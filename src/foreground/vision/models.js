import { AutoModel, AutoProcessor, pipeline, RawImage, SamModel } from "@huggingface/transformers";
import { DETECTION_MODEL, MATTE_MODEL, SAM_MODEL, SEGMENTATION_MODEL } from "./config.js";
import { installOwlPatch } from "./onnxPatch.js";

function toRawImage({ width, height, data }) {
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0, j = 0; i < width * height * 4; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return new RawImage(rgb, width, height, 3);
}

/**
 * Lazily loads the models behind the pipeline. Works in the browser
 * (`device: "wasm"`) and Node (`device: "cpu"`); the same code path is used by
 * the worker and the CLI. Each model downloads on first use only.
 *
 * - `segment(image)`  -> semantic segments `{ label, mask }` (SegFormer, ADE20K)
 * - `matte(image)`    -> class-agnostic foreground mask `{ width, height, data }` (RMBG-1.4)
 * - `segmentAt(image, point, photoKey)` -> mask of the object under `point`
 *   (`{ x, y }` in [0, 1]) (SlimSAM); image embeddings are cached per `photoKey`
 * - `detect(image, prompts, threshold)` -> boxes `{ label, score, box }` in pixels (OWL-ViT, zero-shot)
 */
export function createModels({ device, onProgress = () => {} }) {
  if (device === "wasm") installOwlPatch();
  const loaders = new Map();
  const once = (name, create) => {
    if (!loaders.has(name)) {
      loaders.set(name, create().catch((error) => {
        loaders.delete(name);
        throw error;
      }));
    }
    return loaders.get(name);
  };
  const options = (model, message) => ({
    device,
    dtype: model.dtype,
    progress_callback: ({ status, progress }) => {
      if (status === "progress" && Number.isFinite(progress)) onProgress(`${message}… ${Math.round(progress)}%`);
    },
  });
  const task = (name, model, message) => once(name, () => pipeline(name, model.id, options(model, message)));

  let embeddings = null; // { key, data }: SAM image embeddings for the photo most recently tapped

  return {
    async segment(image) {
      const segmenter = await task("image-segmentation", SEGMENTATION_MODEL, "Loading subject model");
      return segmenter(toRawImage(image));
    },

    async matte(image) {
      const { model, processor } = await once("matte", async () => ({
        model: await AutoModel.from_pretrained(MATTE_MODEL.id, { ...options(MATTE_MODEL, "Loading foreground model"), config: { model_type: "custom" } }),
        processor: await AutoProcessor.from_pretrained(MATTE_MODEL.id, { config: MATTE_MODEL.preprocessing }),
      }));
      const raw = toRawImage(image);
      const { pixel_values: input } = await processor(raw);
      const { output } = await model({ input });
      const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(raw.width, raw.height);
      return { width: mask.width, height: mask.height, data: Uint8Array.from(mask.data) };
    },

    async segmentAt(image, point, photoKey) {
      const { model, processor } = await once("sam", async () => ({
        model: await SamModel.from_pretrained(SAM_MODEL.id, options(SAM_MODEL, "Loading tap-to-select model")),
        processor: await AutoProcessor.from_pretrained(SAM_MODEL.id),
      }));
      const raw = toRawImage(image);
      if (embeddings?.key !== photoKey) {
        const inputs = await processor(raw);
        embeddings = { key: photoKey, data: await model.get_image_embeddings(inputs) };
      }
      const prompt = await processor(raw, { input_points: [[[point.x * raw.width, point.y * raw.height]]] });
      const output = await model({ ...embeddings.data, input_points: prompt.input_points });
      const [masks] = await processor.post_process_masks(output.pred_masks, prompt.original_sizes, prompt.reshaped_input_sizes);
      const [, count, height, width] = masks.dims;
      const scores = Array.from(output.iou_scores.data);

      // SAM offers a few nested guesses (part / object / group). Take the largest one it still trusts.
      const trusted = Math.max(0.7, Math.max(...scores) - 0.15);
      let pick = null;
      for (let k = 0; k < count; k += 1) {
        const area = masks.data.slice(k * width * height, (k + 1) * width * height).reduce((sum, v) => sum + (v ? 1 : 0), 0);
        if (scores[k] >= trusted && (!pick || area > pick.area)) pick = { k, area };
      }
      const data = new Uint8Array(width * height);
      const offset = (pick?.k ?? scores.indexOf(Math.max(...scores))) * width * height;
      for (let i = 0; i < data.length; i += 1) data[i] = masks.data[offset + i] ? 255 : 0;
      return { width, height, data };
    },

    async detect(image, prompts, threshold) {
      const detector = await task("zero-shot-object-detection", DETECTION_MODEL, "Loading part detector");
      const hits = await detector(toRawImage(image), prompts, { threshold, percentage: false });
      return hits.map(({ label, score, box }) => ({
        label,
        score,
        box: { x0: box.xmin, y0: box.ymin, x1: box.xmax, y1: box.ymax },
      }));
    },
  };
}
