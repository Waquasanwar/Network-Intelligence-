/**
 * Where a place is on the globe. A small built-in gazetteer, so the network map never sends a
 * person's city to an outside geocoder. A city wins over its country; an unknown city falls back to
 * the country; a place we cannot find is simply left off the globe and counted as "no location".
 */
export type Place = { key: string; label: string; lat: number; lng: number };

const CITIES: Record<string, [string, number, number]> = {
  // Gulf and Middle East
  "dubai": ["Dubai", 25.2, 55.3], "abu dhabi": ["Abu Dhabi", 24.47, 54.37], "sharjah": ["Sharjah", 25.35, 55.4], "riyadh": ["Riyadh", 24.7, 46.7], "jeddah": ["Jeddah", 21.5, 39.2],
  "dammam": ["Dammam", 26.4, 50.1], "neom": ["NEOM", 28.0, 35.2], "doha": ["Doha", 25.3, 51.5], "kuwait city": ["Kuwait City", 29.4, 48.0], "manama": ["Manama", 26.2, 50.6], "muscat": ["Muscat", 23.6, 58.4],
  "cairo": ["Cairo", 30.0, 31.2], "amman": ["Amman", 31.95, 35.9], "beirut": ["Beirut", 33.9, 35.5], "istanbul": ["Istanbul", 41.0, 29.0], "tel aviv": ["Tel Aviv", 32.1, 34.8],
  // UK and Ireland
  "london": ["London", 51.5, -0.13], "manchester": ["Manchester", 53.48, -2.24], "leeds": ["Leeds", 53.8, -1.55], "birmingham": ["Birmingham", 52.48, -1.9], "edinburgh": ["Edinburgh", 55.95, -3.2],
  "glasgow": ["Glasgow", 55.86, -4.25], "bristol": ["Bristol", 51.45, -2.6], "liverpool": ["Liverpool", 53.4, -2.98], "cardiff": ["Cardiff", 51.48, -3.18], "belfast": ["Belfast", 54.6, -5.93],
  "cambridge": ["Cambridge", 52.2, 0.12], "oxford": ["Oxford", 51.75, -1.26], "newcastle": ["Newcastle", 54.98, -1.6], "reading": ["Reading", 51.45, -0.97], "dublin": ["Dublin", 53.35, -6.26],
  // Europe
  "paris": ["Paris", 48.86, 2.35], "lyon": ["Lyon", 45.76, 4.84], "madrid": ["Madrid", 40.42, -3.7], "barcelona": ["Barcelona", 41.39, 2.17], "lisbon": ["Lisbon", 38.72, -9.14], "porto": ["Porto", 41.15, -8.61],
  "milan": ["Milan", 45.46, 9.19], "rome": ["Rome", 41.9, 12.5], "frankfurt": ["Frankfurt", 50.11, 8.68], "berlin": ["Berlin", 52.52, 13.4], "munich": ["Munich", 48.14, 11.58], "hamburg": ["Hamburg", 53.55, 10.0],
  "amsterdam": ["Amsterdam", 52.37, 4.9], "rotterdam": ["Rotterdam", 51.92, 4.48], "brussels": ["Brussels", 50.85, 4.35], "luxembourg": ["Luxembourg", 49.61, 6.13], "zurich": ["Zurich", 47.38, 8.54], "geneva": ["Geneva", 46.2, 6.15],
  "vienna": ["Vienna", 48.21, 16.37], "prague": ["Prague", 50.08, 14.44], "warsaw": ["Warsaw", 52.23, 21.01], "budapest": ["Budapest", 47.5, 19.04], "bucharest": ["Bucharest", 44.43, 26.1], "athens": ["Athens", 37.98, 23.73],
  "stockholm": ["Stockholm", 59.33, 18.07], "oslo": ["Oslo", 59.91, 10.75], "copenhagen": ["Copenhagen", 55.68, 12.57], "helsinki": ["Helsinki", 60.17, 24.94], "moscow": ["Moscow", 55.75, 37.62], "kyiv": ["Kyiv", 50.45, 30.52],
  // Americas
  "new york": ["New York", 40.71, -74.0], "boston": ["Boston", 42.36, -71.06], "washington": ["Washington", 38.9, -77.04], "chicago": ["Chicago", 41.88, -87.63], "san francisco": ["San Francisco", 37.77, -122.42],
  "los angeles": ["Los Angeles", 34.05, -118.24], "seattle": ["Seattle", 47.61, -122.33], "austin": ["Austin", 30.27, -97.74], "dallas": ["Dallas", 32.78, -96.8], "houston": ["Houston", 29.76, -95.37],
  "miami": ["Miami", 25.76, -80.19], "atlanta": ["Atlanta", 33.75, -84.39], "toronto": ["Toronto", 43.65, -79.38], "vancouver": ["Vancouver", 49.28, -123.12], "montreal": ["Montreal", 45.5, -73.57],
  "mexico city": ["Mexico City", 19.43, -99.13], "sao paulo": ["São Paulo", -23.55, -46.63], "rio de janeiro": ["Rio de Janeiro", -22.91, -43.17], "buenos aires": ["Buenos Aires", -34.6, -58.38],
  "bogota": ["Bogotá", 4.71, -74.07], "santiago": ["Santiago", -33.45, -70.67], "lima": ["Lima", -12.05, -77.04],
  // Africa
  "accra": ["Accra", 5.6, -0.19], "lagos": ["Lagos", 6.52, 3.38], "abuja": ["Abuja", 9.06, 7.5], "nairobi": ["Nairobi", -1.29, 36.82], "johannesburg": ["Johannesburg", -26.2, 28.05], "cape town": ["Cape Town", -33.92, 18.42],
  "casablanca": ["Casablanca", 33.57, -7.59], "tunis": ["Tunis", 36.81, 10.18], "addis ababa": ["Addis Ababa", 9.03, 38.74], "kigali": ["Kigali", -1.95, 30.06], "dar es salaam": ["Dar es Salaam", -6.79, 39.21], "kampala": ["Kampala", 0.35, 32.58],
  // South Asia
  "mumbai": ["Mumbai", 19.08, 72.88], "delhi": ["Delhi", 28.61, 77.21], "new delhi": ["Delhi", 28.61, 77.21], "bangalore": ["Bengaluru", 12.97, 77.59], "bengaluru": ["Bengaluru", 12.97, 77.59],
  "hyderabad": ["Hyderabad", 17.39, 78.49], "chennai": ["Chennai", 13.08, 80.27], "pune": ["Pune", 18.52, 73.86], "kolkata": ["Kolkata", 22.57, 88.36], "karachi": ["Karachi", 24.86, 67.0],
  "lahore": ["Lahore", 31.55, 74.34], "islamabad": ["Islamabad", 33.69, 73.05], "dhaka": ["Dhaka", 23.81, 90.41], "colombo": ["Colombo", 6.93, 79.86],
  // East Asia and Pacific
  "singapore": ["Singapore", 1.35, 103.82], "kuala lumpur": ["Kuala Lumpur", 3.14, 101.69], "jakarta": ["Jakarta", -6.21, 106.85], "bangkok": ["Bangkok", 13.76, 100.5], "ho chi minh city": ["Ho Chi Minh City", 10.82, 106.63],
  "hanoi": ["Hanoi", 21.03, 105.85], "manila": ["Manila", 14.6, 120.98], "hong kong": ["Hong Kong", 22.32, 114.17], "shanghai": ["Shanghai", 31.23, 121.47], "beijing": ["Beijing", 39.9, 116.4], "shenzhen": ["Shenzhen", 22.54, 114.06],
  "tokyo": ["Tokyo", 35.68, 139.69], "osaka": ["Osaka", 34.69, 135.5], "seoul": ["Seoul", 37.57, 126.98], "taipei": ["Taipei", 25.03, 121.57], "sydney": ["Sydney", -33.87, 151.21], "melbourne": ["Melbourne", -37.81, 144.96],
  "brisbane": ["Brisbane", -27.47, 153.03], "perth": ["Perth", -31.95, 115.86], "auckland": ["Auckland", -36.85, 174.76],
};

