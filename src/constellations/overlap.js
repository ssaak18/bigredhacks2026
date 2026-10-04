import { fromVec, toVec } from "../astro/localSky.js";

/** Constellations must stay at least this far apart (degrees) so they never touch. */
export const CLEARANCE_DEG = 1;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

function starsOf(layer) {
  return layer.vertices.filter((vertex) => vertex.star).map((vertex) => vertex.star);
}

/** Mean position of a constellation's snapped stars, used to pin its photo on the map. */
export function skyCentroid(layer) {
  const stars = starsOf(layer);
  if (!stars.length) return null;
  const sum = stars.reduce((total, star) => {
    const vector = toVec(star.ra, star.dec);
    return [total[0] + vector[0], total[1] + vector[1], total[2] + vector[2]];
  }, [0, 0, 0]);
  return fromVec(normalize(sum));
}

/**
 * Gnomonic projection about `center`: great circles become straight lines, so the
 * flat geometry below is exact for the lines a constellation is drawn with.
 */
function projector(center) {
  const pole = Math.abs(center[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const east = normalize(cross(pole, center));
  const north = cross(center, east);
  return (star) => {
    const vector = toVec(star.ra, star.dec);
    const depth = dot(vector, center);
    return depth < 0.1 ? null : [dot(vector, east) / depth, dot(vector, north) / depth];
  };
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list) => {
    const chain = [];
    for (const point of list) {
      while (chain.length >= 2 && turn(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

function pointSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function segmentsCross(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

function segmentSegment(a, b, c, d) {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

function contains(hull, p) {
  if (hull.length < 3) return false;
  return hull.every((a, i) => {
    const b = hull[(i + 1) % hull.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
  });
}

const edgesOf = (hull) => (hull.length < 2 ? [] : hull.map((a, i) => [a, hull[(i + 1) % hull.length]]).slice(0, hull.length === 2 ? 1 : undefined));

function hullDistance(a, b) {
  if (!a.length || !b.length) return Infinity;
  if (contains(a, b[0]) || contains(b, a[0])) return 0;
  const edgesA = edgesOf(a);
  const edgesB = edgesOf(b);
  let nearest = Infinity;
  for (const p of a) for (const [c, d] of edgesB) nearest = Math.min(nearest, pointSegment(p, c, d));
  for (const p of b) for (const [c, d] of edgesA) nearest = Math.min(nearest, pointSegment(p, c, d));
  for (const [p, q] of edgesA) for (const [c, d] of edgesB) nearest = Math.min(nearest, segmentSegment(p, q, c, d));
  if (!edgesA.length || !edgesB.length) {
    for (const p of a) for (const q of b) nearest = Math.min(nearest, Math.hypot(p[0] - q[0], p[1] - q[1]));
  }
  return nearest;
}

/**
 * Two constellations overlap when they share a star or when the outlines (convex
 * hulls) of their stars intersect or come closer than CLEARANCE_DEG. Each argument
 * is anything with `vertices` ({ star: { ra, dec, hip } }).
 */
export function constellationsOverlap(first, second) {
  const a = starsOf(first);
  const b = starsOf(second);
  if (!a.length || !b.length) return false;

  const hips = new Set(a.map((star) => star.hip));
  if (b.some((star) => hips.has(star.hip))) return true;

  const center = normalize([...a, ...b].map((star) => toVec(star.ra, star.dec)).reduce(
    (sum, vector) => [sum[0] + vector[0], sum[1] + vector[1], sum[2] + vector[2]],
    [0, 0, 0],
  ));
  const project = projector(center);
  const hullA = convexHull(a.map(project).filter(Boolean));
  const hullB = convexHull(b.map(project).filter(Boolean));
  return hullDistance(hullA, hullB) < Math.tan((CLEARANCE_DEG * Math.PI) / 180);
}

/** The first of `others` that `candidate` overlaps, or null. */
export function findOverlap(candidate, others) {
  return others.find((other) => constellationsOverlap(candidate, other)) ?? null;
}
