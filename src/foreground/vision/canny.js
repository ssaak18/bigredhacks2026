import { dilate } from "./mask.js";

/** High Canny threshold as a percent of the strongest gradient. Lower keeps more edges. */
export const EDGE_THRESHOLD = { min: 8, default: 30, max: 55 };

const GAUSS = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
const NEIGHBORS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

function blur(values, width, height) {
  const pass = (input, horizontal) => {
    const out = new Float32Array(input.length);
    const radius = 2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const xx = horizontal ? Math.min(width - 1, Math.max(0, x + k)) : x;
          const yy = horizontal ? y : Math.min(height - 1, Math.max(0, y + k));
          sum += input[yy * width + xx] * GAUSS[k + radius];
        }
        out[y * width + x] = sum;
      }
    }
    return out;
  };
  return pass(pass(values, true), false);
}

function gradients(gray, width, height) {
  const mag = new Float32Array(gray.length);
  const dir = new Uint8Array(gray.length);
  let peak = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const sx = -gray[i - 1 - width] + gray[i + 1 - width] - 2 * gray[i - 1] + 2 * gray[i + 1]
        - gray[i - 1 + width] + gray[i + 1 + width];
      const sy = -gray[i - 1 - width] - 2 * gray[i - width] - gray[i + 1 - width]
        + gray[i - 1 + width] + 2 * gray[i + width] + gray[i + 1 + width];
      const m = Math.hypot(sx, sy);
      mag[i] = m;
      peak = Math.max(peak, m);
      const angle = ((Math.atan2(sy, sx) * 180) / Math.PI + 180) % 180;
      dir[i] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
    }
  }
  return { mag, dir, peak };
}

function suppress(mag, dir, width, height) {
  const out = new Float32Array(mag.length);
  const offset = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const [dx, dy] = offset[dir[i]];
      const a = mag[(y - dy) * width + (x - dx)];
      const b = mag[(y + dy) * width + (x + dx)];
      if (mag[i] >= a && mag[i] >= b) out[i] = mag[i];
    }
  }
  return out;
}

function hysteresis(nms, width, height, allowed, high, low) {
  const edges = new Uint8Array(nms.length);
  const stack = [];
  for (let i = 0; i < nms.length; i += 1) {
    if (!allowed[i] || nms[i] < high) continue;
    edges[i] = 1;
    stack.push(i);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (edges[j] || !allowed[j] || nms[j] < low) continue;
      edges[j] = 1;
      stack.push(j);
    }
  }
  return edges;
}

function degree(edges, width, height, x, y) {
  let count = 0;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (edges[ny * width + nx]) count += 1;
  }
  return count;
}

function nextUnvisited(edges, visited, width, height, x, y, backX, backY) {
  let best = null;
  let bestDot = -Infinity;
  const vx = x - backX;
  const vy = y - backY;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const j = ny * width + nx;
    if (!edges[j] || visited[j]) continue;
    const dot = dx * vx + dy * vy;
    if (dot > bestDot) {
      bestDot = dot;
      best = { x: nx, y: ny, i: j };
    }
  }
  return best;
}

function walk(edges, visited, width, height, startX, startY, prevX, prevY) {
  const chain = [];
  let x = startX;
  let y = startY;
  let backX = prevX;
  let backY = prevY;
  while (true) {
    const i = y * width + x;
    if (visited[i]) break;
    visited[i] = 1;
    chain.push({ x, y });
    const next = nextUnvisited(edges, visited, width, height, x, y, backX, backY);
    if (!next) break;
    backX = x;
    backY = y;
    x = next.x;
    y = next.y;
  }
  return chain;
}

function traceChains(edges, width, height) {
  const visited = new Uint8Array(edges.length);
  const starts = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!edges[i]) continue;
      const deg = degree(edges, width, height, x, y);
      if (deg <= 1) starts.push({ x, y, i, deg });
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (edges[i]) starts.push({ x, y, i, deg: 2 });
    }
  }

  const chains = [];
  for (const start of starts) {
    if (visited[start.i]) continue;
    const forward = walk(edges, visited, width, height, start.x, start.y, start.x, start.y);
    if (forward.length < 14) continue;
    chains.push(forward);
  }
  return chains;
}

/**
 * Canny edges of `gray` (0-255) clipped to a dilated subject mask. `threshold`
 * is the high cut as a percent of the peak gradient (see EDGE_THRESHOLD).
 */
export function cannyChains(gray, width, height, mask, threshold = EDGE_THRESHOLD.default) {
  if (!gray || !mask) return [];
  const allowed = dilate(mask, width, height, 2);
  const blurred = blur(gray, width, height);
  const { mag, dir, peak } = gradients(blurred, width, height);
  if (!peak) return [];
  const high = peak * (Math.max(EDGE_THRESHOLD.min, Math.min(EDGE_THRESHOLD.max, threshold)) / 100);
  const low = high * 0.4;
  const nms = suppress(mag, dir, width, height);
  const edges = hysteresis(nms, width, height, allowed, high, low);
  return traceChains(edges, width, height).sort((a, b) => b.length - a.length).slice(0, 48);
}
