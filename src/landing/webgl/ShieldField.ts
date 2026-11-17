import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  GLSL3,
  HalfFloatType,
  Matrix4,
  NearestFilter,
  PerspectiveCamera,
  Points,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type TextureDataType,
  type WebGLRenderTarget,
} from "three";
import { FluidSim } from "./FluidSim.ts";
import { PassRunner, PingPong, passMaterial } from "./passes.ts";
import { SHIELD_BOUNDS, shieldSdf } from "./sdf.ts";
import { BAKE_FRAG, POINTS_FRAG, POINTS_VERT, SEED_FRAG, SIM_FRAG } from "./shaders.ts";

const CAMERA_FOV = 30;
const CAMERA_BASE = new Vector3(-1.17, 0, 6);
/** World-space width that must stay visible so the shield never clips on narrow screens. */
const MIN_VISIBLE_WIDTH = 1.85;
/** Nominal refresh rate the force constants are expressed against. */
const HZ = 60;
const BAKE_ITERATIONS = 14;
const INTRO_DELAY = 0.35;
const INTRO_DURATION = 2.2;
const MAX_IMPULSES_PER_FRAME = 12;
/** A pointer sample older than this starts a new stroke instead of extending the last one. */
const STROKE_TIMEOUT_MS = 120;

export interface ShieldLayout {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  /** Where the shield sits, as a fraction of the viewport away from the centre (x right, y up). */
  offsetX: number;
  offsetY: number;
}

interface Impulse {
  point: Vector2;
  delta: Vector2;
  dt: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniformly samples points inside the shield solid; the GPU bake then projects them onto its surface. */
function sampleInterior(count: number, random: () => number): Float32Array {
  const data = new Float32Array(count * 4);
  const { min, max } = SHIELD_BOUNDS;
  let written = 0;
  while (written < count) {
    const x = min[0] + random() * (max[0] - min[0]);
    const y = min[1] + random() * (max[1] - min[1]);
    const z = min[2] + random() * (max[2] - min[2]);
    if (shieldSdf(x, y, z) > 0) continue;
    const i = written * 4;
    data[i] = x;
    data[i + 1] = y;
    data[i + 2] = z;
    data[i + 3] = random();
    written += 1;
  }
  return data;
}

/**
 * GPGPU particle shield. Particle positions live in a float texture that is advanced every frame
 * by a fragment shader (SDF pull, surface swirl, home spring, fluid advection) and drawn as
 * additive points. The fluid is a separate screen-space solver driven by pointer movement.
 */
export class ShieldField {
  readonly particleCount: number;

  private readonly renderer: WebGLRenderer;
  private readonly runner: PassRunner;
  private readonly fluid: FluidSim;
  private readonly positions: PingPong;
  private readonly origin: WebGLRenderTarget;
  private readonly simulate: RawShaderMaterial;
  private readonly pointsMaterial: RawShaderMaterial;
  private readonly pointsGeometry = new BufferGeometry();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 60);
  private readonly viewProjection = new Matrix4();
  private readonly cameraRight = new Vector3();
  private readonly cameraUp = new Vector3();
  private readonly cameraForward = new Vector3();

  private readonly gaze = new Vector2();
  private readonly gazeTarget = new Vector2();
  private readonly impulses: Impulse[] = [];
  private lastPointer: { uv: Vector2; time: number } | null = null;

  private readonly pointSizeBoost: number;
  private readonly opacityBoost: number;
  private layout: ShieldLayout = { width: 1, height: 1, pixelRatio: 1, offsetX: 0, offsetY: 0 };
  private cameraDistanceScale = 1;
  private frameHandle = 0;
  private lastFrameTime = 0;
  private elapsed = 0;
  private running = false;
  private disposed = false;

