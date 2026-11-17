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
import { SHAPES, sampleShapeInterior, type ShapeIndex } from "./sdf.ts";
import { BAKE_FRAG, POINTS_FRAG, POINTS_VERT, SEED_FRAG, SIM_FRAG } from "./shaders.ts";

const CAMERA_FOV = 30;
const CAMERA_BASE = new Vector3(-0.85, 0, 4.2);
/** World-space width that must stay visible so the widest shape never clips on narrow screens. */
const MIN_VISIBLE_WIDTH = 1.95;
/** Nominal refresh rate the force constants are expressed against. */
const HZ = 60;
const BAKE_ITERATIONS = 14;
const INTRO_DELAY = 0.35;
const INTRO_DURATION = 2.2;
const MAX_IMPULSES_PER_FRAME = 12;
const MORPH_SECONDS = 1.9;
/** Seconds after start-up at which the shapes that are not yet baked get prepared, one per frame. */
const PREWARM_AFTER = 3.2;
/** A pointer sample older than this starts a new stroke instead of extending the last one. */
const STROKE_TIMEOUT_MS = 120;

export interface ShieldLayout {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  /** Where the shape sits in the hero, as a fraction of the viewport away from the centre (x right, y up). */
  offsetX: number;
  offsetY: number;
  /** Where it sits once the page has scrolled past the hero and the field is a backdrop. */
  ambientOffsetX: number;
  ambientOffsetY: number;
  /** How much of its brightness the field keeps as a backdrop (lower where text sits directly over it). */
  ambientOpacity: number;
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

/**
 * GPGPU particle field. Particle positions live in a float texture that is advanced every frame
 * by a fragment shader (SDF pull, surface swirl, home spring, fluid advection) and drawn as
 * additive points. The fluid is a separate screen-space solver driven by pointer movement.
 * The field can morph between the shapes in `SHAPES`: each has its own baked home texture, and a
 * morph blends both the distance fields and the homes.
 */
export class ShieldField {
  readonly particleCount: number;

  private readonly renderer: WebGLRenderer;
  private readonly runner: PassRunner;
  private readonly fluid: FluidSim;
  private readonly positions: PingPong;
  private readonly origins: (WebGLRenderTarget | null)[] = SHAPES.map(() => null);
  private readonly bake: RawShaderMaterial;
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
  private readonly textureSize: number;
  private readonly positionType: TextureDataType;

  private shape: ShapeIndex = 0;
  private previousShape: ShapeIndex = 0;
  private queuedShape: ShapeIndex | null = null;
  private morph = 1;
  private prewarmIndex = 1;
  private ambient = 0;
  private ambientTarget = 0;

  private layout: ShieldLayout = { width: 1, height: 1, pixelRatio: 1, offsetX: 0, offsetY: 0, ambientOffsetX: 0, ambientOffsetY: 0, ambientOpacity: 1 };
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
    this.textureSize = textureSize;
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

    this.positionType = positionType;

    this.bake = passMaterial(BAKE_FRAG, {
      uSource: { value: null },
      uShapeIndex: { value: 0 },
      uShapePrevious: { value: 0 },
      uMorphProgress: { value: 1 },
    });
    this.runner = new PassRunner(this.renderer, this.bake);
    const home = this.homeOf(0);

    // Seed: start every particle scattered around its home; the intro pulls the cloud together.
    this.positions = new PingPong(textureSize, positionType, NearestFilter);
    const seed = passMaterial(SEED_FRAG, { uOrigin: { value: home.texture }, uScatter: { value: 1.35 } });
    this.runner.run(seed, this.positions.read);
    seed.dispose();

    this.fluid = new FluidSim(this.runner);

