function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function degrees(radiansValue) {
  return (radiansValue * 180) / Math.PI;
}

/**
 * Map a geographic point onto the unit sphere used by the globe mesh.
 * The earth texture is equirectangular: its center is the prime meridian,
 * and longitude increases toward the east, which is negative Z.
 */
export function vectorFromLatLon(latitude, longitude, radius) {
  const polar = radians(90 - latitude);
  const lambda = radians(longitude);
  const ring = Math.sin(polar) * radius;
  return {
    x: Math.cos(lambda) * ring,
    y: Math.cos(polar) * radius,
    z: -Math.sin(lambda) * ring,
  };
}

export function latLonFromVector(point) {
  const radius = Math.hypot(point.x, point.y, point.z) || 1;
  const latitude = degrees(Math.asin(Math.min(1, Math.max(-1, point.y / radius))));
  let longitude = degrees(Math.atan2(-point.z, point.x));
  if (longitude > 180) longitude -= 360;
  if (longitude < -180) longitude += 360;
  return { latitude, longitude };
}