  /** Throws when the browser cannot provide WebGL2 with a renderable float format. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    textureSize: number,
    private readonly onContextLost?: () => void,
  ) {
    this.particleCount = textureSize * textureSize;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);

    let positionType: TextureDataType;
    if (this.renderer.extensions.has("EXT_color_buffer_float")) positionType = FloatType;
    else if (this.renderer.extensions.has("EXT_color_buffer_half_float")) positionType = HalfFloatType;
    else {
      this.renderer.dispose();
      throw new Error("Float render targets are not supported");
    }

    const random = mulberry32(0x5eed5);
    const interior = new DataTexture(sampleInterior(this.particleCount, random), textureSize, textureSize, RGBAFormat, FloatType);
    interior.minFilter = NearestFilter;
    interior.magFilter = NearestFilter;
    interior.needsUpdate = true;

    // Bake: slide the interior samples onto the surface so every particle has a home on the shield.
    const bake = passMaterial(BAKE_FRAG, { uSource: { value: interior } });
    this.runner = new PassRunner(this.renderer, bake);
    const baked = new PingPong(textureSize, positionType, NearestFilter);
    for (let i = 0; i < BAKE_ITERATIONS; i++) {
      this.runner.run(bake, baked.write);
      baked.swap();
      bake.uniforms.uSource!.value = baked.read.texture;
    }
    this.origin = baked.read;
    baked.write.dispose();
    bake.dispose();
    interior.dispose();

    // Seed: start every particle scattered around its home; the intro pulls the cloud together.
    this.positions = new PingPong(textureSize, positionType, NearestFilter);
    const seed = passMaterial(SEED_FRAG, { uOrigin: { value: this.origin.texture }, uScatter: { value: 1.35 } });
    this.runner.run(seed, this.positions.read);
    seed.dispose();

    this.fluid = new FluidSim(this.runner);

    this.simulate = passMaterial(SIM_FRAG, {
      uPos: { value: null },
      uOrigin: { value: this.origin.texture },
      uFluidVelocity: { value: null },
      uFluidDensity: { value: null },
      uViewProj: { value: this.viewProjection },
      uCamRight: { value: this.cameraRight },
      uCamUp: { value: this.cameraUp },
      uCamForward: { value: this.cameraForward },
      uAspect: { value: 1 },
      uHz: { value: HZ },
      uStep: { value: 1 },
      uForm: { value: 0 },
      uFluid: { value: 1 },
    });

    // One vertex per particle: `position.xy` is the particle's texel in the position texture.
    const refs = new Float32Array(this.particleCount * 3);
    const randoms = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      refs[i * 3] = ((i % textureSize) + 0.5) / textureSize;
      refs[i * 3 + 1] = (Math.floor(i / textureSize) + 0.5) / textureSize;
      randoms[i * 3] = random();
      randoms[i * 3 + 1] = random();
      randoms[i * 3 + 2] = random();
    }
    this.pointsGeometry.setAttribute("position", new BufferAttribute(refs, 3));
    this.pointsGeometry.setAttribute("aRandom", new BufferAttribute(randoms, 3));

    // Fewer particles are drawn larger and brighter so every tier covers the shield evenly.
    const density = 512 / textureSize;
    this.pointsMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      uniforms: {
        uPos: { value: null },
        uView: { value: this.camera.matrixWorldInverse },
        uProjection: { value: this.camera.projectionMatrix },
        uPointScale: { value: 1 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      blending: AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.pointSizeBoost = Math.pow(density, 0.75);
    this.opacityBoost = Math.pow(density, 0.3);

    const points = new Points(this.pointsGeometry, this.pointsMaterial);
    points.frustumCulled = false;
    this.scene.add(points);

    canvas.addEventListener("webglcontextlost", this.handleContextLost);
  }

  setLayout(layout: ShieldLayout): void {
    this.layout = layout;
    const { width, height, pixelRatio } = layout;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    this.camera.aspect = aspect;
    const baseDistance = CAMERA_BASE.length();
    const visibleWidth = 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * baseDistance * aspect;
    this.cameraDistanceScale = Math.max(1, MIN_VISIBLE_WIDTH / visibleWidth);
    this.camera.setViewOffset(width, height, -layout.offsetX * width, layout.offsetY * height, width, height);
    this.camera.updateProjectionMatrix();

    this.fluid.setAspect(aspect);
    this.simulate.uniforms.uAspect!.value = aspect;
    // Point sizes are tuned for a 1080-pixel-tall viewport and scale with the drawing buffer.
    this.pointsMaterial.uniforms.uPointScale!.value =
      1.9 * this.pointSizeBoost * baseDistance * ((height * pixelRatio) / 1080) * Math.sqrt(1 / this.cameraDistanceScale);

    if (!this.running && !this.disposed) this.renderFrame(0);
  }

  /** Feeds a pointer position in CSS pixels relative to the canvas. Movement becomes fluid impulses. */
  pointer(x: number, y: number, timeMs: number): void {
    const { width, height } = this.layout;
    const uv = new Vector2(x / width, 1 - y / height);
    this.gazeTarget.set(uv.x * 2 - 1, uv.y * 2 - 1).clampScalar(-1, 1);
    const last = this.lastPointer;
    if (last && timeMs - last.time < STROKE_TIMEOUT_MS && timeMs > last.time) {
      const delta = uv.clone().sub(last.uv);
      if (delta.lengthSq() > 1e-9 && this.impulses.length < MAX_IMPULSES_PER_FRAME * 2) {
        this.impulses.push({ point: uv.clone(), delta, dt: (timeMs - last.time) / 1000 });
      }
    }
    this.lastPointer = { uv, time: timeMs };
  }

