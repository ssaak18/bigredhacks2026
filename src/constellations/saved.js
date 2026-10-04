import { factFor } from "../data/celestialBodies";
import { distanceKm } from "../globe/places";
import { timeZoneAt } from "../sky/localSky";

const STORAGE_KEY = "bigredhacks.constellations.v1";

/** A saved constellation is on view when the observer is this close to where it was saved... */
export const MATCH_KM = 50;

const dayFormatters = new Map();

function localDay(time, timeZone) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(time);
}

/** ...at any time during the same calendar day there (midnight to midnight, local time). */
export function isAtSky(record, place, time) {
  if (distanceKm(record.place.latitude, record.place.longitude, place.latitude, place.longitude) > MATCH_KM) {
    return false;
  }
  const timeZone = timeZoneAt(record.place.latitude, record.place.longitude);
  return localDay(record.time, timeZone) === localDay(time, timeZone);
}

/**
 * Builds the stored form of a constellation placed on the sky. Only astronomical
 * coordinates are kept (RA/Dec of each snapped star), so the vision models and the
 * star matching never need to run again. `vertices` has the shape `addConstellationLayer` reads.
 */
export function buildSavedRecord({ mapped, place, time, image, label, name, note = "" }) {
  const vertices = mapped.vertices
    .filter((vertex) => vertex.star)
    .map((vertex) => ({
      id: vertex.id,
      snapDistanceDeg: vertex.snapDistanceDeg,
      star: {
        id: vertex.star.id ?? (vertex.star.hip != null ? `hip-${vertex.star.hip}` : vertex.star.name),
        hip: vertex.star.hip,
        name: vertex.star.name,
        kind: vertex.star.kind ?? "star",
        ra: vertex.star.ra,
        dec: vertex.star.dec,
        vmag: vertex.star.vmag,
        fact: vertex.star.fact || factFor(vertex.star),
      },
    }));
  const ids = new Set(vertices.map((vertex) => vertex.id));
  const outlines = (mapped.outlines ?? (mapped.outline ? [mapped.outline] : [])).map((ring) => ({
    closed: ring.closed !== false,
    points: ring.map((point) => ({ ra: point.ra, dec: point.dec })),
  }));
  return {
    id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    label,
    note,
    savedAt: Date.now(),
    time,
    place: {
      name: place.name ?? "",
      region: place.region ?? "",
      latitude: place.latitude,
      longitude: place.longitude,
    },
    image,
    vertices,
    lines: mapped.lines.filter((line) => ids.has(line.from) && ids.has(line.to)),
    outlines,
    outline: outlines[0] ?? [],
  };
}

export function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** True when `body` is one of the snapped stars in this saved constellation. */
export function recordHasStar(record, body) {
  if (!record || !body) return false;
  return (record.vertices ?? []).some((vertex) => {
    const star = vertex.star;
    if (!star) return false;
    if (star.hip != null && body.hip != null && star.hip === body.hip) return true;
    if (star.id && body.id && star.id === body.id) return true;
    return Math.abs(star.ra - body.ra) < 0.01 && Math.abs(star.dec - body.dec) < 0.01;
  });
}

/** Returns true when the list was stored; false when the browser refused (quota, private mode). */
export function persistSaved(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/** Shrinks the original photo to a JPEG data URL small enough for localStorage. */
export async function photoToDataUrl(file, maxSize = 640, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close?.();
  }
}
