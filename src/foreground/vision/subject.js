import { BACKGROUND_WEIGHT, SUBJECT_CLASSES } from "./config.js";
import { close, fillHoles, largestComponent, maskBounds, resampleMask, smooth } from "./mask.js";

const MIN_AREA_SHARE = 0.01;

/** Closes gaps, fills holes, keeps one blob and rounds it off. */
function cleanMask(mask, width, height) {
  const { x0, y0, x1, y1 } = maskBounds(mask, width);
  const radius = Math.max(1, Math.round(Math.max(x1 - x0, y1 - y0) * 0.012));
  const closed = close(mask, width, height, radius);
  return smooth(largestComponent(fillHoles(closed, width, height), width, height), width, height, 2);
}

function finish({ label, kind, mask, confidence }, width, height) {
  const cleaned = cleanMask(mask, width, height);
  const bounds = maskBounds(cleaned, width);
  if (bounds.area < width * height * MIN_AREA_SHARE) throw new Error("The subject is too small to build a constellation from.");
  return { label, kind, mask: cleaned, bounds, confidence };
}

const overlap = (a, b) => a.reduce((sum, value, i) => sum + (value & b[i]), 0);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Picks the photo's primary subject.
 *
 * Each ADE20K segment is a candidate. A class-agnostic foreground matte (when
 * available) votes on which candidates are salient, so objects outside the 150
 * known classes can still win and big background regions (wall, grass) lose.
 * Without a matte, class weights alone decide: person/animal/building beat stuff.
 * If no segment is salient the matte itself becomes the subject.
 *
 * Also scores how sure the choice is (`confidence`), so the UI can ask the
 * user to point at the subject when the photo is ambiguous.
 */
export function pickPrimarySubject(segments, matte, width, height) {
  const salient = matte ? smooth(resampleMask({ ...matte, channels: 1 }, width, height), width, height, 2) : null;
  const salientArea = salient ? salient.reduce((sum, value) => sum + value, 0) : 0;

  const candidates = [];
  for (const segment of segments) {
    const label = segment.label.trim().toLowerCase();
    const known = SUBJECT_CLASSES[label];
    const mask = largestComponent(resampleMask(segment.mask, width, height), width, height);
    const { x0, y0, x1, y1, area } = maskBounds(mask, width);
    const areaShare = area / (width * height);
    if (areaShare < MIN_AREA_SHARE) continue;
    const coverage = salient ? overlap(mask, salient) / area : 1;
    if (coverage < 0.5) continue;
    const offCenter = Math.hypot((x0 + x1) / 2 / width - 0.5, (y0 + y1) / 2 / height - 0.5) / Math.SQRT1_2;
    const classFactor = known ? 0.6 + 0.4 * known.weight : salient ? 0.6 : BACKGROUND_WEIGHT;
    candidates.push({
      label,
      kind: known?.kind ?? "object",
      mask,
      coverage,
      score: coverage ** 2 * Math.sqrt(areaShare) * (1 - 0.5 * offCenter) * classFactor,
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  let best = candidates[0];
  if (!best && salient && salientArea >= width * height * MIN_AREA_SHARE) {
    best = { label: "subject", kind: "object", mask: largestComponent(salient, width, height), coverage: 0.5, score: 1 };
  }
  if (!best) throw new Error("No clear subject was found in this photo.");

  const subject = finish({ label: best.label, kind: best.kind, mask: best.mask, confidence: null }, width, height);
  subject.confidence = rateConfidence({ subject, best, runnerUp: candidates[1], salient, width, height });
  return subject;
}

/** Combines: how salient the pick is, its lead over the runner-up, how much of the salient area it explains, and its size. */
function rateConfidence({ subject, best, runnerUp, salient, width, height }) {
  const margin = runnerUp ? (best.score - runnerUp.score) / best.score : 1;
  const recall = salient ? overlap(subject.mask, salient) / Math.max(1, salient.reduce((sum, value) => sum + value, 0)) : 1;
  const share = subject.bounds.area / (width * height);
  const { x0, y0, x1, y1 } = subject.bounds;
  const sidesTouched = [x0 <= 1, y0 <= 1, x1 >= width - 1, y1 >= height - 1].filter(Boolean).length;

  const score = clamp01(
    0.35 * best.coverage + 0.25 * clamp01(margin / 0.4) + 0.25 * clamp01(recall / 0.8) + 0.15 * (share > 0.04 && share < 0.8 ? 1 : 0.3)
      - (sidesTouched >= 3 ? 0.15 : 0),
  );
  const reason =
    margin < 0.15 ? "Another object competes for the main subject."
      : recall < 0.5 ? "The photo has other prominent things besides the chosen subject."
        : best.coverage < 0.7 ? "The subject's edges are unclear."
          : "";
  return { score, low: score < 0.7, reason };
}

/**
 * Builds the subject from a mask the user asked for (e.g. by tapping it). The
 * class label is the ADE20K segment that mostly lies under the mask, preferring
 * known object classes.
 */
export function subjectFromMask(source, segments, width, height) {
  const mask = resampleMask({ ...source, channels: 1 }, width, height);
  const area = mask.reduce((sum, value) => sum + value, 0);
  if (!area) throw new Error("Nothing could be cut out at that spot. Try tapping the middle of the subject.");

  const votes = segments
    .map((segment) => {
      const label = segment.label.trim().toLowerCase();
      return { label, known: SUBJECT_CLASSES[label], share: overlap(mask, resampleMask(segment.mask, width, height)) / area };
    })
    .filter((vote) => vote.share >= 0.25)
    .sort((a, b) => b.share + (b.known ? 0.2 : 0) - (a.share + (a.known ? 0.2 : 0)));
  const vote = votes[0];
  return finish(
    {
      label: vote?.label ?? "subject",
      kind: vote?.known?.kind ?? "object",
      mask,
      confidence: { score: 1, low: false, reason: "" },
    },
    width,
    height,
  );
}
