import { julianDate } from "./localSky";

const DEG = Math.PI / 180;

function wrap360(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function sind(degrees) {
  return Math.sin(degrees * DEG);
}

function cosd(degrees) {
  return Math.cos(degrees * DEG);
}

function kepler(meanAnomalyDeg, eccentricity) {
  const mean = meanAnomalyDeg * DEG;
  let eccentric = mean;
  for (let step = 0; step < 10; step += 1) {
    eccentric -= (eccentric - eccentricity * Math.sin(eccentric) - mean)
      / (1 - eccentricity * Math.cos(eccentric));
  }
  return eccentric;
}

function heliocentric(elements, centuries) {
  const { a, e, I, L, varpi, node, da, de, dI, dL, dVarpi, dNode } = elements;
  const semi = a + da * centuries;
  const ecc = e + de * centuries;
  const inc = I + dI * centuries;
  const meanLong = wrap360(L + dL * centuries);
  const peri = varpi + dVarpi * centuries;
  const Omega = node + dNode * centuries;
  const anomaly = wrap360(meanLong - peri);
  const eccentric = kepler(anomaly, ecc);
  const xv = semi * (Math.cos(eccentric) - ecc);
  const yv = semi * Math.sqrt(1 - ecc * ecc) * Math.sin(eccentric);
  const trueAnom = Math.atan2(yv, xv);
  const radius = Math.hypot(xv, yv);
  const arg = trueAnom + (peri - Omega) * DEG;
  const xh = radius * (cosd(Omega) * Math.cos(arg) - sind(Omega) * Math.sin(arg) * cosd(inc));
  const yh = radius * (sind(Omega) * Math.cos(arg) + cosd(Omega) * Math.sin(arg) * cosd(inc));
  const zh = radius * (Math.sin(arg) * sind(inc));
  return { x: xh, y: yh, z: zh };
}

function equatorialFromHelio(body, earth, centuries) {
  const x = body.x - earth.x;
  const y = body.y - earth.y;
  const z = body.z - earth.z;
  const ecl = 23.439291 - 0.0130042 * centuries;
  const xe = x;
  const ye = y * cosd(ecl) - z * sind(ecl);
  const ze = y * sind(ecl) + z * cosd(ecl);
  return {
    ra: wrap360(Math.atan2(ye, xe) / DEG),
    dec: Math.asin(Math.max(-1, Math.min(1, ze / Math.hypot(xe, ye, ze)))) / DEG,
  };
}

// J2000 elements and rates from NASA/JPL low-precision tables.
const ORBITS = {
  mercury: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, varpi: 77.45779628, node: 48.33076593, da: 0.00000037, de: 0.00001906, dI: -0.00594749, dL: 149472.67411175, dVarpi: 0.16047689, dNode: -0.12534081 },
  venus: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, varpi: 131.60246718, node: 76.67984255, da: 0.00000390, de: -0.00004107, dI: -0.00078890, dL: 58517.81538729, dVarpi: 0.00268329, dNode: -0.27769418 },
  earth: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, varpi: 102.93768193, node: 0.0, da: 0.00000562, de: -0.00004392, dI: -0.01294668, dL: 35999.37244981, dVarpi: 0.32327364, dNode: 0.0 },
  mars: { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, varpi: -23.94362959, node: 49.55953891, da: 0.00001847, de: 0.00007882, dI: -0.00813131, dL: 19140.30268499, dVarpi: 0.44441088, dNode: -0.29257343 },
  jupiter: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, varpi: 14.72847983, node: 100.47390909, da: -0.00011607, de: -0.00013253, dI: -0.00183714, dL: 3034.74612775, dVarpi: 0.21252668, dNode: 0.20469106 },
  saturn: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, varpi: 92.59887831, node: 113.66242448, da: -0.00125060, de: -0.00050991, dI: 0.00193609, dL: 1222.49362201, dVarpi: -0.41897216, dNode: -0.28867794 },
  uranus: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, varpi: 170.95427630, node: 74.01692503, da: -0.00196176, de: -0.00004397, dI: -0.00242939, dL: 428.48202785, dVarpi: 0.40805281, dNode: 0.04240589 },
  neptune: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, varpi: 44.96476227, node: 131.78422574, da: 0.00026291, de: 0.00005105, dI: 0.00035372, dL: 218.45945325, dVarpi: -0.32241464, dNode: -0.00508664 },
};

function centuriesSinceJ2000(date) {
  return (julianDate(date) - 2451545.0) / 36525;
}

export function sunRaDec(date) {
  const T = centuriesSinceJ2000(date);
  const earth = heliocentric(ORBITS.earth, T);
  return equatorialFromHelio({ x: 0, y: 0, z: 0 }, earth, T);
}

export function moonRaDec(date) {
  const T = centuriesSinceJ2000(date);
  const L = wrap360(218.3164477 + 481267.88123421 * T);
  const D = wrap360(297.8501921 + 445267.1114034 * T);
  const M = wrap360(134.9633964 + 477198.8673981 * T);
  const Mp = wrap360(357.5291092 + 35999.0502909 * T);
  const F = wrap360(93.2720950 + 483202.0175233 * T);
  const lon = L
    + 6.289 * sind(M)
    + 1.274 * sind(2 * D - M)
    + 0.658 * sind(2 * D)
    + 0.214 * sind(2 * M)
    - 0.186 * sind(Mp);
  const lat = 5.128 * sind(F) + 0.281 * sind(M + F) + 0.278 * sind(M - F);
  const ecl = 23.439291 - 0.0130042 * T;
  const ra = wrap360(Math.atan2(sind(lon) * cosd(ecl) - Math.tan(lat * DEG) * sind(ecl), cosd(lon)) / DEG);
  const dec = Math.asin(Math.max(-1, Math.min(1, sind(lat) * cosd(ecl) + cosd(lat) * sind(ecl) * sind(lon)))) / DEG;
  return { ra, dec };
}

const PLANET_META = [
  { key: "mercury", name: "Mercury", vmag: 0.2 },
  { key: "venus", name: "Venus", vmag: -4.0 },
  { key: "mars", name: "Mars", vmag: 0.6 },
  { key: "jupiter", name: "Jupiter", vmag: -2.2 },
  { key: "saturn", name: "Saturn", vmag: 0.5 },
  { key: "uranus", name: "Uranus", vmag: 5.6 },
  { key: "neptune", name: "Neptune", vmag: 7.8 },
];

export function solarSystemBodies(date = new Date()) {
  const T = centuriesSinceJ2000(date);
  const earth = heliocentric(ORBITS.earth, T);
  const sun = sunRaDec(date);
  const moon = moonRaDec(date);
  const planets = PLANET_META.map((planet) => {
    const sky = equatorialFromHelio(heliocentric(ORBITS[planet.key], T), earth, T);
    return {
      id: `planet-${planet.key}`,
      name: planet.name,
      kind: "planet",
      vmag: planet.vmag,
      ra: sky.ra,
      dec: sky.dec,
    };
  });
  return [
    { id: "sun", name: "the Sun", kind: "sun", vmag: -26.7, ra: sun.ra, dec: sun.dec },
    { id: "moon", name: "the Moon", kind: "moon", vmag: -12.6, ra: moon.ra, dec: moon.dec },
    ...planets,
  ];
}
