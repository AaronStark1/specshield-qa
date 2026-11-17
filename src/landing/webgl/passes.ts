import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  GLSL3,
  Mesh,
  NoBlending,
  OrthographicCamera,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  WebGLRenderTarget,
  type IUniform,
  type MagnificationTextureFilter,
  type TextureDataType,
  type WebGLRenderer,
} from "three";
import { PASS_VERT } from "./shaders.ts";

export type Uniforms = Record<string, IUniform>;

/** Creates a fragment-only material for a full-screen simulation pass. */
export function passMaterial(fragmentShader: string, uniforms: Uniforms): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: PASS_VERT,
    fragmentShader,
    uniforms,
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
  });
}

export function createTarget(size: number, type: TextureDataType, filter: MagnificationTextureFilter): WebGLRenderTarget {
  return new WebGLRenderTarget(size, size, {
    type,
    format: RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

/** Two render targets that swap roles after every write. */
export class PingPong {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;

  constructor(size: number, type: TextureDataType, filter: MagnificationTextureFilter) {
    this.read = createTarget(size, type, filter);
    this.write = createTarget(size, type, filter);
  }

  swap(): void {
    const previous = this.read;
    this.read = this.write;
    this.write = previous;
  }

  dispose(): void {
    this.read.dispose();
    this.write.dispose();
  }
}

/** Renders full-screen passes into render targets with a single shared triangle. */
export class PassRunner {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: Mesh<BufferGeometry, RawShaderMaterial>;
  private readonly geometry = new BufferGeometry();

  constructor(private readonly renderer: WebGLRenderer, placeholder: RawShaderMaterial) {
    this.geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new Mesh(this.geometry, placeholder);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  run(material: RawShaderMaterial, target: WebGLRenderTarget): void {
    this.mesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
