import type { DesignObject, Point, Project } from "./model";
import {
  area,
  distance,
  footprint,
  inside,
  length,
  projectToSegment,
  toLocal,
} from "./geometry";
import type { TerrainAnalysis } from "./Viewport";

export type PlanningSeverity = "error" | "warning" | "unknown" | "pass";
export type PlanningIssue = {
  id: string;
  severity: PlanningSeverity;
  title: string;
  detail: string;
  objectIds: string[];
};
export type PlanningAnalysis = {
  score: number;
  siteAreaHa: number;
  coveragePercent: number;
  greenPercent: number;
  housingUnits: number;
  estimatedResidents: number;
  parkingProvided: number;
  parkingRequired: number;
  disconnectedRoads: number;
  buildingsWithoutAccess: number;
  utilityConnections: number;
  utilityNetworks: number;
  imperviousAreaM2: number;
  preliminaryRunoffM3: number;
  issues: PlanningIssue[];
};

const segments = (points: Point[]) =>
  points.slice(1).map((point, index) => [points[index], point] as const);

const polygonEdges = (points: Point[]) =>
  points.map(
    (point, index) => [point, points[(index + 1) % points.length]] as const,
  );

const orientation = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const segmentIntersects = (a: Point, b: Point, c: Point, d: Point) =>
  orientation(a, b, c) * orientation(a, b, d) <= 0 &&
  orientation(c, d, a) * orientation(c, d, b) <= 0 &&
  Math.max(a[0], b[0]) >= Math.min(c[0], d[0]) &&
  Math.max(c[0], d[0]) >= Math.min(a[0], b[0]) &&
  Math.max(a[1], b[1]) >= Math.min(c[1], d[1]) &&
  Math.max(c[1], d[1]) >= Math.min(a[1], b[1]);

const polygonsIntersect = (a: Point[], b: Point[]) =>
  a.some((point) => inside(point, b)) ||
  b.some((point) => inside(point, a)) ||
  polygonEdges(a).some(([a1, a2]) =>
    polygonEdges(b).some(([b1, b2]) => segmentIntersects(a1, a2, b1, b2)),
  );

const distanceToRoad = (point: Point, road: DesignObject) =>
  Math.min(
    ...segments(road.points).map(
      ([start, end]) => projectToSegment(point, start, end).d,
    ),
  );
const distanceToLine = (point: Point, points: Point[]) =>
  Math.min(
    ...segments(points).map(
      ([start, end]) => projectToSegment(point, start, end).d,
    ),
  );

const residentialUnits = (building: DesignObject) => {
  if (building.buildingType === "Apartment") return building.floors * 4;
  if (building.buildingType === "Townhouse")
    return Math.max(1, building.floors);
  return building.buildingType === "Detached house" ? 1 : 0;
};

