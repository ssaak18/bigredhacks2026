export const SCORE_WEIGHTS = {
  semantic: 0.4,
  curvature: 0.2,
  preservation: 0.2,
  spacing: 0.15,
  distinctiveness: 0.05,
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value) => Math.max(0, Math.min(1, value));

/** Merge colocated candidates while preserving semantic points over geometric ones. */
export function mergeCandidates(candidates, threshold = 0.035) {
  const preferred = [...candidates].sort((a, b) => {
    if (a.source === "semantic" && b.source !== "semantic") return -1;
    if (b.source === "semantic" && a.source !== "semantic") return 1;
    return (b.semanticScore + b.curvatureScore) - (a.semanticScore + a.curvatureScore);
  });
  const merged = [];
  for (const candidate of preferred) {
    if (!merged.some((point) => distance(point, candidate) < threshold)) merged.push(candidate);
  }
  return merged;
}

/** Scores candidates in a way that can be tuned without affecting extraction. */
export function scoreCandidates(candidates, contour) {
  return candidates.map((candidate) => {
    const contourDistance = contour.length
      ? Math.min(...contour.map((point) => distance(candidate, point)))
      : 1;
    const nearestCandidateDistance = candidates.length > 1
      ? Math.min(...candidates.filter((point) => point !== candidate).map((point) => distance(candidate, point)))
      : 1;
    const spacingScore = clamp(nearestCandidateDistance / 0.18);
    // Contour proximity supports silhouette fidelity without overweighting straight edges.
    const preservationScore = Math.max(candidate.preservationScore, clamp(1 - contourDistance / 0.07) * candidate.curvatureScore);
    const totalScore =
      SCORE_WEIGHTS.semantic * candidate.semanticScore +
      SCORE_WEIGHTS.curvature * candidate.curvatureScore +
      SCORE_WEIGHTS.preservation * preservationScore +
      SCORE_WEIGHTS.spacing * spacingScore +
      SCORE_WEIGHTS.distinctiveness * candidate.distinctivenessScore;
    return { ...candidate, spacingScore, preservationScore, totalScore };
  });
}
