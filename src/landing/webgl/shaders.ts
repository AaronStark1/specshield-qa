import { SCENE_SDF_GLSL } from "./sdf.ts";

const HEADER = /* glsl */ `precision highp float;
precision highp sampler2D;
`;

/** Full-screen triangle; every simulation pass shares it. */
export const PASS_VERT = /* glsl */ `${HEADER}
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* ── Particle simulation ─────────────────────────────────────────────────── */

/**
 * Projects CPU-sampled interior points onto the surface of the shape selected by `uShapeIndex`
 * (run a few times per shape; `uMorphProgress` stays at 1 so no blending happens).
 */
export const BAKE_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uSource;
in vec2 vUv;
out vec4 outColor;
${SCENE_SDF_GLSL}
void main() {
  vec4 src = texture(uSource, vUv);
  vec3 p = src.xyz;
  p -= sceneGradient(p) * sdScene(p) * 0.7;
  outColor = vec4(p, src.w);
}
`;

/** Initial positions: every particle starts scattered around its home and converges during the intro. */
export const SEED_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uOrigin;
uniform float uScatter;
in vec2 vUv;
out vec4 outColor;

vec3 hash3(vec2 p) {
  vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)));
  return fract(sin(q) * 43758.5453);
}

void main() {
  vec4 origin = texture(uOrigin, vUv);
  vec3 h = hash3(vUv * 913.7 + origin.w);
  float theta = h.x * 6.2831853;
  float cosPhi = h.y * 2.0 - 1.0;
  float sinPhi = sqrt(1.0 - cosPhi * cosPhi);
  vec3 dir = vec3(sinPhi * cos(theta), sinPhi * sin(theta), cosPhi);
  vec3 p = origin.xyz * (1.0 + uScatter * 0.6) + dir * uScatter * (0.25 + 1.6 * h.z * h.z);
  outColor = vec4(p, origin.w);
}
`;

export const SIM_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uPos;
uniform sampler2D uOrigin;
uniform sampler2D uOriginPrevious;
uniform sampler2D uFluidVelocity;
uniform sampler2D uFluidDensity;
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uAspect;
uniform float uHz;
uniform float uStep;
uniform float uForm;
uniform float uFluid;
in vec2 vUv;
out vec4 outColor;
${SCENE_SDF_GLSL}
void main() {
  vec4 current = texture(uPos, vUv);
  vec4 origin = texture(uOrigin, vUv);
  // While morphing, each particle's home travels from its place on the old shape to its place on
  // the new one. The transit factor peaks mid-morph: the surface pull lets go and the spring takes over, so
  // the swarm flies across instead of crawling along a half-blended surface.
  float transit = 0.0;
  if (uMorphProgress < 1.0) {
    origin.xyz = mix(texture(uOriginPrevious, vUv).xyz, origin.xyz, uMorphProgress);
    transit = sin(3.14159265 * uMorphProgress);
  }
  vec3 pos = current.xyz;

  // Fluid sample: project the particle to the screen and read the cursor-driven velocity field.
  vec4 clip = uViewProj * vec4(pos, 1.0);
  vec2 screenUv = clip.xy / clip.w * 0.5 + 0.5;
  vec2 flow = texture(uFluidVelocity, screenUv).xy * vec2(uAspect, 1.0);
  float density = texture(uFluidDensity, screenUv).r * uFluid;
  float wake = clamp(density, 0.0, 1.0);

  // Pull toward the shape's surface. Inside the cursor wake the pull relaxes so particles can
  // be carried off the surface, then it tightens again as the dye fades.
  float sdf = sdScene(pos);
  vec3 gradient = sceneGradient(pos);
  float pull = (1.0 - pow(0.5, uStep)) * uForm * (1.0 - 0.9 * wake) * (1.0 - 0.92 * transit);
  pos += -gradient * sdf * pull;

  // Surface curl: a slow tangential swirl around the shape.
  vec3 radial = pos / max(length(pos), 1e-4);
  vec3 normal = gradient / max(length(gradient), 1e-4);
  pos += cross(radial, normal) * 0.0006 * uStep * uForm;

  // Spring back to the home position.
  // 0.0002 * HZ per frame, with a healing boost so a swept area refills within about two seconds.
  float spring = 0.0002 * uHz * uStep * mix(2.4, 1.6, uForm) * (1.0 + 5.0 * transit);
  pos += (origin.xyz - pos) * min(spring, 1.0);

  // Advect along the fluid, in the camera plane, with a little depth turbulence.
  vec3 push = uCamRight * flow.x + uCamUp * flow.y;
  push += uCamForward * (origin.w - 0.5) * length(flow) * 0.8;
  pos += push * 0.00015 * uHz * uStep * density;

  outColor = vec4(pos, current.w);
}
`;

