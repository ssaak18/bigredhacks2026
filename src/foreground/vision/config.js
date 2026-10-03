/** Tunable constants for the photo -> constellation pipeline. */

export const SEGMENTATION_MODEL = { id: "Xenova/segformer-b0-finetuned-ade-512-512", dtype: "q8" };
export const DETECTION_MODEL = { id: "Xenova/owlvit-base-patch32", dtype: "q8" };
/** Class-agnostic "what is salient" model. RMBG-1.4 is licensed for non-commercial use. */
export const MATTE_MODEL = {
  id: "briaai/RMBG-1.4",
  dtype: "q8",
  preprocessing: {
    do_normalize: true, do_pad: false, do_rescale: true, do_resize: true,
    image_mean: [0.5, 0.5, 0.5], image_std: [1, 1, 1], resample: 2,
    rescale_factor: 1 / 255, feature_extractor_type: "ImageFeatureExtractor",
    size: { width: 1024, height: 1024 },
  },
};
/** Promptable segmenter used when the user taps the subject. */
export const SAM_MODEL = { id: "Xenova/slimsam-77-uniform", dtype: "q8" };

/** Longest side (px) of the image handed to the models. */
export const INFERENCE_SIZE = 896;
/** Longest side (px) of the grid all geometry (mask, contour, corners) is computed on. */
export const GRID_SIZE = 384;

export const POINT_COUNT = { min: 5, default: 18, max: 40 };

/**
 * ADE20K labels worth treating as a photo's subject. Anything else (wall, sky,
 * grass, floor, ...) is background "stuff" and gets a small default weight so it
 * only wins when nothing better exists. `kind` selects which parts to look for.
 */
const subject = (kind, weight) => ({ kind, weight });
export const SUBJECT_CLASSES = {
  person: subject("person", 1),
  animal: subject("animal", 1),
  house: subject("building", 0.9),
  building: subject("building", 0.7),
  skyscraper: subject("building", 0.8),
  tower: subject("building", 0.8),
  hovel: subject("building", 0.8),
  car: subject("vehicle", 0.9),
  bus: subject("vehicle", 0.9),
  truck: subject("vehicle", 0.9),
  van: subject("vehicle", 0.9),
  minibike: subject("vehicle", 0.9),
  bicycle: subject("vehicle", 0.9),
  boat: subject("vehicle", 0.9),
  ship: subject("vehicle", 0.9),
  airplane: subject("vehicle", 0.9),
  plant: subject("object", 0.5),
  flower: subject("object", 0.6),
  vase: subject("object", 0.6),
  chair: subject("object", 0.5),
  armchair: subject("object", 0.5),
  sofa: subject("object", 0.5),
  table: subject("object", 0.4),
  bench: subject("object", 0.5),
  lamp: subject("object", 0.5),
  sculpture: subject("object", 0.6),
};
export const BACKGROUND_WEIGHT = 0.12;

/**
 * Semantic parts to look for with the zero-shot detector, per subject kind.
 * - `max`: most instances kept (eyes: 2, nose: 1, ...).
 * - `size`: largest plausible extent as a fraction of the subject's size.
 * - `shape`: "box" parts (windows, doors) can contribute their four corners.
 * - `weight`: how much a part matters for readability (drives selection order).
 */
const part = (name, max, size, weight, shape = "point") => ({ name, max, size, weight, shape });
export const PARTS_BY_KIND = {
  person: [
    part("eye", 2, 0.12, 1),
    part("nose", 1, 0.12, 0.9),
    part("mouth", 1, 0.14, 0.7),
    part("ear", 2, 0.18, 0.55),
    part("hand", 2, 0.25, 0.7),
    part("foot", 2, 0.25, 0.7),
  ],
  animal: [
    part("eye", 2, 0.12, 1),
    part("nose", 1, 0.14, 0.9),
    part("ear", 2, 0.28, 0.7),
    part("paw", 4, 0.28, 0.75),
    part("tail", 1, 0.35, 0.5),
  ],
  building: [
    part("door", 1, 0.5, 0.85, "box"),
    part("window", 6, 0.35, 0.75, "box"),
    part("chimney", 2, 0.3, 0.6, "box"),
  ],
  vehicle: [
    part("wheel", 3, 0.4, 0.85),
    part("window", 3, 0.45, 0.6, "box"),
    part("headlight", 2, 0.2, 0.55),
  ],
  object: [],
};

/**
 * The detector scores "a dog's ear" several times higher than a bare "an ear",
 * so each part is queried as "<owner> <part>" for every plausible owner and the
 * best-scoring phrasing wins. (Species-specific owners also cover cats etc.)
 */
const OWNERS = {
  person: ["a person's"],
  animal: ["an animal's", "a dog's", "a cat's"],
  building: ["a building's", "a"],
  vehicle: ["a vehicle's", "a"],
};
export const promptsFor = (kind, spec) => OWNERS[kind].map((owner) => `${owner} ${spec.name}`);

/** Whole-subject prompts that settle person vs animal (see `refineKind`). */
export const CREATURES = [
  { prompt: "a person", kind: "person", label: "person" },
  { prompt: "a dog", kind: "animal", label: "dog" },
  { prompt: "a cat", kind: "animal", label: "cat" },
  { prompt: "a bird", kind: "animal", label: "bird" },
  { prompt: "a horse", kind: "animal", label: "horse" },
  { prompt: "an animal", kind: "animal", label: "animal" },
];
export const MIN_CREATURE_SCORE = 0.12;

/** Detection tuning. Raw scores are tiny and image dependent, so hits are judged relative to the best one. */
export const DETECTION = { threshold: 0.002, minRelativeScore: 0.35, cropPadding: 0.1 };

/** Fraction of the point budget that semantic parts may use. */
export const SEMANTIC_BUDGET = 0.4;
/** Same, when doors/windows are present: each costs four corner points. */
export const BOX_SEMANTIC_BUDGET = 0.7;
/** Fraction of the point budget always kept for silhouette vertices. */
export const MIN_OUTLINE_SHARE = 0.33;
/** Of the budget left after semantic parts, the share given to outline vertices. */
export const OUTLINE_SHARE = 0.65;
