# Product scope and phase backlog

## Implemented vertical slice

React/TypeScript/Cesium editor; real Christchurch OSM map context; explicit flat ellipsoid mode; new/open/save project; one design boundary with geometry validation and vertex editing; roads with metric width, length and explicit T/X snaps; footprint/floor-height parametric buildings; manual plots; original tree/car/bench/concept bridge placeholders; selection, translation, rotation, duplicate/delete, layer visibility and framing; session undo/redo; browser storage; actual FastAPI persistence with optimistic revisions; project JSON import/export and GeoJSON export.

## Phase 1 acceptance gaps

- Real elevation and aerial imagery: configure authorised sources, verify exact pilot coverage and runtime delivery, implement a vertical reference/base-elevation workflow, and test against terrain. No credentialed service or LINZ raster was fetched in the current slice.
- Run migrations, save/load and spatial checks against actual PostgreSQL/PostGIS. SQLite is verified separately.
- Buildings are rectangular massing footprints; arbitrary polygon footprints and richer roof/facade systems are not implemented.
- Bridge is a fixed conceptual deck placeholder with transform/scale only; no piers, approaches or structural validation.
- Full polygon and buffered-road containment is enforced. Tree/car/bench containment is anchor-based; the asset's visual volume can extend beyond the boundary.
- Improve road selection hit area, on-map vertex handles and hover snap feedback. Current coordinate editing is via inspector; numeric road vertex count must remain unchanged.
- Add durable context/terrain source records per project (current renderer source configuration is environment-based), reliable imagery loading feedback and asset instancing where profiling warrants it.

Phase 1 is **not declared complete** until these acceptance-critical context gaps are verified. No Phase 2/3 feature panels imply working analysis.

## Phase 2

Improved junction geometry; parametric conceptual bridges; generated road/block alternatives; plot and building rules; setbacks; green/parking allocation; full scenario duplication/comparison; real indicators with stated definitions; GIS imports through GDAL/Shapely/PROJ; source attribution/provenance records; background job system for long-running imports. Generated content remains editable and regeneration must be explicitly scoped.

## Phase 3

Separate proposed terrain surface, grading/cut-fill with validated datum and method; SUMO network/demand integration; sun/environmental/financial/zoning analysis; access-controlled collaboration; optional Unreal/VR presentation. Vehicle placement is static, not traffic simulation. No regulatory or structural compliance claims.