  /** Ends the current stroke (pointer left the page or the touch lifted). */
  releasePointer(): void {
    this.lastPointer = null;
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrameTime = 0;
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.fluid.dispose();
    this.positions.dispose();
    this.origin.dispose();
    this.simulate.dispose();
    this.pointsMaterial.dispose();
    this.pointsGeometry.dispose();
    this.runner.dispose();
    this.renderer.dispose();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    this.onContextLost?.();
  };

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.frame);
    const dt = this.lastFrameTime === 0 ? 1 / HZ : Math.min(1 / 20, Math.max(1 / 240, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.renderFrame(dt);
  };

  private updateCamera(dt: number): void {
    const ease = 1 - Math.exp(-dt * 2.4);
    this.gaze.lerp(this.gazeTarget, ease);
    const drift = this.elapsed * 0.22;
    this.camera.position
      .copy(CAMERA_BASE)
      .multiplyScalar(this.cameraDistanceScale)
      .add(new Vector3(this.gaze.x * 0.42 + Math.sin(drift) * 0.16, this.gaze.y * 0.26 + Math.cos(drift * 0.8) * 0.07, 0));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.cameraForward.setFromMatrixColumn(this.camera.matrixWorld, 2).negate();
  }

  private renderFrame(dt: number): void {
    this.elapsed += dt;
    this.updateCamera(dt);

    if (dt > 0) {
      const pending = this.impulses.splice(0, MAX_IMPULSES_PER_FRAME);
      for (const impulse of pending) this.fluid.addImpulse(impulse.point, impulse.delta, impulse.dt);
      this.fluid.step(dt);

      const intro = Math.min(1, Math.max(0, (this.elapsed - INTRO_DELAY) / INTRO_DURATION));
      const sim = this.simulate.uniforms;
      sim.uPos!.value = this.positions.read.texture;
      sim.uFluidVelocity!.value = this.fluid.velocityTexture;
      sim.uFluidDensity!.value = this.fluid.densityTexture;
      sim.uStep!.value = dt * HZ;
      sim.uForm!.value = intro * intro * (3 - 2 * intro);
      this.runner.run(this.simulate, this.positions.write);
      this.positions.swap();
    }

    const draw = this.pointsMaterial.uniforms;
    draw.uPos!.value = this.positions.read.texture;
    draw.uTime!.value = this.elapsed;
    draw.uOpacity!.value = 0.5 * this.opacityBoost * Math.min(1, this.elapsed / 1.2);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
