import { describe, it, expect } from "vitest";
import { newProject, newObject, demoProject } from "./model";
import {
  area,
  validPolygon,
  toLocal,
  toGeo,
  connectRoad,
  roadSurface,
  validateProject,
  footprint,
  moveTo,
  resizeFromHandle,
  validateObjectCollisions,
} from "./geometry";
import { zarajNzProject } from "./zarajDemo";
import { applyCommand, command } from "./history";
describe("metric geometry and project commands", () => {
  it("blocks a newly changed building that overlaps another building", () => {
    const project = newProject("Collision");
    const first = newObject(project, "building", [[0, 0]]);
    first.name = "First house";
    const second = newObject(project, "building", [[2, 2]]);
    second.name = "Second house";
    project.objects.push(first, second);
    expect(() =>
      validateObjectCollisions(project, new Set([second.id])),
    ).toThrow(/overlaps First house|First house overlaps Second house/);
  });
  it("checks a new road without re-reporting an unrelated legacy overlap", () => {
    const project = newProject("Road collision scope"),
      building = newObject(project, "building", [[0, 0]]),
      legacyRoad = newObject(project, "road", [
        [-20, 0],
        [20, 0],
      ]),
      newRoad = newObject(project, "road", [
        [80, 0],
        [120, 0],
      ]);
    project.objects.push(building, legacyRoad, newRoad);
    expect(() =>
      validateObjectCollisions(project, new Set([newRoad.id])),
    ).not.toThrow();
    const crossingRoad = {
      ...newRoad,
      points: [
        [-20, 0],
        [20, 0],
      ] as [number, number][],
    };
    project.objects[2] = crossingRoad;
    expect(() =>
      validateObjectCollisions(project, new Set([crossingRoad.id])),
    ).toThrow(/overlaps a road/);
  });
  it("builds a valid Avalon Heights NZ demo with complete facilities", () => {
    const project = validateProject(zarajNzProject());
    expect(
      project.objects.filter((object) => object.kind === "building").length,
    ).toBeGreaterThanOrEqual(170);
    expect(
      project.objects.filter((object) => object.kind === "road").length,
    ).toBeGreaterThan(20);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:mosque",
      ),
    ).toBe(true);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:hospital",
      ),
    ).toBe(true);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:graveyard",
      ),
    ).toBe(true);
    for (const faithAsset of ["church", "temple", "gurdwara"])
      expect(
        project.objects.some(
          (object) =>
            object.assetRef === `builtin:society:${faithAsset}` &&
            object.buildingType === "Place of worship",
        ),
      ).toBe(true);
    for (const landmark of ["F3 Technologies", "Avalon Plaza"])
      expect(
        project.objects.some(
          (object) =>
            object.name === landmark &&
            object.kind === "building" &&
            object.assetRef.startsWith("builtin:cinematic:tower-"),
        ),
      ).toBe(true);
    expect(
      project.objects.some(
        (object) =>
          object.name === "SLS School" && object.buildingType === "School",
      ),
    ).toBe(true);
    const accessRoads = project.objects.filter(
      (object) =>
        object.kind === "road" &&
        ["Entry", "Exit", "Link"].some((word) => object.name.includes(word)),
    );
    expect(accessRoads).toHaveLength(2);
    expect(
      accessRoads.every((road) =>
        road.points.some(([x, y]) => Math.abs(x) > 500 || Math.abs(y) > 380),
      ),
    ).toBe(true);
    const roads = project.objects.filter((object) => object.kind === "road"),
      homes = project.objects.filter(
        (object) =>
          object.kind === "building" &&
          ["Detached house", "Townhouse"].includes(object.buildingType),
      ),
      distanceToSegment = (
        point: [number, number],
        start: [number, number],
        end: [number, number],
      ) => {
        const vx = end[0] - start[0],
          vy = end[1] - start[1],
          wx = point[0] - start[0],
          wy = point[1] - start[1],
          t = Math.max(
            0,
            Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)),
          );
        return Math.hypot(
          point[0] - start[0] - t * vx,
          point[1] - start[1] - t * vy,
        );
      };
    const overlaps: string[] = [];
    for (const home of homes)
      for (const road of roads)
        for (let index = 1; index < road.points.length; index++)
          if (
            distanceToSegment(
              home.points[0],
              road.points[index - 1],
              road.points[index],
            ) <
            road.width / 2 + Math.min(home.width, home.depth) / 2 + 1
          )
            overlaps.push(`${home.name} overlaps ${road.name}`);
    expect(overlaps).toEqual([]);
    const collisionErrors: string[] = [];
    for (const building of project.objects.filter(
      (object) =>
        object.kind === "building" &&
        object.assetRef !== "builtin:society:gate",
    ))
      try {
        validateObjectCollisions(project, new Set([building.id]));
      } catch (error) {
        collisionErrors.push((error as Error).message);
      }
    expect(collisionErrors).toEqual([]);
    const internalRoads = roads.filter(
      (road) => road.assetRef !== "builtin:road:external-access",
    );
    const reached = new Set<string>([internalRoads[0].id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const road of internalRoads) {
        if (reached.has(road.id)) continue;
        const connected = internalRoads.some(
          (candidate) =>
            reached.has(candidate.id) &&
            candidate.nodeIds.some((nodeId) => road.nodeIds.includes(nodeId)),
        );
        if (connected) {
          reached.add(road.id);
          changed = true;
        }
      }
    }
    expect(reached.size).toBe(internalRoads.length);
    expect(
      accessRoads.every((road) =>
        road.nodeIds.some((nodeId) =>
          internalRoads.some((candidate) => candidate.nodeIds.includes(nodeId)),
        ),
      ),
    ).toBe(true);
    expect(project.origin).toEqual([172.439, -43.6005]);
    expect(
      project.objects.some((object) => object.name.includes("Canal")),
    ).toBe(false);
  }, 15_000);
  it("resizes a building from one corner while keeping the opposite corner fixed", () => {
    const p = newProject(),
      house = newObject(p, "building", [[0, 0]]);
    house.width = 12;
    house.depth = 16;
    const resized = resizeFromHandle(house, 2, [10, 10]);
    expect(resized.width).toBe(16);
    expect(resized.depth).toBe(18);
    expect(resized.points[0]).toEqual([2, 1]);
    expect(footprint(resized)[0]).toEqual([-6, -8]);
  });
  it("scales a point asset from its map handle", () => {
    const p = newProject(),
      car = newObject(p, "car", [[10, 10]]),
      resized = resizeFromHandle(car, -1, [16, 10]);
    expect(resized.scale).toBe(2);
    expect(resized.points[0]).toEqual([10, 10]);
  });
  it("migrates schema v1 projects to v4 without changing design objects", () => {
    const current = demoProject();
    const legacy = {
      ...current,
      schemaVersion: 1,
      dataLayers: undefined,
      designLayers: undefined,
      projectLayers: undefined,
      planningSettings: undefined,
      dataSources: undefined,
      zones: undefined,
      alternatives: undefined,
      utilityNetworks: undefined,
    };
    delete (legacy as { dataLayers?: unknown }).dataLayers;
    delete (legacy as { designLayers?: unknown }).designLayers;
    delete (legacy as { projectLayers?: unknown }).projectLayers;
    delete (legacy as { planningSettings?: unknown }).planningSettings;
    delete (legacy as { dataSources?: unknown }).dataSources;
    delete (legacy as { zones?: unknown }).zones;
    delete (legacy as { alternatives?: unknown }).alternatives;
    delete (legacy as { utilityNetworks?: unknown }).utilityNetworks;
    delete (legacy as { layerControls?: unknown }).layerControls;
    delete (legacy as { layerPresentation?: unknown }).layerPresentation;
    const migrated = validateProject(legacy);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.objects).toEqual(current.objects);
    expect(migrated.dataLayers).toEqual([]);
    expect(migrated.projectLayers).toEqual([]);
  });
  it("migrates schema v2 projects with an empty project-layer list", () => {
    const current = demoProject();
    const previous = { ...current, schemaVersion: 2 } as Record<
      string,
      unknown
    >;
    delete previous.projectLayers;
    delete previous.planningSettings;
    delete previous.dataSources;
    delete previous.zones;
    delete previous.alternatives;
    delete previous.utilityNetworks;
    delete previous.layerControls;
    delete previous.layerPresentation;
    const migrated = validateProject(previous);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.objects).toEqual(current.objects);
    expect(migrated.projectLayers).toEqual([]);
  });
  it("migrates schema v3 planning projects to v4 settings", () => {
    const current = demoProject();
    const previous = { ...current, schemaVersion: 3 } as Record<
      string,
      unknown
    >;
    delete previous.planningSettings;
    delete previous.dataSources;
    delete previous.zones;
    delete previous.alternatives;
    delete previous.utilityNetworks;
    delete previous.layerControls;
    delete previous.layerPresentation;
    const migrated = validateProject(previous);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.planningSettings.residentsPerUnit).toBe(4);
    expect(migrated.dataSources).toEqual([]);
    expect(migrated.zones).toEqual([]);
    expect(migrated.alternatives).toEqual([]);
    expect(migrated.utilityNetworks).toEqual([]);
  });
  it("persists independent scenario snapshots in schema v4", () => {
    const project = newProject("Scenarios");
    const house = newObject(project, "building", [[0, 0]]);
    project.objects.push(house);
    const alternativeId = crypto.randomUUID();
    project.alternatives.push({
      id: alternativeId,
      name: "Alternative 1",
      createdAt: new Date().toISOString(),
      objects: [
        {
          ...house,
          scenarioId: alternativeId,
          points: [[25, 25]],
        },
      ],
    });
    const restored = validateProject(JSON.parse(JSON.stringify(project)));
    expect(restored.alternatives).toHaveLength(1);
    expect(restored.alternatives[0].objects[0].points[0]).toEqual([25, 25]);
    expect(restored.objects[0].points[0]).toEqual([0, 0]);
  });
  it("rejects road surfaces that escape a concave boundary despite inside endpoints", () => {
    const p = newProject();
    p.objects = [
      newObject(p, "boundary", [
        [0, 0],
        [100, 0],
        [100, 100],
        [60, 100],
        [60, 40],
        [40, 40],
        [40, 100],
        [0, 100],
      ]),
      newObject(p, "road", [
        [20, 80],
        [80, 80],
      ]),
    ];
    expect(() => validateProject(p)).toThrow("full surface");
  });
  it("round trips Christchurch coordinates within 1 mm and matches an independent PROJ reference", () => {
    const origin: [number, number] = [172.6362, -43.5321],
      ll: [number, number] = [172.637, -43.531];
    const xy = toLocal(ll, origin),
      back = toGeo(xy, origin);
    expect(Math.abs(back[0] - ll[0])).toBeLessThan(1e-9);
    expect(Math.abs(back[1] - ll[1])).toBeLessThan(1e-9);
    expect(xy[0]).toBeCloseTo(64.13, 0);
    expect(xy[1]).toBeCloseTo(122.46, 0);
  });
  it("rejects bow ties and degenerate boundaries", () => {
    expect(
      validPolygon([
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0],
      ]),
    ).toBe(false);
    expect(
      validPolygon([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toBe(false);
    expect(
      validPolygon([
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ]),
    ).toBe(true);
  });
  it("splits a snapped road into a shared T node, regenerates width, and supports reversible atomic edits", () => {
    const p = newProject(),
      a = newObject(p, "road", [
        [-100, 0],
        [100, 0],
      ]);
    p.objects = [a];
    const b = newObject(p, "road", [
      [0, -80],
      [0, 2],
    ]);
    const c = command(p, "Connect road", connectRoad(b, p.objects));
    const next = applyCommand(p, c);
    expect(next.objects[0].points).toHaveLength(3);
    expect(next.objects[1].nodeIds[1]).toBe(next.objects[0].nodeIds[1]);
    expect(applyCommand(next, c, true)).toEqual(p);
    const surface = roadSurface(next.objects);
    expect(surface).toHaveLength(1);
    const before = area(surface[0][0]);
    next.objects[0] = { ...next.objects[0], width: 14 };
    const after = roadSurface(next.objects);
    expect(area(after[0][0])).toBeGreaterThan(before + 1000);
  });
  it("does not connect roads at different elevations", () => {
    const p = newProject(),
      a = newObject(p, "road", [
        [-20, 0],
        [20, 0],
      ]),
      b = {
        ...newObject(p, "road", [
          [0, -10],
          [0, 0],
        ]),
        elevation: 5,
      };
    expect(connectRoad(b, [a])).toHaveLength(1);
  });
  it("moves an object by its anchor while preserving its shape", () => {
    const p = newProject(),
      plot = newObject(p, "plot", [
        [10, 20],
        [30, 20],
        [30, 40],
        [10, 40],
      ]);
    expect(moveTo(plot, [100, 200]).points).toEqual([
      [100, 200],
      [120, 200],
      [120, 220],
      [100, 220],
    ]);
  });
  it("supports multiple sites and accepts objects inside either boundary", () => {
    const p = newProject("Multi-site plan"),
      first = newObject(p, "boundary", [
        [-200, -100],
        [-20, -100],
        [-20, 100],
        [-200, 100],
      ]),
      second = newObject(p, "boundary", [
        [20, -100],
        [200, -100],
        [200, 100],
        [20, 100],
      ]),
      firstHouse = newObject(p, "building", [[-100, 0]]),
      secondHouse = newObject(p, "building", [[100, 0]]);
    first.name = "Site 1 boundary";
    second.name = "Site 2 boundary";
    p.objects = [first, second, firstHouse, secondHouse];
    expect(validateProject(p).objects).toHaveLength(4);
    const outside = newObject(p, "building", [[0, 0]]);
    expect(() =>
      validateProject({ ...p, objects: [...p.objects, outside] }),
    ).toThrow("must remain inside one site boundary");
  });
  it("rejects an object whose required area is larger than the site", () => {
    const p = newProject("Compact residential site"),
      boundary = newObject(p, "boundary", [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
      ]),
      house = newObject(p, "building", [[0, 0]]);
    house.width = 12;
    house.depth = 16;
    p.objects = [boundary, house];
    expect(() => validateProject(p)).toThrow(
      /needs 192 m², but the largest site is only 100 m²/,
    );
  });
  it("validates dimensions, scene persistence, and parametric footprint changes", () => {
    const p = demoProject();
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const b = p.objects.find((o) => o.kind === "building")!;
    expect(area(footprint({ ...b, width: 20 }))).toBeCloseTo(
      20 * b.depth * b.scale * b.scale,
    );
    expect(() =>
      validateProject({ ...p, objects: [{ ...b, width: -1 }] }),
    ).toThrow();
  });
});
