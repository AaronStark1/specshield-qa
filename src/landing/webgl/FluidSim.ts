import { HalfFloatType, LinearFilter, Vector2, Vector3, type RawShaderMaterial, type Texture } from "three";
import { PassRunner, PingPong, createTarget, passMaterial } from "./passes.ts";
import {
  FLUID_ADVECT_FRAG,
  FLUID_DIVERGENCE_FRAG,
  FLUID_GRADIENT_FRAG,
  FLUID_PRESSURE_FRAG,
  FLUID_SCALE_FRAG,
  FLUID_SPLAT_FRAG,
} from "./shaders.ts";

const VELOCITY_SIZE = 256;
const DENSITY_SIZE = 512;
const PRESSURE_ITERATIONS = 16;
/** Per-second decay rates: the wake is gone roughly two seconds after the cursor stops. */
const VELOCITY_DECAY = 2.1;
const DENSITY_DECAY = 1.5;
const PRESSURE_CARRYOVER = 0.8;
/** Fluid velocity gained per unit of cursor velocity (both in UV per second). */
const SPLAT_FORCE = 0.9;
const SPLAT_RADIUS = 0.0032;
const DENSITY_PER_SPEED = 1.6;
const DENSITY_MAX = 1.4;

/**
 * Screen-space stable-fluids solver on half-float targets: splat → advect → project → advect dye.
 * Velocity is stored in UV per second, so advection needs no aspect correction; consumers convert
 * to screen-isotropic units themselves.
 */
export class FluidSim {
  private readonly velocity = new PingPong(VELOCITY_SIZE, HalfFloatType, LinearFilter);
  private readonly density = new PingPong(DENSITY_SIZE, HalfFloatType, LinearFilter);
  private readonly pressure = new PingPong(VELOCITY_SIZE, HalfFloatType, LinearFilter);
  private readonly divergence = createTarget(VELOCITY_SIZE, HalfFloatType, LinearFilter);

  private readonly splat: RawShaderMaterial;
  private readonly advect: RawShaderMaterial;
  private readonly divergencePass: RawShaderMaterial;
  private readonly pressurePass: RawShaderMaterial;
  private readonly gradientPass: RawShaderMaterial;
  private readonly scalePass: RawShaderMaterial;

  private aspect = 1;

  constructor(private readonly runner: PassRunner) {
    const texel = new Vector2(1 / VELOCITY_SIZE, 1 / VELOCITY_SIZE);
    this.splat = passMaterial(FLUID_SPLAT_FRAG, {
      uTarget: { value: null },
      uPoint: { value: new Vector2() },
      uValue: { value: new Vector3() },
      uRadius: { value: SPLAT_RADIUS },
      uAspect: { value: 1 },
    });
    this.advect = passMaterial(FLUID_ADVECT_FRAG, {
      uVelocity: { value: null },
      uSource: { value: null },
      uDt: { value: 0 },
      uDissipation: { value: 1 },
    });
    this.divergencePass = passMaterial(FLUID_DIVERGENCE_FRAG, { uVelocity: { value: null }, uTexel: { value: texel } });
    this.pressurePass = passMaterial(FLUID_PRESSURE_FRAG, {
      uPressure: { value: null },
      uDivergence: { value: null },
      uTexel: { value: texel },
    });
    this.gradientPass = passMaterial(FLUID_GRADIENT_FRAG, {
      uPressure: { value: null },
      uVelocity: { value: null },
      uTexel: { value: texel },
    });
    this.scalePass = passMaterial(FLUID_SCALE_FRAG, { uSource: { value: null }, uScale: { value: 1 } });
  }

  get velocityTexture(): Texture {
    return this.velocity.read.texture;
  }

  get densityTexture(): Texture {
    return this.density.read.texture;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
  }

  /**
   * Injects a directional impulse at `point` (UV). `delta` is the cursor travel in UV since the
   * previous sample and `dt` the time it took, so the impulse scales with cursor velocity.
   */
  addImpulse(point: Vector2, delta: Vector2, dt: number): void {
    const seconds = Math.max(dt, 1 / 240);
    const travel = Math.hypot(delta.x * this.aspect, delta.y);
    const speed = travel / seconds;
    // Overlapping splats from a slow cursor would otherwise stack into a jet: weight each one by
    // how much fresh ground it covers.
    const coverage = Math.min(1, travel / Math.sqrt(SPLAT_RADIUS));
    const vx = (delta.x / seconds) * SPLAT_FORCE * coverage;
    const vy = (delta.y / seconds) * SPLAT_FORCE * coverage;
    const u = this.splat.uniforms;
    (u.uPoint!.value as Vector2).copy(point);
    u.uAspect!.value = this.aspect;

    u.uTarget!.value = this.velocity.read.texture;
    (u.uValue!.value as Vector3).set(vx, vy, 0);
    u.uRadius!.value = SPLAT_RADIUS;
    this.runner.run(this.splat, this.velocity.write);
    this.velocity.swap();

    u.uTarget!.value = this.density.read.texture;
    (u.uValue!.value as Vector3).set(Math.min(DENSITY_MAX, speed * DENSITY_PER_SPEED) * coverage, 0, 0);
    u.uRadius!.value = SPLAT_RADIUS * 1.6;
    this.runner.run(this.splat, this.density.write);
    this.density.swap();
  }

  step(dt: number): void {
    const advect = this.advect.uniforms;
    advect.uDt!.value = dt;

    advect.uVelocity!.value = this.velocity.read.texture;
    advect.uSource!.value = this.velocity.read.texture;
    advect.uDissipation!.value = Math.exp(-VELOCITY_DECAY * dt);
    this.runner.run(this.advect, this.velocity.write);
    this.velocity.swap();

    this.divergencePass.uniforms.uVelocity!.value = this.velocity.read.texture;
    this.runner.run(this.divergencePass, this.divergence);

    this.scalePass.uniforms.uSource!.value = this.pressure.read.texture;
    this.scalePass.uniforms.uScale!.value = PRESSURE_CARRYOVER;
    this.runner.run(this.scalePass, this.pressure.write);
    this.pressure.swap();

    this.pressurePass.uniforms.uDivergence!.value = this.divergence.texture;
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.pressurePass.uniforms.uPressure!.value = this.pressure.read.texture;
      this.runner.run(this.pressurePass, this.pressure.write);
      this.pressure.swap();
    }

    this.gradientPass.uniforms.uPressure!.value = this.pressure.read.texture;
    this.gradientPass.uniforms.uVelocity!.value = this.velocity.read.texture;
    this.runner.run(this.gradientPass, this.velocity.write);
    this.velocity.swap();

    advect.uVelocity!.value = this.velocity.read.texture;
    advect.uSource!.value = this.density.read.texture;
    advect.uDissipation!.value = Math.exp(-DENSITY_DECAY * dt);
    this.runner.run(this.advect, this.density.write);
    this.density.swap();
  }

  dispose(): void {
    this.velocity.dispose();
    this.density.dispose();
    this.pressure.dispose();
    this.divergence.dispose();
    for (const material of [this.splat, this.advect, this.divergencePass, this.pressurePass, this.gradientPass, this.scalePass]) {
      material.dispose();
    }
  }
}
