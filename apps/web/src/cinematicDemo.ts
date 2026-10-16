import {
  newObject,
  newProject,
  type DesignObject,
  type Kind,
  type Point,
} from "./model";

export function cinematicSocietyProject() {
  const project = newProject("Aurora Gardens · Cinematic Society"),
    add = (
      kind: Kind,
      points: Point[],
      name: string,
      values: Partial<DesignObject> = {},
    ) => {
      const object = newObject(project, kind, points);
      object.name = name;
      Object.assign(object, values);
      project.objects.push(object);
      return object;
    },
    building = (
      x: number,
      y: number,
      name: string,
      width: number,
      depth: number,
      assetRef: string,
      color: string,
      floors = 2,
      rotation = 0,
      buildingType: DesignObject["buildingType"] = "Detached house",
    ) =>
      add("building", [[x, y]], name, {
        width,
        depth,
        assetRef,
        color,
        floors,
        floorHeight: floors > 5 ? 3.5 : 3,
        rotation,
        buildingType,
        roof: floors > 3 ? "flat" : "pitched",
      }),
    rectangle = (
      x: number,
      y: number,
      width: number,
      depth: number,
    ): Point[] => [
      [x - width / 2, y - depth / 2],
      [x + width / 2, y - depth / 2],
      [x + width / 2, y + depth / 2],
      [x - width / 2, y + depth / 2],
    ];

  project.origin = [172.512, -43.615];
  project.scenarioName = "Cinematic showcase master plan";
  add("boundary", rectangle(0, 0, 1000, 800), "Aurora Gardens · 80 ha", {
    color: "#0ca789",
  });

  const roads: Array<[string, Point[], number, number]> = [
    [
      "Grand Entrance Boulevard",
      [
        [0, -380],
        [0, 380],
      ],
      26,
      4,
    ],
    [
      "Garden Avenue",
      [
        [-485, 0],
        [485, 0],
      ],
      20,
      4,
    ],
    [
      "Faith and Culture Avenue",
      [
        [-485, 220],
        [485, 220],
      ],
      16,
      2,
    ],
    [
      "Education Avenue",
      [
        [-485, -220],
        [485, -220],
      ],
      16,
      2,
    ],
    [
      "West Residential Crescent",
      [
        [-320, -380],
        [-320, 380],
      ],
      14,
      2,
    ],
    [
      "East Residential Crescent",
      [
        [320, -380],
        [320, 380],
      ],
      14,
      2,
    ],
  ];
  roads.forEach(([name, points, width, lanes]) =>
    add("road", points, name, {
      width,
      lanes,
      color: "#313b42",
    }),
  );

  // A landscaped arrival gate and central civic park.
  building(
    -22,
    -350,
    "Aurora entrance gate west",
    28,
    8,
    "builtin:society:entrance-gate",
    "#d6b979",
    1,
    0,
    "Community",
  );
  building(
    22,
    -350,
    "Aurora entrance gate east",
    28,
    8,
    "builtin:society:entrance-gate",
    "#d6b979",
    1,
    0,
    "Community",
  );
  add("plot", rectangle(0, 105, 250, 150), "Central botanical park", {
    assetRef: "builtin:society:theme-park",
    color: "#58a65d",
  });
  building(
    0,
    105,
    "Park pavilion",
    24,
    20,
    "builtin:society:gazebo",
    "#c99754",
    1,
    0,
    "Community",
  );

  // Landmarks and complete community facilities.
  building(
    -205,
    285,
    "Aurora Grand Mosque",
    48,
    38,
    "builtin:society:mosque",
    "#efe3c7",
    2,
    0,
    "Place of worship",
  );
  building(
    205,
    285,
    "St Mark Community Church",
    38,
    48,
    "builtin:society:church",
    "#c9b18b",
    2,
    0,
    "Place of worship",
  );
  add("plot", rectangle(410, 295, 120, 120), "Memorial garden and graveyard", {
    assetRef: "builtin:society:graveyard",
    color: "#79986d",
  });
  building(
    -205,
    -290,
    "Aurora International School",
    72,
    38,
    "builtin:society:school",
    "#f2b84b",
    3,
    0,
    "School",
  );
  building(
    205,
    -290,
    "Aurora Medical Centre",
    64,
    40,
    "builtin:society:hospital",
    "#dcecf4",
    5,
    0,
    "Clinic",
  );

  // Mixed-use skyline around the central boulevard.
  const towers = [
    [-250, -105, "Sunrise Tower", "#e5a94e", 12],
    [-155, -105, "Azure Business Centre", "#4f9dc5", 16],
    [155, -105, "Coral Residence", "#d77b67", 11],
    [250, -105, "Emerald Offices", "#5eaa83", 15],
  ] as const;
  towers.forEach(([x, y, name, color, floors]) =>
    building(
      x,
      y,
      name,
      42,
      34,
      `builtin:cinematic:tower-${floors % 2 ? "terrace" : "glass"}`,
      color,
      floors,
      0,
      "Commercial",
    ),
  );
  building(
    -195,
    35,
    "Colour Walk shops",
    86,
    22,
    "builtin:society:shops",
    "#ec8c49",
    3,
    0,
    "Commercial",
  );
  building(
    195,
    35,
    "Garden Market",
    72,
    30,
    "builtin:society:supermarket",
    "#5b93c4",
    2,
    0,
    "Commercial",
  );

  const houseAssets = [
      "builtin:cinematic:home-linear",
      "builtin:cinematic:home-villa",
      "builtin:cinematic:home-courtyard",
      "builtin:cinematic:home-linear",
    ],
    houseColours = [
      "#f0d6a8",
      "#c8dded",
      "#efb7a8",
      "#d3c3e6",
      "#b9dbc4",
      "#f2df83",
    ];
  let houseIndex = 0;
  const home = (x: number, y: number, rotation = 0) => {
    const index = houseIndex++;
    building(
      x,
      y,
      `Aurora modern home ${index + 1}`,
      index % 4 === 0 ? 20 : 17,
      index % 3 === 0 ? 15 : 13,
      houseAssets[index % houseAssets.length],
      houseColours[index % houseColours.length],
      index % 3 === 0 ? 2 : 1,
      rotation,
      index % 7 === 0 ? "Townhouse" : "Detached house",
    );
  };
  for (const y of [-315, -275, -165, -120, 285, 330])
    for (const x of [-455, -410, -365, 365, 410, 455]) home(x, y);
  for (const y of [-155, -105, 105, 155])
    for (const x of [-285, -240, -90, -45, 45, 90, 240, 285]) {
      if (Math.abs(y - 105) < 15 && Math.abs(x) < 130) continue;
      home(x, y, y > 0 ? 180 : 0);
    }

  // A close, complete residential avenue for the guided walkthrough camera.
  // Homes sit behind the road reserve on both sides, with consistent setbacks.
  for (const y of [-245, -195])
    for (const x of [
      -445, -395, -345, -295, -95, -45, 45, 95, 295, 345, 395, 445,
    ])
      home(x, y, y > -220 ? 180 : 0);

  // Dense landscaping, street furniture and moving-scene detail.
  const treeAssets = [
    "builtin:tree:native",
    "builtin:tree:palm",
    "builtin:tree:columnar",
  ];
  let treeIndex = 0;
  for (let y = -330; y <= 330; y += 55)
    for (const x of [-28, 28, -345, 345])
      add("tree", [[x, y]], `Boulevard tree ${++treeIndex}`, {
        assetRef: treeAssets[treeIndex % treeAssets.length],
        scale: 0.9 + (treeIndex % 3) * 0.14,
        color: ["#2f7f45", "#4b9d50", "#6aa84f"][treeIndex % 3],
      });
  for (let x = -110; x <= 110; x += 44)
    for (const y of [55, 155])
      add("tree", [[x, y]], `Park tree ${++treeIndex}`, {
        assetRef: treeAssets[treeIndex % treeAssets.length],
        scale: 1.05,
        color: "#3e934d",
      });

  const cars: Array<[number, number, number, string]> = [
    [-8, -315, 0, "#ffffff"],
    [8, -265, 180, "#d93636"],
    [-8, -145, 0, "#2c63b8"],
    [8, -60, 180, "#17191c"],
    [-135, -18, 90, "#f1c232"],
    [135, 18, -90, "#e7e7e7"],
    [8, 165, 180, "#43a568"],
    [-8, 300, 0, "#843f9f"],
  ];
  cars.forEach(([x, y, rotation, color], index) =>
    add("car", [[x, y]], `Cinematic car ${index + 1}`, {
      assetRef: `kenney:car:${["sedan", "suv", "van"][index % 3]}`,
      rotation,
      color,
      scale: 1,
    }),
  );
  for (const [x, y, rotation] of [
    [-120, 42, 90],
    [120, 42, -90],
    [-120, 168, 90],
    [120, 168, -90],
  ] as const)
    add("bench", [[x, y]], `Park bench ${x}:${y}`, {
      assetRef: "builtin:bench:modern",
      rotation,
      color: "#8a5a32",
    });

  project.dataSources.push({
    id: crypto.randomUUID(),
    name: "OpenStreetMap basemap",
    kind: "basemap",
    url: "https://www.openstreetmap.org/copyright",
    license: "ODbL · © OpenStreetMap contributors",
    fetchedAt: new Date().toISOString(),
    resolution: "Web map tiles",
    confidence: "indicative",
  });
  return project;
}