    this.simulate = passMaterial(SIM_FRAG, {
      uPos: { value: null },
      uOrigin: { value: home.texture },
      uOriginPrevious: { value: home.texture },
      uShapeIndex: { value: 0 },
      uShapePrevious: { value: 0 },
      uMorphProgress: { value: 1 },
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
    const random = mulberry32(0xa11ce);
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
        uShapeIndex: { value: 0 },
        uShapePrevious: { value: 0 },
        uMorphProgress: { value: 1 },
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
    this.applyViewOffset();

    this.fluid.setAspect(aspect);
    this.simulate.uniforms.uAspect!.value = aspect;
    // Point sizes are tuned for a 1080-pixel-tall viewport and scale with the drawing buffer.
    this.pointsMaterial.uniforms.uPointScale!.value =
      2.6 * this.pointSizeBoost * baseDistance * ((height * pixelRatio) / 1080) * Math.sqrt(1 / this.cameraDistanceScale);

    if (!this.running && !this.disposed) this.renderFrame(0);
  }

  /** The shape currently shown, or being formed. */
  get currentShape(): ShapeIndex {
    return this.queuedShape ?? this.shape;
  }

  /** Morphs the field into another shape. A request made mid-morph is queued until the morph lands. */
  setShape(next: ShapeIndex): void {
    if (this.morph < 1) {
      this.queuedShape = next === this.shape ? null : next;
      return;
    }
    this.beginMorph(next);
  }

  /** 0 while the hero owns the field, 1 once it has become the dimmed backdrop behind the page. */
  setAmbient(amount: number): void {
    this.ambientTarget = Math.min(1, Math.max(0, amount));
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
    for (const origin of this.origins) origin?.dispose();
    this.bake.dispose();
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

  /** Home positions for a shape: interior samples slid onto its surface by the bake pass. Baked once. */
  private homeOf(shape: ShapeIndex): WebGLRenderTarget {
    const existing = this.origins[shape];
    if (existing) return existing;

    const data = sampleShapeInterior(shape, this.particleCount, mulberry32(0x5eed5 + shape * 977));
    const interior = new DataTexture(data, this.textureSize, this.textureSize, RGBAFormat, FloatType);
    interior.minFilter = NearestFilter;
    interior.magFilter = NearestFilter;
    interior.needsUpdate = true;

    const uniforms = this.bake.uniforms;
    uniforms.uSource!.value = interior;
    uniforms.uShapeIndex!.value = shape;
    uniforms.uShapePrevious!.value = shape;
    const baked = new PingPong(this.textureSize, this.positionType, NearestFilter);
    for (let i = 0; i < BAKE_ITERATIONS; i++) {
      this.runner.run(this.bake, baked.write);
      baked.swap();
      uniforms.uSource!.value = baked.read.texture;
    }
    uniforms.uSource!.value = null;
    baked.write.dispose();
    interior.dispose();
    this.origins[shape] = baked.read;
    return baked.read;
  }

  private beginMorph(next: ShapeIndex): void {
    if (next === this.shape) return;
    this.homeOf(next);
    this.previousShape = this.shape;
    this.shape = next;
    this.morph = 0;
  }

  private advanceMorph(dt: number): void {
    if (this.morph < 1) {
      this.morph = Math.min(1, this.morph + dt / MORPH_SECONDS);
      if (this.morph >= 1) {
        this.previousShape = this.shape;
        const queued = this.queuedShape;
        this.queuedShape = null;
        if (queued !== null) this.beginMorph(queued);
      }
    } else if (this.elapsed > PREWARM_AFTER && this.prewarmIndex < SHAPES.length) {
      // Bake the remaining shapes during idle frames so the first morph does not hitch.
      this.homeOf(this.prewarmIndex as ShapeIndex);
      this.prewarmIndex += 1;
    }
  }

  private applyViewOffset(): void {
    const { width, height, offsetX, offsetY, ambientOffsetX, ambientOffsetY } = this.layout;
    const x = offsetX + (ambientOffsetX - offsetX) * this.ambient;
    const y = offsetY + (ambientOffsetY - offsetY) * this.ambient;
    this.camera.setViewOffset(width, height, -x * width, y * height, width, height);
    this.camera.updateProjectionMatrix();
  }

  private updateCamera(dt: number): void {
    const ease = 1 - Math.exp(-dt * 2.4);
    this.gaze.lerp(this.gazeTarget, ease);
    if (Math.abs(this.ambientTarget - this.ambient) > 1e-4) {
      this.ambient += (this.ambientTarget - this.ambient) * (1 - Math.exp(-dt * 5));
      this.applyViewOffset();
    }
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
      this.advanceMorph(dt);
      const eased = this.morph * this.morph * (3 - 2 * this.morph);
      for (const uniforms of [this.simulate.uniforms, this.pointsMaterial.uniforms]) {
        uniforms.uShapeIndex!.value = this.shape;
        uniforms.uShapePrevious!.value = this.previousShape;
        uniforms.uMorphProgress!.value = eased;
      }
      this.simulate.uniforms.uOrigin!.value = this.homeOf(this.shape).texture;
      this.simulate.uniforms.uOriginPrevious!.value = this.homeOf(this.previousShape).texture;

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
    const dim = 1 + (this.layout.ambientOpacity - 1) * this.ambient;
    draw.uOpacity!.value = 0.5 * this.opacityBoost * Math.min(1, this.elapsed / 1.2) * dim;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
