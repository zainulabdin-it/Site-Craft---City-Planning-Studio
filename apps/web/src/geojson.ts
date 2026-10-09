import { dataLayerSchema, type DataLayer } from "./model";

const geometryTypes = new Set([
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
]);

function validateCoordinates(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0)
    throw Error("GeoJSON geometry has empty coordinates.");
  if (typeof value[0] === "number") {
    if (
      value.length < 2 ||
      !Number.isFinite(value[0]) ||
      !Number.isFinite(value[1]) ||
      value[0] < -180 ||
      value[0] > 180 ||
      value[1] < -90 ||
      value[1] > 90
    )
      throw Error(
        "GeoJSON coordinates must be valid WGS84 longitude/latitude values.",
      );
    return;
  }
  value.forEach(validateCoordinates);
}

export function importGeoJSON(
  input: unknown,
  filename = "Imported GeoJSON",
): DataLayer {
  const root = input as Record<string, unknown>;
  const rawFeatures =
    root?.type === "FeatureCollection"
      ? root.features
      : root?.type === "Feature"
        ? [root]
        : undefined;
  if (!Array.isArray(rawFeatures))
    throw Error("Choose a GeoJSON FeatureCollection or Feature file.");
  if (!rawFeatures.length) throw Error("GeoJSON contains no features.");
  if (rawFeatures.length > 50_000)
    throw Error("GeoJSON exceeds 50,000 features.");

  const features = rawFeatures.map((raw, index) => {
    const feature = raw as Record<string, unknown>;
    const geometry = feature.geometry as Record<string, unknown> | null;
    if (!geometry || !geometryTypes.has(String(geometry.type)))
      throw Error(
        `Feature ${index + 1} has an unsupported or missing geometry.`,
      );
    validateCoordinates(geometry.coordinates);
    const properties =
      feature.properties &&
      typeof feature.properties === "object" &&
      !Array.isArray(feature.properties)
        ? (feature.properties as Record<string, unknown>)
        : {};
    return {
      id: crypto.randomUUID(),
      geometry: {
        type: geometry.type as
          | "Point"
          | "LineString"
          | "Polygon"
          | "MultiPoint"
          | "MultiLineString"
          | "MultiPolygon",
        coordinates: geometry.coordinates,
      },
      properties,
    };
  });

  return dataLayerSchema.parse({
    id: crypto.randomUUID(),
    name: filename.replace(/\.(geo)?json$/i, "") || "Imported GeoJSON",
    visible: true,
    opacity: 0.8,
    color: "#2563eb",
    source: filename,
    features,
  });
}
