import proj4 from "proj4";
import polygonClipping, {
  type MultiPolygon,
  type Polygon,
} from "polygon-clipping";
import {
  type Point,
  type Project,
  type DesignObject,
  projectSchema,
  legacyProjectSchema,
} from "./model";
proj4.defs(
  "EPSG:2193",
  "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs",
);
export function toLocal(ll: Point, origin: Point): Point {
  const a = proj4("EPSG:4326", "EPSG:2193", ll),
    b = proj4("EPSG:4326", "EPSG:2193", origin);
  return [a[0] - b[0], a[1] - b[1]];
}
export function toGeo(xy: Point, origin: Point): Point {
  const b = proj4("EPSG:4326", "EPSG:2193", origin);
  return proj4("EPSG:2193", "EPSG:4326", [xy[0] + b[0], xy[1] + b[1]]) as Point;
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export const length = (p: Point[]) =>
  p.slice(1).reduce((s, b, i) => s + distance(p[i], b), 0);
export const area = (p: Point[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  );
export function moveTo(o: DesignObject, anchor: Point): DesignObject {
  const [x, y] = o.points[0],
    delta: Point = [anchor[0] - x, anchor[1] - y];
  return {
    ...o,
    points: o.points.map(
      ([east, north]) => [east + delta[0], north + delta[1]] as Point,
    ),
  };
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  return (
    x * y <= 0 &&
    z * w <= 0 &&
    Math.max(a[0], b[0]) >= Math.min(c[0], d[0]) &&
    Math.max(c[0], d[0]) >= Math.min(a[0], b[0]) &&
    Math.max(a[1], b[1]) >= Math.min(c[1], d[1]) &&
    Math.max(c[1], d[1]) >= Math.min(a[1], b[1])
  );
}
export function validPolygon(p: Point[]) {
  if (p.length < 3 || area(p) < 1) return false;
  for (let i = 0; i < p.length; i++) {
    if (distance(p[i], p[(i + 1) % p.length]) < 0.01) return false;
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
        return false;
    }
  }
  return true;
}
export function inside(p: Point, ring: Point[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (projectToSegment(p, a, b).d < 0.01) return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function footprint(o: DesignObject): Point[] {
  const c = o.points[0],
    r = (o.rotation * Math.PI) / 180,
    scale = o.kind === "bridge" ? o.scale : 1;
  return [
    [-o.width / 2, -o.depth / 2],
    [o.width / 2, -o.depth / 2],
    [o.width / 2, o.depth / 2],
    [-o.width / 2, o.depth / 2],
  ].map(([x, y]) => [
    c[0] + scale * (x * Math.cos(r) - y * Math.sin(r)),
    c[1] + scale * (x * Math.sin(r) + y * Math.cos(r)),
  ]);
}
export function validateProject(input: unknown): Project {
  const version = (input as { schemaVersion?: unknown })?.schemaVersion;
  const p =
    version === 1
      ? projectSchema.parse({
          ...legacyProjectSchema.parse(input),
          schemaVersion: 2,
          dataLayers: [],
          designLayers: [
            "boundary",
            "road",
            "building",
            "plot",
            "tree",
            "car",
            "bench",
            "bridge",
          ].map((kind) => ({ kind, visible: true, opacity: 1 })),
        })
      : projectSchema.parse(input);
  const ids = new Set<string>(),
    nodes = new Map<string, string>();
  const bounds = p.objects.filter((o) => o.kind === "boundary");
  if (bounds.length > 1) throw Error("Only one project boundary is supported.");
  for (const o of p.objects) {
    if (ids.has(o.id)) throw Error("Duplicate object ID.");
    ids.add(o.id);
    if (o.scenarioId !== p.scenarioId)
      throw Error("Object belongs to another scenario.");
    if (["boundary", "plot"].includes(o.kind) && !validPolygon(o.points))
      throw Error("Polygon must be simple, non-overlapping and at least 1 m².");
    if (o.kind === "road") {
      if (
        o.points.length < 2 ||
        o.nodeIds.length !== o.points.length ||
        new Set(o.nodeIds).size !== o.nodeIds.length ||
        o.points.slice(1).some((b, i) => distance(b, o.points[i]) < 0.1)
      )
        throw Error("Road needs distinct points at least 0.1 m apart.");
      o.nodeIds.forEach((id, i) => {
        const value = JSON.stringify([...o.points[i], o.elevation]);
        if (nodes.has(id) && nodes.get(id) !== value)
          throw Error(
            "Connected road nodes must share position and elevation.",
          );
        nodes.set(id, value);
      });
    } else if (!["boundary", "plot"].includes(o.kind) && o.points.length !== 1)
      throw Error("Object needs one anchor.");
    if (o.kind !== "boundary" && bounds.length) {
      const shape = ["building", "bridge"].includes(o.kind)
        ? footprint(o)
        : o.points;
      if (shape.some((v) => !inside(v, bounds[0].points)))
        throw Error(`${o.name} must remain inside the design boundary.`);
      const polygons: MultiPolygon =
        o.kind === "road"
          ? roadSurface([o])
          : shape.length >= 3
            ? [[shape]]
            : [];
      if (polygons.length) {
        const outside = polygonClipping.difference(polygons, [
          bounds[0].points,
        ]);
        if (outside.some((polygon) => area(polygon[0]) > 0.0001))
          throw Error(
            `${o.name}'s full surface must remain inside the design boundary.`,
          );
      }
    }
  }
  return p;
}
export function projectToSegment(p: Point, a: Point, b: Point) {
  const den = distance(a, b) ** 2;
  const t = den
    ? Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / den,
        ),
      )
    : 0;
  const q: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return { p: q, d: distance(p, q), t };
}
// Only deliberate snaps create graph connections. Plan crossings remain independent.
export function connectRoad(road: DesignObject, objects: DesignObject[]) {
  const updates = new Map<string, DesignObject>();
  road = { ...road, points: [...road.points], nodeIds: [...road.nodeIds] };
  road.points.forEach((p, index) => {
    let best:
      | { road: DesignObject; segment: number; p: Point; t: number; d: number }
      | undefined;
    for (const raw of objects.filter(
      (o) => o.kind === "road" && o.elevation === road.elevation,
    )) {
      const r = updates.get(raw.id) || raw;
      for (let j = 0; j < r.points.length - 1; j++) {
        const hit = projectToSegment(p, r.points[j], r.points[j + 1]);
        if (hit.d < 6 && (!best || hit.d < best.d))
          best = { road: r, segment: j, ...hit };
      }
    }
    if (best) {
      const h = best,
        r = {
          ...h.road,
          points: [...h.road.points],
          nodeIds: [...h.road.nodeIds],
        };
      let idx = h.t < 0.001 ? h.segment : h.t > 0.999 ? h.segment + 1 : -1;
      if (idx < 0) {
        idx = h.segment + 1;
        r.points.splice(idx, 0, h.p);
        r.nodeIds.splice(idx, 0, crypto.randomUUID());
        updates.set(r.id, r);
      }
      road.points[index] = r.points[idx];
      road.nodeIds[index] = r.nodeIds[idx];
    }
  });
  return [...updates.values(), road];
}
export function roadSurface(roads: DesignObject[]): MultiPolygon {
  const parts: Polygon[] = [];
  for (const o of roads) {
    const r = o.width / 2;
    for (let i = 1; i < o.points.length; i++) {
      const a = o.points[i - 1],
        b = o.points[i],
        len = distance(a, b);
      if (!len) continue;
      const x = (-(b[1] - a[1]) / len) * r,
        y = ((b[0] - a[0]) / len) * r;
      parts.push([
        [
          [a[0] + x, a[1] + y],
          [b[0] + x, b[1] + y],
          [b[0] - x, b[1] - y],
          [a[0] - x, a[1] - y],
          [a[0] + x, a[1] + y],
        ],
      ]);
    }
    for (const p of o.points) {
      const ring: Point[] = Array.from({ length: 25 }, (_, i) => [
        p[0] + r * Math.cos((i * Math.PI) / 12),
        p[1] + r * Math.sin((i * Math.PI) / 12),
      ]);
      parts.push([ring]);
    }
  }
  // Quantize derived vertices to a micrometre. Trigonometric near-zero noise at
  // quadrant/cardinal points otherwise creates almost-coincident ring edges.
  const stable = parts.map((polygon) =>
    polygon.map((ring) =>
      ring.map(
        ([x, y]) =>
          [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6] as Point,
      ),
    ),
  );
  return stable.length
    ? polygonClipping.union(stable[0], ...stable.slice(1))
    : [];
}
