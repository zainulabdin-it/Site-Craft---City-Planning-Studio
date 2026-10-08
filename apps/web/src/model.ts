import { z } from "zod";
export const pointSchema = z.tuple([
  z.number().finite().min(-2000).max(2000),
  z.number().finite().min(-2000).max(2000),
]);
export type Point = z.infer<typeof pointSchema>;
export const objectSchema = z
  .object({
    id: z.string().uuid(),
    scenarioId: z.string().uuid(),
    kind: z.enum([
      "boundary",
      "road",
      "building",
      "plot",
      "tree",
      "car",
      "bench",
      "bridge",
    ]),
    name: z.string().min(1).max(100),
    points: z.array(pointSchema).min(1).max(500),
    nodeIds: z.array(z.string().uuid()).max(500),
    width: z.number().finite().min(1).max(100),
    depth: z.number().finite().min(1).max(100),
    floors: z.number().int().min(1).max(60),
    floorHeight: z.number().finite().min(2).max(6),
    rotation: z.number().finite().min(-360).max(360),
    scale: z.number().finite().min(0.2).max(5),
    elevation: z.number().finite().min(0).max(100),
    lanes: z.number().int().min(1).max(8),
    roof: z.enum(["flat", "pitched"]),
    buildingType: z.enum([
      "Detached house",
      "Townhouse",
      "Apartment",
      "Commercial",
    ]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    assetRef: z.string().max(100),
  })
  .strict();
export type DesignObject = z.infer<typeof objectSchema>;
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
    scenarioId: z.string().uuid(),
    scenarioName: z.string(),
    origin: z.tuple([
      z.number().min(165).max(179),
      z.number().min(-48).max(-34),
    ]),
    horizontalCRS: z.literal("EPSG:2193"),
    verticalReference: z.literal(
      "Conceptual offset above ellipsoid; not NZVD2016",
    ),
    objects: z.array(objectSchema).max(2000),
  })
  .strict();
export type Project = z.infer<typeof projectSchema>;
export type Kind = DesignObject["kind"];
export const kinds: Kind[] = [
  "boundary",
  "road",
  "building",
  "plot",
  "tree",
  "car",
  "bench",
  "bridge",
];
export function newProject(name = "Untitled Christchurch site"): Project {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    revision: 0,
    scenarioId: crypto.randomUUID(),
    scenarioName: "Base proposal",
    origin: [172.6362, -43.5321],
    horizontalCRS: "EPSG:2193",
    verticalReference: "Conceptual offset above ellipsoid; not NZVD2016",
    objects: [],
  };
}
export function newObject(
  p: Project,
  kind: Kind,
  points: Point[],
): DesignObject {
  return {
    id: crypto.randomUUID(),
    scenarioId: p.scenarioId,
    kind,
    name: kind[0].toUpperCase() + kind.slice(1),
    points,
    nodeIds: kind === "road" ? points.map(() => crypto.randomUUID()) : [],
    width: kind === "road" ? 8 : kind === "bridge" ? 10 : 12,
    depth: kind === "bridge" ? 30 : 16,
    floors: 2,
    floorHeight: 3,
    rotation: 0,
    scale: 1,
    elevation: kind === "bridge" ? 5 : 0,
    lanes: 2,
    roof: "flat",
    buildingType: "Detached house",
    color: kind === "building" ? "#d7c8ae" : "#4b7863",
    assetRef: ["tree", "car", "bench", "bridge"].includes(kind)
      ? `builtin:${kind}:v1`
      : "",
  };
}
export function demoProject() {
  const p = newProject("Avon / Christchurch concept");
  const add = (kind: Kind, points: Point[], name: string) => {
    const o = newObject(p, kind, points);
    o.name = name;
    p.objects.push(o);
    return o;
  };
  add(
    "boundary",
    [
      [-180, -150],
      [180, -150],
      [180, 150],
      [-180, 150],
    ],
    "Concept site · 10.8 ha",
  );
  const a = add(
    "road",
    [
      [-140, 0],
      [0, 0],
      [140, 0],
    ],
    "East–west avenue",
  );
  const b = add(
    "road",
    [
      [0, -120],
      [0, 0],
    ],
    "South connection",
  );
  b.nodeIds[1] = a.nodeIds[1];
  for (let i = 0; i < 4; i++)
    add("building", [[-100 + i * 60, 45]], `Residence ${i + 1}`);
  add("tree", [[-100, -40]], "Native tree placeholder");
  add("car", [[60, 0]], "Vehicle placeholder");
  add("bridge", [[100, -70]], "Concept bridge");
  return p;
}
