import { describe, expect, it } from "vitest";
import { locationRadiusMeters, streetApproach } from "./navigation";
import { newObject, newProject } from "./model";

describe("location navigation", () => {
  it("frames geographic bounds in metres with longitude adjusted for latitude", () => {
    const equator = locationRadiusMeters(
      [172, 0],
      [171.99, -0.01, 172.01, 0.01],
    );
    const nz = locationRadiusMeters(
      [172, -43],
      [171.99, -43.01, 172.01, -42.99],
    );
    expect(nz).toBeLessThan(equator);
    expect(locationRadiusMeters([172, -43], [172, -43, 172, -43])).toBe(30);
  });
  it("approaches a landmark from its nearest road and faces the landmark", () => {
    const p = newProject();
    const road = newObject(p, "road", [
      [-100, 0],
      [100, 0],
    ]);
    road.elevation = 2;
    const view = streetApproach([20, 30], 15, [road], 1);
    expect(view.eye).toEqual([20, 0]);
    expect(view.heading).toBe(0);
    expect(view.height).toBe(3.7);
  });
  it("looks along a selected road instead of facing its own camera position", () => {
    const p = newProject();
    const road = newObject(p, "road", [
      [-100, 0],
      [100, 0],
    ]);
    expect(streetApproach([0, 0], 20, [road], 0).heading).toBeCloseTo(
      Math.PI / 2,
    );
  });
  it("does not jump to a distant unrelated road", () => {
    const p = newProject();
    const road = newObject(p, "road", [
      [900, 900],
      [1000, 900],
    ]);
    const view = streetApproach([0, 0], 10, [road], 0);
    expect(view.eye).toEqual([0, -18]);
    expect(view.heading).toBe(0);
  });
});
