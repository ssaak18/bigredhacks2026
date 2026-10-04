let worker;
let sequence = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/vision.worker.js", import.meta.url), { type: "module" });

  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    if (data.type === "progress") {
      request.onProgress(data.message);
      return;
    }
    pending.delete(data.id);
    if (data.type === "error") request.reject(new Error(data.message));
    else request.resolve(data.analysis);
  };

  worker.onerror = () => {
    for (const { reject } of pending.values()) reject(new Error("The vision worker stopped unexpectedly."));
    pending.clear();
    worker = undefined;
  };
  return worker;
}

/**
 * Analyzes a photo off the main thread (see `analyzeImage`). Resolves with the
 * point-count independent analysis; models load on first use and are reused.
 * Pass `point` ({ x, y } in [0, 1]) to use the object there as the subject;
 * `photoKey` identifies the photo so repeated taps skip re-processing it.
 */
export function analyzePhoto(file, { photoKey, point } = {}, onProgress = () => {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, file, photoKey, point });
  });
}

export function disposeVisionWorker() {
  worker?.terminate();
  worker = undefined;
  for (const { reject } of pending.values()) reject(new Error("Image analysis was cancelled."));
  pending.clear();
}
