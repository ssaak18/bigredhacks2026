/** Shi-Tomasi corner detection restricted to the subject. */

function boxBlur(values, width, height, radius) {
  const pass = (input, length, lines, stride, step) => {
    const out = new Float32Array(input.length);
    const span = radius * 2 + 1;
    for (let line = 0; line < lines; line += 1) {
      for (let i = 0; i < length; i += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          sum += input[line * stride + Math.min(length - 1, Math.max(0, i + k)) * step];
        }
        out[line * stride + i * step] = sum / span;
      }
    }
    return out;
  };
  return pass(pass(values, width, height, width, 1), height, width, 1, width);
}

/**
 * Finds locally dominant corners (smaller structure-tensor eigenvalue) on a
 * grayscale grid, keeping only pixels where `allowed[i]` is set. Priorities are
 * normalized so the strongest corner is 1. Returns every non-max-suppressed
 * corner above `minRelative`, strongest first.
 */
export function findCorners(gray, width, height, allowed, { scale, minRelative = 0.08, separation }) {
  const smoothed = boxBlur(gray, width, height, 1);
  const ixx = new Float32Array(gray.length);
  const iyy = new Float32Array(gray.length);
  const ixy = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = smoothed[i + 1] - smoothed[i - 1];
      const gy = smoothed[i + width] - smoothed[i - width];
      ixx[i] = gx * gx;
      iyy[i] = gy * gy;
      ixy[i] = gx * gy;
    }
  }
  // Integrate gradients over a window proportional to the subject so texture is ignored.
  const radius = Math.max(2, Math.round(scale * 0.02));
  const sxx = boxBlur(ixx, width, height, radius);
  const syy = boxBlur(iyy, width, height, radius);
  const sxy = boxBlur(ixy, width, height, radius);

  const response = new Float32Array(gray.length);
  let peak = 0;
  for (let i = 0; i < response.length; i += 1) {
    if (!allowed[i]) continue;
    const half = (sxx[i] + syy[i]) / 2;
    const diff = (sxx[i] - syy[i]) / 2;
    response[i] = half - Math.hypot(diff, sxy[i]);
    peak = Math.max(peak, response[i]);
  }
  if (!peak) return [];

  const found = [];
  const reach = Math.max(2, Math.round(separation / 2));
  for (let y = reach; y < height - reach; y += 1) {
    for (let x = reach; x < width - reach; x += 1) {
      const value = response[y * width + x];
      if (value / peak < minRelative) continue;
      let isMax = true;
      for (let dy = -reach; dy <= reach && isMax; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          if (response[(y + dy) * width + x + dx] > value) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) found.push({ x, y, priority: value / peak });
    }
  }
  return found.sort((a, b) => b.priority - a.priority);
}
