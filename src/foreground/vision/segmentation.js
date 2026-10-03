let segmentationWorker;
let sequence = 0;
const pending = new Map();
const MODEL_TIMEOUT_MS = 90_000;

function getWorker() {
  if (segmentationWorker) return segmentationWorker;

  segmentationWorker = new Worker(new URL("../workers/vision.worker.js", import.meta.url), {
    type: "module",
  });

  segmentationWorker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    if (data.type === "progress") {
      request.onProgress?.(data.message);
      return;
    }
    pending.delete(data.id);
    clearTimeout(request.timeout);
    if (data.type === "error") request.reject(new Error(data.message));
    else request.resolve({
      width: data.mask.width,
      height: data.mask.height,
      data: new Uint8Array(data.mask.data),
      label: data.label,
      confidence: data.confidence,
    });
  };

  segmentationWorker.onerror = () => {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(new Error("The segmentation worker stopped unexpectedly."));
    }
    pending.clear();
    segmentationWorker = undefined;
  };
  return segmentationWorker;
}

/** Lazily segments a file without blocking React's main thread. */
export function segmentPrimarySubject(file, onProgress) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error("The local vision model took too long to start. Check your connection, then try again."));
    }, MODEL_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timeout, onProgress });
    getWorker().postMessage({ type: "segment", id, file });
  });
}

export function disposeSegmentationWorker() {
  segmentationWorker?.terminate();
  segmentationWorker = undefined;
  for (const { reject, timeout } of pending.values()) {
    clearTimeout(timeout);
    reject(new Error("Image analysis was cancelled."));
  }
  pending.clear();
}