export function analyzePlanning(
  project: Project,
  terrain?: TerrainAnalysis,
): PlanningAnalysis {
  const boundaries = project.objects.filter((item) => item.kind === "boundary"),
    roads = project.objects.filter((item) => item.kind === "road"),
    buildings = project.objects.filter((item) => item.kind === "building"),
    plots = project.objects.filter((item) => item.kind === "plot"),
    cars = project.objects.filter((item) => item.kind === "car"),
    trees = project.objects.filter((item) => item.kind === "tree"),
    siteArea = boundaries.reduce((sum, item) => sum + area(item.points), 0),
    buildingArea = buildings.reduce(
      (sum, item) => sum + area(footprint(item)),
      0,
    ),
    greenArea = plots
      .filter((item) => /park|green|garden|playground/i.test(item.name))
      .reduce((sum, item) => sum + area(item.points), 0),
    housingUnits = buildings.reduce(
      (sum, building) => sum + residentialUnits(building),
      0,
    ),
    estimatedResidents =
      housingUnits * project.planningSettings.residentsPerUnit,
    commercialBuildings = buildings.filter(
      (item) => item.buildingType === "Commercial",
    ).length,
    parkingRequired = Math.ceil(
      housingUnits * project.planningSettings.parkingSpacesPerUnit +
        commercialBuildings * 6,
    ),
    issues: PlanningIssue[] = [];

  for (let i = 0; i < buildings.length; i++)
    for (let j = i + 1; j < buildings.length; j++)
      if (polygonsIntersect(footprint(buildings[i]), footprint(buildings[j])))
        issues.push({
          id: `collision:${buildings[i].id}:${buildings[j].id}`,
          severity: "error",
          title: "Buildings overlap",
          detail: `${buildings[i].name} conflicts with ${buildings[j].name}.`,
          objectIds: [buildings[i].id, buildings[j].id],
        });

  const buildingsWithoutAccess = buildings.filter((building) => {
    if (!roads.length) return true;
    const centre = building.points[0];
    return !roads.some(
      (road) =>
        distanceToRoad(centre, road) <=
        road.width / 2 + project.planningSettings.maximumRoadAccessDistanceM,
    );
  });
  if (buildingsWithoutAccess.length)
    issues.push({
      id: "access:buildings",
      severity: "warning",
      title: "Buildings need road access",
      detail: `${buildingsWithoutAccess.length} building(s) exceed the ${project.planningSettings.maximumRoadAccessDistanceM} m road-access assumption.`,
      objectIds: buildingsWithoutAccess.map((item) => item.id),
    });

  const connectedRoadIds = new Set<string>();
  for (let i = 0; i < roads.length; i++)
    for (let j = i + 1; j < roads.length; j++)
      if (
        roads[i].points.some((a) =>
          roads[j].points.some((b) => distance(a, b) <= 3),
        )
      ) {
        connectedRoadIds.add(roads[i].id);
        connectedRoadIds.add(roads[j].id);
      }
  const disconnectedRoads = roads.filter(
    (road) => !connectedRoadIds.has(road.id) && roads.length > 1,
  );
  if (disconnectedRoads.length)
    issues.push({
      id: "roads:disconnected",
      severity: "warning",
      title: "Disconnected roads",
      detail: `${disconnectedRoads.length} road(s) do not connect to the road network.`,
      objectIds: disconnectedRoads.map((item) => item.id),
    });

  const facilities = project.objects.map((item) => item.name.toLowerCase());
  const requiredFacilities: Array<[string, RegExp, number]> = [
    ["park", /park|playground|garden/, 25],
    ["school", /school|education/, 250],
    ["clinic", /clinic|health|hospital/, 500],
    ["community facility", /community|library/, 500],
    ["worship facility", /mosque|church|temple|worship/, 500],
  ];
  for (const [label, pattern, threshold] of requiredFacilities)
    if (
      estimatedResidents >= threshold &&
      !facilities.some((name) => pattern.test(name))
    )
      issues.push({
        id: `facility:${label}`,
        severity: "warning",
        title: `Missing ${label}`,
        detail: `The estimated population is ${estimatedResidents}; add a ${label} or change the project assumption.`,
        objectIds: [],
      });

  if (cars.length < parkingRequired)
    issues.push({
      id: "parking:shortage",
      severity: "warning",
      title: "Parking shortage",
      detail: `${cars.length} spaces/vehicles shown; concept demand is ${parkingRequired}.`,
      objectIds: cars.map((item) => item.id),
    });

  const coveragePercent = siteArea ? (buildingArea / siteArea) * 100 : 0,
    greenPercent = siteArea
      ? (Math.min(
          siteArea,
          greenArea +
            trees.reduce(
              (sum, tree) => sum + Math.PI * (3 * tree.scale) ** 2,
              0,
            ),
        ) /
          siteArea) *
        100
      : 0;
  if (coveragePercent > project.planningSettings.maximumSiteCoveragePercent)
    issues.push({
      id: "rules:coverage",
      severity: "error",
      title: "Site coverage exceeds assumption",
      detail:
        coveragePercent.toFixed(1) +
        "% coverage exceeds the configured " +
        project.planningSettings.maximumSiteCoveragePercent +
        "% limit.",
      objectIds: buildings.map((item) => item.id),
    });
  if (greenPercent < project.planningSettings.minimumGreenSpacePercent)
    issues.push({
      id: "rules:green",
      severity: "warning",
      title: "Green-space target not met",
      detail:
        greenPercent.toFixed(1) +
        "% is below the configured " +
        project.planningSettings.minimumGreenSpacePercent +
        "% target.",
      objectIds: [],
    });

  for (const zone of project.zones) {
    for (const parcelId of zone.parcelIds) {
      const parcel = plots.find((plot) => plot.id === parcelId);
      if (!parcel) continue;
      const parcelArea = area(parcel.points),
        parcelBuildings = buildings.filter((building) =>
          inside(building.points[0], parcel.points),
        ),
        parcelBuildingArea = parcelBuildings.reduce(
          (sum, building) => sum + area(footprint(building)),
          0,
        ),
        coverage = parcelArea ? (parcelBuildingArea / parcelArea) * 100 : 0,
        floorArea = parcelBuildings.reduce(
          (sum, building) => sum + area(footprint(building)) * building.floors,
          0,
        ),
        far = parcelArea ? floorArea / parcelArea : 0;
      if (parcelArea < zone.minimumPlotAreaM2)
        issues.push({
          id: "zone:min-area:" + parcel.id,
          severity: "error",
          title: "Parcel is below zone minimum",
          detail:
            parcel.name +
            " is " +
            parcelArea.toFixed(0) +
            " m²; " +
            zone.name +
            " requires " +
            zone.minimumPlotAreaM2 +
            " m².",
          objectIds: [parcel.id],
        });
      if (coverage > zone.maximumCoveragePercent)
        issues.push({
          id: "zone:coverage:" + parcel.id,
          severity: "error",
          title: "Parcel coverage exceeds zone rule",
          detail:
            coverage.toFixed(1) +
            "% exceeds " +
            zone.maximumCoveragePercent +
            "% in " +
            zone.name +
            ".",
          objectIds: [parcel.id, ...parcelBuildings.map((item) => item.id)],
        });
      if (far > zone.maximumFar)
        issues.push({
          id: "zone:far:" + parcel.id,
          severity: "error",
          title: "Floor area ratio exceeds zone rule",
          detail:
            "FAR " +
            far.toFixed(2) +
            " exceeds " +
            zone.maximumFar.toFixed(2) +
            " in " +
            zone.name +
            ".",
          objectIds: [parcel.id, ...parcelBuildings.map((item) => item.id)],
        });
      for (const building of parcelBuildings) {
        if (!zone.allowedBuildingTypes.includes(building.buildingType))
          issues.push({
            id: "zone:use:" + building.id,
            severity: "error",
            title: "Building use is not allowed",
            detail:
              building.buildingType + " is not allowed in " + zone.name + ".",
            objectIds: [building.id, parcel.id],
          });
        if (building.floors > zone.maximumFloors)
          issues.push({
            id: "zone:height:" + building.id,
            severity: "error",
            title: "Building exceeds zone height",
            detail:
              building.floors +
              " floors exceeds the " +
              zone.maximumFloors +
              "-floor rule.",
            objectIds: [building.id, parcel.id],
          });
        const edgeDistance = Math.min(
          ...parcel.points.map(
            (point, index) =>
              projectToSegment(
                building.points[0],
                point,
                parcel.points[(index + 1) % parcel.points.length],
              ).d,
          ),
        );
        const requiredSetback = Math.max(
          zone.frontSetbackM,
          zone.sideSetbackM,
          zone.rearSetbackM,
        );
        if (
          edgeDistance - Math.hypot(building.width / 2, building.depth / 2) <
          requiredSetback
        )
          issues.push({
            id: "zone:setback:" + building.id,
            severity: "warning",
            title: "Building enters setback envelope",
            detail:
              building.name +
              " needs approximately " +
              requiredSetback +
              " m clearance from parcel edges.",
            objectIds: [building.id, parcel.id],
          });
      }
    }
  }

  const requiredUtilityTypes = [
    "water",
    "wastewater",
    "stormwater",
    "electricity",
  ] as const;
  for (const utilityType of requiredUtilityTypes) {
    const networks = project.utilityNetworks.filter(
      (network) => network.type === utilityType,
    );
    if (!networks.length) {
      issues.push({
        id: "utilities:missing:" + utilityType,
        severity: "unknown",
        title: utilityType + " network is missing",
        detail:
          "No " +
          utilityType +
          " corridor or authoritative capacity source is recorded.",
        objectIds: [],
      });
      continue;
    }
    if (networks.every((network) => network.capacity === 0))
      issues.push({
        id: "utilities:capacity:" + utilityType,
        severity: "unknown",
        title: utilityType + " capacity is unknown",
        detail:
          "A concept corridor exists, but no verified capacity has been recorded.",
        objectIds: [],
      });
    const unconnected = buildings.filter(
      (building) =>
        !networks.some(
          (network) =>
            network.connectedObjectIds.includes(building.id) ||
            distanceToLine(building.points[0], network.points) <=
              network.connectionDistanceM,
        ),
    );
    if (unconnected.length)
      issues.push({
        id: "utilities:unconnected:" + utilityType,
        severity: "warning",
        title: "Buildings lack " + utilityType + " connection",
        detail:
          unconnected.length +
          " building(s) exceed the configured utility connection distance.",
        objectIds: unconnected.map((building) => building.id),
      });
  }
  const requiredHazards = [
    "flood",
    "liquefaction",
    "coastal",
    "fault",
  ] as const;
  for (const hazardType of requiredHazards) {
    const layers = project.dataLayers.filter(
      (layer) => layer.hazardType === hazardType,
    );
    if (!layers.length) {
      issues.push({
        id: "hazards:missing:" + hazardType,
        severity: "unknown",
        title: hazardType + " data is missing",
        detail:
          "Import a GeoJSON layer and classify it as " +
          hazardType +
          " with its source and confidence.",
        objectIds: [],
      });
      continue;
    }
    for (const layer of layers) {
      const hazardPolygons = layer.features.flatMap((feature) => {
        if (feature.geometry.type === "Polygon")
          return [
            ((feature.geometry.coordinates as number[][][])[0] || []).map(
              (point) => toLocal(point as Point, project.origin),
            ),
          ];
        if (feature.geometry.type === "MultiPolygon")
          return (feature.geometry.coordinates as number[][][][]).map(
            (polygon) =>
              (polygon[0] || []).map((point) =>
                toLocal(point as Point, project.origin),
              ),
          );
        return [];
      });
      const affected = [
        ...boundaries.map((boundary) => ({
          id: boundary.id,
          polygon: boundary.points,
        })),
        ...buildings.map((building) => ({
          id: building.id,
          polygon: footprint(building),
        })),
      ].filter((candidate) =>
        hazardPolygons.some(
          (polygon) =>
            polygon.length >= 3 &&
            polygonsIntersect(candidate.polygon, polygon),
        ),
      );
      if (affected.length)
        issues.push({
          id: `hazards:overlap:${layer.id}`,
          severity: layer.hazardSeverity === "avoid" ? "error" : "warning",
          title: `${hazardType} constraint overlaps the proposal`,
          detail: `${affected.length} boundary/building object(s) overlap ${layer.name}. Source confidence: ${layer.confidence || "unknown"}.`,
          objectIds: affected.map((candidate) => candidate.id),
        });
    }
  }
  if (!terrain?.available)
    issues.push({
      id: "terrain:data",
      severity: "unknown",
      title: "Terrain and slope unknown",
      detail:
        "No configured terrain source is available. Slope-dependent placement cannot be verified.",
      objectIds: [],
    });
  else if ((terrain.maximumSlopePercent ?? 0) > 15)
    issues.push({
      id: "terrain:slope",
      severity: "warning",
      title: "Steep terrain requires review",
      detail:
        "Sampled boundary-edge slope reaches " +
        terrain.maximumSlopePercent!.toFixed(1) +
        "%. A detailed survey and grading design are required.",
      objectIds: boundaries.map((item) => item.id),
    });

  if (!issues.some((issue) => issue.severity === "error"))
    issues.push({
      id: "geometry:pass",
      severity: "pass",
      title: "No building collisions found",
      detail: "Current building footprints do not intersect each other.",
      objectIds: [],
    });

  const deductions = issues.reduce(
      (sum, issue) =>
        sum +
        (issue.severity === "error"
          ? 2
          : issue.severity === "warning"
            ? 0.75
            : issue.severity === "unknown"
              ? 0.5
              : 0),
      0,
    ),
    roadArea = roads.reduce(
      (sum, road) => sum + length(road.points) * road.width,
      0,
    ),
    parkingArea = plots
      .filter((plot) => /parking/i.test(plot.name))
      .reduce((sum, plot) => sum + area(plot.points), 0),
    imperviousAreaM2 = buildingArea + roadArea + parkingArea,
    preliminaryRunoffM3 = imperviousAreaM2 * 0.05 * 0.9,
    connectedUtilityObjects = new Set(
      project.utilityNetworks.flatMap((network) => network.connectedObjectIds),
    );
  return {
    score: Math.max(0, Math.round((10 - deductions) * 10) / 10),
    siteAreaHa: siteArea / 10_000,
    coveragePercent,
    greenPercent,
    housingUnits,
    estimatedResidents,
    parkingProvided: cars.length,
    parkingRequired,
    disconnectedRoads: disconnectedRoads.length,
    buildingsWithoutAccess: buildingsWithoutAccess.length,
    utilityConnections: connectedUtilityObjects.size,
    utilityNetworks: project.utilityNetworks.length,
    imperviousAreaM2,
    preliminaryRunoffM3,
    issues,
  };
}
