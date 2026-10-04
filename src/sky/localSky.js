import tzLookup from "tz-lookup";

const J2000_JD = 2451545.0;

function wrap360(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Greenwich mean sidereal time, in degrees.
 * Meeus, Astronomical Algorithms, the IAU expression for GMST.
 */
export function greenwichSiderealDegrees(date) {
  const jd = julianDate(date);
  const century = (jd - J2000_JD) / 36525;
  return wrap360(
    280.46061837 +
      360.98564736629 * (jd - J2000_JD) +
      0.000387933 * century * century -
      (century * century * century) / 38710000,
  );
}

/**
 * Equatorial coordinates of the point straight overhead.
 * Declination equals latitude. Right ascension equals local sidereal time.
 */
export function zenithEquatorial(latitude, longitude, date = new Date()) {
  return {
    ra: wrap360(greenwichSiderealDegrees(date) + longitude),
    dec: latitude,
  };
}

export function formatCoordinates(latitude, longitude) {
  const northSouth = latitude >= 0 ? "N" : "S";
  const eastWest = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(2)}° ${northSouth}, ${Math.abs(longitude).toFixed(2)}° ${eastWest}`;
}

export function formatRightAscension(degrees) {
  const totalMinutes = Math.round((wrap360(degrees) / 15) * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatDeclination(degrees) {
  const sign = degrees >= 0 ? "+" : "−";
  return `${sign}${Math.abs(degrees).toFixed(1)}°`;
}

/** Clock time at this longitude, ignoring political time zones. Used for the sun's altitude. */
export function localMeanDate(date, longitude) {
  return new Date(date.getTime() + (longitude / 15) * 3600000);
}

/** IANA timezone for a place, so the clock matches civil time there, including daylight saving. */
export function timeZoneAt(latitude, longitude) {
  try {
    return tzLookup(latitude, longitude);
  } catch {
    const utcOffsetHours = Math.max(-12, Math.min(14, Math.round(longitude / 15)));
    if (utcOffsetHours === 0) return "UTC";
    const etcHours = -utcOffsetHours;
    return `Etc/GMT${etcHours > 0 ? "+" : ""}${etcHours}`;
  }
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

function offsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - date.getTime();
}

function timestampFromZoned(parts, timeZone) {
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let date = new Date(asUtc);
  date = new Date(asUtc - offsetMs(date, timeZone));
  return new Date(asUtc - offsetMs(date, timeZone)).getTime();
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Move a civil-time field at this place, keeping the other fields stable. */
export function shiftZonedTime(timestamp, timeZone, unit, amount) {
  if (!amount) return timestamp;
  if (unit === "minute") return timestamp + amount * 60_000;
  if (unit === "day") return timestamp + amount * 86_400_000;

  const parts = zonedParts(new Date(timestamp), timeZone);
  if (unit === "month") {
    const index = parts.month - 1 + amount;
    parts.year += Math.floor(index / 12);
    parts.month = ((index % 12) + 12) % 12 + 1;
    parts.day = Math.min(parts.day, daysInMonth(parts.year, parts.month));
  } else if (unit === "year") {
    parts.year += amount;
    parts.day = Math.min(parts.day, daysInMonth(parts.year, parts.month));
  }
  return timestampFromZoned(parts, timeZone);
}

export function formatLocalClock(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const hours = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";
  const weekdayShort = parts.weekday.slice(0, 3);
  const military = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    weekday: parts.weekday,
    weekdayShort,
    month: parts.month,
    day: Number(parts.day),
    year: Number(parts.year),
    hours,
    hour12,
    minutes,
    suffix,
    military,
    clock: military,
    hourLabel: military,
    dateLine: `${parts.weekday}, ${parts.month} ${Number(parts.day)}, ${parts.year}`,
  };
}

/** Approximate solar altitude in degrees. Positive means the sun is up. */
export function sunAltitudeDegrees(latitude, longitude, date) {
  const local = localMeanDate(date, longitude);
  const yearStart = Date.UTC(local.getUTCFullYear(), 0, 0);
  const dayOfYear = (local.getTime() - yearStart) / 86400000;
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const hours = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
  const lat = (latitude * Math.PI) / 180;
  const dec = (declination * Math.PI) / 180;
  const hourAngle = ((hours - 12) * 15 * Math.PI) / 180;
  const sine =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  return (Math.asin(Math.min(1, Math.max(-1, sine))) * 180) / Math.PI;
}
