import { labelComponents } from "./mask.js";
import { perimeter, resampleClosed, smoothClosed, traceOuterContour } from "./contour.js";

const INNER_PARTS = new Set(["eye", "nose", "mouth", "ear", "headlight", "wheel"]);
const DARK_FRACTION = { eye: 0.48, nose: 0.42, mouth: 0.4, ear: 0.32, headlight: 0.4, wheel: 0.4 };

function clampBox(box, width, height) {
  return {
    x0: Math.max(0, Math.floor(box.x0)),
    y0: Math.max(0, Math.floor(box.y0)),
    x1: Math.min(width, Math.ceil(box.x1)),
    y1: Math.min(height, Math.ceil(box.y1)),
  };
}

function padBox(box, width, height, pad) {
  const w = Math.max(4, box.x1 - box.x0);
  const h = Math.max(4, box.y1 - box.y0);
  return clampBox({
    x0: box.x0 - w * pad,
    y0: box.y0 - h * pad,
    x1: box.x1 + w * pad,
    y1: box.y1 + h * pad,
  }, width, height);
}

function boxAround(part, radius) {
  return { x0: part.x - radius, y0: part.y - radius, x1: part.x + radius, y1: part.y + radius };
}

function boxArea(box) {
  return Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0));
}

function markBox(used, box, width) {
  for (let y = box.y0; y < box.y1; y += 1) {
    used.fill(1, y * width + box.x0, y * width + box.x1);
  }
}

function contourFromMask(mask, width, height) {
  const boundary = traceOuterContour(mask, width, height);
  if (boundary.length < 8) return null;
  const smoothed = smoothClosed(boundary, 1);
  const samples = Math.min(120, Math.max(28, Math.round(perimeter(smoothed))));
  return resampleClosed(smoothed, samples);
}

function componentMask(labels, id, length) {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) if (labels[i] === id) out[i] = 1;
  return out;
}

function bestComponent(labels, sizes, width, { cx, cy, minArea, maxArea }) {
  let best = 0;
  let bestScore = Infinity;
  for (let id = 1; id < sizes.length; id += 1) {
    const area = sizes[id];
    if (area < minArea || area > maxArea) continue;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < labels.length; i += 1) {
      if (labels[i] !== id) continue;
      sx += i % width;
      sy += (i - (i % width)) / width;
    }
    const dx = sx / area - cx;
    const dy = sy / area - cy;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function darkBlobInBox(gray, mask, width, height, box, fraction) {
  const values = [];
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = y * width + x;
      if (mask[i]) values.push(gray[i]);
    }
  }
  if (values.length < 12) return null;
  values.sort((a, b) => a - b);
  const thresh = values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
  const local = new Uint8Array(mask.length);
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = y * width + x;
      if (mask[i] && gray[i] <= thresh) local[i] = 1;
    }
  }
  const { labels, sizes } = labelComponents(local, width, height);
  const id = bestComponent(labels, sizes, width, {
    cx: (box.x0 + box.x1) / 2,
    cy: (box.y0 + box.y1) / 2,
    minArea: 8,
    maxArea: boxArea(box) * 0.7,
  });
  return id ? componentMask(labels, id, mask.length) : null;
}

function maskInBox(mask, width, height, box) {
  const local = new Uint8Array(mask.length);
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = y * width + x;
      if (mask[i]) local[i] = 1;
    }
  }
  const { labels, sizes } = labelComponents(local, width, height);
  const id = bestComponent(labels, sizes, width, {
    cx: (box.x0 + box.x1) / 2,
    cy: (box.y0 + box.y1) / 2,
    minArea: 8,
    maxArea: boxArea(box),
  });
  return id ? componentMask(labels, id, mask.length) : null;
}

function extraDarkRings(gray, mask, used, width, height, size) {
  const interior = [];
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || used[i]) continue;
    interior.push(i);
    sum += gray[i];
    sum2 += gray[i] * gray[i];
  }
  if (interior.length < 40) return [];
  const mean = sum / interior.length;
  const std = Math.sqrt(Math.max(0, sum2 / interior.length - mean * mean));
  const thresh = mean - 0.75 * std;
  const local = new Uint8Array(mask.length);
  for (const i of interior) if (gray[i] <= thresh) local[i] = 1;
  const { labels, sizes } = labelComponents(local, width, height);
  const minArea = Math.max(12, Math.round(size * size * 0.0008));
  const maxArea = Math.round(size * size * 0.012);
  const rings = [];
  const ranked = sizes
    .map((area, id) => ({ id, area }))
    .filter(({ id, area }) => id && area >= minArea && area <= maxArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, 2);
  for (const { id } of ranked) {
    const contour = contourFromMask(componentMask(labels, id, mask.length), width, height);
    if (contour) rings.push(contour);
  }
  return rings;
}

/**
 * Closed inner contours for eyes, ears and other detected features, plus any
 * leftover dark blobs inside the subject that look like features the detector
 * missed.
 */
export function traceFeatureRings({ gray, mask, parts, width, height, size }) {
  const rings = [];
  const used = new Uint8Array(mask.length);

  for (const part of parts) {
    const isBox = part.corners?.length >= 4;
    if (!isBox && !INNER_PARTS.has(part.part)) continue;
    const fallback = boxAround(part, size * (part.part === "ear" ? 0.14 : 0.07));
    const box = padBox(part.box ?? fallback, width, height, 0.18);
    if (box.x1 - box.x0 < 4 || box.y1 - box.y0 < 4) continue;

    if (isBox) {
      rings.push(part.corners);
      markBox(used, box, width);
      continue;
    }

    let local = null;
    if (INNER_PARTS.has(part.part)) {
      local = darkBlobInBox(gray, mask, width, height, box, DARK_FRACTION[part.part] ?? 0.35);
    }
    if (!local) {
      const tight = padBox(part.box ?? fallback, width, height, part.part === "ear" ? 0.05 : 0.1);
      local = maskInBox(mask, width, height, tight);
    }
    const contour = local ? contourFromMask(local, width, height) : null;
    if (contour) {
      rings.push(contour);
      markBox(used, box, width);
    }
  }

  const eyes = parts.filter((part) => part.part === "eye").length;
  if (eyes < 2) {
    rings.push(...extraDarkRings(gray, mask, used, width, height, size).slice(0, 2 - eyes));
  }
  return rings;
}
