import { fromVec, toVec } from "../astro/localSky.js";
import { skyBodiesAt } from "../data/celestialBodies";
import hipparcosBright from "../data/hipparcosBright.json";
import { zenithEquatorial } from "../sky/localSky";
import { mapEuclideanConstellation } from "./mapToStars";

/** Angular size of a placed constellation, in degrees across its longer side. */
export const SKY_SPAN = { min: 5, default: 12, max: 30 };

/**
 * Lays a Euclidean drawing out on the sky around `center` (the zenith when omitted)
 * and snaps it to stars. Returns the mapped constellation and where it was centred.
 */
export function placeInSky(drawing, place, time, { center, spanDeg = SKY_SPAN.default } = {}) {
  const date = new Date(time);
  const zenith = zenithEquatorial(place.latitude, place.longitude, date);
  const aim = center ?? zenith;
  const mapped = mapEuclideanConstellation(drawing, skyBodiesAt(date, hipparcosBright), zenith, {
    spanDeg,
    center: aim,
  });
  return { mapped, center: aim };
}

/** Places at the zenith. Click and drag afterward to move it. */
export function autoPlaceInSky(drawing, place, time, options = {}) {
  return placeInSky(drawing, place, time, options);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function rodrigues(vec, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const along = dot(axis, vec);
  const [cx, cy, cz] = cross(axis, vec);
  return [
    vec[0] * cos + cx * sin + axis[0] * along * (1 - cos),
    vec[1] * cos + cy * sin + axis[1] * along * (1 - cos),
    vec[2] * cos + cz * sin + axis[2] * along * (1 - cos),
  ];
}

/** Rigidly slides every snapped star from `from` to `to` on the sphere. No rematch. */
export function slideMapped(mapped, from, to) {
  const a = toVec(from.ra, from.dec);
  const b = toVec(to.ra, to.dec);
  const axis = cross(a, b);
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  const cosine = Math.max(-1, Math.min(1, dot(a, b)));
  let rotate;
  if (length < 1e-10) {
    if (cosine > 0) return mapped;
    const fallback = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const pole = cross(a, fallback);
    const poleLength = Math.hypot(pole[0], pole[1], pole[2]) || 1;
    const unit = [pole[0] / poleLength, pole[1] / poleLength, pole[2] / poleLength];
    rotate = (point) => fromVec(rodrigues(toVec(point.ra, point.dec), unit, Math.PI));
  } else {
    const unit = [axis[0] / length, axis[1] / length, axis[2] / length];
    const angle = Math.atan2(length, cosine);
    rotate = (point) => fromVec(rodrigues(toVec(point.ra, point.dec), unit, angle));
  }
  const outlines = (mapped.outlines ?? (mapped.outline ? [mapped.outline] : [])).map((ring) => {
    const next = ring.map((point) => {
      const sky = rotate(point);
      return { ...point, ra: sky.ra, dec: sky.dec };
    });
    next.closed = ring.closed !== false;
    return next;
  });
  return {
    ...mapped,
    vertices: mapped.vertices.map((vertex) => {
      if (!vertex.star) return vertex;
      const next = rotate(vertex.star);
      return { ...vertex, star: { ...vertex.star, ra: next.ra, dec: next.dec } };
    }),
    outlines,
    outline: outlines[0] ?? [],
  };
}
