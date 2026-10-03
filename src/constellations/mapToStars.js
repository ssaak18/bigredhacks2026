import {
  angularDistanceDeg,
  raDecFromLocalOffsets,
} from "../astro/localSky.js";

const MAX_SNAP_DEG = 8;
const NAMED_ASSIGN_DEG = 3;
const NAMED_SLACK_DEG = 1.8;
const BRIGHT_SLACK_DEG = 0.7;
const WELL_KNOWN_MAG = 6.5;

export function projectEuclideanToSky(
  drawing,
  zenith,
  { spanDeg = 36, xToward = "west" } = {},
) {
  const xs = drawing.points.map((point) => point.x);
  const ys = drawing.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxY - minY, 1e-9);
  const scale = spanDeg / Math.max(width, height);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const xSign = xToward === "west" ? 1 : -1;

  return drawing.points.map((point) => {
    const westDeg = (point.x - cx) * scale * xSign;
    const northDeg = (point.y - cy) * scale;
    const sky = raDecFromLocalOffsets(zenith, -westDeg, northDeg);
    return {
      id: point.id,
      x: point.x,
      y: point.y,
      target: sky,
    };
  });
}

export function isWellKnown(star) {
  return Boolean(star.name) && star.vmag <= WELL_KNOWN_MAG;
}

function nearestDistance(target, stars, used) {
  let nearest = Infinity;
  for (const star of stars) {
    if (used.has(star.hip)) {
      continue;
    }
    const distance = angularDistanceDeg(target, star);
    if (distance < nearest) {
      nearest = distance;
    }
  }
  return nearest;
}

function pickStarForShape(target, stars, used) {
  const candidates = [];
  for (const star of stars) {
    if (used.has(star.hip)) {
      continue;
    }
    const distance = angularDistanceDeg(target, star);
    if (distance > MAX_SNAP_DEG) {
      continue;
    }
    candidates.push({ star, distance });
  }

  if (candidates.length === 0) {
    return null;
  }

  const minDistance = Math.min(...candidates.map((candidate) => candidate.distance));
  const pool = candidates.filter((candidate) => {
    const slack = isWellKnown(candidate.star) ? NAMED_SLACK_DEG : BRIGHT_SLACK_DEG;
    return candidate.distance <= minDistance + slack;
  });

  pool.sort((a, b) => {
    const knownDiff = Number(isWellKnown(b.star)) - Number(isWellKnown(a.star));
    if (knownDiff !== 0) {
      return knownDiff;
    }
    if (a.star.vmag !== b.star.vmag) {
      return a.star.vmag - b.star.vmag;
    }
    return a.distance - b.distance;
  });

  return pool[0];
}

export function snapToNearestStars(
  projectedPoints,
  stars,
  zenith,
  { unique = true, maxZenithDistanceDeg = 80 } = {},
) {
  const visible = stars.filter(
    (star) => angularDistanceDeg(zenith, star) <= maxZenithDistanceDeg,
  );
  const used = new Set();
  const vertices = projectedPoints.map((point) => ({
    ...point,
    star: null,
    snapDistanceDeg: null,
  }));

  const namedClaims = visible
    .filter(isWellKnown)
    .map((star) => {
      let pointIndex = -1;
      let distance = Infinity;
      projectedPoints.forEach((point, index) => {
        const starDistance = angularDistanceDeg(point.target, star);
        if (starDistance < distance) {
          distance = starDistance;
          pointIndex = index;
        }
      });
      return { star, pointIndex, distance };
    })
    .filter((claim) => claim.distance <= NAMED_ASSIGN_DEG)
    .sort((a, b) => a.distance - b.distance);

  for (const claim of namedClaims) {
    const vertex = vertices[claim.pointIndex];
    if (vertex.star || (unique && used.has(claim.star.hip))) {
      continue;
    }
    const closestAny = nearestDistance(vertex.target, visible, used);
    if (claim.distance > closestAny + NAMED_SLACK_DEG) {
      continue;
    }
    vertex.star = claim.star;
    vertex.snapDistanceDeg = claim.distance;
    if (unique) {
      used.add(claim.star.hip);
    }
  }

  for (const vertex of vertices) {
    if (vertex.star) {
      continue;
    }
    const picked = pickStarForShape(vertex.target, visible, unique ? used : new Set());
    if (!picked) {
      continue;
    }
    vertex.star = picked.star;
    vertex.snapDistanceDeg = picked.distance;
    if (unique) {
      used.add(picked.star.hip);
    }
  }

  return vertices;
}

export function mapEuclideanConstellation(drawing, stars, zenith, options = {}) {
  const projected = projectEuclideanToSky(drawing, zenith, options);
  const vertices = snapToNearestStars(projected, stars, zenith, options);

  return {
    name: drawing.name,
    id: drawing.id,
    lines: drawing.lines,
    vertices,
  };
}
