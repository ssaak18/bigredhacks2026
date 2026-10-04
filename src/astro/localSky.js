const DEG = Math.PI / 180;

export function toVec(raDeg, decDeg) {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}

export function fromVec(vec) {
  const [x, y, z] = vec;
  const ra = ((Math.atan2(y, x) / DEG) + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, z))) / DEG;
  return { ra, dec };
}

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function zenithRaDec(latitudeDeg, longitudeDeg, date = new Date()) {
  const d = julianDate(date) - 2451545.0;
  const t = d / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  const lst = (((gmst + longitudeDeg) % 360) + 360) % 360;
  return { ra: lst, dec: latitudeDeg };
}

export function angularDistanceDeg(a, b) {
  const va = toVec(a.ra, a.dec);
  const vb = toVec(b.ra, b.dec);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return Math.acos(dot) / DEG;
}

export function pointAlongGreatCircle(from, to, distanceDeg) {
  const va = toVec(from.ra, from.dec);
  const vb = toVec(to.ra, to.dec);
  const span = angularDistanceDeg(from, to) * DEG;
  if (span < 1e-12) {
    return { ra: from.ra, dec: from.dec };
  }

  const t = Math.max(0, Math.min(1, (distanceDeg * DEG) / span));
  const sinSpan = Math.sin(span);
  const w1 = Math.sin((1 - t) * span) / sinSpan;
  const w2 = Math.sin(t * span) / sinSpan;
  return fromVec([
    w1 * va[0] + w2 * vb[0],
    w1 * va[1] + w2 * vb[1],
    w1 * va[2] + w2 * vb[2],
  ]);
}

export function clampCenterToHorizon(center, zenith, fovWidthDeg, fovHeightDeg) {
  const halfFov = Math.max(fovWidthDeg, fovHeightDeg) / 2;
  const maxOffset = Math.max(0, 90 - halfFov);
  const offset = angularDistanceDeg(zenith, center);
  if (offset <= maxOffset + 1e-4) {
    return center;
  }
  return pointAlongGreatCircle(zenith, center, maxOffset);
}

export function raDecFromLocalOffsets(zenith, eastDeg, northDeg) {
  const rho = Math.hypot(eastDeg, northDeg) * DEG;
  const pa = Math.atan2(eastDeg, northDeg);
  const dec0 = zenith.dec * DEG;
  const ra0 = zenith.ra * DEG;
  const sinDec =
    Math.sin(dec0) * Math.cos(rho) +
    Math.cos(dec0) * Math.sin(rho) * Math.cos(pa);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.sin(pa) * Math.sin(rho);
  const x =
    Math.cos(rho) * Math.cos(dec0) -
    Math.sin(rho) * Math.sin(dec0) * Math.cos(pa);
  const ra = ra0 + Math.atan2(y, x);
  return {
    ra: (((ra / DEG) % 360) + 360) % 360,
    dec: dec / DEG,
  };
}

/** Inverse of `raDecFromLocalOffsets`: east/north degrees of `sky` from `center`. */
export function localOffsetsFromRaDec(center, sky) {
  const dec0 = center.dec * DEG;
  const dec = sky.dec * DEG;
  const dRa = Math.atan2(Math.sin((sky.ra - center.ra) * DEG), Math.cos((sky.ra - center.ra) * DEG));
  const cosRho = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(dRa);
  const rhoDeg = Math.acos(Math.max(-1, Math.min(1, cosRho))) / DEG;
  const pa = Math.atan2(
    Math.sin(dRa) * Math.cos(dec),
    Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(dRa),
  );
  return { eastDeg: rhoDeg * Math.sin(pa), northDeg: rhoDeg * Math.cos(pa) };
}

export function formatLatitude(latitudeDeg) {
  const hemisphere = latitudeDeg >= 0 ? "N" : "S";
  return `${Math.abs(latitudeDeg).toFixed(2)}°${hemisphere}`;
}

export function formatLongitude(longitudeDeg) {
  const hemisphere = longitudeDeg >= 0 ? "E" : "W";
  return `${Math.abs(longitudeDeg).toFixed(2)}°${hemisphere}`;
}
