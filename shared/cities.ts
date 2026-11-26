export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

/** Cities offered for live air data; the id is the only thing sent to the server. */
export const CITIES: readonly City[] = [
  { id: "delhi", name: "Delhi", state: "Delhi", lat: 28.6139, lon: 77.209 },
  { id: "noida", name: "Noida", state: "Uttar Pradesh", lat: 28.5355, lon: 77.391 },
  { id: "ghaziabad", name: "Ghaziabad", state: "Uttar Pradesh", lat: 28.6692, lon: 77.4538 },
  { id: "gurugram", name: "Gurugram", state: "Haryana", lat: 28.4595, lon: 77.0266 },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462 },
  { id: "kanpur", name: "Kanpur", state: "Uttar Pradesh", lat: 26.4499, lon: 80.3319 },
  { id: "agra", name: "Agra", state: "Uttar Pradesh", lat: 27.1767, lon: 78.0081 },
  { id: "varanasi", name: "Varanasi", state: "Uttar Pradesh", lat: 25.3176, lon: 82.9739 },
  { id: "patna", name: "Patna", state: "Bihar", lat: 25.5941, lon: 85.1376 },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873 },
  { id: "chandigarh", name: "Chandigarh", state: "Chandigarh", lat: 30.7333, lon: 76.7794 },
  { id: "amritsar", name: "Amritsar", state: "Punjab", lat: 31.634, lon: 74.8723 },
  { id: "ludhiana", name: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.8573 },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639 },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777 },
  { id: "pune", name: "Pune", state: "Maharashtra", lat: 18.5204, lon: 73.8567 },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lon: 72.5714 },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lon: 77.4126 },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.4867 },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.9716, lon: 77.5946 },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707 },
];
export const cityById = (id: string): City | undefined => CITIES.find((c) => c.id === id);
export const cityName = (id: string) => cityById(id)?.name ?? "your area";

const rad = (degrees: number) => (degrees * Math.PI) / 180;
/** Great-circle (haversine) distance in kilometres. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The listed city closest to a position, or null when none is within `maxKm`. Runs in the browser:
 * coordinates are never sent anywhere — only the chosen city id is used afterwards.
 */
export function nearestCity(lat: number, lon: number, maxKm = 150): { city: City; km: number } | null {
  const [first] = CITIES.map((city) => ({ city, km: distanceKm(lat, lon, city.lat, city.lon) })).sort(
    (a, b) => a.km - b.km,
  );
  return first.km <= maxKm ? first : null;
}
