/** Binary-mask operations. A mask is a Uint8Array of 0/1 values, row-major. */

/** Resamples a model mask (0-255 values) onto a `width` x `height` binary grid. */
export function resampleMask(source, width, height) {
  const channels = source.channels || 1;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const sx = Math.min(source.width - 1, Math.floor(((x + ox) / width) * source.width));
        const sy = Math.min(source.height - 1, Math.floor(((y + oy) / height) * source.height));
        sum += source.data[(sy * source.width + sx) * channels];
      }
      out[y * width + x] = sum / 4 >= 128 ? 1 : 0;
    }
  }
  return out;
}

/** Labels 4-connected foreground components. Returns per-pixel labels (0 = background) and sizes. */
export function labelComponents(mask, width, height) {
  const labels = new Int32Array(mask.length);
  const sizes = [0];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = id;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index >= width ? index - width : -1,
        index < mask.length - width ? index + width : -1,
      ];
      for (const next of neighbours) {
        if (next >= 0 && mask[next] && !labels[next]) {
          labels[next] = id;
          queue[tail++] = next;
        }
      }
    }
    sizes.push(tail);
  }
  return { labels, sizes };
}

export function largestComponent(mask, width, height) {
  const { labels, sizes } = labelComponents(mask, width, height);
  let best = 0;
  for (let id = 1; id < sizes.length; id += 1) if (sizes[id] > sizes[best]) best = id;
  const out = new Uint8Array(mask.length);
  if (best) for (let i = 0; i < mask.length; i += 1) out[i] = labels[i] === best ? 1 : 0;
  return out;
}

/** Fills regions of background that are not connected to the image border. */
export function fillHoles(mask, width, height) {
  const inverse = mask.map((value) => 1 - value);
  const { labels } = labelComponents(inverse, width, height);
  const outside = new Set();
  for (let x = 0; x < width; x += 1) {
    outside.add(labels[x]);
    outside.add(labels[(height - 1) * width + x]);
  }
  for (let y = 0; y < height; y += 1) {
    outside.add(labels[y * width]);
    outside.add(labels[y * width + width - 1]);
  }
  return mask.map((value, i) => (value || !outside.has(labels[i]) ? 1 : 0));
}

/** Separable square max/min filter of the given radius. */
function rankFilter(mask, width, height, radius, pickMax) {
  const pass = (input, length, lines, stride, step) => {
    const out = new Uint8Array(input.length);
    for (let line = 0; line < lines; line += 1) {
      for (let i = 0; i < length; i += 1) {
        let value = pickMax ? 0 : 1;
        for (let k = -radius; k <= radius; k += 1) {
          const j = i + k;
          const sample = j < 0 || j >= length ? (pickMax ? 0 : 1) : input[line * stride + j * step];
          value = pickMax ? Math.max(value, sample) : Math.min(value, sample);
        }
        out[line * stride + i * step] = value;
      }
    }
    return out;
  };
  return pass(pass(mask, width, height, width, 1), height, width, 1, width);
}

export const dilate = (mask, width, height, radius) => rankFilter(mask, width, height, radius, true);
export const erode = (mask, width, height, radius) => rankFilter(mask, width, height, radius, false);
export const close = (mask, width, height, radius) =>
  erode(dilate(mask, width, height, radius), width, height, radius);

/** Box-blurs then re-thresholds, rounding off single-pixel jaggies. */
export function smooth(mask, width, height, radius) {
  const blur = (input, length, lines, stride, step) => {
    const out = new Float32Array(input.length);
    const span = radius * 2 + 1;
    for (let line = 0; line < lines; line += 1) {
      for (let i = 0; i < length; i += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const j = Math.min(length - 1, Math.max(0, i + k));
          sum += input[line * stride + j * step];
        }
        out[line * stride + i * step] = sum / span;
      }
    }
    return out;
  };
  const blurred = blur(blur(mask, width, height, width, 1), height, width, 1, width);
  return Uint8Array.from(blurred, (value) => (value >= 0.5 ? 1 : 0));
}

export function maskBounds(mask, width) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    area += 1;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return { x0, y0, x1, y1, area };
}