const COUNTRIES: Record<string, [string, number, number]> = {
  "united arab emirates": ["UAE", 24.3, 54.3], "saudi arabia": ["Saudi Arabia", 24.2, 45.1], "qatar": ["Qatar", 25.3, 51.2], "kuwait": ["Kuwait", 29.3, 47.6], "bahrain": ["Bahrain", 26.05, 50.55], "oman": ["Oman", 21.5, 56.5],
  "egypt": ["Egypt", 27.0, 30.0], "jordan": ["Jordan", 31.2, 36.5], "lebanon": ["Lebanon", 33.9, 35.9], "turkey": ["Türkiye", 39.0, 35.0], "israel": ["Israel", 31.5, 34.9],
  "united kingdom": ["UK", 53.5, -1.8], "scotland": ["Scotland", 56.6, -4.1], "wales": ["Wales", 52.3, -3.7], "ireland": ["Ireland", 53.3, -7.9], "france": ["France", 46.6, 2.4], "spain": ["Spain", 40.2, -3.6],
  "portugal": ["Portugal", 39.6, -8.0], "italy": ["Italy", 42.8, 12.5], "germany": ["Germany", 51.1, 10.4], "netherlands": ["Netherlands", 52.2, 5.3], "belgium": ["Belgium", 50.6, 4.6], "luxembourg": ["Luxembourg", 49.7, 6.1],
  "switzerland": ["Switzerland", 46.8, 8.2], "austria": ["Austria", 47.6, 14.1], "poland": ["Poland", 52.0, 19.4], "czechia": ["Czechia", 49.8, 15.5], "hungary": ["Hungary", 47.2, 19.5], "romania": ["Romania", 45.9, 25.0],
  "greece": ["Greece", 39.0, 22.0], "sweden": ["Sweden", 60.1, 15.0], "norway": ["Norway", 61.0, 9.0], "denmark": ["Denmark", 56.0, 10.0], "finland": ["Finland", 62.5, 26.0], "russia": ["Russia", 55.75, 37.6], "ukraine": ["Ukraine", 49.0, 32.0],
  "united states": ["USA", 39.8, -98.6], "canada": ["Canada", 53.0, -100.0], "mexico": ["Mexico", 23.6, -102.5], "brazil": ["Brazil", -10.0, -52.0], "argentina": ["Argentina", -34.0, -64.0], "colombia": ["Colombia", 4.0, -73.0],
  "chile": ["Chile", -33.0, -71.0], "peru": ["Peru", -9.2, -75.0], "ghana": ["Ghana", 7.9, -1.0], "nigeria": ["Nigeria", 9.1, 8.7], "kenya": ["Kenya", 0.2, 37.9], "south africa": ["South Africa", -29.0, 24.0],
  "morocco": ["Morocco", 31.8, -7.1], "tunisia": ["Tunisia", 34.0, 9.5], "ethiopia": ["Ethiopia", 9.1, 40.5], "rwanda": ["Rwanda", -1.9, 29.9], "tanzania": ["Tanzania", -6.4, 34.9], "uganda": ["Uganda", 1.4, 32.3],
  "india": ["India", 22.0, 79.0], "pakistan": ["Pakistan", 30.0, 69.3], "bangladesh": ["Bangladesh", 23.7, 90.4], "sri lanka": ["Sri Lanka", 7.9, 80.8], "malaysia": ["Malaysia", 4.2, 102.0], "indonesia": ["Indonesia", -2.5, 118.0],
  "thailand": ["Thailand", 15.0, 101.0], "vietnam": ["Vietnam", 16.0, 107.8], "philippines": ["Philippines", 12.9, 121.8], "china": ["China", 35.0, 104.0], "japan": ["Japan", 36.2, 138.3], "south korea": ["South Korea", 36.5, 127.9],
  "taiwan": ["Taiwan", 23.7, 121.0], "australia": ["Australia", -25.0, 134.0], "new zealand": ["New Zealand", -41.0, 174.0],
};

