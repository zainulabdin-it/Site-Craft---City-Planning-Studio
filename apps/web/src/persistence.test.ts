import { beforeEach, describe, expect, it, vi } from "vitest";
import { newObject, newProject } from "./model";
import { listSnapshots, saveSnapshot } from "./persistence";

describe("local recovery snapshots", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it("does not duplicate unchanged snapshots", () => {
    const project = newProject("Recovery");
    saveSnapshot(project);
    saveSnapshot(project);
    expect(listSnapshots(project.id)).toHaveLength(1);
  });

  it("keeps only ten revisions for one project", () => {
    const project = newProject("Recovery");
    for (let index = 0; index < 12; index++) {
      const tree = newObject(project, "tree", [[index, index]]);
      tree.name = "Tree " + index;
      project.objects.push(tree);
      saveSnapshot({ ...project, objects: [...project.objects] });
    }
    expect(listSnapshots(project.id)).toHaveLength(10);
  });
});
