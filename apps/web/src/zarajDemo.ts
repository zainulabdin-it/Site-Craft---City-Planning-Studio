import {
  newObject,
  newProject,
  type DesignObject,
  type Kind,
  type Point,
} from "./model";

export function zarajNzProject() {
  const p = newProject("Avalon Heights Society · NZ"),
    add = (
      kind: Kind,
      points: Point[],
      name: string,
      values: Partial<DesignObject> = {},
    ) => {
      const object = newObject(p, kind, points);
      object.name = name;
      Object.assign(object, values);
      p.objects.push(object);
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
      floors = 1,
      rotation = 0,
      buildingType: DesignObject["buildingType"] = "Community",
    ) =>
      add("building", [[x, y]], name, {
        width,
        depth,
        assetRef,
        color,
        floors,
        rotation,
        buildingType,
        roof: floors <= 2 ? "pitched" : "flat",
      });

  // Dry north-east Rolleston field; Selwyn Road sits south of the site.
  p.origin = [172.439, -43.6005];
  p.scenarioName = "Avalon Heights master plan · professional NZ demo";
  add(
    "boundary",
    [
      [-500, -380],
      [500, -380],
      [500, 380],
      [-500, 380],
    ],
    "Avalon Heights · 76 ha boundary",
    { color: "#12a889" },
  );

  // A true connected hierarchy: every crossing below uses the same exact
  // coordinate. Shared node IDs are assigned at the end of the generator.
  const localStreetYs = [-315, -120, 40, 245],
    networkXs = [
      -485, -410, -300, -240, -190, -155, -75, 0, 190, 300, 410, 485,
    ],
    networkYs = [-360, -315, -210, -120, 40, 140, 245, 350];
  add(
    "road",
    networkYs.map((y) => [0, y] as Point),
    "Main Boulevard · 27 m",
    { width: 27, lanes: 4, color: "#374151" },
  );
  add(
    "road",
    networkXs.map((x) => [x, -210] as Point),
    "Central Avenue · 18 m",
    { width: 18, lanes: 2, color: "#46515b" },
  );
  add(
    "road",
    networkXs.map((x) => [x, 140] as Point),
    "Park Avenue · 18 m",
    { width: 18, lanes: 2, color: "#46515b" },
  );
  [-300, 300].forEach((x, index) =>
    add(
      "road",
      networkYs.map((y) => [x, y] as Point),
      `Sector ${index ? "C" : "A"} Collector`,
      { width: 15, lanes: 2, color: "#46515b" },
    ),
  );
  localStreetYs.forEach((y, row) => {
    const divisions = [-485, -300, 0, 300, 485];
    for (let segment = 0; segment < divisions.length - 1; segment++)
      add(
        "road",
        [
          [divisions[segment], y],
          [divisions[segment + 1], y],
        ],
        `Residential Street ${row + 1}.${segment + 1}`,
        { width: 12, lanes: 2, color: "#56616a" },
      );
  });
  [-410, -190, 190, 410].forEach((x, i) =>
    add(
      "road",
      networkYs.map((y) => [x, y] as Point),
      `Residential Spine ${i + 1}`,
      { width: 10, lanes: 2, color: "#59636b" },
    ),
  );

  // Three residential sectors with practical plot sizes and varied houses.
  const houseColors = [
    "#f7e0bc",
    "#d6e9f5",
    "#f1c5b6",
    "#d9e8c5",
    "#ead7ef",
    "#f4edcf",
    "#c8e1dc",
    "#efc98f",
  ];
  const houseRefs = [
    "kenney:house:a",
    "kenney:house:f",
    "kenney:house:k",
    "kenney:house:t",
  ];
  const residentialBands = [
    {
      sector: "A",
      xs: [-470, -440, -375, -340],
      ys: [
        -345, -275, -175, -150, -85, -45, 5, 75, 105, 175, 205, 285, 320, 345,
      ],
    },
    {
      sector: "B",
      xs: [
        -270, -235, -195, -155, -115, -75, -35, 35, 75, 115, 155, 205, 245, 275,
      ],
      ys: [
        -345, -275, -175, -150, -85, -45, 5, 75, 105, 175, 205, 285, 320, 345,
      ],
    },
    {
      sector: "C",
      xs: [335, 370, 435, 470],
      ys: [
        -345, -275, -175, -150, -85, -45, 5, 75, 105, 175, 205, 285, 320, 345,
      ],
    },
  ];
  const distanceToSegment = (point: Point, start: Point, end: Point) => {
    const vx = end[0] - start[0],
      vy = end[1] - start[1],
      wx = point[0] - start[0],
      wy = point[1] - start[1],
      t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    return Math.hypot(
      point[0] - start[0] - t * vx,
      point[1] - start[1] - t * vy,
    );
  };
  let houseNo = 1;
  for (const band of residentialBands)
    for (const y of band.ys)
      for (const x of band.xs) {
        if (
          (band.sector === "B" && y >= 165 && x < 0) ||
          (band.sector === "B" && y > -190 && y < 125 && x > 20) ||
          (band.sector === "A" && y > 155 && x > -400) ||
          (band.sector === "A" && y > -205 && y < -135) ||
          (band.sector === "B" && y === -275 && x < -20) ||
          (band.sector === "B" && y < -320 && x > -95 && x < -15) ||
          (band.sector === "B" && y > -195 && y < -135 && x < -215) ||
          (band.sector === "B" && y > 300 && x > 95 && x < 215) ||
          (band.sector === "C" && y > 75 && y < 140) ||
          (band.sector === "C" && y > 145 && y < 195 && x > 390) ||
          (band.sector === "C" && y < -315 && x > 345) ||
          (band.sector === "C" && y > 180 && x > 320)
        )
          continue;
        const width = 18 + (houseNo % 3) * 2,
          depth = 14 + (houseNo % 2) * 2,
          roadConflict = p.objects.some(
            (object) =>
              object.kind === "road" &&
              object.points
                .slice(1)
                .some(
                  (point, index) =>
                    distanceToSegment([x, y], object.points[index], point) <
                    object.width / 2 + Math.min(width, depth) / 2 + 3,
                ),
          );
        if (roadConflict) continue;
        building(
          x,
          y,
          `Sector ${band.sector} home ${houseNo}`,
          width,
          depth,
          houseRefs[houseNo % houseRefs.length],
          houseColors[houseNo % houseColors.length],
          houseNo % 7 === 0 ? 2 : 1,
          houseNo % 2 ? 0 : 180,
          houseNo % 9 === 0 ? "Townhouse" : "Detached house",
        );
        houseNo++;
      }

  // Central park and recreation precinct.
  add(
    "plot",
    [
      [-275, 175],
      [-35, 175],
      [-45, 345],
      [-250, 340],
    ],
    "Main Park · 3.7 ha",
    { color: "#79b96b", assetRef: "builtin:society:sports-field" },
  );
  add(
    "plot",
    [
      [85, 185],
      [235, 185],
      [235, 285],
      [85, 285],
    ],
    "Community sports field",
    { color: "#57a96a", assetRef: "builtin:society:sports-field" },
  );
  add(
    "plot",
    [
      [90, 295],
      [155, 295],
      [155, 345],
      [90, 345],
    ],
    "Children playground",
    { color: "#e7b45d", assetRef: "builtin:society:playground" },
  );
  add(
    "plot",
    [
      [165, 295],
      [235, 295],
      [235, 345],
      [165, 345],
    ],
    "Family theme park",
    { color: "#d7b9e8", assetRef: "builtin:society:theme-park" },
  );
  for (let i = 0; i < 46; i++) {
    const x = -255 + (i % 12) * 18,
      y = 195 + Math.floor(i / 12) * 38;
    const treeRef = `cc0:proof:tree-${["a", "b", "c"][i % 3]}`;
    add("tree", [[x, y]], `Main Park tree ${i + 1}`, {
      scale: 0.75 + (i % 4) * 0.12,
      color: i % 3 ? "#45a342" : "#73bd3f",
      assetRef: treeRef,
    });
  }
  [-230, -160, -90].forEach((x, i) =>
    add("bench", [[x, 265]], `Park bench ${i + 1}`, {
      rotation: 90,
      assetRef: "builtin:bench:v1",
    }),
  );
  building(
    -155,
    205,
    "Park gazebo",
    18,
    18,
    "builtin:society:gazebo",
    "#d6b777",
  );
  add(
    "plot",
    [
      [-185, 245],
      [-145, 245],
      [-145, 285],
      [-185, 285],
    ],
    "Park fountain",
    { assetRef: "builtin:society:fountain", color: "#67bde2" },
  );

  // Civic, faith, education and health facilities.
  building(
    -342,
    205,
    "Avalon Heights Jamia Mosque",
    48,
    38,
    "builtin:society:mosque",
    "#f4f0df",
    2,
    0,
    "Place of worship",
  );
  add(
    "plot",
    [
      [-285, -305],
      [-30, -305],
      [-30, -220],
      [-285, -220],
    ],
    "Faith and community precinct",
    { color: "#d8d2c5", assetRef: "builtin:society:green-space" },
  );
  building(
    -240,
    -275,
    "Rolleston Community Church",
    25,
    38,
    "builtin:society:church",
    "#d8c7a7",
    2,
    0,
    "Place of worship",
  );
  building(
    -155,
    -275,
    "Community Hindu Temple",
    25,
    25,
    "builtin:society:temple",
    "#efb34f",
    2,
    0,
    "Place of worship",
  );
  building(
    -75,
    -275,
    "Rolleston Gurdwara",
    28,
    24,
    "builtin:society:gurdwara",
    "#f4f4ef",
    2,
    0,
    "Place of worship",
  );
  [-240, -155, -75].forEach((x, index) => {
    const facadeY = index === 0 ? -253 : -259;
    add(
      "road",
      [
        [x, facadeY],
        [x, -210],
      ],
      `Faith building access ${index + 1}`,
      { width: 5, lanes: 1, color: "#59636b" },
    );
    add("car", [[x + 18, -238]], `Faith precinct car ${index + 1}`, {
      rotation: 0,
      scale: 0.78,
      color: ["#2878c8", "#f4b942", "#f8f9fa"][index],
      assetRef: `kenney:car:${index === 0 ? "sedan" : index === 1 ? "suv" : "van"}`,
    });
  });
  building(
    145,
    325,
    "Sector B Primary School",
    64,
    34,
    "builtin:society:school",
    "#f2c94c",
    2,
    0,
    "School",
  );
  building(
    365,
    115,
    "SLS School",
    56,
    30,
    "builtin:society:school",
    "#eabf45",
    2,
    0,
    "School",
  );
  building(
    455,
    165,
    "F3 Technologies",
    44,
    26,
    "builtin:cinematic:tower-glass",
    "#2878c8",
    6,
    0,
    "Commercial",
  );
  building(
    -350,
    -175,
    "Rolleston Community Hospital",
    56,
    34,
    "builtin:society:hospital",
    "#edf3f6",
    4,
    0,
    "Clinic",
  );
  building(
    -245,
    -175,
    "Emergency and Police Centre",
    34,
    26,
    "builtin:society:police",
    "#5f83b9",
    2,
  );
  building(
    250,
    105,
    "Community Club and Library",
    48,
    30,
    "builtin:society:community-centre",
    "#8bb8a1",
    2,
  );

  // Commercial centre along the main boulevard with dedicated parking.
  [-175, -82, -42, 2, 78].forEach((y, i) => {
    building(
      70,
      y,
      i === 4 ? "Avalon Plaza" : `Main Boulevard plaza ${i + 1}`,
      44,
      22,
      i === 4
        ? "builtin:cinematic:tower-terrace"
        : i === 2
          ? "builtin:society:supermarket"
          : "builtin:society:shops",
      i === 4 ? "#dc6e54" : i % 2 ? "#e7a957" : "#d8e2ea",
      i === 4 ? 7 : i === 2 ? 2 : 3,
      0,
      "Commercial",
    );
    add(
      "plot",
      [
        [105, y - 18],
        [165, y - 18],
        [165, y + 18],
        [105, y + 18],
      ],
      `Plaza ${i + 1} parking`,
      { color: "#aab3b8", assetRef: "builtin:society:parking-bays" },
    );
    for (let c = 0; c < 4; c++)
      add("car", [[118 + c * 12, y]], `Plaza ${i + 1} car ${c + 1}`, {
        rotation: 90,
        scale: 0.85,
        color: ["#e63946", "#f4b942", "#3273dc", "#f8f9fa"][c],
        assetRef: "builtin:car:v1",
      });
  });

  // Graveyard, utilities, entry gate and landscape buffers.
  add(
    "plot",
    [
      [335, 200],
      [475, 200],
      [475, 350],
      [335, 350],
    ],
    "Community graveyard · 2.1 ha",
    { color: "#8ca67a", assetRef: "builtin:society:graveyard" },
  );
  building(
    430,
    -335,
    "Water services",
    30,
    24,
    "builtin:society:water-tank",
    "#75a9c7",
  );
  building(
    370,
    -335,
    "Power substation",
    26,
    20,
    "builtin:society:transformer",
    "#8e9fa8",
  );
  building(
    0,
    -350,
    "Main security gate",
    34,
    12,
    "builtin:society:gate",
    "#d7c09d",
  );
  building(
    -55,
    -335,
    "Society management office",
    36,
    22,
    "builtin:society:office",
    "#87b7d5",
    2,
    0,
    "Commercial",
  );
  // Surveyed connection targets from current OpenStreetMap data around Rolleston.
  add(
    "road",
    [
      [0, -360],
      [20, -430],
      [123, -714],
    ],
    "Main Entry · Selwyn Road connection",
    {
      width: 24,
      lanes: 4,
      color: "#374151",
      assetRef: "builtin:road:external-access",
    },
  );
  add(
    "road",
    [
      [485, -210],
      [515, -310],
      [549, -457],
    ],
    "Secondary Exit · Selwyn and Waterholes junction",
    {
      width: 14,
      lanes: 2,
      color: "#46515b",
      assetRef: "builtin:road:external-access",
    },
  );
  building(
    490,
    -225,
    "East security gate",
    20,
    9,
    "builtin:society:gate",
    "#d7c09d",
  );
  for (let i = 0; i < 40; i++) {
    const x = -470 + i * 24;
    add("tree", [[x, i % 2 ? 360 : -360]], `Boundary green belt ${i + 1}`, {
      scale: 0.72 + (i % 3) * 0.08,
      color: "#4e9f45",
      assetRef: `cc0:proof:tree-${["a", "b", "c"][i % 3]}`,
    });
  }
  // Continuous green streets, pocket parks and daily-use furniture make each sector feel occupied.
  const treeVariants = [
    "cc0:proof:tree-a",
    "cc0:proof:tree-b",
    "cc0:proof:tree-c",
  ];
  [-455, -365, -220, -145, 145, 220, 365, 455].forEach((x, xi) =>
    [-295, -105, 25, 230].forEach((y, yi) =>
      add("tree", [[x, y]], `Street tree ${xi + 1}.${yi + 1}`, {
        scale: 0.62 + ((xi + yi) % 3) * 0.1,
        color: ["#3f9142", "#65ad45", "#2f7d4f"][(xi + yi) % 3],
        assetRef: treeVariants[(xi + yi) % treeVariants.length],
      }),
    ),
  );
  [
    [-455, 155],
    [-430, 155],
    [335, 165],
    [365, 165],
    [445, 155],
  ].forEach(([x, y], i) =>
    add("tree", [[x, y]], `Pocket green tree ${i + 1}`, {
      scale: 0.85,
      assetRef: treeVariants[i % 3],
      color: "#57a447",
    }),
  );
  [-265, -150, 150, 265].forEach((x, i) => {
    add("bench", [[x, 128]], `Park Avenue seat ${i + 1}`, {
      rotation: 90,
      assetRef: `builtin:bench:${i % 2 ? "modern" : "timber"}`,
    });
    add("car", [[x, -202]], `Central Avenue car ${i + 1}`, {
      rotation: 90,
      scale: 0.8,
      color: ["#d94841", "#2878c8", "#f2c94c", "#ffffff"][i],
      assetRef: `kenney:car:${i % 3 === 0 ? "suv" : i % 3 === 1 ? "sedan" : "van"}`,
    });
  });
  [-330, -270, -165, -70, 0, 75, 190, 300, 340].forEach((y, i) => {
    add("bench", [[-18, y]], `Boulevard light west ${i + 1}`, {
      scale: 0.82,
      assetRef: "builtin:society:streetlight",
      color: "#39434d",
    });
    add("bench", [[22, y]], `Boulevard light east ${i + 1}`, {
      scale: 0.82,
      assetRef: "builtin:society:streetlight",
      color: "#39434d",
    });
  });
  [-450, -360, -240, -120, 120, 240, 360, 450].forEach((x, i) => {
    add("bench", [[x, i % 2 ? -224 : -196]], `Central Avenue light ${i + 1}`, {
      scale: 0.82,
      assetRef: "builtin:society:streetlight",
      color: "#39434d",
    });
    add("bench", [[x, i % 2 ? 126 : 154]], `Park Avenue light ${i + 1}`, {
      scale: 0.82,
      assetRef: "builtin:society:streetlight",
      color: "#39434d",
    });
  });
  [-300, 300].forEach((x, side) =>
    [-330, -260, -160, -70, 70, 190, 300, 340].forEach((y, i) =>
      add(
        "bench",
        [[x + (side ? 12 : -12), y]],
        `Collector light ${side + 1}.${i + 1}`,
        {
          scale: 0.78,
          assetRef: "builtin:society:streetlight",
          color: "#39434d",
        },
      ),
    ),
  );
  [-210, 140].forEach((y, i) =>
    add("bench", [[15, y]], `Boulevard traffic signal ${i + 1}`, {
      scale: 0.8,
      assetRef: "builtin:society:traffic-signal",
      color: "#343a40",
    }),
  );
  [-360, -240, -120, 0, 120, 240, 360].forEach((y, i) =>
    add("bench", [[-18, y]], `Boulevard bench ${i + 1}`, {
      rotation: 90,
      assetRef: "builtin:bench:v1",
    }),
  );
  // Roads that meet at one coordinate also share a graph node. This keeps
  // navigation, connectivity checks and future routing honest.
  const sharedRoadNodes = new Map<string, string>();
  for (const road of p.objects.filter((object) => object.kind === "road"))
    road.points.forEach((point, index) => {
      const key = `${point[0].toFixed(3)}:${point[1].toFixed(3)}`;
      const nodeId = sharedRoadNodes.get(key) ?? road.nodeIds[index];
      sharedRoadNodes.set(key, nodeId);
      road.nodeIds[index] = nodeId;
    });
  return p;
}
