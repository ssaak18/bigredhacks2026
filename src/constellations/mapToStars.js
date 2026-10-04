import {
  angularDistanceDeg,
  localOffsetsFromRaDec,
  raDecFromLocalOffsets,
} from "../astro/localSky.js";
import { catalogId } from "../data/celestialBodies";

const MAX_SNAP_DEG = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Snap radius shrinks with the constellation so a small figure stays tight. */
function snapLimits(spanDeg = 12) {
  return {
    maxSnapDeg: clamp(spanDeg * 0.3, 1.5, MAX_SNAP_DEG),
  };
}

function drawingLayout(drawing, { spanDeg = 12, xToward = "west" } = {}) {
  const xs = drawing.points.map((point) => point.x);
  const ys = drawing.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxY - minY, 1e-9);
  return {
    scale: spanDeg / Math.max(width, height),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    xSign: xToward === "west" ? 1 : -1,
  };
}

function projectPoint(point, center, layout) {
  const westDeg = (point.x - layout.cx) * layout.scale * layout.xSign;
  const northDeg = (point.y - layout.cy) * layout.scale;
  const eastDeg = -westDeg;
  return {
    target: raDecFromLocalOffsets(center, eastDeg, northDeg),
    eastDeg,
    northDeg,
  };
}

/** Rigid 2D fit (rotate + translate, no scale) taking `from` onto `to`. */
function fitRigid(from, to) {
  const n = from.length;
  if (n === 0) return (point) => point;
  let ax = 0;
  let ay = 0;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < n; i += 1) {
    ax += from[i].x;
    ay += from[i].y;
    bx += to[i].x;
    by += to[i].y;
  }
  ax /= n;
  ay /= n;
  bx /= n;
  by /= n;
  if (n === 1) {
    const dx = bx - ax;
    const dy = by - ay;
    return (point) => ({ x: point.x + dx, y: point.y + dy });
  }
  let dot = 0;
  let cross = 0;
  for (let i = 0; i < n; i += 1) {
    const fx = from[i].x - ax;
    const fy = from[i].y - ay;
    const tx = to[i].x - bx;
    const ty = to[i].y - by;
    dot += fx * tx + fy * ty;
    cross += fx * ty - fy * tx;
  }
  const angle = Math.atan2(cross, dot);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (point) => {
    const dx = point.x - ax;
    const dy = point.y - ay;
    return {
      x: cos * dx - sin * dy + bx,
      y: sin * dx + cos * dy + by,
    };
  };
}

export function projectEuclideanToSky(
  drawing,
  zenith,
  options = {},
) {
  const layout = drawingLayout(drawing, options);
  return drawing.points.map((point) => {
    const projected = projectPoint(point, zenith, layout);
    return {
      id: point.id,
      x: point.x,
      y: point.y,
      ...projected,
    };
  });
}

function markClosed(points, closed) {
  points.closed = closed;
  return points;
}

/** Rings as point arrays. `ring.closed === false` means an open Canny chain. */
export function outlineRings(mapped) {
  const raw = mapped?.outlines?.length
    ? mapped.outlines
    : (mapped?.outline?.length ? [mapped.outline] : []);
  return raw.map((ring) => {
    if (Array.isArray(ring)) return markClosed(ring, ring.closed !== false);
    const points = ring?.points ?? [];
    return markClosed(points, ring?.closed !== false);
  }).filter((ring) => ring.length);
}

function projectRing(ring, center, layout, apply) {
  return ring.map((point) => {
    const projected = projectPoint(point, center, layout);
    if (!apply) return { ra: projected.target.ra, dec: projected.target.dec };
    const fitted = apply({ x: projected.eastDeg, y: projected.northDeg });
    return raDecFromLocalOffsets(center, fitted.x, fitted.y);
  });
}

function projectOutlines(drawing, center, options, vertices) {
  const rings = drawing.outlines?.length ? drawing.outlines : (drawing.outline?.length ? [drawing.outline] : []);
  if (!rings.length) return [];
  const layout = drawingLayout(drawing, options);
  const pairs = vertices.filter((vertex) => vertex.star);
  const apply = pairs.length >= 2
    ? fitRigid(
      pairs.map((vertex) => ({ x: vertex.eastDeg, y: vertex.northDeg })),
      pairs.map((vertex) => {
        const offset = localOffsetsFromRaDec(center, vertex.star);
        return { x: offset.eastDeg, y: offset.northDeg };
      }),
    )
    : null;
  return rings.filter((ring) => ring.length >= 3).map((ring) => (
    markClosed(projectRing(ring, center, layout, apply), ring.closed !== false)
  ));
}

function isCatalogStar(body) {
  return !body.kind || body.kind === "star";
}

/** Stars inside the snap radius, nearest first. Planets and deep-sky objects are skipped. */
function candidatesFor(target, stars, maxSnapDeg) {
  const candidates = [];
  for (const star of stars) {
    if (!isCatalogStar(star)) continue;
    const distance = angularDistanceDeg(target, star);
    if (distance > maxSnapDeg) continue;
    candidates.push({ star, distance });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

export function snapToNearestStars(
  projectedPoints,
  stars,
  zenith,
  { unique = true, maxZenithDistanceDeg = 80, excludeHips = [], spanDeg = 12 } = {},
) {
  const limits = snapLimits(spanDeg);
  const visible = stars.filter(
    (star) => angularDistanceDeg(zenith, star) <= maxZenithDistanceDeg,
  );
  // Stars that already belong to another constellation are off limits.
  const used = new Set(excludeHips);
  const vertices = projectedPoints.map((point) => ({
    ...point,
    star: null,
    snapDistanceDeg: null,
  }));
  const pools = vertices.map((vertex) => candidatesFor(vertex.target, visible, limits.maxSnapDeg));
  const cursor = pools.map(() => 0);
  const open = new Set(vertices.map((_, index) => index));

  // Assign the closest remaining pair first so two vertices don't fight over one star
  // and pull the figure off the drawing.
  while (open.size > 0) {
    let best = null;
    for (const index of open) {
      const pool = pools[index];
      let next = cursor[index];
      while (next < pool.length && unique && used.has(catalogId(pool[next].star))) next += 1;
      cursor[index] = next;
      if (next >= pool.length) continue;
      const candidate = pool[next];
      if (!best || candidate.distance < best.distance) {
        best = { index, star: candidate.star, distance: candidate.distance };
      }
    }
    if (!best) break;
    const vertex = vertices[best.index];
    vertex.star = best.star;
    vertex.snapDistanceDeg = best.distance;
    if (unique) used.add(catalogId(best.star));
    open.delete(best.index);
    for (const index of [...open]) {
      if (cursor[index] >= pools[index].length) open.delete(index);
    }
  }

  return vertices;
}

/**
 * `zenith` decides which stars are above the horizon. `options.center` is where the
 * drawing is laid out on the sky (the zenith when omitted).
 */
export function mapEuclideanConstellation(drawing, stars, zenith, options = {}) {
  const center = options.center ?? zenith;
  const projected = projectEuclideanToSky(drawing, center, options);
  const vertices = snapToNearestStars(projected, stars, zenith, options);
  const outlines = projectOutlines(drawing, center, options, vertices);
  return {
    name: drawing.name,
    id: drawing.id,
    lines: drawing.lines,
    vertices,
    outlines,
    outline: outlines[0] ?? [],
  };
}
