const clamp = (value) => Math.max(0, Math.min(1, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Finds separated high-turning-angle locations along an ordered silhouette. */
export function findCurvatureCandidates(contour, { window = 12, maximum = 28 } = {}) {
  if (contour.length < window * 3) return [];
  const values = [];
  for (let index = 0; index < contour.length; index += 1) {
    const before = contour[(index - window + contour.length) % contour.length];
    const current = contour[index];
    const after = contour[(index + window) % contour.length];
    const ax = before.x - current.x;
    const ay = before.y - current.y;
    const bx = after.x - current.x;
    const by = after.y - current.y;
    const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (!denominator) continue;
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / denominator));
    const angle = Math.acos(cosine);
    values.push({ point: current, curvature: clamp((Math.PI - angle) / Math.PI) });
  }

  const selected = [];
  for (const candidate of values.sort((a, b) => b.curvature - a.curvature)) {
    if (selected.length >= maximum) break;
    if (selected.some((other) => distance(other, candidate.point) < 0.04)) continue;
    selected.push(candidate.point);
  }
  return selected.map(({ point, curvature }) => ({
    ...point, source: "curvature", semanticScore: 0, curvatureScore: curvature,
    preservationScore: 0.65, spacingScore: 0, distinctivenessScore: 0.45, totalScore: 0,
  }));
}
