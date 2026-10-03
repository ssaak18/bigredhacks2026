import { findCorners } from "./corners.js";
import { GRID_SIZE } from "./config.js";
import { perimeter, resampleClosed, smoothClosed, traceOuterContour, vertexImportance } from "./contour.js";
import { fitSize, toGrayGrid } from "./image.js";
import { erode } from "./mask.js";
import { detectParts, refineKind } from "./parts.js";
import { pickPrimarySubject, subjectFromMask } from "./subject.js";

/**
 * The expensive half of the pipeline: runs the models and extracts every
 * candidate the constellation can be built from. Nothing here depends on the
 * requested point count, so the result is built once per photo and
 * `buildConstellation` can then be re-run instantly for any count.
 *
 * `image` is `{ width, height, data }` (RGBA bytes) at model resolution.
 * With `point` (`{ x, y }` in [0, 1], e.g. where the user tapped) the subject is
 * the object under that point instead of the automatic pick; `photoKey` lets
 * repeated taps on one photo reuse the expensive image embedding.
 * All returned geometry is in pixels of a `width` x `height` grid whose aspect
 * matches the photo.
 */
export async function analyzeImage(image, models, onProgress = () => {}, { point, photoKey } = {}) {
  const grid = fitSize(image.width, image.height, GRID_SIZE);
  const scale = grid.width / image.width;

  onProgress("Finding the primary subject…");
  const segments = await models.segment(image);
  let subject;
  if (point) {
    onProgress("Cutting out the subject you chose…");
    subject = subjectFromMask(await models.segmentAt(image, point, photoKey), segments, grid.width, grid.height);
  } else {
    // The matte is a second opinion; the pick still works from class weights alone without it.
    const matte = await models.matte(image).catch(() => null);
    subject = pickPrimarySubject(segments, matte, grid.width, grid.height);
  }
  const { bounds } = subject;
  const size = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);

  onProgress("Tracing the silhouette…");
  const boundary = traceOuterContour(subject.mask, grid.width, grid.height);
  if (boundary.length < 24) throw new Error("The subject's outline was too small to use.");
  const smoothed = smoothClosed(boundary, 2);
  const samples = Math.min(360, Math.max(120, Math.round(perimeter(smoothed) / 2)));
  const outlinePoints = resampleClosed(smoothed, samples);
  const importance = vertexImportance(outlinePoints);
  const outline = outlinePoints.map((point, i) => ({
    ...point,
    priority: Math.min(1, importance[i] / (bounds.area * 0.02)),
  }));

  onProgress("Finding corners…");
  const gray = toGrayGrid(image, grid.width, grid.height);
  const cornerPool = findCorners(gray, grid.width, grid.height, subject.mask, {
    scale: size,
    separation: Math.round(size * 0.04),
  });
  const interior = erode(subject.mask, grid.width, grid.height, Math.max(2, Math.round(size * 0.03)));
  const corners = cornerPool.filter(({ x, y }) => interior[y * grid.width + x]).slice(0, 60);

  onProgress("Looking for eyes, noses, paws and other features…");
  let parts = [];
  let warning = "";
  let { label, kind } = subject;
  try {
    ({ label, kind } = await refineKind({ models, image, subject, scale }));
    parts = await detectParts({ models, image, subject: { ...subject, kind }, grid, scale, cornerPool });
  } catch (error) {
    // The silhouette and corners are still a usable constellation without semantics.
    warning = `Feature detection was unavailable (${error instanceof Error ? error.message : "unknown error"}); using the outline only.`;
  }

  return {
    width: grid.width,
    height: grid.height,
    label,
    kind,
    confidence: subject.confidence,
    area: bounds.area,
    bounds,
    mask: subject.mask,
    outline,
    corners,
    parts,
    warning,
  };
}
