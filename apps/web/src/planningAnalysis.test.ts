import { describe, expect, it } from "vitest";
import { analyzePlanning } from "./planningAnalysis";
import { newObject, newProject } from "./model";
import { toGeo } from "./geometry";

describe("planning analysis", () => {
  it("reports collisions, access and unknown authoritative data", () => {
    const project = newProject("Analysis");
    const boundary = newObject(project, "boundary", [
      [-100, -100],
      [100, -100],
      [100, 100],
      [-100, 100],
    ]);
    const first = newObject(project, "building", [[0, 0]]);
    first.name = "House one";
    const second = newObject(project, "building", [[2, 2]]);
    second.name = "House two";
    project.objects.push(boundary, first, second);

    const result = analyzePlanning(project);
    expect(result.issues.some((item) => item.id.startsWith("collision:"))).toBe(
      true,
    );
    expect(result.buildingsWithoutAccess).toBe(2);
    expect(
      result.issues.some((item) => item.id === "utilities:missing:water"),
    ).toBe(true);
    expect(result.score).toBeLessThan(10);
  });

  it("calculates population, parking and green space deterministically", () => {
    const project = newProject("Metrics");
    const boundary = newObject(project, "boundary", [
      [-100, -100],
      [100, -100],
      [100, 100],
      [-100, 100],
    ]);
    const house = newObject(project, "building", [[0, 0]]);
    const park = newObject(project, "plot", [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ]);
    park.name = "Neighbourhood park";
    project.objects.push(boundary, house, park);

    const result = analyzePlanning(project);
    expect(result.housingUnits).toBe(1);
    expect(result.estimatedResidents).toBe(4);
    expect(result.parkingRequired).toBe(2);
    expect(result.greenPercent).toBeGreaterThan(0);
  });

  it("keeps missing terrain unknown and warns on sampled steep terrain", () => {
    const project = newProject("Terrain");
    project.objects.push(
      newObject(project, "boundary", [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50],
      ]),
    );
    const unknown = analyzePlanning(project, { available: false });
    expect(unknown.issues.some((item) => item.id === "terrain:data")).toBe(
      true,
    );
    const steep = analyzePlanning(project, {
      available: true,
      minimumM: 10,
      maximumM: 40,
      rangeM: 30,
      maximumSlopePercent: 22,
      sampledAt: new Date().toISOString(),
    });
    expect(steep.issues.some((item) => item.id === "terrain:slope")).toBe(true);
    expect(steep.issues.some((item) => item.id === "terrain:data")).toBe(false);
  });

  it("checks parcel zoning use, floors, coverage and FAR", () => {
    const project = newProject("Zoning");
    const parcel = newObject(project, "plot", [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ]);
    parcel.name = "Residential parcel";
    const building = newObject(project, "building", [[0, 0]]);
    building.buildingType = "Commercial";
    building.floors = 5;
    project.objects.push(parcel, building);
    project.zones.push({
      id: crypto.randomUUID(),
      name: "Low density residential",
      type: "residential",
      parcelIds: [parcel.id],
      allowedBuildingTypes: ["Detached house"],
      frontSetbackM: 3,
      sideSetbackM: 1.5,
      rearSetbackM: 3,
      maximumFloors: 2,
      maximumCoveragePercent: 20,
      maximumFar: 0.5,
      minimumPlotAreaM2: 500,
    });
    const result = analyzePlanning(project, { available: false });
    expect(result.issues.some((item) => item.id.startsWith("zone:use:"))).toBe(
      true,
    );
    expect(
      result.issues.some((item) => item.id.startsWith("zone:height:")),
    ).toBe(true);
    expect(
      result.issues.some((item) => item.id.startsWith("zone:min-area:")),
    ).toBe(true);
  });

  it("checks utility reach and estimates preliminary stormwater runoff", () => {
    const project = newProject("Utilities");
    const near = newObject(project, "building", [[5, 10]]);
    near.name = "Connected house";
    const far = newObject(project, "building", [[5, 80]]);
    far.name = "Unconnected house";
    project.objects.push(near, far);
    for (const type of [
      "water",
      "wastewater",
      "stormwater",
      "electricity",
    ] as const)
      project.utilityNetworks.push({
        id: crypto.randomUUID(),
        name: `${type} main`,
        type,
        points: [
          [-50, 0],
          [50, 0],
        ],
        capacity: 0,
        capacityUnit: type === "electricity" ? "kVA" : "L/s",
        connectionDistanceM: 30,
        connectedObjectIds: [near.id],
        source: "Concept test",
        confidence: "indicative",
      });

    const result = analyzePlanning(project, { available: false });
    expect(result.utilityNetworks).toBe(4);
    expect(result.utilityConnections).toBe(1);
    expect(result.preliminaryRunoffM3).toBeGreaterThan(0);
    expect(
      result.issues.some((item) => item.id === "utilities:unconnected:water"),
    ).toBe(true);
  });

  it("flags an imported hazard polygon that overlaps a site", () => {
    const project = newProject("Hazards");
    const boundary = newObject(project, "boundary", [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ]);
    project.objects.push(boundary);
    const ring = [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
      [-20, -20],
    ].map((point) => toGeo(point as [number, number], project.origin));
    project.dataLayers.push({
      id: crypto.randomUUID(),
      name: "Council flood layer",
      visible: true,
      opacity: 0.5,
      color: "#2563eb",
      source: "Council test data",
      hazardType: "flood",
      hazardSeverity: "avoid",
      confidence: "authoritative",
      sourceDate: "2026-01-01",
      features: [
        {
          id: crypto.randomUUID(),
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {},
        },
      ],
    });
    const result = analyzePlanning(project, { available: false });
    const overlap = result.issues.find((issue) =>
      issue.id.startsWith("hazards:overlap:"),
    );
    expect(overlap?.severity).toBe("error");
    expect(overlap?.objectIds).toContain(boundary.id);
  });
});
