# Architecture and conventions

## Decisions

- One Cesium viewer owns the viewport and geographic transforms. No second renderer. Entity references are retained for unchanged design objects; event handlers, workers and GPU resources are disposed on unmount.
- A React command journal holds before/after values only for affected objects, rather than snapshots of the entire city. Connected road node edits form one atomic command. History is session-only and capped at 100 commands.
- Structured schema version 1 project documents are authoritative. A stable project/scenario/object ID and revision survive reload. The relational project envelope stores JSON/JSONB. Separate relational road/building tables are deferred until query/access requirements justify them.
- Save API uses an atomic revision predicate to reject concurrent overwrites (HTTP 409). It does not silently merge. Local save errors and server failures are shown. A server save also caches the successful document in the browser.
- The browser has a strict Zod schema; FastAPI has independent Pydantic and Shapely checks. IDs, geometry, dimensions and graph consistency are validated. No generic file-upload endpoint exists.
- Project operations are small enough for synchronous API requests. No Redis/Celery is installed. Road buffering/union runs in a Web Worker, with stale work cancelled. Assets remain references with location/rotation/scale; current built-ins are original procedural placeholders.
- Local filesystem and S3-compatible asset adapters exist, but have no exposed upload API. Large binaries never enter project rows. A CDN can serve the S3 public base URL. Asset ingestion and GDAL processing remain unimplemented.

## Coordinates

Exchange uses WGS84 longitude, latitude (EPSG:4326), always in that order. Metric editing uses NZTM2000 (EPSG:2193). Store the WGS84 origin and local `[east, north]` metre offsets from its projected NZTM position. Local offsets are bounded to ±2 km for this pilot. Transforms are `local -> NZTM -> WGS84 -> Cesium ECEF`, not degree-based widths or Web Mercator measurements.

The projection implementation uses GRS80 and the standard NZTM parameters. WGS84/NZGD2000 are treated as coincident for concept planning; survey-grade epoch/deformation transformations are not implemented. The sub-millimetre numerical roundtrip test is not a claim of real-world datum accuracy.

Vertical reference is explicitly **conceptual offset above the ellipsoid, not NZVD2016**. No orthometric/geoid conversion exists. Optional world terrain adds context only; designs have not been fitted to it and must not be interpreted as ground-referenced engineering. Terrain sampling, project base elevation and a validated vertical transform are outstanding Phase 1 context work.

Boundary means a user design extent, not a cadastral parcel. Proposed objects and real context are separate. The initial fixtures are wholly proposed/assumed.

## Roads

Alignment is an ordered list of local points and shared node UUIDs. Snapping is deliberate, same-elevation, within 6 m; an interior snap inserts a node into an existing alignment. T and explicitly snapped X junctions share graph nodes. Graph connectivity is not inferred from every crossing. Elevation editing is not exposed yet.

Round-capped segment buffers are unioned in metric coordinates and triangulated by Cesium. Width changes regenerate geometry. The surface is a conceptual connected paved region; traffic lanes are stored metadata. It does not model turn radii, corner fillets, footpaths, drainage or different-grade approaches. Unioning visual surfaces does not create graph connections.

## Bounds and deployment

Initial scale: 10.8 ha demo, 10 objects, no bulk national data. Hard limit: 2,000 objects / 500 vertices per object / 5 MB import. These are validation guards, not measured capacity claims. Repeated placeholders use entities, not GPU instancing; tiles/context are streamed by Cesium. Detailed instancing/LOD requires profiling.

Local-only services are unauthenticated. Before shared deployment add authenticated sessions, project ownership/access controls, rate limiting, bounded asset processing and deployment-specific CORS/TLS. PostgreSQL's spatial boundary column/index is initially unpopulated; do not claim spatial querying is working.
