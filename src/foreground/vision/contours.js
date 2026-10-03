import { loadOpenCV } from "./opencv";

const normalize = (x, y, width, height) => ({ x: x / width, y: y / height });

/** Converts a binary foreground mask into its largest ordered outer contour. */
export async function extractSilhouette(mask) {
  const cv = await loadOpenCV();
  let source;
  let cleaned;
  let kernel;
  let contours;
  let hierarchy;
  let approximation;
  let contour;

  try {
    source = cv.matFromArray(mask.height, mask.width, cv.CV_8UC1, mask.data);
    cleaned = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    cv.morphologyEx(source, cleaned, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(cleaned, cleaned, cv.MORPH_OPEN, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(cleaned, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
    if (!contours.size()) throw new Error("Could not trace a silhouette for this subject.");

    let largestIndex = 0;
    let largestArea = 0;
    for (let index = 0; index < contours.size(); index += 1) {
      const candidateContour = contours.get(index);
      const area = cv.contourArea(candidateContour);
      candidateContour.delete();
      if (area > largestArea) {
        largestArea = area;
        largestIndex = index;
      }
    }
    if (largestArea < mask.width * mask.height * 0.002) {
      throw new Error("The detected subject is too small to map reliably.");
    }

    contour = contours.get(largestIndex);
    const raw = [];
    for (let index = 0; index < contour.data32S.length; index += 2) {
      raw.push(normalize(contour.data32S[index], contour.data32S[index + 1], mask.width, mask.height));
    }

    approximation = new cv.Mat();
    const perimeter = cv.arcLength(contour, true);
    cv.approxPolyDP(contour, approximation, Math.max(2, perimeter * 0.012), true);
    const corners = [];
    for (let index = 0; index < approximation.data32S.length; index += 2) {
      const { x, y } = normalize(approximation.data32S[index], approximation.data32S[index + 1], mask.width, mask.height);
      corners.push({
        x, y, source: "corner", semanticScore: 0, curvatureScore: 0,
        preservationScore: 0.6, spacingScore: 0, distinctivenessScore: 0.35, totalScore: 0,
      });
    }
    // This is an intermediate candidate set, never the final constellation.
    return { contour: raw, corners: corners.slice(0, 30) };
  } finally {
    contour?.delete();
    approximation?.delete();
    hierarchy?.delete();
    contours?.delete();
    kernel?.delete();
    cleaned?.delete();
    source?.delete();
  }
}
