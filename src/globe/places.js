export const ITHACA = {
  name: "Ithaca",
  region: "New York",
  latitude: 42.444,
  longitude: -76.5019,
};

export const PLACES = [
  ITHACA,
  { name: "New York", region: "New York", latitude: 40.7128, longitude: -74.006 },
  { name: "Buffalo", region: "New York", latitude: 42.8864, longitude: -78.8784 },
  { name: "Rochester", region: "New York", latitude: 43.1566, longitude: -77.6088 },
  { name: "Syracuse", region: "New York", latitude: 43.0481, longitude: -76.1474 },
  { name: "Boston", region: "Massachusetts", latitude: 42.3601, longitude: -71.0589 },
  { name: "Washington", region: "D.C.", latitude: 38.9072, longitude: -77.0369 },
  { name: "Miami", region: "Florida", latitude: 25.7617, longitude: -80.1918 },
  { name: "Chicago", region: "Illinois", latitude: 41.8781, longitude: -87.6298 },
  { name: "Austin", region: "Texas", latitude: 30.2672, longitude: -97.7431 },
  { name: "Denver", region: "Colorado", latitude: 39.7392, longitude: -104.9903 },
  { name: "Los Angeles", region: "California", latitude: 34.0522, longitude: -118.2437 },
  { name: "San Francisco", region: "California", latitude: 37.7749, longitude: -122.4194 },
  { name: "Seattle", region: "Washington", latitude: 47.6062, longitude: -122.3321 },
  { name: "Honolulu", region: "Hawaii", latitude: 21.3069, longitude: -157.8583 },
  { name: "Anchorage", region: "Alaska", latitude: 61.2181, longitude: -149.9003 },
  { name: "Toronto", region: "Canada", latitude: 43.6532, longitude: -79.3832 },
  { name: "Vancouver", region: "Canada", latitude: 49.2827, longitude: -123.1207 },
  { name: "Montreal", region: "Canada", latitude: 45.5017, longitude: -73.5673 },
  { name: "Mexico City", region: "Mexico", latitude: 19.4326, longitude: -99.1332 },
  { name: "São Paulo", region: "Brazil", latitude: -23.5558, longitude: -46.6396 },
  { name: "Rio de Janeiro", region: "Brazil", latitude: -22.9068, longitude: -43.1729 },
  { name: "Buenos Aires", region: "Argentina", latitude: -34.6037, longitude: -58.3816 },
  { name: "Santiago", region: "Chile", latitude: -33.4489, longitude: -70.6693 },
  { name: "Lima", region: "Peru", latitude: -12.0464, longitude: -77.0428 },
  { name: "Bogotá", region: "Colombia", latitude: 4.711, longitude: -74.0721 },
  { name: "London", region: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
  { name: "Edinburgh", region: "United Kingdom", latitude: 55.9533, longitude: -3.1883 },
  { name: "Dublin", region: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { name: "Paris", region: "France", latitude: 48.8566, longitude: 2.3522 },
  { name: "Madrid", region: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { name: "Lisbon", region: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { name: "Amsterdam", region: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { name: "Berlin", region: "Germany", latitude: 52.52, longitude: 13.405 },
  { name: "Rome", region: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { name: "Athens", region: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { name: "Stockholm", region: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { name: "Oslo", region: "Norway", latitude: 59.9139, longitude: 10.7522 },
  { name: "Helsinki", region: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { name: "Reykjavik", region: "Iceland", latitude: 64.1466, longitude: -21.9426 },
  { name: "Moscow", region: "Russia", latitude: 55.7558, longitude: 37.6173 },
  { name: "Istanbul", region: "Türkiye", latitude: 41.0082, longitude: 28.9784 },
  { name: "Cairo", region: "Egypt", latitude: 30.0444, longitude: 31.2357 },
  { name: "Jerusalem", region: "Israel", latitude: 31.7683, longitude: 35.2137 },
  { name: "Dubai", region: "UAE", latitude: 25.2048, longitude: 55.2708 },
  { name: "Nairobi", region: "Kenya", latitude: -1.2921, longitude: 36.8219 },
  { name: "Lagos", region: "Nigeria", latitude: 6.5244, longitude: 3.3792 },
  { name: "Johannesburg", region: "South Africa", latitude: -26.2041, longitude: 28.0473 },
  { name: "Cape Town", region: "South Africa", latitude: -33.9249, longitude: 18.4241 },
  { name: "Mumbai", region: "India", latitude: 19.076, longitude: 72.8777 },
  { name: "Delhi", region: "India", latitude: 28.6139, longitude: 77.209 },
  { name: "Bangkok", region: "Thailand", latitude: 13.7563, longitude: 100.5018 },
  { name: "Singapore", region: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { name: "Hong Kong", region: "China", latitude: 22.3193, longitude: 114.1694 },
  { name: "Beijing", region: "China", latitude: 39.9042, longitude: 116.4074 },
  { name: "Shanghai", region: "China", latitude: 31.2304, longitude: 121.4737 },
  { name: "Taipei", region: "Taiwan", latitude: 25.033, longitude: 121.5654 },
  { name: "Seoul", region: "South Korea", latitude: 37.5665, longitude: 126.978 },
  { name: "Tokyo", region: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { name: "Sydney", region: "Australia", latitude: -33.8688, longitude: 151.2093 },
  { name: "Melbourne", region: "Australia", latitude: -37.8136, longitude: 144.9631 },
  { name: "Perth", region: "Australia", latitude: -31.9505, longitude: 115.8605 },
  { name: "Auckland", region: "New Zealand", latitude: -36.8509, longitude: 174.7645 },
  { name: "Wellington", region: "New Zealand", latitude: -41.2865, longitude: 174.7762 },
];

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(fromLat, fromLon, toLat, toLon) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestPlace(latitude, longitude) {
  let best = null;
  for (const place of PLACES) {
    const km = distanceKm(latitude, longitude, place.latitude, place.longitude);
    if (!best || km < best.distanceKm) {
      best = { place, distanceKm: km };
    }
  }
  return best;
}

export function searchPlaces(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return PLACES
    .filter((place) => `${place.name} ${place.region}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, 6);
}

export function formatPlaceName(place) {
  if (place?.name) {
    return place.region ? `${place.name}, ${place.region}` : place.name;
  }
  return "Selected point";
}

const NAMED_CLICK_KM = 45;

export function placeFromCoordinates(latitude, longitude) {
  const nearest = nearestPlace(latitude, longitude);
  if (nearest && nearest.distanceKm <= NAMED_CLICK_KM) {
    return {
      latitude,
      longitude,
      name: nearest.place.name,
      region: nearest.place.region,
    };
  }
  return { latitude, longitude, name: "", region: "" };
}
