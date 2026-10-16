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
    expect(result.surface).toBe("unknown");
    expect(result.notes[0]).toContain("unavailable");
  });

  it("tries another OpenStreetMap endpoint when the first one fails", async () => {
    const origin: [number, number] = [172.6362, -43.5321],
      roadGeometry = [
        [-100, 0],
        [100, 0],
      ].map((point) => {
        const [lon, lat] = toGeo(point as [number, number], origin);
        return { lon, lat };
      });
    let overpassAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("is-on-water"))
          return Promise.resolve({
            ok: true,
            json: async () => ({ isWater: false }),
          });
        overpassAttempts++;
        if (overpassAttempts === 1)
          return Promise.resolve({ ok: false, status: 503 });
        return Promise.resolve({
          ok: true,
          json: async () => ({
            elements: [
              {
                type: "way",
                tags: { highway: "residential", name: "Fallback Road" },
                geometry: roadGeometry,
              },
            ],
          }),
        });
      }),
    );
    const result = await analyzeSite(boundary, origin);
    expect(result.sourceAvailable).toBe(true);
    expect(result.accessRoads).toContain("Fallback Road");
    expect(overpassAttempts).toBe(2);
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

  it("blocks a boundary whose centre is mapped as water", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("nominatim.openstreetmap.org/reverse"))
          return Promise.resolve({
            ok: true,
            json: async () => ({
              category: "natural",
              type: "water",
              display_name: "Lyttelton Harbour",
            }),
          });
        return Promise.resolve({
          ok: true,
          json: async () => ({ elements: [] }),
        });
      }),
    );

    const result = await analyzeSite(boundary, [172.6362, -43.5321]);
    expect(result.surface).toBe("water");
    expect(result.buildability).toBe("blocked");
    expect(result.notes.join(" ")).toContain("mapped as water");
  });
});
