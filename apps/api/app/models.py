"""Versioned parametric project representation; meshes are never authoritative."""
from typing import Any, Literal
from uuid import UUID
from math import isfinite, hypot, cos, sin, radians
from pydantic import BaseModel, ConfigDict, Field, model_validator
from shapely.geometry import Polygon, Point, LineString

class DesignObject(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: UUID
    scenarioId: UUID
    kind: Literal['boundary', 'road', 'building', 'plot', 'tree', 'car', 'bench', 'bridge']
    name: str = Field(min_length=1, max_length=100)
    points: list[tuple[float, float]] = Field(min_length=1, max_length=500)
    nodeIds: list[UUID] = Field(max_length=500)
    width: float = Field(ge=1, le=100)
    depth: float = Field(ge=1, le=100)
    floors: int = Field(ge=1, le=60)
    floorHeight: float = Field(ge=2, le=6)
    rotation: float = Field(ge=-360, le=360)
    scale: float = Field(ge=.2, le=5)
    elevation: float = Field(ge=0, le=100)
    lanes: int = Field(ge=1, le=8)
    roof: Literal['flat', 'pitched']
    buildingType: Literal['Detached house', 'Townhouse', 'Apartment', 'Commercial', 'Place of worship', 'School', 'Clinic', 'Community']
    color: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    assetRef: str = Field(max_length=100)

    @model_validator(mode='after')
    def geometry_valid(self):
        if any(not isfinite(v) or abs(v) > 2000 for p in self.points for v in p):
            raise ValueError('Coordinates must be finite and within the 4 km pilot window')
        if self.kind in ('boundary', 'plot'):
            if len(self.points) < 3:
                raise ValueError('Polygon requires three vertices')
            polygon = Polygon(self.points)
            if not polygon.is_valid or polygon.area < 1:
                raise ValueError('Invalid or self-intersecting polygon')
        elif self.kind == 'road':
            if len(self.points) < 2 or len(self.nodeIds) != len(self.points) or len(set(self.nodeIds)) != len(self.nodeIds):
                raise ValueError('Road requires distinct graph nodes')
            if any(hypot(b[0]-a[0], b[1]-a[1]) < .1 for a,b in zip(self.points, self.points[1:])):
                raise ValueError('Road segments must be at least 0.1 m')
        elif len(self.points) != 1:
            raise ValueError('Object requires one anchor')
        return self

class DataGeometry(BaseModel):
    model_config = ConfigDict(extra='forbid')
    type: Literal['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']
    coordinates: Any

class DataFeature(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    geometry: DataGeometry
    properties: dict[str, Any]

class DataLayer(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    visible: bool
    opacity: float = Field(ge=0, le=1)
    color: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    source: str = Field(max_length=200)
    hazardType: Literal['flood', 'liquefaction', 'coastal', 'fault', 'contamination'] | None = None
    hazardSeverity: Literal['information', 'review', 'avoid'] | None = None
    confidence: Literal['authoritative', 'indicative', 'unknown'] | None = None
    sourceDate: str | None = Field(default=None, max_length=40)
    features: list[DataFeature] = Field(max_length=50000)

class DesignLayer(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    kind: Literal['boundary', 'road', 'building', 'plot', 'tree', 'car', 'bench', 'bridge']
    visible: bool
    opacity: float = Field(ge=0, le=1)

class ProjectLayer(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: UUID
    sourceProjectId: UUID
    name: str = Field(min_length=1, max_length=100)
    origin: tuple[float, float]
    visible: bool
    opacity: float = Field(ge=0, le=1)
    locked: bool
    objects: list[DesignObject] = Field(max_length=2000)
    designLayers: list[DesignLayer] = Field(max_length=8)

class PlanningSettings(BaseModel):
    # Ignore retired unit fields when an older saved project is opened.
    model_config = ConfigDict(extra='ignore', allow_inf_nan=False)
    unitSystem: Literal['metric', 'imperial'] = 'metric'
    residentsPerUnit: float = Field(default=4, ge=1, le=10)
    parkingSpacesPerUnit: float = Field(default=1.5, ge=0, le=5)
    maximumSiteCoveragePercent: float = Field(default=45, ge=1, le=100)
    minimumGreenSpacePercent: float = Field(default=15, ge=0, le=100)
    maximumRoadAccessDistanceM: float = Field(default=20, ge=1, le=500)

class DataSource(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    kind: Literal['basemap', 'terrain', 'context', 'hazard', 'rules']
    url: str = Field(max_length=500)
    license: str = Field(max_length=200)
    fetchedAt: str
    resolution: str = Field(max_length=100)
    confidence: Literal['authoritative', 'indicative', 'unknown']

class Zone(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    type: Literal['residential', 'commercial', 'mixed-use', 'education', 'health', 'faith', 'recreation', 'cemetery', 'utility', 'protected']
    parcelIds: list[UUID] = Field(max_length=2000)
    allowedBuildingTypes: list[Literal['Detached house', 'Townhouse', 'Apartment', 'Commercial', 'Place of worship', 'School', 'Clinic', 'Community']] = Field(max_length=8)
    frontSetbackM: float = Field(ge=0, le=100)
    sideSetbackM: float = Field(ge=0, le=100)
    rearSetbackM: float = Field(ge=0, le=100)
    maximumFloors: int = Field(ge=1, le=60)
    maximumCoveragePercent: float = Field(ge=1, le=100)
    maximumFar: float = Field(ge=.1, le=20)
    minimumPlotAreaM2: float = Field(ge=1, le=1_000_000)

class ScenarioSnapshot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    createdAt: str
    objects: list[DesignObject] = Field(max_length=2000)

class UtilityNetwork(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    type: Literal['water', 'wastewater', 'stormwater', 'electricity', 'gas', 'telecom']
    sourceRoadId: UUID | None = None
    points: list[tuple[float, float]] = Field(min_length=2, max_length=500)
    capacity: float = Field(ge=0, le=1_000_000)
    capacityUnit: str = Field(min_length=1, max_length=30)
    connectionDistanceM: float = Field(ge=1, le=500)
    connectedObjectIds: list[UUID] = Field(max_length=2000)
    source: str = Field(max_length=200)
    confidence: Literal['authoritative', 'indicative', 'unknown']

class LayerControl(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=150)
    visible: bool
    opacity: float = Field(ge=0, le=1)
    locked: bool
    displayOffsetM: float = Field(ge=-200, le=500)

class LayerPresentation(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    exploded: bool = False
    spacingM: float = Field(default=15, ge=0, le=100)

class Project(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    schemaVersion: Literal[1, 2, 3, 4]
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)
    scenarioId: UUID
    scenarioName: str = Field(max_length=100)
    origin: tuple[float, float]
    horizontalCRS: Literal['EPSG:2193']
    verticalReference: Literal['Conceptual offset above ellipsoid; not NZVD2016']
    objects: list[DesignObject] = Field(max_length=2000)
    dataLayers: list[DataLayer] = Field(default_factory=list, max_length=100)
    designLayers: list[DesignLayer] = Field(default_factory=list, max_length=8)
    projectLayers: list[ProjectLayer] = Field(default_factory=list, max_length=20)
    planningSettings: PlanningSettings = Field(default_factory=PlanningSettings)
    dataSources: list[DataSource] = Field(default_factory=list, max_length=100)
    zones: list[Zone] = Field(default_factory=list, max_length=500)
    alternatives: list[ScenarioSnapshot] = Field(default_factory=list, max_length=10)
    utilityNetworks: list[UtilityNetwork] = Field(default_factory=list, max_length=500)
    layerControls: list[LayerControl] = Field(default_factory=list, max_length=200)
    layerPresentation: LayerPresentation = Field(default_factory=LayerPresentation)

    @model_validator(mode='after')
    def validate_design(self):
        if not (165 <= self.origin[0] <= 179 and -48 <= self.origin[1] <= -34):
            raise ValueError('Origin must be in the New Zealand pilot extent')
        ids = [o.id for o in self.objects]
        if len(set(ids)) != len(ids):
            raise ValueError('Duplicate object IDs')
        boundaries = [o for o in self.objects if o.kind == 'boundary']
        nodes = {}
        for o in self.objects:
            if o.scenarioId != self.scenarioId:
                raise ValueError('Scenario mismatch')
            if o.kind == 'road':
                for node, point in zip(o.nodeIds, o.points):
                    value = (*point, o.elevation)
                    if node in nodes and nodes[node] != value:
                        raise ValueError('Connected node position/elevation mismatch')
                    nodes[node] = value
            if boundaries and o.kind != 'boundary':
                points = o.points
                if o.kind in ('building', 'bridge'):
                    a = radians(o.rotation)
                    x, y = o.points[0]
                    scale = o.scale if o.kind == 'bridge' else 1
                    points = [(x+scale*(u*cos(a)-v*sin(a)),y+scale*(u*sin(a)+v*cos(a))) for u,v in [(-o.width/2,-o.depth/2),(o.width/2,-o.depth/2),(o.width/2,o.depth/2),(-o.width/2,o.depth/2)]]
                candidate_boundaries = [Polygon(item.points).buffer(.01) for item in boundaries]
                if o.kind == 'road' and o.assetRef == 'builtin:road:external-access':
                    has_inside = any(any(boundary.covers(Point(point)) for boundary in candidate_boundaries) for point in points)
                    has_outside = any(not any(boundary.covers(Point(point)) for boundary in candidate_boundaries) for point in points)
                    if not has_inside or not has_outside:
                        raise ValueError(f'{o.name} must connect inside and outside the site')
                    continue
                boundary = next((item for item in candidate_boundaries if all(item.covers(Point(p)) for p in points)), None)
                if boundary is None:
                    raise ValueError(f'{o.name} outside project boundary')
                shape = LineString(points).buffer(o.width/2, quad_segs=6) if o.kind == 'road' else Polygon(points) if len(points) >= 3 else Point(points[0])
                if not boundary.covers(shape):
                    raise ValueError(f'{o.name} full surface outside project boundary')
        return self
