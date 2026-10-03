import { extractSilhouette } from "./contours";
import { findCurvatureCandidates } from "./curvature";
import { detectSemanticLandmarks } from "./landmarks";
import { mergeCandidates, scoreCandidates } from "./scoring";
import { segmentPrimarySubject } from "./segmentation";
import { createConstellationEdges, selectRepresentativePoints } from "./selectPoints";

/**
 * Orchestrates independent vision stages. The segmentation worker and the
 * landmark model stay swappable without coupling the foreground components to
 * a particular CV model.
 */
export async function runVisionPipeline(file, image, onProgress = () => {}, pointCount = 9) {
  onProgress("Finding the primary subject…");
  const segmentation = await segmentPrimarySubject(file, onProgress);

  onProgress("Tracing the silhouette…");
  const { contour, corners } = await extractSilhouette(segmentation);

  onProgress("Looking for meaningful landmarks…");
  const [semantic, curvature] = await Promise.all([
    detectSemanticLandmarks(image),
    Promise.resolve(findCurvatureCandidates(contour)),
  ]);

  onProgress("Selecting constellation points…");
  const candidates = scoreCandidates(mergeCandidates([...semantic, ...curvature, ...corners]), contour);
  const selectedPoints = selectRepresentativePoints(candidates, { target: pointCount });
  if (selectedPoints.length < 2) {
    throw new Error("The subject did not contain enough distinct points to form a constellation.");
  }
  return {
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    segmentationMask: segmentation,
    silhouetteContour: contour,
    candidates,
    selectedPoints,
    edges: createConstellationEdges(selectedPoints),
  };
}