const ALIASES: Record<string, string> = {
  "uae": "united arab emirates", "emirates": "united arab emirates", "uk": "united kingdom", "great britain": "united kingdom", "britain": "united kingdom", "england": "united kingdom", "gb": "united kingdom",
  "ksa": "saudi arabia", "saudi": "saudi arabia", "kingdom of saudi arabia": "saudi arabia", "usa": "united states", "us": "united states", "united states of america": "united states", "america": "united states",
  "turkiye": "turkey", "czech republic": "czechia", "holland": "netherlands", "the netherlands": "netherlands", "korea": "south korea", "republic of ireland": "ireland", "eire": "ireland",
  "nyc": "new york", "new york city": "new york", "washington dc": "washington", "sf": "san francisco", "la": "los angeles", "saigon": "ho chi minh city", "bombay": "mumbai",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.']/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
const lookup = (table: Record<string, [string, number, number]>, raw: string): Place | null => {
  const n = norm(raw); if (!n) return null;
  const key = ALIASES[n] ?? n; const hit = table[key];
  return hit ? { key, label: hit[0], lat: hit[1], lng: hit[2] } : null;
};

/** The place for a person's city and country, or null when neither is one we know. */
export function locatePlace(city?: string | null, country?: string | null): Place | null {
  for (const part of (city ?? "").split(/[,/]| - /)) { const p = lookup(CITIES, part); if (p) return p; }
  for (const part of [country ?? "", ...(city ?? "").split(/[,/]| - /)]) { const p = lookup(COUNTRIES, part); if (p) return p; }
  return null;
}