/* ── Particle rendering ──────────────────────────────────────────────────── */

export const POINTS_VERT = /* glsl */ `${HEADER}
in vec3 position;
in vec3 aRandom;
uniform sampler2D uPos;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uPointScale;
uniform float uTime;
uniform float uOpacity;
out vec3 vColor;
out float vAlpha;
${SCENE_SDF_GLSL}
void main() {
  vec3 pos = texture(uPos, position.xy).xyz;
  vec4 viewPos = uView * vec4(pos, 1.0);
  gl_Position = uProjection * viewPos;

  float sdf = sdScene(pos);
  vec3 gradient = sceneGradient(pos);
  vec3 normal = mat3(uView) * (gradient / max(length(gradient), 1e-4));

  // Matcap-style lighting from the view-space normal: key light upper-left, cool rim.
  float key = clamp(dot(normal, normalize(vec3(-0.5, 0.62, 0.6))), 0.0, 1.0);
  float rim = pow(1.0 - clamp(abs(normal.z), 0.0, 1.0), 2.0);
  float facing = smoothstep(-0.35, 0.4, normal.z);

  vec3 deep = vec3(0.020, 0.588, 0.412);   // #059669
  vec3 mint = vec3(0.204, 0.827, 0.600);   // #34d399
  vec3 spark = vec3(0.86, 1.0, 0.98);      // white-cyan highlight
  float light = clamp(key * 0.85 + rim * 0.45, 0.0, 1.0);
  vec3 color = mix(deep * 0.55, mint, smoothstep(0.08, 0.95, light));

  float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + aRandom.x * 2.4) + aRandom.y * 6.2831853);
  float sparkle = pow(aRandom.z, 80.0) * twinkle;
  color = mix(color, spark, clamp(sparkle * 1.6, 0.0, 1.0));

  // Particles lifted off the surface by the fluid run hotter and fade with distance.
  float lifted = smoothstep(0.03, 0.4, abs(sdf));
  color = mix(color, mix(mint, spark, 0.35), lifted * 0.6);

  float size = mix(0.7, 1.9, aRandom.x * aRandom.x) + sparkle * 1.8;
  gl_PointSize = max(1.0, size * uPointScale / -viewPos.z);

  vAlpha = uOpacity * mix(0.16, 1.0, facing) * (0.42 + 0.58 * light + sparkle * 1.4) * (1.0 - 0.45 * lifted);
  vColor = color;
}
`;

export const POINTS_FRAG = /* glsl */ `${HEADER}
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  // Shade each point as a small lit sphere with a soft edge.
  vec3 n = vec3(c.x, -c.y, sqrt(1.0 - r2));
  float lambert = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(-0.4, 0.55, 0.73))), 0.0, 1.0);
  float glint = pow(clamp(dot(n, normalize(vec3(-0.3, 0.45, 0.84))), 0.0, 1.0), 12.0);
  float soft = smoothstep(1.0, 0.15, r2);
  outColor = vec4(vColor * lambert + vec3(glint) * 0.35, vAlpha * soft);
}
`;

/* ── Fluid solver ────────────────────────────────────────────────────────── */

export const FLUID_SPLAT_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  vec3 splat = exp(-dot(d, d) / uRadius) * uValue;
  outColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
}
`;

export const FLUID_ADVECT_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uDissipation;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy;
  outColor = vec4(uDissipation * texture(uSource, coord).xyz, 1.0);
}
`;

export const FLUID_DIVERGENCE_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

export const FLUID_PRESSURE_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + b + t - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

export const FLUID_GRADIENT_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy - 0.5 * vec2(r - l, t - b);
  outColor = vec4(velocity, 0.0, 1.0);
}
`;

export const FLUID_SCALE_FRAG = /* glsl */ `${HEADER}
uniform sampler2D uSource;
uniform float uScale;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = uScale * texture(uSource, vUv);
}
`;
