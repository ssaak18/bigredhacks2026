const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Greedily picks high-value points while maintaining meaningful visual separation. */
export function selectRepresentativePoints(candidates, { min = 6, max = 12, target = 9 } = {}) {
  const count = Math.max(min, Math.min(max, target));
  // Semantics are deliberately selected first. A silhouette corner should not
  // displace a detected head, hand, or foot simply because it scores similarly.
  const sorted = [...candidates].sort((a, b) => {
    const semanticPriority = Number(b.source === "semantic") - Number(a.source === "semantic");
    return semanticPriority || b.totalScore - a.totalScore;
  });
  for (const minimumDistance of [0.105, 0.085, 0.065, 0.04]) {
    const selected = [];
    for (const candidate of sorted) {
      if (selected.every((point) => distance(point, candidate) >= minimumDistance)) selected.push(candidate);
      if (selected.length === count) return selected;
    }
    if (selected.length >= min) return selected;
  }
  return sorted.slice(0, count);
}

/** Prim's algorithm supplies a sparse, readable constellation preview. */
export function createConstellationEdges(points) {
  if (points.length < 2) return [];
  const connected = new Set([0]);
  const edges = [];
  while (connected.size < points.length) {
    let best;
    for (const from of connected) {
      points.forEach((point, to) => {
        if (connected.has(to)) return;
        const length = distance(points[from], point);
        if (!best || length < best.length) best = { from, to, length };
      });
    }
    connected.add(best.to);
    edges.push([best.from, best.to]);
  }
  return edges;
}
