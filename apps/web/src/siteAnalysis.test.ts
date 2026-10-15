import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSite } from "./siteAnalysis";
import { toGeo } from "./geometry";

const boundary: [number, number][] = [
  [-50, -50],
  [50, -50],
  [50, 50],
  [-50, 50],
];

describe("site analysis", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps boundary measurements when live map data is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await analyzeSite(boundary, [172.6362, -43.5321]);
    expect(result.areaHa).toBe(1);
    expect(result.perimeterM).toBe(400);
    expect(result.sourceAvailable).toBe(false);
    expect(result.notes[0]).toContain("unavailable");
  });

  it("reports mapped access, buildings, water and land use", async () => {
    const origin: [number, number] = [172.6362, -43.5321],
      geometry = (points: [number, number][]) =>
        points.map((point) => {
          const [lon, lat] = toGeo(point, origin);
          return { lon, lat };
        });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: "way",
              tags: { highway: "residential", name: "Boundary Road" },
              geometry: geometry([
                [-100, 0],
                [100, 0],
              ]),
            },
            {
              type: "way",
              tags: { building: "house" },
              geometry: geometry([
                [-10, -10],
                [10, -10],
                [10, 10],
                [-10, 10],
              ]),
            },
            {
              type: "way",
              tags: { waterway: "stream" },
              geometry: geometry([
                [-80, 20],
                [80, 20],
              ]),
            },
            {
              type: "way",
              tags: { landuse: "residential" },
              geometry: geometry([
                [-60, -60],
                [60, -60],
                [60, 60],
                [-60, 60],
              ]),
            },
          ],
        }),
      }),
    );
    const result = await analyzeSite(boundary, origin);
    expect(result.sourceAvailable).toBe(true);
    expect(result.nearbyRoads).toBe(1);
    expect(result.accessRoads).toContain("Boundary Road");
    expect(result.existingBuildings).toBe(1);
    expect(result.waterFeatures).toBe(1);
    expect(result.landUse).toContain("residential");
    expect(result.intersectingRoads).toBe(1);
    expect(result.intersectingBuildings).toBe(1);
    expect(result.intersectingWaterFeatures).toBe(1);
    expect(result.intersectingLandUse).toContain("residential");
    expect(result.buildability).toBe("blocked");
  });
});
