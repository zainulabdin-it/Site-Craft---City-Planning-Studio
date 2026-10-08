# Data sources, rights and pilot

Checked 2026-10-08. Pilot anchor: central Christchurch, 172.6362° E, 43.5321° S. Demo extent is 360 × 300 m (10.8 ha), not surveyed, owned or permitted land.

## Active context

- OpenStreetMap standard raster tiles: live geographic map context, **not aerial imagery**. Attribution is supplied by Cesium's OpenStreetMapImageryProvider and retained in its credit control. OSM data is ODbL; public tiles have a separate [usage policy](https://operations.osmfoundation.org/policies/tiles/). No offline bulk prefetch or nationwide download is implemented. Choose a suitable licensed provider before shared production use.
- Flat ellipsoid: no elevation observations. The visible status explicitly states this.
- Optional Cesium ion token enables World Terrain. CesiumJS (Apache-2.0) and ion service terms are separate. This path is configured but unverified without a token. Design elevations remain conceptual offsets.
- Optional XYZ imagery URL and credit string in `.env.example`. Provider access, geographic coverage, license and attribution must be checked before use.

## LINZ candidates, not loaded into this build

[Christchurch LiDAR 1 m DEM 2024–2025](https://data.linz.govt.nz/layer/123193-canterbury-christchurch-lidar-1m-dem-2024-2025/) covers Christchurch City and Lyttelton Harbour. Capture: 10 December 2024–20 January 2025. Stored horizontal CRS EPSG:2193; vertical NZVD2016. Metadata states ±0.2 m vertical (95%) and ±1.0 m horizontal (95%) specifications, 1 m grid, CC BY 4.0. Credit Environment Canterbury / Aerial Surveys / LINZ as required by the dataset. Exact pilot tile coverage and download/API access have not been verified.

The [LINZ Christchurch catalogue](https://data.linz.govt.nz/data/?geotag=global%2Foceania%2Fnew-zealand%2Fcanterbury%2Fchristchurch-city) lists 0.075 m urban aerial photography (2025). Full imagery capture dates, pilot tile extent and delivery endpoint remain to be checked before selecting it. Follow [LINZ attribution guidance](https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data). Some service endpoints require an account/key; do not copy a public demo key into the application.

No building outline, parcel, cadastral boundary or authoritative road dataset is imported. Existing building heights and roofs are not inferred. All editable objects are proposed concept fixtures or user designs; placeholder assets are original procedural geometry with no third-party asset dependencies.

## Official implementation references

- [Cesium Viewer and providers](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html)
- [Vite runtime requirements](https://vite.dev/guide/)
- [FastAPI relational database integration](https://fastapi.tiangolo.com/tutorial/sql-databases/)
- [3D Cityplanner](https://3dcityplanner.com/) used only as a workflow reference; no claims about its internal stack.
