import { pipeline } from "@huggingface/transformers";

let segmenterPromise;

function sendProgress(id, message) {
  self.postMessage({ type: "progress", id, message });
}

function getSegmenter(id) {
  if (!segmenterPromise) {
    // Explicit WASM/q8 avoids a larger default model download on first use.
    segmenterPromise = pipeline("image-segmentation", "Xenova/segformer-b0-finetuned-ade-512-512", {
      device: "wasm",
      dtype: "q8",
      progress_callback: ({ status, progress, file }) => {
        if (status === "ready") sendProgress(id, "Model ready — isolating the subject…");
        else if (status === "progress" && Number.isFinite(progress)) sendProgress(id, `Preparing local model… ${Math.round(progress)}%`);
        else if (status === "download") sendProgress(id, `Downloading ${file || "vision model"}…`);
      },
    }).catch((error) => {
      segmenterPromise = undefined;
      throw error;
    });
  }
  return segmenterPromise;
}

function maskToBinary(mask) {
  const width = mask.width;
  const height = mask.height;
  const channels = mask.channels || Math.max(1, Math.round(mask.data.length / (width * height)));
  const binary = new Uint8Array(width * height);
  for (let index = 0; index < binary.length; index += 1) {
    const value = mask.data[index * channels + (channels === 4 ? 3 : 0)] || 0;
    binary[index] = value > 24 ? 255 : 0;
  }
  return binary;
}

function primarySubjectScore(item, binary) {
  let area = 0;
  let centerDistance = 0;
  const width = item.mask.width;
  const height = item.mask.height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!binary[y * width + x]) continue;
      area += 1;
      centerDistance += Math.hypot(x / width - 0.5, y / height - 0.5);
    }
  }
  if (!area) return { score: 0, area: 0 };
  const areaScore = Math.min(1, area / (width * height) * 3);
  const meanDistance = centerDistance / area;
  const centerBias = Math.max(0.2, 1 - meanDistance / 0.71);
  return { score: (item.score || 0.5) * areaScore * centerBias, area };
}

/** Keeps inference responsive while normalized output remains resolution-independent. */
async function createInferenceImage(file, maximumDimension = 896) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

self.onmessage = async ({ data }) => {
  if (data.type !== "segment") return;
  try {
    sendProgress(data.id, "Starting local subject detection…");
    const segmenter = await getSegmenter(data.id);
    const inferenceImage = await createInferenceImage(data.file);
    sendProgress(data.id, "Analyzing the photo…");
    const results = await segmenter(inferenceImage);
    if (!Array.isArray(results) || !results.length) {
      throw new Error("No subject could be identified in this photo.");
    }

    const ranked = results
      .map((item) => {
        const binary = maskToBinary(item.mask);
        return { item, binary, ...primarySubjectScore(item, binary) };
      })
      .filter((candidate) => candidate.area > 32)
      .sort((a, b) => b.score - a.score);

    const primary = ranked[0];
    if (!primary) throw new Error("No usable foreground subject was found.");

    self.postMessage({
      type: "result",
      id: data.id,
      label: primary.item.label || "subject",
      confidence: primary.item.score || 0,
      mask: {
        width: primary.item.mask.width,
        height: primary.item.mask.height,
        data: primary.binary.buffer,
      },
    }, [primary.binary.buffer]);
  } catch (error) {
    self.postMessage({
      type: "error",
      id: data.id,
      message: error instanceof Error ? error.message : "Segmentation failed.",
    });
  }
};
