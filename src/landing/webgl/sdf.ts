/**
 * Cyber-Shield signed distance field, defined once and used three ways:
 *  - `SHIELD_SDF_GLSL` in the simulation shader (pull-to-surface force),
 *  - `SHIELD_SDF_GLSL` in the particle vertex shader (surface normal for shading),
 *  - `shieldSdf()` on the CPU (rejection-sampling the particle home positions).
 *
 * Shape: a six-sided heraldic outline (crown, two shoulders, two flanks, tip), domed toward the
 * viewer, with a smooth front/back mirror seam and an open elliptical core.
 */

/** Right half of the outline, clockwise from the crown. The left half is its mirror image. */
const OUTLINE: readonly (readonly [number, number])[] = [
  [0.0, 0.7],
  [0.55, 0.47],
  [0.55, -0.15],
  [0.0, -0.74],
];
const CORNER_RADIUS = 0.07;
const DOME = 0.26;
const DOME_OFFSET = 0.06;
const SEAM = 0.02;
const SEAM_BIAS = Math.sqrt(0.012);
const HALF_THICKNESS = 0.12;
const CORE_SCALE: readonly [number, number] = [1.1, 0.9];
const CORE_RADIUS = 0.28;

/** Axis-aligned box that contains the whole solid; used for rejection sampling. */
export const SHIELD_BOUNDS = {
  min: [-0.64, -0.83, -0.24] as const,
  max: [0.64, 0.79, 0.28] as const,
};

function segment(px: number, py: number, a: readonly [number, number], b: readonly [number, number]): [number, number] {
  const pax = px - a[0];
  const pay = py - a[1];
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return [Math.sqrt(dx * dx + dy * dy), bax * pay - bay * pax];
}

function outline(x: number, y: number): number {
  const px = Math.abs(x);
  let dist = Infinity;
  let inside = true;
  for (let i = 0; i < OUTLINE.length - 1; i++) {
    const [d, side] = segment(px, y, OUTLINE[i]!, OUTLINE[i + 1]!);
    if (d < dist) dist = d;
    if (side > 0) inside = false;
  }
  return (inside ? -dist : dist) - CORNER_RADIUS;
}

/** CPU mirror of `sdShield` in the GLSL chunk below. Negative inside the solid. */
export function shieldSdf(x: number, y: number, z: number): number {
  let pz = z + DOME * (x * x + y * y) - DOME_OFFSET;
  pz = Math.sqrt(pz * pz + SEAM) - SEAM_BIAS;
  const shieldDist = Math.max(outline(x, y), Math.abs(pz) - HALF_THICKNESS);
  const cx = x * CORE_SCALE[0];
  const cy = y * CORE_SCALE[1];
  const innerHole = Math.sqrt(cx * cx + cy * cy) - CORE_RADIUS;
  return Math.max(shieldDist, -innerHole);
}

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const v2 = (p: readonly [number, number]): string => `vec2(${f(p[0])}, ${f(p[1])})`;

export const SHIELD_SDF_GLSL = /* glsl */ `
float sdOutlineEdge(vec2 p, vec2 a, vec2 b, inout float inside) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  if (ba.x * pa.y - ba.y * pa.x > 0.0) inside = 0.0;
  return length(pa - ba * h);
}

float sdOutline(vec2 p) {
  p.x = abs(p.x);
  float inside = 1.0;
  float d = sdOutlineEdge(p, ${v2(OUTLINE[0]!)}, ${v2(OUTLINE[1]!)}, inside);
  d = min(d, sdOutlineEdge(p, ${v2(OUTLINE[1]!)}, ${v2(OUTLINE[2]!)}, inside));
  d = min(d, sdOutlineEdge(p, ${v2(OUTLINE[2]!)}, ${v2(OUTLINE[3]!)}, inside));
  return mix(d, -d, inside) - ${f(CORNER_RADIUS)};
}

float sdShield(vec3 pos) {
  vec3 p = pos;
  p.z += ${f(DOME)} * dot(p.xy, p.xy) - ${f(DOME_OFFSET)};
  p.z = sqrt(p.z * p.z + ${f(SEAM)}) - sqrt(0.012);
  float shieldDist = max(sdOutline(p.xy), abs(p.z) - ${f(HALF_THICKNESS)});
  float innerHole = length(p.xy * ${v2(CORE_SCALE)}) - ${f(CORE_RADIUS)};
  return max(shieldDist, -innerHole);
}

vec3 shieldGradient(vec3 p) {
  const vec2 e = vec2(0.004, 0.0);
  return vec3(
    sdShield(p + e.xyy) - sdShield(p - e.xyy),
    sdShield(p + e.yxy) - sdShield(p - e.yxy),
    sdShield(p + e.yyx) - sdShield(p - e.yyx)
  ) / (2.0 * e.x);
}
`;
