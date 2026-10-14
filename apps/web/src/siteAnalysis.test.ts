import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSite } from "./siteAnalysis";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: "way",
              tags: { highway: "residential", name: "Boundary Road" },
              center: { lon: 172.6362, lat: -43.53165 },
            },
            { type: "way", tags: { building: "house" } },
            { type: "way", tags: { waterway: "stream" } },
            { type: "way", tags: { landuse: "residential" } },
          ],
        }),
      }),
    );
    const result = await analyzeSite(boundary, [172.6362, -43.5321]);
    expect(result.sourceAvailable).toBe(true);
    expect(result.nearbyRoads).toBe(1);
    expect(result.accessRoads).toContain("Boundary Road");
    expect(result.existingBuildings).toBe(1);
    expect(result.waterFeatures).toBe(1);
    expect(result.landUse).toContain("residential");
  });
});
