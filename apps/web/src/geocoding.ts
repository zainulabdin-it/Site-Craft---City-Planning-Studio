import { type Point } from "./model";

export interface LocationResult {
  id: string;
  name: string;
  center: Point;
  bounds: [number, number, number, number];
}

const cache = new Map<string, LocationResult[]>();
let nextRequestAt = 0;

export function parseLocationResults(input: unknown): LocationResult[] {
  if (!Array.isArray(input))
    throw Error("Location service returned invalid data.");
  return input.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as Record<string, unknown>,
      lat = Number(value.lat),
      lon = Number(value.lon),
      box = Array.isArray(value.boundingbox)
        ? value.boundingbox.map(Number)
        : [];
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180 ||
      typeof value.display_name !== "string" ||
      box.length !== 4 ||
      box.some((n) => !Number.isFinite(n)) ||
      box[0] < -90 ||
      box[1] > 90 ||
      box[2] < -180 ||
      box[3] > 180
    )
      return [];
    return [
      {
        id: String(value.place_id ?? `${lon},${lat},${index}`),
        name: value.display_name,
        center: [lon, lat] as Point,
        // Nominatim returns south, north, west, east.
        bounds: [box[2], box[0], box[3], box[1]] as [
          number,
          number,
          number,
          number,
        ],
      },
    ];
  });
}

export async function searchLocations(
  query: string,
): Promise<LocationResult[]> {
  const q = query.trim(),
    key = q.toLocaleLowerCase();
  if (q.length < 2) throw Error("Enter at least two characters to search.");
  const saved = cache.get(key);
  if (saved) return saved;

  const wait = nextRequestAt - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  nextRequestAt = Date.now() + 1000;

  const endpoint =
      import.meta.env.VITE_GEOCODER_URL ||
      "https://nominatim.openstreetmap.org/search",
    url = new URL(endpoint);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error(`Location search failed (${response.status}).`);
  const results = parseLocationResults(await response.json());
  cache.set(key, results);
  return results;
}
