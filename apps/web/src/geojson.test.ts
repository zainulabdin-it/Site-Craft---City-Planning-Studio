import { describe, expect, it } from "vitest";
import { importGeoJSON } from "./geojson";
import { newProject } from "./model";
import { validateProject } from "./geometry";

describe("GeoJSON import", () => {
  it("preserves geometry and properties", () => {
    const layer = importGeoJSON(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Test site", height: 12 },
            geometry: { type: "Point", coordinates: [172.63, -43.53] },
          },
        ],
      },
      "sites.geojson",
    );
    expect(layer.name).toBe("sites");
    expect(layer.features[0].properties).toEqual({
      name: "Test site",
      height: 12,
    });
    expect(layer.features[0].geometry.type).toBe("Point");
  });

  it("rejects invalid coordinates", () => {
    expect(() =>
      importGeoJSON({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [500, -43] },
      }),
    ).toThrow(/WGS84/);
  });

  it("round trips imported layers through project JSON", () => {
    const project = newProject("Layer round trip");
    project.dataLayers.push(
      importGeoJSON({
        type: "Feature",
        properties: { zone: "central" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [172.63, -43.53],
              [172.64, -43.53],
              [172.64, -43.54],
              [172.63, -43.53],
            ],
          ],
        },
      }),
    );
    const restored = validateProject(JSON.parse(JSON.stringify(project)));
    expect(restored.dataLayers).toEqual(project.dataLayers);
  });
});
