import { z } from "zod";
export const pointSchema = z.tuple([
  z.number().finite().min(-2000).max(2000),
  z.number().finite().min(-2000).max(2000),
]);
export type Point = z.infer<typeof pointSchema>;
export const kindSchema = z.enum([
  "boundary",
  "road",
  "building",
  "plot",
  "tree",
  "car",
  "bench",
  "bridge",
]);
export const objectSchema = z
  .object({
    id: z.string().uuid(),
    scenarioId: z.string().uuid(),
    kind: kindSchema,
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
export const dataFeatureSchema = z.object({
  id: z.string().uuid(),
  geometry: z.object({
    type: z.enum([
      "Point",
      "LineString",
      "Polygon",
      "MultiPoint",
      "MultiLineString",
      "MultiPolygon",
    ]),
    coordinates: z.unknown(),
  }),
  properties: z.record(z.string(), z.unknown()),
});
export const dataLayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  source: z.string().max(200),
  features: z.array(dataFeatureSchema).max(50000),
});
export type DataLayer = z.infer<typeof dataLayerSchema>;
export const designLayerSchema = z.object({
  kind: kindSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
});
const projectFields = {
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  scenarioId: z.string().uuid(),
  scenarioName: z.string(),
  origin: z.tuple([z.number().min(165).max(179), z.number().min(-48).max(-34)]),
  horizontalCRS: z.literal("EPSG:2193"),
  verticalReference: z.literal(
    "Conceptual offset above ellipsoid; not NZVD2016",
  ),
  objects: z.array(objectSchema).max(2000),
} as const;
export const legacyProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    ...projectFields,
  })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal(2),
    ...projectFields,
    dataLayers: z.array(dataLayerSchema).max(100),
    designLayers: z.array(designLayerSchema).length(8),
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
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name,
    revision: 0,
    scenarioId: crypto.randomUUID(),
    scenarioName: "Base proposal",
    origin: [172.6362, -43.5321],
    horizontalCRS: "EPSG:2193",
    verticalReference: "Conceptual offset above ellipsoid; not NZVD2016",
    objects: [],
    dataLayers: [],
    designLayers: kinds.map((kind) => ({ kind, visible: true, opacity: 1 })),
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
    assetRef:
      kind === "building"
        ? "kenney:house:f"
        : ["tree", "car", "bench", "bridge"].includes(kind)
          ? `builtin:${kind}:v1`
          : "",
  };
}
export function demoProject() {
  const p = newProject("Avon / Christchurch concept");
  const add = (
    kind: Kind,
    points: Point[],
    name: string,
    values: Partial<DesignObject> = {},
  ) => {
    const o = newObject(p, kind, points);
    o.name = name;
    Object.assign(o, values);
    p.objects.push(o);
    return o;
  };
  add(
    "boundary",
    [
      [-230, -175],
      [230, -175],
      [230, 175],
      [-230, 175],
    ],
    "Riverside neighbourhood · 16.1 ha",
  );
  const avenue = add(
    "road",
    [
      [-220, 0],
      [0, 0],
      [220, 0],
    ],
    "Riverside Avenue",
    { width: 14, lanes: 4 },
  );
  const street = add(
    "road",
    [
      [0, -165],
      [0, 0],
      [0, 165],
    ],
    "Market Street",
    { width: 10, lanes: 2 },
  );
  street.nodeIds[1] = avenue.nodeIds[1];
  add(
    "road",
    [
      [-205, 96],
      [0, 96],
      [205, 96],
    ],
    "Garden Lane",
    { width: 8, lanes: 2 },
  );
  add(
    "plot",
    [
      [-215, 18],
      [-20, 18],
      [-20, 82],
      [-215, 82],
    ],
    "Riverside community park",
    { color: "#5aa66f" },
  );
  const parkPlot = (
    name: string,
    west: number,
    south: number,
    east: number,
    north: number,
    color: string,
  ) =>
    add(
      "plot",
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
      ],
      name,
      { color, elevation: 0.12 },
    );

  parkPlot("Park entrance plaza", -132, 18, -104, 34, "#d8d2c4");
  parkPlot("Main walking promenade", -123, 30, -113, 78, "#ddd8ca");
  parkPlot("Garden walking path", -205, 47, -30, 55, "#d8d2c4");
  parkPlot("Visitor parking", -72, 22, -28, 43, "#58626b");
  parkPlot("Children playground", -102, 58, -67, 77, "#e9b96e");
  parkPlot("Riverside park pond", -192, 58, -157, 77, "#3a9bd4");
  parkPlot("Flower garden", -150, 59, -130, 77, "#d96f9f");

  add("building", [[-42, 65]], "Park pavilion", {
    width: 20,
    depth: 12,
    floors: 1,
    floorHeight: 3.2,
    buildingType: "Commercial",
    roof: "pitched",
    color: "#f2c14e",
  });

  [
    [-66, 28, "sedan", "#d94841"],
    [-56, 28, "suv", "#2878c8"],
    [-46, 28, "van", "#f2c94c"],
    [-36, 28, "sedan", "#34a853"],
  ].forEach(([x, y, variant, color], index) =>
    add("car", [[x as number, y as number]], `Parked car ${index + 1}`, {
      assetRef: `kenney:car:${variant}`,
      rotation: 0,
      scale: 0.9,
      color: color as string,
    }),
  );

  [
    [-142, 42, 0],
    [-94, 42, 0],
    [-142, 59, 180],
    [-94, 59, 180],
    [-181, 54, 90],
    [-166, 54, 90],
  ].forEach(([x, y, rotation], index) =>
    add("bench", [[x, y]], `Park bench ${index + 1}`, {
      assetRef: `builtin:bench:${index % 3 === 0 ? "modern" : "timber"}`,
      rotation,
    }),
  );

  const parkTrees: Array<[number, number, string, number]> = [
    [-207, 27, "large", 1.1],
    [-194, 35, "small", 0.85],
    [-180, 29, "large", 1],
    [-165, 39, "columnar", 0.9],
    [-150, 29, "large", 1.05],
    [-91, 29, "small", 0.8],
    [-82, 42, "columnar", 0.9],
    [-205, 67, "large", 1.1],
    [-198, 78, "small", 0.85],
    [-147, 80, "large", 1],
    [-128, 69, "columnar", 0.9],
    [-110, 79, "small", 0.85],
    [-87, 80, "large", 1.05],
    [-62, 51, "columnar", 0.9],
    [-29, 50, "large", 1],
    [-27, 77, "small", 0.85],
  ];
  parkTrees.forEach(([x, y, variant, scale], index) =>
    add("tree", [[x, y]], `Park tree ${index + 1}`, {
      assetRef:
        variant === "columnar"
          ? "builtin:tree:columnar"
          : `kenney:tree:${variant}`,
      scale,
    }),
  );
  add(
    "plot",
    [
      [-225, -116],
      [225, -116],
      [225, -84],
      [-225, -84],
    ],
    "Avon water and landscape corridor",
    { color: "#4c9bd6" },
  );
  const homeXs = [-198, -158, -118, -78, -38, 38, 78, 118, 158, 198];
  const homes: Array<[number, number, number, string]> = [
    ...homeXs.map(
      (x, index) =>
        [x, 122, 180, ["a", "f", "k", "t"][index % 4]] as [
          number,
          number,
          number,
          string,
        ],
    ),
    ...homeXs
      .filter((x) => x > 0)
      .map(
        (x, index) =>
          [x, 70, 0, ["k", "f", "a", "t"][index % 4]] as [
            number,
            number,
            number,
            string,
          ],
      ),
  ];
  homes.forEach(([x, y, rotation, variant], index) =>
    add("building", [[x, y]], `Garden Lane home ${index + 1}`, {
      width: variant === "t" ? 19 : 16,
      depth: variant === "t" ? 13 : 12,
      floors: 2,
      roof: "pitched",
      rotation,
      assetRef: `kenney:house:${variant}`,
      color: ["#ef8354", "#3f9ed8", "#f2c14e", "#55ad68"][index % 4],
    }),
  );
  add("building", [[-58, -42]], "Neighbourhood market", {
    width: 36,
    depth: 24,
    floors: 2,
    buildingType: "Commercial",
    color: "#f2c94c",
  });
  add("building", [[66, -48]], "Mixed-use apartments", {
    width: 42,
    depth: 28,
    floors: 5,
    buildingType: "Apartment",
    color: "#e9b52f",
  });

  [
    [108, 34],
    [154, 36],
    [204, 52],
    [-210, 118],
    [-178, 110],
    [-142, 112],
    [142, 112],
    [178, 110],
    [210, 118],
  ].forEach((point, index) =>
    add("tree", [point as Point], `Street tree ${index + 1}`, {
      assetRef: `kenney:tree:${index % 3 === 0 ? "small" : "large"}`,
      scale: index % 3 === 0 ? 0.8 : 1,
    }),
  );
  add("bench", [[-150, 34]], "Park bench west", {
    assetRef: "builtin:bench:timber",
    rotation: 90,
  });
  add("bench", [[-82, 34]], "Park bench east", {
    assetRef: "builtin:bench:modern",
    rotation: 90,
  });
  add("car", [[-92, -4]], "Westbound sedan", {
    assetRef: "kenney:car:sedan",
    rotation: 90,
    color: "#d94841",
  });
  add("car", [[118, 4]], "Eastbound SUV", {
    assetRef: "kenney:car:suv",
    rotation: -90,
    color: "#2878c8",
  });
  add("car", [[5, 48]], "Market delivery van", {
    assetRef: "kenney:car:van",
    color: "#f2c94c",
  });
  add("car", [[-176, 4]], "Eastbound compact", {
    assetRef: "kenney:car:sedan",
    rotation: -90,
    color: "#34a853",
  });
  add("car", [[176, -4]], "Westbound van", {
    assetRef: "kenney:car:van",
    rotation: 90,
    color: "#f28c28",
  });
  add("car", [[-5, 118]], "Garden Lane SUV", {
    assetRef: "kenney:car:suv",
    color: "#7f56d9",
  });
  add("bridge", [[0, -100]], "Avon crossing", {
    width: 13,
    depth: 36,
    elevation: 1.2,
    assetRef: "builtin:bridge:arch",
    color: "#697782",
  });
  return p;
}
