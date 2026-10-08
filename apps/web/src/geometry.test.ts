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
} from "./geometry";
import { applyCommand, command } from "./history";
describe("metric geometry and project commands", () => {
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
  it("validates dimensions, scene persistence, and parametric footprint changes", () => {
    const p = demoProject();
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const b = p.objects.find((o) => o.kind === "building")!;
    expect(area(footprint({ ...b, width: 20 }))).toBeCloseTo(320);
    expect(() =>
      validateProject({ ...p, objects: [{ ...b, width: -1 }] }),
    ).toThrow();
  });
});
