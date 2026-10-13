import { describe, expect, it } from "vitest";
import { newObject, newProject, projectSchema } from "./model";
import { societyAssets } from "./societyAssets";

describe("society and custom assets", () => {
  it("provides unique, editable society assets", () => {
    expect(societyAssets.length).toBeGreaterThanOrEqual(20);
    expect(new Set(societyAssets.map((asset) => asset.assetRef)).size).toBe(
      societyAssets.length,
    );
    expect(societyAssets.map((asset) => asset.name)).toEqual(
      expect.arrayContaining(["Mosque", "School", "Hospital", "Graveyard"]),
    );
  });
  it("stores a mosque as an editable building", () => {
    const project = newProject("Society plan");
    const mosque = newObject(project, "building", [[0, 0]]);
    mosque.name = "Community mosque";
    mosque.buildingType = "Place of worship";
    mosque.assetRef = "builtin:society:mosque";
    mosque.width = 28;
    mosque.depth = 22;
    project.objects.push(mosque);

    expect(projectSchema.parse(project).objects[0]).toMatchObject({
      name: "Community mosque",
      buildingType: "Place of worship",
      assetRef: "builtin:society:mosque",
    });
  });

  it("keeps a custom GLB reference in saved project data", () => {
    const project = newProject("Imported model plan");
    const asset = newObject(project, "building", [[12, 18]]);
    asset.assetRef = `custom:${crypto.randomUUID()}`;
    asset.buildingType = "Community";
    project.objects.push(asset);

    expect(projectSchema.parse(JSON.parse(JSON.stringify(project)))).toEqual(
      project,
    );
  });
});
