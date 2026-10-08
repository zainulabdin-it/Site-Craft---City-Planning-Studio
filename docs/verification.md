# Verification — 2026-10-08

## Executed successfully

- `npm.cmd run build`: TypeScript check and Vite production build passed. Main Cesium bundle is about 4.67 MB (1.28 MB gzip); build emits a large-chunk warning. No performance claim is inferred from a successful build.
- `npm.cmd test`: 6 geometry/command tests passed. Covers numerical coordinate roundtrips (<1e-9 degrees, approximately sub-mm), invalid/self-intersecting polygons, concave-boundary full-surface containment, T-node insertion, width-derived surface area, different-elevation non-connectivity, undo reversal, parameter validation and JSON roundtrip.
- Independent Python/PROJ check from (172.6362, -43.5321) to (172.637, -43.531): local delta **64.108168527 m east, 122.447042254 m north**. This validates numerical implementation, not real-world survey accuracy.
- `.venv/Scripts/python.exe -m pytest tests -q` from `apps/api`: 4 tests passed against a real temporary SQLite database: save/read/update, optimistic conflict rejection, invalid origin/ID rejection, PROJ roundtrip and storage-key validation. A Starlette TestClient/httpx deprecation warning remains; it does not affect the live HTTP integration test.
- Alembic `upgrade head` ran successfully on the local SQLite fallback database.
- `npm.cmd run test:e2e`: **2 browser tests passed**, 2.1 minutes total, with live Cesium/WebGL, real OSM tiles, Vite and FastAPI. No mocked successful API responses. One test intentionally aborts the save request to check error handling.
- Acceptance browser flow: create project; draw boundary; draw two snapped roads; edit width 8→14 m; add building and floors 2→4; undo/redo floors; place tree, car and bridge; rotate/move bridge; save locally; reload; verify persisted parameters/shared node; download JSON; save/read the same objects through the live API; revision increments. Seven objects total.
- Browser `pageerror` capture remained empty during acceptance. Screenshot [editor-acceptance.png](editor-acceptance.png) was visually inspected: actual OSM context, drawn boundary and connected T surface visible, UI panels usable.
- `npm audit`: zero known vulnerabilities after removing an unnecessary static-copy plugin. Cesium runtime assets are copied by a small local Node script instead.

## Environment and observed performance

Windows office machine, Node 24.18.0, bundled Python 3.12. Hardware reported Intel Core i5-4460S @2.90 GHz, Intel HD Graphics 4600 and a Remote Display Adapter. Playwright Chromium **156.0.8078.4**, 1440×1000 viewport, forced SwiftShader software WebGL. The final complete acceptance workflow took **103,277 ms**, including startup, map loading, interaction, page reload and persistence; this is not a frame-time benchmark. No sustained FPS or maximum-capacity claim has been made.

Default seeded proposal: 360×300 m, 10.8 ha, 10 objects. The drawing test creates a separate seven-object site within the ±2 km coordinate window. It does not establish usability at the 2,000-object validation limit. Idle rendering is request-driven and capped at 30 FPS when active. Unchanged object entities retain identity, and road union generation is keyed to road data instead of all building/asset changes.

## Failures found and addressed

The first browser attempt exposed an ambiguous test locator (`Road` existed as both an object and toolbar button); the locator was scoped to the toolbar. A later run was invalidated by editing source while Vite was serving the test, causing a development reload. The final passing run used frozen source. API tests initially ran from the wrong working directory; README now specifies `apps/api`.

A full-boundary containment regression test exposed near-coincident edges in an axis-aligned road buffer. Derived buffer vertices are now quantized to 1 micrometre before polygon union, removing trigonometric near-zero noise. Source alignment coordinates are preserved. Containment includes buffered roads, plots, rectangular buildings and scaled bridge decks; tree/car/bench placeholders use their anchors.

## Not verified / not complete

PostgreSQL/PostGIS runtime and its spatial index; authorised LINZ raster/imagery delivery and exact pilot coverage; optional ion terrain path; vertical datum conversion/terrain-relative placement; S3 storage operations; shared deployment/authentication; large-scene performance; comprehensive console/network warning audit. GDAL imports are not implemented. See the Phase 1 gaps in [scope.md](scope.md). Phase 1 is not claimed complete.
