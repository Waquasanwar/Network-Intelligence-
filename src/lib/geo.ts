/**
 * Where a place sits east to west, for drawing the network along a horizon from London to the Gulf
 * and beyond. Longitude in degrees; unknown cities fall back to their time zone (15° an hour).
 * Shared by the app and its tests. No I/O.
 */
import { zoneFor, offsetHours } from "./place";

const LON: Record<string, number> = {
  london: -0.13, manchester: -2.24, birmingham: -1.9, edinburgh: -3.19, leeds: -1.55, glasgow: -4.25, bristol: -2.59, dublin: -6.26,
  paris: 2.35, amsterdam: 4.9, brussels: 4.35, frankfurt: 8.68, munich: 11.58, berlin: 13.4, zurich: 8.54, geneva: 6.14, milan: 9.19, rome: 12.5,
  madrid: -3.7, barcelona: 2.17, lisbon: -9.14, stockholm: 18.07, warsaw: 21.01, athens: 23.73, istanbul: 28.98,
  cairo: 31.24, amman: 35.93, beirut: 35.5, jeddah: 39.19, riyadh: 46.68, dammam: 50.1, khobar: 50.2, neom: 35.3, kuwait: 47.98, "kuwait city": 47.98,
  manama: 50.59, doha: 51.53, "abu dhabi": 54.37, dubai: 55.27, sharjah: 55.41, "al ain": 55.76, muscat: 58.41,
  karachi: 67.0, lahore: 74.36, islamabad: 73.05, mumbai: 72.88, pune: 73.86, delhi: 77.21, "new delhi": 77.21, bangalore: 77.59, bengaluru: 77.59, hyderabad: 78.49, chennai: 80.27,
  colombo: 79.86, dhaka: 90.41, singapore: 103.82, "kuala lumpur": 101.69, "hong kong": 114.17, shanghai: 121.47, tokyo: 139.69, sydney: 151.21, melbourne: 144.96,
  nairobi: 36.82, lagos: 3.38, johannesburg: 28.05, "cape town": 18.42,
  "new york": -74.0, boston: -71.06, toronto: -79.38, chicago: -87.63, "san francisco": -122.42, "los angeles": -118.24,
};

/** The city part of "Dubai, UAE" or "Dubai". */
export const cityName = (place: string) => place.split(",")[0].trim();

/** East–west position of a place, or null when nothing is known about it. */
export function longitudeOf(place: string | null | undefined): number | null {
  if (!place) return null;
  const k = cityName(place).toLowerCase();
  if (k in LON) return LON[k];
  const z = zoneFor({ primaryCity: cityName(place), primaryCountry: place.split(",")[1]?.trim() ?? null });
  return z ? offsetHours(z) * 15 : null;
}
