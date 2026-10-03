/**
 * All coordinates in foreground vision results are normalized to [0, 1].
 * Keeping this contract independent from the rendered image size lets the
 * overlay draw correctly at any resolution.
 */

/** @typedef {{ x: number, y: number }} NormalizedPoint */

/**
 * @typedef {NormalizedPoint & {
 *   source: "semantic" | "corner" | "curvature",
 *   semanticType?: string,
 *   semanticScore: number,
 *   curvatureScore: number,
 *   preservationScore: number,
 *   spacingScore: number,
 *   distinctivenessScore: number,
 *   totalScore: number
 * }} CandidatePoint
 */

/**
 * @typedef {{
 *   width: number,
 *   height: number,
 *   data: Uint8Array
 * }} SegmentationMask
 */

/**
 * @typedef {{
 *   imageWidth: number,
 *   imageHeight: number,
 *   segmentationMask: SegmentationMask,
 *   silhouetteContour: NormalizedPoint[],
 *   candidates: CandidatePoint[],
 *   selectedPoints: CandidatePoint[],
 *   edges: [number, number][]
 * }} VisionResult
 */

export {};
