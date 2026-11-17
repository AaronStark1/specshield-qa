/**
 * Signed distance fields for the three hero shapes, one per stage of SpecShield QA:
 *
 *   0  Cyber-Shield            — the privacy boundary around an NDA spec
 *   1  QA Matrix Lattice       — four columns by four rows: test categories against priorities
 *   2  Playwright Prism Check  — a faceted checkmark badge: a green automated run
 *
 * `SCENE_SDF_GLSL` is shared by the simulation shader (pull-to-surface force) and the particle
 * vertex shader (surface normal for shading). `sampleShapeInterior` produces points inside each
 * solid on the CPU; the GPU bake then slides them onto the surface to become particle homes.
 */

export const SHAPES = [
  { id: "shield", label: "Shield", name: "Cyber-Shield" },
  { id: "matrix", label: "Matrix", name: "QA Matrix Lattice" },
  { id: "test", label: "Test", name: "Playwright Prism" },
] as const;

export type ShapeIndex = 0 | 1 | 2;

type Vec2 = readonly [number, number];

/* ── Shape 0: Cyber-Shield ───────────────────────────────────────────────── */

/** Right half of the outline, clockwise from the crown. The left half is its mirror image. */
const OUTLINE: readonly Vec2[] = [
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
const CORE_SCALE: Vec2 = [1.1, 0.9];
const CORE_RADIUS = 0.28;
const SHIELD_MIN = [-0.64, -0.83, -0.24] as const;
const SHIELD_MAX = [0.64, 0.79, 0.28] as const;

/* ── Shape 1: QA Matrix Lattice ──────────────────────────────────────────── */

/** Distance between bar axes. Bars sit at ±0.2 and ±0.6, giving four columns and four rows in two layers. */
const LATTICE_PITCH = 0.4;
const LATTICE_BAR_RADIUS = 0.036;
const LATTICE_NODE_RADIUS = 0.078;
const LATTICE_BOUNDS = [0.75, 0.75, 0.3] as const;
const LATTICE_AXES = [-0.6, -0.2, 0.2, 0.6] as const;
const LATTICE_LAYERS = [-0.2, 0.2] as const;

/* ── Shape 2: Playwright Prism Check ─────────────────────────────────────── */

const CHECK_START: Vec2 = [-0.5, 0.02];
const CHECK_VERTEX: Vec2 = [-0.16, -0.36];
const CHECK_END: Vec2 = [0.52, 0.44];
const CHECK_RADIUS = 0.105;
const CHECK_DEPTH = 0.11;
const CHECK_BEVEL = 0.035;
const RING_RADIUS = 0.8;
const RING_HALF_WIDTH = 0.038;
const RING_DEPTH = 0.07;

/* ── CPU sampling ────────────────────────────────────────────────────────── */

function segmentDistance(px: number, py: number, a: Vec2, b: Vec2): [number, number] {
  const pax = px - a[0];
  const pay = py - a[1];
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return [Math.sqrt(dx * dx + dy * dy), bax * pay - bay * pax];
}

function shieldOutline(x: number, y: number): number {
  const px = Math.abs(x);
  let dist = Infinity;
  let inside = true;
  for (let i = 0; i < OUTLINE.length - 1; i++) {
    const [d, side] = segmentDistance(px, y, OUTLINE[i]!, OUTLINE[i + 1]!);
    if (d < dist) dist = d;
    if (side > 0) inside = false;
  }
  return (inside ? -dist : dist) - CORNER_RADIUS;
}

/** CPU mirror of `sdShield` in the GLSL chunk below. Negative inside the solid. */
function shieldSdf(x: number, y: number, z: number): number {
  let pz = z + DOME * (x * x + y * y) - DOME_OFFSET;
  pz = Math.sqrt(pz * pz + SEAM) - SEAM_BIAS;
  const shieldDist = Math.max(shieldOutline(x, y), Math.abs(pz) - HALF_THICKNESS);
  const cx = x * CORE_SCALE[0];
  const cy = y * CORE_SCALE[1];
  return Math.max(shieldDist, -(Math.sqrt(cx * cx + cy * cy) - CORE_RADIUS));
}

type Writer = (x: number, y: number, z: number) => void;

function sampleShield(count: number, random: () => number, write: Writer): void {
  let written = 0;
  while (written < count) {
    const x = SHIELD_MIN[0] + random() * (SHIELD_MAX[0] - SHIELD_MIN[0]);
    const y = SHIELD_MIN[1] + random() * (SHIELD_MAX[1] - SHIELD_MIN[1]);
    const z = SHIELD_MIN[2] + random() * (SHIELD_MAX[2] - SHIELD_MIN[2]);
    if (shieldSdf(x, y, z) > 0) continue;
    write(x, y, z);
    written += 1;
  }
}

/** The lattice is thin, so its interior is sampled primitive by primitive instead of by rejection. */
function sampleLattice(count: number, random: () => number, write: Writer): void {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const barVolume = Math.PI * LATTICE_BAR_RADIUS * LATTICE_BAR_RADIUS;
  const alongX = LATTICE_AXES.length * LATTICE_LAYERS.length * 2 * LATTICE_BOUNDS[0] * barVolume;
  const alongY = LATTICE_AXES.length * LATTICE_LAYERS.length * 2 * LATTICE_BOUNDS[1] * barVolume;
  const alongZ = LATTICE_AXES.length * LATTICE_AXES.length * 2 * LATTICE_BOUNDS[2] * barVolume;
  const nodes = LATTICE_AXES.length * LATTICE_AXES.length * LATTICE_LAYERS.length * ((4 / 3) * Math.PI * LATTICE_NODE_RADIUS ** 3);
  const total = alongX + alongY + alongZ + nodes;

  for (let i = 0; i < count; i++) {
    const choice = random() * total;
    const angle = random() * Math.PI * 2;
    const radius = LATTICE_BAR_RADIUS * Math.sqrt(random());
    const u = Math.cos(angle) * radius;
    const v = Math.sin(angle) * radius;
    const t = random() * 2 - 1;
    if (choice < alongX) {
      write(t * LATTICE_BOUNDS[0], pick(LATTICE_AXES) + u, pick(LATTICE_LAYERS) + v);
    } else if (choice < alongX + alongY) {
      write(pick(LATTICE_AXES) + u, t * LATTICE_BOUNDS[1], pick(LATTICE_LAYERS) + v);
    } else if (choice < alongX + alongY + alongZ) {
      write(pick(LATTICE_AXES) + u, pick(LATTICE_AXES) + v, t * LATTICE_BOUNDS[2]);
    } else {
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const r = LATTICE_NODE_RADIUS * Math.cbrt(random());
      write(
        pick(LATTICE_AXES) + r * sinPhi * Math.cos(angle),
        pick(LATTICE_AXES) + r * sinPhi * Math.sin(angle),
        pick(LATTICE_LAYERS) + r * cosPhi,
      );
    }
  }
}

function sampleCheck(count: number, random: () => number, write: Writer): void {
  const strokes: readonly (readonly [Vec2, Vec2])[] = [
    [CHECK_START, CHECK_VERTEX],
    [CHECK_VERTEX, CHECK_END],
  ];
  const lengths = strokes.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const strokeVolumes = lengths.map((length) => length * 2 * CHECK_RADIUS * 2 * CHECK_DEPTH);
  const ringVolume = 2 * Math.PI * RING_RADIUS * 2 * RING_HALF_WIDTH * 2 * RING_DEPTH;
  const total = strokeVolumes[0]! + strokeVolumes[1]! + ringVolume;

  let written = 0;
  while (written < count) {
    const choice = random() * total;
    if (choice >= strokeVolumes[0]! + strokeVolumes[1]!) {
      const angle = random() * Math.PI * 2;
      const r = RING_RADIUS + (random() * 2 - 1) * RING_HALF_WIDTH;
      write(Math.cos(angle) * r, Math.sin(angle) * r, (random() * 2 - 1) * RING_DEPTH);
      written += 1;
      continue;
    }
    const index = choice < strokeVolumes[0]! ? 0 : 1;
    const [a, b] = strokes[index]!;
    const length = lengths[index]!;
    const dx = (b[0] - a[0]) / length;
    const dy = (b[1] - a[1]) / length;
    const along = -CHECK_RADIUS + random() * (length + 2 * CHECK_RADIUS);
    const across = (random() * 2 - 1) * CHECK_RADIUS;
    const x = a[0] + dx * along - dy * across;
    const y = a[1] + dy * along + dx * across;
    if (segmentDistance(x, y, a, b)[0] > CHECK_RADIUS) continue;
    write(x, y, (random() * 2 - 1) * CHECK_DEPTH);
    written += 1;
  }
}

/** `count` points inside the given shape as RGBA floats (xyz + a per-particle random in w). */
export function sampleShapeInterior(shape: ShapeIndex, count: number, random: () => number): Float32Array {
  const data = new Float32Array(count * 4);
  let cursor = 0;
  const write: Writer = (x, y, z) => {
    data[cursor] = x;
    data[cursor + 1] = y;
    data[cursor + 2] = z;
    data[cursor + 3] = random();
    cursor += 4;
  };
  if (shape === 0) sampleShield(count, random, write);
  else if (shape === 1) sampleLattice(count, random, write);
  else sampleCheck(count, random, write);
  return data;
}

/* ── GLSL ────────────────────────────────────────────────────────────────── */

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const v2 = (p: Vec2): string => `vec2(${f(p[0])}, ${f(p[1])})`;
const v3 = (p: readonly [number, number, number]): string => `vec3(${f(p[0])}, ${f(p[1])}, ${f(p[2])})`;

/**
 * Declares the morph uniforms and `sdScene` / `sceneGradient`:
 *   uShapeIndex    — shape being formed (0 shield, 1 matrix lattice, 2 playwright prism)
 *   uShapePrevious — shape being left
 *   uMorphProgress — 0 → 1 blend from the previous shape to `uShapeIndex`
 */
export const SCENE_SDF_GLSL = /* glsl */ `
uniform float uShapeIndex;
uniform float uShapePrevious;
uniform float uMorphProgress;

float sdSegment2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

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

float sdMatrixLattice(vec3 p) {
  vec3 cell = mod(p, ${f(LATTICE_PITCH)}) - ${f(LATTICE_PITCH / 2)};
  float bars = min(min(length(cell.xy), length(cell.yz)), length(cell.zx)) - ${f(LATTICE_BAR_RADIUS)};
  float nodes = length(cell) - ${f(LATTICE_NODE_RADIUS)};
  float bounds = sdBox(p, ${v3(LATTICE_BOUNDS)});
  return max(min(bars, nodes), bounds);
}

float sdPrismCheck(vec3 p) {
  float depth = abs(p.z);
  float stroke = min(
    sdSegment2(p.xy, ${v2(CHECK_START)}, ${v2(CHECK_VERTEX)}),
    sdSegment2(p.xy, ${v2(CHECK_VERTEX)}, ${v2(CHECK_END)})
  ) - ${f(CHECK_RADIUS)};
  float slab = depth - ${f(CHECK_DEPTH)};
  // Bevelled extrusion: the 45-degree cut gives the check its faceted prism edges.
  float check = max(max(stroke, slab), (stroke + slab) * 0.70710678 + ${f(CHECK_BEVEL)});
  float ring = max(abs(length(p.xy) - ${f(RING_RADIUS)}) - ${f(RING_HALF_WIDTH)}, depth - ${f(RING_DEPTH)});
  return min(check, ring);
}

float sdShape(vec3 p, float index) {
  if (index < 0.5) return sdShield(p);
  if (index < 1.5) return sdMatrixLattice(p);
  return sdPrismCheck(p);
}

float sdScene(vec3 p) {
  float target = sdShape(p, uShapeIndex);
  if (uMorphProgress >= 1.0) return target;
  return mix(sdShape(p, uShapePrevious), target, uMorphProgress);
}

vec3 sceneGradient(vec3 p) {
  const vec2 e = vec2(0.004, 0.0);
  return vec3(
    sdScene(p + e.xyy) - sdScene(p - e.xyy),
    sdScene(p + e.yxy) - sdScene(p - e.yxy),
    sdScene(p + e.yyx) - sdScene(p - e.yyx)
  ) / (2.0 * e.x);
}
`;
