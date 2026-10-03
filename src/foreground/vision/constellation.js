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

/**
 * Converts a constellation to the Euclidean drawing the sky mapper consumes:
 * centred on the origin, unit height, y pointing up (north).
 */
export function toEuclideanDrawing(constellation, { id, name }) {
  return {
    id,
    name,
    points: constellation.points.map((point) => ({
      id: point.id,
      x: (point.x - 0.5) * constellation.aspect,
      y: 0.5 - point.y,
    })),
    lines: constellation.lines,
  };
}
