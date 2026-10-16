import type { Point } from "./model";
import { area, inside, length, toGeo, toLocal } from "./geometry";

export type SiteAnalysis = {
  areaHa: number;
  perimeterM: number;
  widthM: number;
  depthM: number;
  nearbyRoads: number;
  accessRoads: string[];
  nearestRoad?: { name: string; distanceM: number };
  existingBuildings: number;
  waterFeatures: number;
  landUse: string[];
  intersectingRoads: number;
  intersectingBuildings: number;
  intersectingWaterFeatures: number;
  intersectingLandUse: string[];
  surface: "land" | "water" | "unknown";
  surfaceName?: string;
  buildability: "blocked" | "review" | "unknown";
  checkedAt: string;
  notes: string[];
  sourceAvailable: boolean;
};

type OsmElement = {
  type: string;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
};

export type SurfaceCheck = {
  surface: "land" | "water" | "unknown";
  name?: string;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function fetchOsmContext(query: string) {
  let lastStatus = "unavailable";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        lastStatus = `${response.status}`;
        continue;
      }
      const payload = (await response.json()) as { elements?: OsmElement[] };
      if (Array.isArray(payload.elements)) return payload;
      lastStatus = "invalid response";
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : "request failed";
    }
  }
  throw Error(`OpenStreetMap context ${lastStatus}`);
}

