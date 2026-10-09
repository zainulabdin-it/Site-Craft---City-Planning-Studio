# Sitecraft — NZ city planning editor

Working local vertical slice using React, TypeScript, CesiumJS, FastAPI and SQLAlchemy. **Phase 1 is not fully accepted yet:** authoritative terrain/imagery integration and a live PostGIS run need verification. The editor works without those services using an explicitly labelled OpenStreetMap / flat ellipsoid context.

## Run on this Windows workspace

From `D:\Special Team\Project\City Or Town Planner 3D`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. Browser-local persistence works immediately. `Open project` includes a labelled demo proposal at Christchurch (172.6362, -43.5321). The 360 × 300 m demo site is illustrative, not an approved development or ownership claim.

For the API, in a second terminal:

```powershell
cd apps/api
# This workspace already has a .venv. For a fresh machine, install Python 3.12+
# and run: py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Select **Local API server** as the save destination. API documentation: http://127.0.0.1:8000/docs. Without DATABASE_URL it uses a real SQLite database (`apps/api/planner.db`), not a mocked service. The API does not load `.env` automatically; set environment variables in the shell. Both services bind to loopback. No authentication: do not expose them to a shared network or public internet.

The office Python installation was unavailable through PATH. A project virtual environment was created using Codex's bundled Python 3.12; its exact executable was `C:\Users\zain.ulabdin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`. The generated `.venv` is not portable.

## PostgreSQL + PostGIS

Docker was not installed on the inspected office machine. On a machine with Docker:

```powershell
docker compose -f infra/compose.yaml up -d
cd apps/api
$env:DATABASE_URL='postgresql+psycopg://planner:local-development-only@127.0.0.1:5432/planner'
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Alternatively install PostgreSQL 17 and its PostGIS extension locally, create the database/user and set DATABASE_URL. The migration user needs permission to enable PostGIS. SQLite and PostgreSQL are distinct stores; export project JSON for transfer. Do not change database URLs and assume data was migrated.

## Editing

1. Create a project; choose Boundary, click at least three map points, then Finish drawing.
2. Draw roads with at least two points. To connect a T junction, put a road endpoint within 6 m of an existing alignment. A shared node is inserted in the existing road. For X junctions, explicitly include a snapped point at the crossing. Crossings alone do not create graph connections.
3. Select a road and edit its width. The worker regenerates buffered metric surfaces. These are conceptual rounded junctions without kerbs, lane markings, signals or engineering turn radii.
4. Place a building, change floors, floor height, footprint dimensions, roof, colour and rotation. Numeric edits commit on Enter or blur.
5. Place tree/car/bench/bridge placeholders. Select Move, then click the new anchor. For precision, open local coordinates in the inspector. Polygon/road vertices can be edited there; preserve road vertex count.
6. Undo/redo covers the last 100 object commands in the current session. Save explicitly, then reload or use Open project. Creating/opening a project clears undo history.
7. Export Project JSON for lossless parametric exchange. GeoJSON exports geographic footprints/centerlines/anchors and parameters; it is not a complete project backup. JSON import is limited to 5 MB and schema-validated.
8. Submit a New Zealand city or address in the map search to inspect another location. Results are restricted to New Zealand. Search moves only the camera; it does not relocate or remove project objects. Use **Return to project** to frame the saved boundary again.
9. Use **Save to computer** for a portable project JSON file. Supported browsers show a native Save dialog; others download the file. Use **Open from computer** to restore that file later.

Mouse: left drag pans, wheel zooms, middle drag or Ctrl+left drag orbits (Cesium controls). Escape cancels drawing. 2D/3D buttons use top-down/oblique camera views in the same Cesium renderer.

## Checks

```powershell
npm.cmd test
npm.cmd run build
# Start both servers first, then:
npx.cmd playwright install chromium
npm.cmd run test:e2e
cd apps/api
.venv/Scripts/python.exe -m pytest tests -q
```

See [architecture](docs/architecture.md), [scope and backlog](docs/scope.md), [data provenance](docs/data-sources.md) and [verification](docs/verification.md). No paid resources have been provisioned.
