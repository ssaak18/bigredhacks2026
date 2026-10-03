let poseLandmarkerPromise;

const modelUrl = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    })();
  }
  return poseLandmarkerPromise;
}

const landmarkGroups = [
  ["head", [0, 2, 5], 1], ["left shoulder", [11], 0.72], ["right shoulder", [12], 0.72],
  ["left elbow", [13], 0.62], ["right elbow", [14], 0.62], ["left hand", [15, 17, 19], 0.92],
  ["right hand", [16, 18, 20], 0.92], ["left hip", [23], 0.62], ["right hip", [24], 0.62],
  ["left knee", [25], 0.55], ["right knee", [26], 0.55], ["left foot", [27, 29, 31], 0.9],
  ["right foot", [28, 30, 32], 0.9],
];

/** Returns a compact, constellation-oriented human pose landmark set. */
export async function detectSemanticLandmarks(image) {
  try {
    const landmarker = await getPoseLandmarker();
    const result = landmarker.detect(image);
    const pose = result.landmarks?.[0];
    if (!pose) return [];
    return landmarkGroups.flatMap(([semanticType, indexes, importance]) => {
      const visible = indexes.map((index) => pose[index]).filter((point) => point && (point.visibility ?? 1) > 0.45);
      if (!visible.length) return [];
      const x = visible.reduce((sum, point) => sum + point.x, 0) / visible.length;
      const y = visible.reduce((sum, point) => sum + point.y, 0) / visible.length;
      return [{
        x, y, source: "semantic", semanticType, semanticScore: importance,
        curvatureScore: 0, preservationScore: 0.55, spacingScore: 0,
        distinctivenessScore: 0.75, totalScore: 0,
      }];
    });
  } catch {
    // Human semantics are additive. Geometric candidates remain valid without them.
    return [];
  }
}
