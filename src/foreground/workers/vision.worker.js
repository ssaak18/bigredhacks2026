import { INFERENCE_SIZE } from "../vision/config.js";
import { analyzeImage } from "../vision/analyze.js";
import { fitSize } from "../vision/image.js";
import { createModels } from "../vision/models.js";

let currentId = 0;
const models = createModels({
  device: "wasm",
  onProgress: (message) => self.postMessage({ type: "progress", id: currentId, message }),
});

/** Decodes (honouring EXIF orientation) and downsizes a photo to model resolution. */
async function decodePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitSize(bitmap.width, bitmap.height, INFERENCE_SIZE);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, data: context.getImageData(0, 0, width, height).data };
}

self.onmessage = async ({ data: { id, file, photoKey, point } }) => {
  currentId = id;
  try {
    const image = await decodePhoto(file);
    const analysis = await analyzeImage(image, models, (message) => self.postMessage({ type: "progress", id, message }), { point, photoKey });
    self.postMessage({ type: "result", id, analysis });
  } catch (error) {
    self.postMessage({ type: "error", id, message: error instanceof Error ? error.message : "The photo could not be analyzed." });
  }
};