export async function classifyBoundarySurface(
  boundary: Point[],
  origin: [number, number],
): Promise<SurfaceCheck> {
  const geo = boundary.map((point) => toGeo(point, origin)),
    centre = [
      geo.reduce((sum, point) => sum + point[0], 0) / geo.length,
      geo.reduce((sum, point) => sum + point[1], 0) / geo.length,
    ] as Point;
  try {
    const response = await fetch(
      `https://is-on-water.balbona.me/api/v1/get/${centre[1]}/${centre[0]}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (response.ok) {
      const result = (await response.json()) as {
        isWater?: boolean;
        feature?: string;
      };
      if (typeof result.isWater === "boolean")
        return {
          surface: result.isWater ? "water" : "land",
          name: result.feature,
        };
    }
  } catch {
    // Fall back to OpenStreetMap reverse lookup below.
  }

  try {
    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.searchParams.set("lat", String(centre[1]));
    reverseUrl.searchParams.set("lon", String(centre[0]));
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("zoom", "18");
    const response = await fetch(reverseUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { surface: "unknown" };
    const place = (await response.json()) as {
      category?: string;
      type?: string;
      display_name?: string;
      address?: Record<string, string>;
    };
    const waterTypes = new Set([
      "water",
      "sea",
      "ocean",
      "bay",
      "strait",
      "lake",
      "reservoir",
      "river",
    ]);
    const isWater =
      place.category === "water" ||
      (place.category === "natural" && waterTypes.has(place.type ?? "")) ||
      waterTypes.has(place.type ?? "");
    return {
      surface: isWater
        ? "water"
        : place.address || place.display_name
          ? "land"
          : "unknown",
      name: place.display_name,
    };
  } catch {
    return { surface: "unknown" };
  }
}

const pointSegmentDistance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    denominator = dx * dx + dy * dy;
  if (!denominator) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denominator),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const distanceToBoundary = (point: Point, boundary: Point[]) =>
  Math.min(
    ...boundary.map((start, index) =>
      pointSegmentDistance(
        point,
        start,
        boundary[(index + 1) % boundary.length],
      ),
    ),
  );

const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point) => {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b),
    epsilon = 0.000001;
  return (
    abC * abD <= epsilon &&
    cdA * cdB <= epsilon &&
    Math.max(a[0], b[0]) + epsilon >= Math.min(c[0], d[0]) &&
    Math.max(c[0], d[0]) + epsilon >= Math.min(a[0], b[0]) &&
    Math.max(a[1], b[1]) + epsilon >= Math.min(c[1], d[1]) &&
    Math.max(c[1], d[1]) + epsilon >= Math.min(a[1], b[1])
  );
};

const geometryIntersectsBoundary = (
  points: Point[],
  boundary: Point[],
  polygon = false,
) => {
  if (!points.length) return false;
  if (points.some((point) => inside(point, boundary))) return true;
  if (polygon && boundary.some((point) => inside(point, points))) return true;
  for (let i = 1; i < points.length; i++)
    for (let j = 0; j < boundary.length; j++)
      if (
        segmentsIntersect(
          points[i - 1],
          points[i],
          boundary[j],
          boundary[(j + 1) % boundary.length],
        )
      )
        return true;
  if (polygon && points.length > 2)
    for (let j = 0; j < boundary.length; j++)
      if (
        segmentsIntersect(
          points.at(-1)!,
          points[0],
          boundary[j],
          boundary[(j + 1) % boundary.length],
        )
      )
        return true;
  return false;
};

const lineDistanceToBoundary = (points: Point[], boundary: Point[]) => {
  if (!points.length) return Number.POSITIVE_INFINITY;
  if (geometryIntersectsBoundary(points, boundary)) return 0;
  return Math.min(
    ...points.map((point) => distanceToBoundary(point, boundary)),
    ...boundary.flatMap((point) =>
      points
        .slice(1)
        .map((end, index) => pointSegmentDistance(point, points[index], end)),
    ),
  );
};

export async function analyzeSite(
  boundary: Point[],
  origin: [number, number],
): Promise<SiteAnalysis> {
  const xs = boundary.map(([x]) => x),
    ys = boundary.map(([, y]) => y),
    base: SiteAnalysis = {
      areaHa: area(boundary) / 10_000,
      perimeterM: length([...boundary, boundary[0]]),
      widthM: Math.max(...xs) - Math.min(...xs),
      depthM: Math.max(...ys) - Math.min(...ys),
      nearbyRoads: 0,
      accessRoads: [],
      existingBuildings: 0,
      waterFeatures: 0,
      landUse: [],
      intersectingRoads: 0,
      intersectingBuildings: 0,
      intersectingWaterFeatures: 0,
      intersectingLandUse: [],
      surface: "unknown",
      buildability: "unknown",
      checkedAt: new Date().toISOString(),
      notes: ["A ground and elevation survey is required before engineering."],
      sourceAvailable: false,
    };
  const geo = boundary.map((point) => toGeo(point, origin)),
    lons = geo.map(([lon]) => lon),
    lats = geo.map(([, lat]) => lat),
    pad = 0.002,
    bbox = `${Math.min(...lats) - pad},${Math.min(...lons) - pad},${Math.max(...lats) + pad},${Math.max(...lons) + pad}`,
    query = `[out:json][timeout:18];(way["highway"](${bbox});way["building"](${bbox});way["waterway"](${bbox});way["natural"="water"](${bbox});way["landuse"](${bbox}););out tags center geom;`;
  const surfaceCheck = await classifyBoundarySurface(boundary, origin);
  base.surface = surfaceCheck.surface;
  base.surfaceName = surfaceCheck.name;
  if (surfaceCheck.surface === "water") {
    base.buildability = "blocked";
    base.notes.unshift(
      "The centre of this boundary is mapped as water. Buildings cannot be placed until the boundary is moved onto suitable land.",
    );
  }
  try {
    const payload = await fetchOsmContext(query);
    const elements = payload.elements ?? [],
      localGeometry = (element: OsmElement) =>
        (element.geometry ?? []).map(({ lon, lat }) =>
          toLocal([lon, lat], origin),
        ),
      roads = elements.filter((item) => item.tags?.highway),
      roadDetails = roads
        .map((road) => {
          const points = localGeometry(road);
          if (!points.length && road.center)
            points.push(toLocal([road.center.lon, road.center.lat], origin));
          const distanceM = lineDistanceToBoundary(points, boundary);
          return {
            name: road.tags?.name || road.tags?.ref || "Unnamed road",
            distanceM,
          };
        })
        .filter((road) => Number.isFinite(road.distanceM))
        .sort((a, b) => a.distanceM - b.distanceM);
    base.nearbyRoads = roadDetails.filter(
      (road) => road.distanceM <= 150,
    ).length;
    base.accessRoads = [
      ...new Set(
        roadDetails
          .filter((road) => road.distanceM <= 25)
          .map((road) => road.name),
      ),
    ].slice(0, 6);
    base.nearestRoad = roadDetails[0];
    const buildings = elements.filter((item) => item.tags?.building),
      water = elements.filter(
        (item) => item.tags?.waterway || item.tags?.natural === "water",
      ),
      landUseFeatures = elements.filter((item) => item.tags?.landuse);
    base.existingBuildings = buildings.length;
    base.waterFeatures = water.length;
    base.intersectingRoads = roads.filter((item) =>
      geometryIntersectsBoundary(localGeometry(item), boundary),
    ).length;
    base.intersectingBuildings = buildings.filter((item) =>
      geometryIntersectsBoundary(localGeometry(item), boundary, true),
    ).length;
    base.intersectingWaterFeatures = water.filter((item) =>
      geometryIntersectsBoundary(
        localGeometry(item),
        boundary,
        item.tags?.natural === "water",
      ),
    ).length;
    base.intersectingLandUse = [
      ...new Set(
        landUseFeatures
          .filter((item) =>
            geometryIntersectsBoundary(localGeometry(item), boundary, true),
          )
          .map((item) => item.tags!.landuse),
      ),
    ].slice(0, 6);
    base.landUse = [
      ...new Set(
        elements.map((item) => item.tags?.landuse).filter(Boolean) as string[],
      ),
    ].slice(0, 6);
    if (!base.accessRoads.length)
      base.notes.unshift(
        "No mapped road reaches within 25 m of the boundary; plan an access connection.",
      );
    if (base.waterFeatures)
      base.notes.unshift(
        `${base.waterFeatures} mapped water feature(s) are nearby; verify setbacks and flood risk.`,
      );
    if (base.intersectingWaterFeatures)
      base.notes.unshift(
        `${base.intersectingWaterFeatures} mapped water feature(s) intersect the site. Normal buildings must not be placed there.`,
      );
    if (base.intersectingBuildings)
      base.notes.unshift(
        `${base.intersectingBuildings} mapped existing building(s) intersect the site boundary.`,
      );
    if (base.existingBuildings)
      base.notes.unshift(
        `${base.existingBuildings} mapped existing building(s) need site verification before layout work.`,
      );
    base.buildability =
      base.surface === "water" || base.intersectingWaterFeatures
        ? "blocked"
        : "review";
    base.sourceAvailable = true;
  } catch {
    base.notes.unshift(
      "Live map analysis is unavailable. Area measurements are shown; retry when online.",
    );
  }
  return base;
}
