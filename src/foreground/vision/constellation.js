import { connectPoints } from "./edges.js";
import { selectPoints } from "./select.js";

/**
 * Turns an `analyzeImage` result into a constellation with `pointCount` stars.
 * Cheap enough to re-run on every slider change.
 *
 * Points are in image space: `x`/`y` in [0, 1] with y pointing down, so they
 * can be drawn straight over the photo. Lines reference point ids.
 */
export function buildConstellation(analysis, pointCount) {
  const selected = selectPoints(analysis, pointCount);
  const edges = connectPoints(selected, analysis);
  const points = selected.map((point, i) => ({
    id: `star-${i}`,
    x: point.x / analysis.width,
    y: point.y / analysis.height,
    kind: point.kind,
    part: point.part,
  }));
  return {
    aspect: analysis.width / analysis.height,
    label: analysis.label,
    points,
    lines: edges.map(([from, to]) => ({ from: points[from].id, to: points[to].id })),
  };
}

const OUTLINE_POINTS = 480;

function thinClosed(points, max = OUTLINE_POINTS) {
  if (!points?.length) return [];
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.floor(i * step) % points.length]);
}

function thinPath(points, max = OUTLINE_POINTS) {
  if (!points?.length) return [];
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

function markPath(points, closed) {
  points.closed = closed;
  return points;
}

function toEuclid(point, aspect) {
  return {
    x: (point.x - 0.5) * aspect,
    y: 0.5 - point.y,
  };
}

/**
 * Converts a constellation to the Euclidean drawing the sky mapper consumes:
 * centred on the origin, unit height, y pointing up (north). `edges` are Canny
 * chains in the same [0, 1] photo coordinates as the stars. `outline`/`features`
 * are a closed-silhouette fallback when Canny is unavailable.
 */
export function toEuclideanDrawing(constellation, { id, name, edges = [], outline = [], features = [] }) {
  const fromCanny = edges
    .map((chain) => thinPath(chain, 400))
    .filter((chain) => chain.length >= 3)
    .map((chain) => markPath(chain.map((point) => toEuclid(point, constellation.aspect)), false));
  const outlines = fromCanny.length
    ? fromCanny
    : [thinClosed(outline), ...features.map((ring) => thinClosed(ring, 96))]
      .filter((ring) => ring.length >= 3)
      .map((ring) => markPath(ring.map((point) => toEuclid(point, constellation.aspect)), true));
  return {
    id,
    name,
    points: constellation.points.map((point) => ({
      id: point.id,
      ...toEuclid(point, constellation.aspect),
    })),
    lines: constellation.lines,
    outline: outlines[0] ?? [],
    outlines,
  };
}
