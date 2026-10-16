import { describe, expect, it } from "vitest";
import * as C from "cesium";
import { newObject, newProject, projectSchema } from "./model";
import {
  assertLayersEditable,
  displayOffset,
  getLayerControl,
  updateLayerControl,
} from "./layerControls";
import { applyLayerPresentation } from "./layerRendering";

describe("shared layer controls", () => {
  it("opens existing version-four saves with safe layer defaults", () => {
    const old = newProject();
    const raw = JSON.parse(JSON.stringify(old));
    delete raw.layerControls;
    delete raw.layerPresentation;
    const restored = projectSchema.parse(raw);
    expect(restored.layerControls).toEqual([]);
    expect(restored.layerPresentation).toEqual({
      exploded: false,
      spacingM: 15,
    });
    expect(getLayerControl(restored, "design:building").locked).toBe(false);
    expect(getLayerControl(restored, "data:reference").locked).toBe(true);
  });
  it("prevents edits to locked layers, including connected road changes", () => {
    let project = newProject();
    const road = newObject(project, "road", [
      [0, 0],
      [50, 0],
    ]);
    const house = newObject(project, "building", [[0, 40]]);
    project = updateLayerControl(project, "design:road", { locked: true });
    expect(() => assertLayersEditable(project, [house, road])).toThrow(
      "road layer is locked",
    );
    expect(() => assertLayersEditable(project, [house])).not.toThrow();
    project = updateLayerControl(project, "design:road", { locked: false });
    expect(() => assertLayersEditable(project, [road])).not.toThrow();
  });
  it("saves presentation separately from physical positions and elevations", () => {
    let project = newProject();
    project.objects.push(newObject(project, "building", [[10, 20]]));
    const original = JSON.stringify(project.objects);
    project = updateLayerControl(project, "design:building", {
      displayOffsetM: 25,
    });
    project.layerPresentation = { exploded: true, spacingM: 10 };
    expect(displayOffset(project, "design:building", "3d")).toBeGreaterThan(25);
    expect(displayOffset(project, "design:building", "street")).toBeGreaterThan(
      25,
    );
    expect(
      displayOffset(project, "design:building", "cinematic"),
    ).toBeGreaterThan(25);
    expect(displayOffset(project, "design:building", "2d")).toBe(0);
    expect(JSON.stringify(project.objects)).toBe(original);
    expect(
      projectSchema.parse(JSON.parse(JSON.stringify(project))).layerControls[0]
        .displayOffsetM,
    ).toBe(25);
  });
  it("applies render offsets once and restores geometry when assembled or viewed in 2D", () => {
    let project = newProject();
    const house = newObject(project, "building", [[0, 0]]);
    project.objects.push(house);
    project = updateLayerControl(project, "design:building", {
      displayOffsetM: 30,
    });
    const entities = new C.EntityCollection();
    const entity = entities.add({
      id: house.id,
      position: C.Cartesian3.fromDegrees(172, -43, 5),
      polygon: {
        hierarchy: C.Cartesian3.fromDegreesArray([
          172, -43, 172.001, -43, 172.001, -43.001,
        ]),
        height: 2,
        extrudedHeight: 8,
      },
    });
    const time = C.JulianDate.now();
    const viewer = {
      clock: { currentTime: time },
      imageryLayers: { length: 0 },
      entities,
    } as unknown as C.Viewer;
    const cache = new WeakMap();
    applyLayerPresentation(viewer, project, "3d", cache);
    applyLayerPresentation(viewer, project, "3d", cache);
    expect(
      C.Cartographic.fromCartesian(entity.position!.getValue(time)!).height,
    ).toBeCloseTo(35, 4);
    expect(entity.polygon!.height!.getValue(time)).toBe(32);
    expect(entity.polygon!.extrudedHeight!.getValue(time)).toBe(38);
    applyLayerPresentation(viewer, project, "2d", cache);
    expect(
      C.Cartographic.fromCartesian(entity.position!.getValue(time)!).height,
    ).toBeCloseTo(5, 4);
    expect(entity.polygon!.height!.getValue(time)).toBe(2);
    expect(project.objects[0].elevation).toBe(0);
  });
});
