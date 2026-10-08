"""Versioned parametric project representation; meshes are never authoritative."""
from typing import Literal
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
    buildingType: Literal['Detached house', 'Townhouse', 'Apartment', 'Commercial']
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

class Project(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    schemaVersion: Literal[1]
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)
    scenarioId: UUID
    scenarioName: str = Field(max_length=100)
    origin: tuple[float, float]
    horizontalCRS: Literal['EPSG:2193']
    verticalReference: Literal['Conceptual offset above ellipsoid; not NZVD2016']
    objects: list[DesignObject] = Field(max_length=2000)

    @model_validator(mode='after')
    def validate_design(self):
        if not (165 <= self.origin[0] <= 179 and -48 <= self.origin[1] <= -34):
            raise ValueError('Origin must be in the New Zealand pilot extent')
        ids = [o.id for o in self.objects]
        if len(set(ids)) != len(ids):
            raise ValueError('Duplicate object IDs')
        boundaries = [o for o in self.objects if o.kind == 'boundary']
        if len(boundaries) > 1:
            raise ValueError('One boundary per project')
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
                boundary = Polygon(boundaries[0].points).buffer(.01)
                if any(not boundary.covers(Point(p)) for p in points):
                    raise ValueError(f'{o.name} outside project boundary')
                shape = LineString(points).buffer(o.width/2, quad_segs=6) if o.kind == 'road' else Polygon(points) if len(points) >= 3 else Point(points[0])
                if not boundary.covers(shape):
                    raise ValueError(f'{o.name} full surface outside project boundary')
        return self
