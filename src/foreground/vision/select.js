import { BOX_SEMANTIC_BUDGET, MIN_OUTLINE_SHARE, OUTLINE_SHARE, POINT_COUNT, SEMANTIC_BUDGET } from "./config.js";

import { crosses, distance, insidePolygon, segmentDistance } from "./geometry.js";

export const clampPointCount = (count) =>
  Math.max(POINT_COUNT.min, Math.min(POINT_COUNT.max, Math.round(count) || POINT_COUNT.default));

/**
 * Chooses exactly `count` points (fewer only if the photo cannot supply them)
 * with semantic parts first, then outline vertices, then interior corners.
 *
 * Clustering is prevented by a minimum spacing derived from the subject's area
 * and the point count: an even spread of `count` points over the subject has
 * neighbours about `sqrt(area / count)` apart. Spacing is relaxed in steps only
 * when a pool cannot otherwise fill its share.
 */
export function selectPoints(analysis, requested) {
  const count = clampPointCount(requested);
  const base = Math.sqrt(analysis.area / count);
  const chosen = [];

  const isClear = (point, spacing, group) =>
    chosen.every((other) => (group && other.group === group) || distance(other, point) >= spacing);
  const take = (point, spacing, extra) => {
    if (chosen.length >= count || !isClear(point, spacing, extra.group)) return false;
    chosen.push({ x: point.x, y: point.y, priority: point.priority, ...extra });
    return true;
  };

  // 1. Semantic parts, strongest first. Boxes (doors, windows) bring all four corners or nothing.
  const hasBoxes = analysis.parts.some((part) => part.shape === "box" && part.corners);
  // Parts never crowd out the silhouette: some outline vertices are always reserved.
  const outlineReserve = Math.max(3, Math.round(count * MIN_OUTLINE_SHARE));
  const semanticBudget = Math.min(
    Math.round(count * (hasBoxes ? BOX_SEMANTIC_BUDGET : SEMANTIC_BUDGET)),
    count - outlineReserve,
  );
  let semanticUsed = 0;
  const parts = [...analysis.parts].sort((a, b) => b.priority - a.priority);
  parts.forEach((part, index) => {
    if (part.shape === "box" && part.corners) {
      if (semanticUsed + 4 > semanticBudget) return;
      const group = `${part.part}-${index}`;
      const fits = part.corners.every((corner) => isClear(corner, base * 0.3));
      if (!fits) return;
      part.corners.forEach((corner) => take(corner, 0, { kind: "part", part: part.part, group }));
      semanticUsed += 4;
    } else if (semanticUsed < semanticBudget && take(part, base * 0.3, { kind: "part", part: part.part })) {
      semanticUsed += 1;
    }
  });

  // 2./3. Outline vertices (shape-defining first), then interior corners.
  const outline = analysis.outline
    .map((point, index) => ({ ...point, index }))
    .sort((a, b) => b.priority - a.priority);
  const corners = [...analysis.corners].sort((a, b) => b.priority - a.priority);

  const fill = (pool, quota, kind, scales) => {
    const target = Math.min(count, chosen.length + quota);
    for (const scale of scales) {
      for (const point of pool) {
        if (chosen.length >= target) return;
        take(point, base * scale, { kind, index: point.index });
      }
    }
  };
  const remaining = count - chosen.length;
  fill(outline, Math.max(outlineReserve, Math.round(remaining * OUTLINE_SHARE)), "outline", [0.85, 0.65, 0.45]);
  fill(corners, count - chosen.length, "corner", [0.7, 0.5]);
  // Whatever is still missing comes from either pool at progressively tighter spacing.
  fill(outline, count - chosen.length, "outline", [0.6, 0.45, 0.3]);
  fill(corners, count - chosen.length, "corner", [0.4, 0.3]);

  repairOutline(chosen, analysis.outline, base * 0.5);
  return chosen;
}

/**
 * Contour vertex between two outline picks that bulges furthest from the
 * straight chord, skipping vertices that would crowd an existing pick.
 */
function farthestBetween(a, b, outline, chosen, clearance) {
  let best = null;
  for (let i = (a.index + 1) % outline.length; i !== b.index; i = (i + 1) % outline.length) {
    const d = segmentDistance(outline[i], a, b);
    if ((!best || d > best.d) && chosen.every((other) => distance(other, outline[i]) >= clearance)) best = { d, index: i };
  }
  return best;
}

/**
 * Sparse outlines turn into long chords that slice through features (a roof
 * line through a window, a paw cut off the body). While some chord does that,
 * swap in the contour vertex that best follows the true edge, giving up the
 * least valuable interior corner (or outline vertex) to stay within budget.
 */
function repairOutline(chosen, outline, clearance) {
  const boxEdges = [];
  const groups = new Map();
  chosen.forEach((point) => {
    if (point.group) groups.set(point.group, [...(groups.get(point.group) ?? []), point]);
  });
  for (const members of groups.values()) members.forEach((p, i) => boxEdges.push([p, members[(i + 1) % members.length]]));

  for (let pass = 0; pass < chosen.length; pass += 1) {
    const loop = chosen.filter((p) => p.kind === "outline").sort((a, b) => a.index - b.index);
    if (loop.length < 3) return;
    const chords = loop.map((a, i) => [a, loop[(i + 1) % loop.length]]);
    const inner = chosen.filter((p) => p.kind !== "outline");
    const outside = inner.filter((p) => !insidePolygon(p, loop) && chords.every(([a, b]) => segmentDistance(p, a, b) > 2));

    let violated;
    let fix;
    chords.some(([a, b], i) => {
      const bad = boxEdges.some(([c, d]) => crosses(a, b, c, d)) ||
        outside.some((p) => chords.every(([c, d], j) => j === i || segmentDistance(p, a, b) <= segmentDistance(p, c, d)));
      if (!bad) return false;
      fix = farthestBetween(a, b, outline, chosen, clearance);
      if (fix?.d >= 1.5) violated = [a, b];
      return Boolean(violated);
    });
    if (!violated) return;
    const keep = new Set(violated);
    const removable = chosen
      .filter((p) => !keep.has(p) && !p.group && (p.kind === "corner" || p.kind === "outline"))
      .sort((a, b) => (a.kind === b.kind ? a.priority - b.priority : a.kind === "corner" ? -1 : 1));
    if (!removable.length) return;
    chosen.splice(chosen.indexOf(removable[0]), 1);
    chosen.push({ x: outline[fix.index].x, y: outline[fix.index].y, priority: outline[fix.index].priority, kind: "outline", index: fix.index });
  }
}
