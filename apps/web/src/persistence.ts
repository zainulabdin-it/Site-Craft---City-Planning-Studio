import { type Project } from "./model";
import { validateProject, toGeo, footprint } from "./geometry";
const key = "sitecraft.projects.v1";
export function listLocal(): Project[] {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw).map(validateProject) : [];
}
export function saveLocal(p: Project) {
  const all = listLocal().filter((q) => q.id !== p.id);
  localStorage.setItem(key, JSON.stringify([...all, p]));
  localStorage.setItem("sitecraft.active", p.id);
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
