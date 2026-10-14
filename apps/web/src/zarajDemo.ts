import {
  newObject,
  newProject,
  type DesignObject,
  type Kind,
  type Point,
} from "./model";

export function zarajNzProject() {
  const p = newProject("Zaraj-inspired Rolleston Society · NZ"),
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
  p.scenarioName = "Zaraj reference master plan · professional NZ demo";
  add(
    "boundary",
    [
      [-500, -380],
      [500, -380],
      [500, 380],
      [-500, 380],
    ],
    "Zaraj NZ society · 76 ha boundary",
    { color: "#12a889" },
  );

  // 27 m main boulevard, 18 m sector collectors and 12 m residential streets.
  add(
    "road",
    [
      [0, -355],
      [0, -210],
      [12, -40],
      [5, 145],
      [52, 355],
    ],
    "Main Boulevard · 27 m",
    { width: 27, lanes: 4, color: "#374151" },
  );
  add(
    "road",
    [
      [-485, -215],
      [-250, -210],
      [0, -210],
      [250, -205],
      [485, -190],
    ],
    "Central Avenue · 18 m",
    { width: 18, lanes: 2, color: "#46515b" },
  );
  add(
    "road",
    [
      [-475, 135],
      [-250, 120],
      [5, 145],
      [250, 155],
      [480, 135],
    ],
    "Park Avenue · 18 m",
    { width: 18, lanes: 2, color: "#46515b" },
  );
  add(
    "road",
    [
      [-300, -360],
      [-300, -210],
      [-285, -40],
      [-260, 120],
      [-230, 350],
    ],
    "Sector A Collector",
    { width: 15, lanes: 2 },
  );
  add(
    "road",
    [
      [300, -360],
      [300, -205],
      [285, -25],
      [270, 150],
      [250, 355],
    ],
    "Sector C Collector",
    { width: 15, lanes: 2 },
  );
  [-315, -120, 40, 245].forEach((y, i) => {
    add(
      "road",
      [
        [-485, y],
        [-305, y + (i % 2 ? 5 : -5)],
      ],
      `Sector A Street ${i + 1}`,
      { width: 12 },
    );
    add(
      "road",
      [
        [-295, y],
        [-15, y + (i % 2 ? -4 : 4)],
      ],
      `Sector B-West Street ${i + 1}`,
      { width: 12 },
    );
    add(
      "road",
      [
        [20, y + 3],
        [290, y],
      ],
      `Sector B-East Street ${i + 1}`,
      { width: 12 },
    );
    add(
      "road",
      [
        [310, y],
        [485, y + (i % 2 ? 4 : -4)],
      ],
      `Sector C Street ${i + 1}`,
      { width: 12 },
    );
  });
  [-410, -190, 190, 410].forEach((x, i) =>
    add(
      "road",
      [
        [x, -360],
        [x + (i % 2 ? 12 : -12), 350],
      ],
      `Residential Spine ${i + 1}`,
      { width: 10 },
    ),
  );

  // Three residential sectors with Zaraj-like plot sizes and varied houses.
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
      xs: [-470, -445, -375, -345, -325],
      ys: [
        -345, -275, -175, -150, -85, -45, 5, 75, 105, 175, 205, 285, 320, 345,
      ],
    },
    {
      sector: "B",
      xs: [
        -270, -240, -215, -160, -130, -100, -70, -40, 35, 65, 95, 125, 155, 220,
        250, 275,
      ],
      ys: [
        -345, -275, -175, -150, -85, -45, 5, 75, 105, 175, 205, 285, 320, 345,
      ],
    },
    {
      sector: "C",
      xs: [330, 355, 380, 440, 465],
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
          (band.sector === "C" && y > 75 && y < 140) ||
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
                    object.width / 2 + Math.min(width, depth) / 2 + 1,
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
          ((houseNo % 5) - 2) * 1.5,
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
  for (let i = 0; i < 46; i++) {
    const x = -255 + (i % 12) * 18,
      y = 195 + Math.floor(i / 12) * 38;
    const treeRef =
      i % 7 === 0
        ? "builtin:tree:columnar"
        : `kenney:tree:${i % 3 === 0 ? "small" : "large"}`;
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
    -330,
    205,
    "Zaraj Jamia Mosque",
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
    add(
      "road",
      [
        [x, -255],
        [x, -219],
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
    170,
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
    "Sector C School",
    56,
    30,
    "builtin:society:school",
    "#eabf45",
    2,
    0,
    "School",
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
      `Main Boulevard plaza ${i + 1}`,
      44,
      22,
      i === 2 ? "builtin:society:supermarket" : "builtin:society:shops",
      i % 2 ? "#e7a957" : "#d8e2ea",
      i === 2 ? 2 : 3,
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
      [0, -355],
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
      [485, -190],
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
    488,
    -188,
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
      assetRef:
        i % 5 === 0
          ? "builtin:tree:columnar"
          : `kenney:tree:${i % 2 ? "small" : "large"}`,
    });
  }
  // Continuous green streets, pocket parks and daily-use furniture make each sector feel occupied.
  const treeVariants = [
    "kenney:tree:large",
    "kenney:tree:small",
    "builtin:tree:columnar",
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
  [-285, -150, 150, 285].forEach((y, i) => {
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
  return p;
}
