import { describe, expect, it } from "vitest";
import { cinematicSocietyProject } from "./cinematicDemo";
import { validateProject } from "./geometry";

describe("cinematic society demo", () => {
  it("is a separate valid project with a complete showcase mix", () => {
    const project = validateProject(cinematicSocietyProject());
    expect(project.name).toContain("Cinematic Society");
    expect(
      project.objects.filter((object) => object.kind === "building").length,
    ).toBeGreaterThan(50);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:mosque",
      ),
    ).toBe(true);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:church",
      ),
    ).toBe(true);
    expect(
      project.objects.some(
        (object) => object.assetRef === "builtin:society:graveyard",
      ),
    ).toBe(true);
    expect(
      project.objects.filter((object) => object.floors >= 10).length,
    ).toBeGreaterThanOrEqual(4);
  });
});
