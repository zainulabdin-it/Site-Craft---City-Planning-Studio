import { type Project } from "./model";
import { validateProject, toGeo, footprint } from "./geometry";
import { exportCustomAssets, type EmbeddedCustomAsset } from "./assetStorage";
const key = "sitecraft.projects.v1";
const snapshotKey = "sitecraft.snapshots.v1";
export type ProjectSnapshot = {
  id: string;
  projectId: string;
  savedAt: string;
  project: Project;
};
export function listLocal(): Project[] {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw).map(validateProject) : [];
}
export function saveLocal(p: Project) {
  const all = listLocal().filter((q) => q.id !== p.id);
  localStorage.setItem(key, JSON.stringify([...all, p]));
  localStorage.setItem("sitecraft.active", p.id);
}
export function deleteLocal(id: string): Project[] {
  const remaining = listLocal().filter((project) => project.id !== id);
  localStorage.setItem(key, JSON.stringify(remaining));
  if (localStorage.getItem("sitecraft.active") === id)
    localStorage.removeItem("sitecraft.active");
  return remaining;
}
export function listSnapshots(projectId: string): ProjectSnapshot[] {
  try {
    const raw = localStorage.getItem(snapshotKey);
    if (!raw) return [];
    return (JSON.parse(raw) as ProjectSnapshot[])
      .filter((snapshot) => snapshot.projectId === projectId)
      .map((snapshot) => ({
        ...snapshot,
        project: validateProject(snapshot.project),
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}
export function saveSnapshot(project: Project) {
  const raw = localStorage.getItem(snapshotKey),
    all = raw ? (JSON.parse(raw) as ProjectSnapshot[]) : [],
    projectSnapshots = all
      .filter((snapshot) => snapshot.projectId === project.id)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    latest = projectSnapshots[0];
  if (
    latest &&
    JSON.stringify(latest.project.objects) === JSON.stringify(project.objects)
  )
    return;
  const snapshot: ProjectSnapshot = {
    id: crypto.randomUUID(),
    projectId: project.id,
    savedAt: new Date().toISOString(),
    project,
  };
  const retained = [snapshot, ...projectSnapshots].slice(0, 10),
    others = all.filter((item) => item.projectId !== project.id).slice(-40);
  localStorage.setItem(snapshotKey, JSON.stringify([...others, ...retained]));
}
export async function saveServer(p: Project): Promise<Project> {
  const r = await fetch(`/api/projects/${p.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error(`Server save failed (${r.status}): ${await r.text()}`);
  return validateProject(await r.json());
}
export async function loadServer(): Promise<Project[]> {
  const r = await fetch("/api/projects", {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error(`Server open failed (${r.status})`);
  return (await r.json()).map(validateProject);
}
export function download(p: Project, geo = false) {
  const data = geo
    ? {
        type: "FeatureCollection",
        features: p.objects.map((o) => {
          const polygon = ["boundary", "plot", "building", "bridge"].includes(
            o.kind,
          );
          const points = (
            ["building", "bridge"].includes(o.kind) ? footprint(o) : o.points
          ).map((q) => toGeo(q, p.origin));
          return {
            type: "Feature",
            id: o.id,
            properties: {
              ...o,
              points: undefined,
              source: "proposed concept",
              verticalReference: p.verticalReference,
            },
            geometry: {
              type: polygon
                ? "Polygon"
                : o.kind === "road"
                  ? "LineString"
                  : "Point",
              coordinates: polygon
                ? [[...points, points[0]]]
                : o.kind === "road"
                  ? points
                  : points[0],
            },
          };
        }),
      }
    : p;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.name.replace(/[^a-z0-9]/gi, "-")}.${geo ? "geojson" : "json"}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface WritableProjectFile {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface ProjectFileHandle {
  createWritable(): Promise<WritableProjectFile>;
}

export type SitecraftPackage = {
  format: "sitecraft-package";
  version: 1;
  exportedAt: string;
  project: Project;
  assets: EmbeddedCustomAsset[];
};

export async function createSitecraftPackage(
  project: Project,
): Promise<SitecraftPackage> {
  const assetIds = [
    ...new Set(
      project.objects
        .map((object) => object.assetRef)
        .filter((assetRef) => assetRef.startsWith("custom:"))
        .map((assetRef) => assetRef.slice("custom:".length)),
    ),
  ];
  return {
    format: "sitecraft-package",
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    assets: await exportCustomAssets(assetIds),
  };
}

export async function saveToComputer(p: Project): Promise<boolean> {
  const filename = `${p.name.replace(/[^a-z0-9]/gi, "-")}.sitecraft`,
    picker = (
      window as typeof window & {
        showSaveFilePicker?: (options: unknown) => Promise<ProjectFileHandle>;
      }
    ).showSaveFilePicker;
  if (!picker) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(await createSitecraftPackage(p))], {
          type: "application/json",
        }),
      ),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  try {
    const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: "Sitecraft project",
            accept: { "application/json": [".sitecraft"] },
          },
        ],
      }),
      writable = await handle.createWritable();
    await writable.write(JSON.stringify(await createSitecraftPackage(p)));
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return false;
    throw error;
  }
}
