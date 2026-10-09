import { roadSurface } from "./geometry";
self.onmessage = ({ data }) => {
  try {
    const groups = new Map<number, typeof data.roads>();
    for (const r of data.roads) {
      const a = groups.get(r.elevation) || [];
      a.push(r);
      groups.set(r.elevation, a);
    }
    self.postMessage({
      id: data.id,
      surfaces: [...groups].map(([elevation, roads]) => ({
        elevation,
        sidewalks: roadSurface(
          roads.map((road: { width: number }) => ({
            ...road,
            width: road.width + 3.2,
          })),
        ),
        polygons: roadSurface(roads),
      })),
    });
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e) });
  }
};
