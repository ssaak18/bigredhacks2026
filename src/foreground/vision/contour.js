/** Outer-boundary tracing and shape simplification for a single-component mask. */

// Clockwise neighbour offsets in image coordinates: E, SE, S, SW, W, NW, N, NE.
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Moore-neighbour trace of the outer boundary, returned as ordered pixel centres. */
export function traceOuterContour(mask, width, height) {
  const filled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  const first = mask.indexOf(1);
  if (first < 0) return [];

  const startX = first % width;
  const startY = (first - startX) / width;
  // The raster-first pixel has background to its west, so we enter facing west (4).
  let x = startX;
  let y = startY;
  let back = 4;
  const points = [];

  for (let steps = 0; steps < mask.length * 4; steps += 1) {
    points.push({ x, y });
    let moved = false;
    for (let turn = 1; turn <= 8; turn += 1) {
      const dir = (back + turn) % 8;
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (!filled(nx, ny)) continue;
      // New backtrack: the background cell scanned just before the hit, seen from the new pixel.
      const prev = (back + turn - 1) % 8;
      const bx = x + DX[prev] - nx;
      const by = y + DY[prev] - ny;
      back = DX.findIndex((dx, k) => dx === bx && DY[k] === by);
      x = nx;
      y = ny;
      moved = true;
      break;
    }
    if (!moved) break; // isolated pixel
    if (x === startX && y === startY) break;
  }
  return points;
}

/** Circular moving average. */
export function smoothClosed(points, radius) {
  const n = points.length;
  return points.map((_, i) => {
    let sx = 0;
    let sy = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const p = points[(i + k + n * 4) % n];
      sx += p.x;
      sy += p.y;
    }
    const span = radius * 2 + 1;
    return { x: sx / span, y: sy / span };
  });
}

export function perimeter(points) {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return total;
}

/** Resamples a closed polyline to `count` points evenly spaced by arc length. */
export function resampleClosed(points, count) {
  const total = perimeter(points);
  const step = total / count;
  const out = [];
  let index = 0;
  let travelled = 0; // arc length at points[index]
  for (let i = 0; i < count; i += 1) {
    const target = i * step;
    while (true) {
      const a = points[index % points.length];
      const b = points[(index + 1) % points.length];
      const segment = Math.hypot(b.x - a.x, b.y - a.y);
      if (travelled + segment >= target || index > points.length * 2) {
        const t = segment ? (target - travelled) / segment : 0;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        break;
      }
      travelled += segment;
      index += 1;
    }
  }
  return out;
}

/**
 * Visvalingam-Whyatt importance for each vertex of a closed polygon: the
 * (monotonic) triangle area at which the vertex would be removed. Vertices that
 * define the shape - ear tips, paws, roof corners - outlive gentle curves.
 */
export function vertexImportance(points) {
  const n = points.length;
  const prev = Array.from({ length: n }, (_, i) => (i + n - 1) % n);
  const next = Array.from({ length: n }, (_, i) => (i + 1) % n);
  const area = (i) => {
    const a = points[prev[i]];
    const b = points[i];
    const c = points[next[i]];
    return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  };
  const areas = Array.from({ length: n }, (_, i) => area(i));
  const alive = new Uint8Array(n).fill(1);
  const importance = new Float64Array(n);
  let floor = 0;
  for (let remaining = n; remaining > 3; remaining -= 1) {
    let best = -1;
    for (let i = 0; i < n; i += 1) if (alive[i] && (best < 0 || areas[i] < areas[best])) best = i;
    floor = Math.max(floor, areas[best]);
    importance[best] = floor;
    alive[best] = 0;
    next[prev[best]] = next[best];
    prev[next[best]] = prev[best];
    areas[prev[best]] = area(prev[best]);
    areas[next[best]] = area(next[best]);
  }
  for (let i = 0; i < n; i += 1) if (alive[i]) importance[i] = Infinity;
  return importance;
}
