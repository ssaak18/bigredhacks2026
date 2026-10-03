import { crosses, distance } from "./geometry.js";

/** Fraction of the segment that lies on the subject mask. */
function insideShare(mask, width, height, a, b) {
  const steps = 16;
  let inside = 0;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.min(width - 1, Math.max(0, Math.round(a.x + ((b.x - a.x) * i) / steps)));
    const y = Math.min(height - 1, Math.max(0, Math.round(a.y + ((b.y - a.y) * i) / steps)));
    inside += mask[y * width + x];
  }
  return inside / (steps + 1);
}

/**
 * Connects the selected points into a readable figure, as index pairs:
 *  1. the silhouette, as a closed loop through the outline vertices;
 *  2. a rectangle for every door/window whose four corners were chosen;
 *  3. a relative-neighbourhood graph over everything else, which joins nearby
 *     features (eye-eye, eye-nose, ear-head, ...) without long, cluttering
 *     chords, never crossing another line or leaving the subject;
 *  4. the shortest extra links needed to leave a single connected figure.
 */
export function connectPoints(points, { mask, width, height }) {
  const edges = [];
  const has = new Set();
  const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const link = (i, j) => {
    if (i === j || has.has(key(i, j))) return;
    has.add(key(i, j));
    edges.push([i, j]);
  };
  const blocked = (i, j) => edges.some(([p, q]) => p !== i && p !== j && q !== i && q !== j && crosses(points[i], points[j], points[p], points[q]));

  const loop = points
    .map((point, i) => ({ i, index: point.index }))
    .filter((_, i) => points[i].kind === "outline")
    .sort((a, b) => a.index - b.index);
  if (loop.length === 2) link(loop[0].i, loop[1].i);
  else loop.forEach((item, k) => link(item.i, loop[(k + 1) % loop.length].i));

  const groups = new Map();
  points.forEach((point, i) => {
    if (point.group) groups.set(point.group, [...(groups.get(point.group) ?? []), i]);
  });
  for (const members of groups.values()) members.forEach((i, k) => link(i, members[(k + 1) % members.length]));

  const pairs = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (points[i].group && points[i].group === points[j].group) continue;
      pairs.push({ i, j, length: distance(points[i], points[j]) });
    }
  }
  pairs.sort((a, b) => a.length - b.length);

  for (const { i, j, length } of pairs) {
    if (has.has(key(i, j))) continue;
    const isolated = points.every((_, k) => k === i || k === j || Math.max(distance(points[i], points[k]), distance(points[j], points[k])) >= length);
    if (isolated && !blocked(i, j) && insideShare(mask, width, height, points[i], points[j]) >= 0.9) link(i, j);
  }

  // Union-find over what we have, then bridge any remaining islands.
  const parent = points.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  edges.forEach(([i, j]) => { parent[find(i)] = find(j); });
  for (const requireInside of [true, false]) {
    for (const { i, j } of pairs) {
      if (find(i) === find(j) || blocked(i, j)) continue;
      if (requireInside && insideShare(mask, width, height, points[i], points[j]) < 0.9) continue;
      link(i, j);
      parent[find(i)] = find(j);
    }
  }
  return edges;
}
