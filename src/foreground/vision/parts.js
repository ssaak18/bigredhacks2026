import { CREATURES, DETECTION, MIN_CREATURE_SCORE, PARTS_BY_KIND, promptsFor } from "./config.js";
import { cropImage } from "./image.js";
import { dilate } from "./mask.js";

const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);

function overlap(a, b) {
  const inter = area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
  return inter / (area(a) + area(b) - inter || 1);
}

/** Moves each raw box corner onto a nearby real image corner so doors and windows come out crisp. */
function snapCorners(box, corners) {
  const reach = Math.min(box.x1 - box.x0, box.y1 - box.y0) * 0.3;
  const raw = [
    { x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 },
  ];
  const used = new Set();
  return raw.map((corner) => {
    let best = null;
    for (const candidate of corners) {
      const d = Math.hypot(candidate.x - corner.x, candidate.y - corner.y);
      if (d <= reach && !used.has(candidate) && (!best || d < best.d)) best = { candidate, d };
    }
    if (!best) return corner;
    used.add(best.candidate);
    return { x: best.candidate.x, y: best.candidate.y };
  });
}

function subjectCrop(image, subject, scale) {
  const { x0, y0, x1, y1 } = subject.bounds;
  const size = Math.max(x1 - x0, y1 - y0);
  const pad = size * DETECTION.cropPadding;
  return { size, crop: cropImage(image, (x0 - pad) / scale, (y0 - pad) / scale, (x1 + pad) / scale, (y1 + pad) / scale) };
}

/**
 * Scene parsing labels by shape and context, so a dog wrapped in a blanket can
 * come back as "person" and an unfamiliar object as nothing useful. A
 * whole-subject check against a few common creatures settles person vs animal
 * before the parts to look for are chosen. Returns `{ kind, label }`.
 */
export async function refineKind({ models, image, subject, scale }) {
  if (subject.kind === "building" || subject.kind === "vehicle") return subject;
  const { crop, size } = subjectCrop(image, subject, scale);
  const hits = await models.detect(crop, CREATURES.map(({ prompt }) => prompt), DETECTION.threshold);

  const best = new Map();
  for (const hit of hits) {
    if (Math.max(hit.box.x1 - hit.box.x0, hit.box.y1 - hit.box.y0) * scale < size * 0.5) continue; // whole subject only
    best.set(hit.label, Math.max(best.get(hit.label) ?? 0, hit.score));
  }
  const ranked = CREATURES.map((creature) => ({ ...creature, score: best.get(creature.prompt) ?? 0 })).sort((a, b) => b.score - a.score);
  const [top] = ranked;
  const rival = ranked.find((creature) => creature.kind !== top.kind);
  if (top.score < MIN_CREATURE_SCORE || top.score < rival.score * 1.5 || top.kind === subject.kind) return subject;
  return { ...subject, kind: top.kind, label: top.label };
}

/**
 * Locates semantic parts (eyes, nose, paws, windows, ...) of the subject with a
 * zero-shot detector run on a crop of the subject, then keeps the few hits per
 * part that are plausible: inside the subject, sensibly sized, well separated
 * and not much weaker than the best hit of that part.
 *
 * `image` is the model-resolution image; all other geometry lives on the grid,
 * `scale` px of grid per px of image. Returns parts in grid coordinates.
 */
export async function detectParts({ models, image, subject, grid, scale, cornerPool }) {
  const specs = PARTS_BY_KIND[subject.kind] ?? [];
  if (!specs.length) return [];

  const { crop, size } = subjectCrop(image, subject, scale);
  const prompts = new Map(specs.map((spec) => [spec, promptsFor(subject.kind, spec)]));
  const hits = await models.detect(crop, [...prompts.values()].flat(), DETECTION.threshold);

  const reach = dilate(subject.mask, grid.width, grid.height, Math.max(1, Math.round(size * 0.04)));
  const parts = [];
  for (const spec of specs) {
    const candidates = hits
      .filter((hit) => prompts.get(spec).includes(hit.label))
      .map((hit) => ({
        score: hit.score,
        x0: crop.left * scale + hit.box.x0 * scale,
        y0: crop.top * scale + hit.box.y0 * scale,
        x1: crop.left * scale + hit.box.x1 * scale,
        y1: crop.top * scale + hit.box.y1 * scale,
      }))
      .filter((box) => {
        const extent = Math.max(box.x1 - box.x0, box.y1 - box.y0);
        const cx = Math.round((box.x0 + box.x1) / 2);
        const cy = Math.round((box.y0 + box.y1) / 2);
        const inside = cx >= 0 && cy >= 0 && cx < grid.width && cy < grid.height && reach[cy * grid.width + cx] === 1;
        return inside && extent <= spec.size * size && extent >= 0.01 * size;
      })
      .sort((a, b) => b.score - a.score);

    const kept = [];
    for (const box of candidates) {
      if (kept.length >= spec.max) break;
      if (box.score < candidates[0].score * DETECTION.minRelativeScore) break;
      if (kept.some((other) => overlap(other, box) > 0.2)) continue;
      kept.push(box);
    }
    for (const box of kept) {
      parts.push({
        part: spec.name,
        shape: spec.shape,
        x: (box.x0 + box.x1) / 2,
        y: (box.y0 + box.y1) / 2,
        priority: spec.weight * (0.5 + 0.5 * (box.score / candidates[0].score)),
        corners: spec.shape === "box" ? snapCorners(box, cornerPool) : undefined,
      });
    }
  }
  return parts;
}
