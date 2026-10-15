# Sitecraft Professional GIS Planning — Implementation Plan

## Goal

Sitecraft ko concept drawing app se reliable GIS-based planning platform banana. System user ko unsafe ya impossible layout banane se roke, har warning ka reason bataye, aur 2D, 3D aur Street views mein same planning rules apply kare.

## Core rules

- Safety aur data validation visual realism se pehle complete hogi.
- Har analysis apna source, date, resolution aur confidence show karega.
- Missing GIS data ko safe result nahi samjha jayega; status `Unknown / data required` hoga.
- Hard block sirf reliable rule/data par hoga. Incomplete data warning dega.
- All calculations metric units mein store hongi. UI project-specific units dikha sakegi.
- 2D, 3D, Street view aur saved project ek hi geometry/state use karenge.

## Phase 0 — Foundation and data model

**Purpose:** Aane wale rules ko clean architecture dena.

### Work

- Project schema v4 introduce karna with migration from v1-v3.
- Add `Site`, `Parcel`, `ConstraintLayer`, `HazardLayer`, `Zone`, `UtilityNetwork`, `RuleSet`, `AnalysisResult`, `DataSource` and `Scenario` entities.
- Object geometry ko point-anchor ke bajaye real footprint geometry dena.
- Units setting: metric, imperial, square metres, square feet, acres and configurable marla standard.
- Every layer ke saath source, fetched date, license, resolution and confidence store karna.
- Central validation engine banana with `error`, `warning`, `unknown` and `pass` results.
- Analysis ko Web Worker/background tasks mein move karna.

### Acceptance

- Old projects automatically open hon.
- Save/open ke baad geometry, units, rules and sources unchanged rahen.
- Same validation result 2D, 3D and Street view mein ho.

## Phase 1 — GIS context and buildability

**Purpose:** Boundary draw hote hi batana ke land buildable hai ya nahi.

### Work

- Exact boundary intersection ke saath OpenStreetMap water, waterways, buildings, roads, railways and land-use fetch karna.
- LINZ DEM/elevation source adapter add karna.
- Terrain samples se slope, aspect and elevation range calculate karna.
- Water, wetland, steep slope and missing-data constraint polygons generate karna.
- Existing buildings/roads/railways ko protected context objects banana.
- Buildability heatmap:
  - Green: allowed
  - Yellow: review/warning
  - Red: blocked
  - Grey: data unavailable
- Boundary analysis report mein intersecting features aur nearby features alag dikhana.
- Data fetch failure par analysis status `Incomplete` rakhna.

### Initial rules

- Normal buildings water/wetland polygons par blocked.
- Bridges sirf water/road crossing rules ke saath allowed.
- Configurable slope thresholds; default thresholds ko concept assumptions label karna.
- Existing mapped building overlap warning until authoritative parcel/context data is available.

### Acceptance

- Lake par drawn site water area red show kare.
- Mountain site slope bands show kare.
- Offline/failed analysis green result na de.
- Report exact overlap area and percentage show kare.

## Phase 2 — Geometry, topology and collision engine

**Purpose:** Impossible overlapping layouts ko rokna.

### Work

- Har asset ka actual 2D footprint and clearance envelope define karna.
- Building-building, building-road, plot-plot, tree-road, parking-building and utility collisions detect karna.
- Multiple boundaries ke overlap and duplicate sites detect karna.
- Polygon gaps, self-intersections, duplicate vertices and tiny slivers validate karna.
- Snapping system: vertex, midpoint, road edge, parcel edge, perpendicular, parallel and grid.
- Spatial index (RBush/R-tree) use karke large projects mein fast collision queries.
- Map par conflict highlights and click-to-focus error list.

### Acceptance

- Object ka sirf centre nahi, complete footprint validate ho.
- Overlapping house save na ho aur exact conflict object show ho.
- 1,000+ objects par editing responsive rahe.

## Phase 3 — Parcels, zoning and development controls

**Purpose:** Plot ke size aur planning rules ke mutabiq construction allow karna.

### Work

- Parcel/cadastral GeoJSON import and LINZ parcel adapter.
- Zone types: residential, commercial, mixed-use, education, health, faith, recreation, cemetery, utility and protected land.
- Rule editor per zone:
  - Allowed uses
  - Front/side/rear setbacks
  - Maximum height/floors
  - Site coverage
  - FAR/floor area ratio
  - Minimum plot size/frontage
  - Density/units per hectare
  - Parking requirement
- 3D development envelope visualize karna.
- Easement and right-of-way areas mein construction block karna.
- Rule presets project-level configuration se manage karna; presets ko legal approval na kehna.

### Acceptance

- 5-marla parcel par 10-marla footprint reject ho.
- Setback cross karne par live red envelope show ho.
- Height/FAR/coverage changes real time recalculate hon.

## Phase 4 — Road and mobility network

**Purpose:** Connected, usable and safe transport layout banana.

### Work

- Road graph with junction nodes and directed connections.
- Detect disconnected roads, dead ends, invalid crossings and roads ending without access.
- Road hierarchy: arterial, collector, local, service and pedestrian.
- Width, lanes, median, footpath, cycleway, parking lane and verge templates.
- Terrain-following road profile and maximum gradient checks.
- Junction angle, turning radius and roundabout templates.
- Every occupied plot/facility ka gate-to-road access check.
- Emergency access: maximum route distance, secondary entrance and fire access configuration.
- Basic trip-generation and traffic-capacity estimates; assumptions clearly shown.

### Acceptance

- Society entrance external mapped road ke valid connection point tak jaye.
- Disconnected house/park/school automatically listed ho.
- Steep road section live warning de.

## Phase 5 — Facilities, population and parking capacity

**Purpose:** Society ko sirf objects nahi, functioning community banana.

### Work

- Housing units, estimated residents and household assumptions.
- Facility demand rules for schools, clinics, worship, parks, playgrounds, community centre, police/fire and cemetery.
- Catchment/service radius maps.
- Commercial and institutional parking demand.
- Accessible parking, loading, drop-off and bus bays.
- Open-space percentage, tree canopy and per-person green-space metrics.
- Dashboard: planned, required, shortage and surplus.

### Acceptance

- Population change par facility/parking requirement update ho.
- Missing essential facility dashboard par red show ho.
- Catchment gaps map par visible hon.

## Phase 6 — Utilities and stormwater

**Purpose:** Infrastructure capacity ko layout ke saath plan karna.

### Work

- Water, wastewater, stormwater, electricity and telecom network layers.
- Pipes/cables ke nodes, slopes, capacity and connection points.
- Buildings ka nearest utility connection check.
- Terrain-based drainage direction and low-point detection.
- Impervious area and preliminary runoff estimate.
- Detention pond, swale, rain garden and outfall assets.
- Utility easement and clash detection.

### Acceptance

- Unconnected building warning de.
- Stormwater low points and blocked flow paths map par show hon.
- Utility-building/road clashes detect hon.

## Phase 7 — Natural hazards and environmental analysis

**Purpose:** Planning decisions ko known risks ke against check karna.

### Work

- Council/national layer adapters for flood, coastal inundation, tsunami, liquefaction, landslide and fault data where available.
- Hazard layer dates and limitations prominently show karna.
- Flood map incomplete ho to `Unknown` state use karna.
- Configurable buffers for streams, wetlands, coast, railways and sensitive land.
- Noise proximity model for roads/railways/commercial uses.
- Sun/shadow study by date/time.
- Later iteration: wind, daylight and microclimate estimates.

### Acceptance

- Hazard overlap area and affected objects list ho.
- Missing hazard data ko safe mark na kiya jaye.
- Shadow timeline selected buildings and public spaces par work kare.

## Phase 8 — Suitability and scenario comparison

**Purpose:** User ko best site/layout choose karne mein help dena.

### Work

- Weighted suitability criteria: slope, water, hazards, access, zoning, services and environmental constraints.
- User-adjustable weights with saved models.
- Parcel/site score 0-10 and reason breakdown.
- Scenario clone, lock, rename and compare.
- Compare metrics: units, residents, FAR, green space, roads, parking, facilities, hazard exposure and preliminary cost quantities.
- Side-by-side map and delta dashboard.

### Acceptance

- Same inputs same score produce karein.
- User har score ka reason dekh sake.
- Scenario changes original scenario ko mutate na karein.

## Phase 9 — Data reliability, portable projects and recovery

**Purpose:** Projects ko safely save, share and recover karna.

### Work

- Browser localStorage se IndexedDB project store migrate karna.
- Project package format (`.sitecraft`) containing JSON, custom assets, thumbnails and source metadata.
- Autosave snapshots with retention limits.
- Recovery screen after crash/corrupt save.
- Import validation report before project opens.
- Missing asset relinking.
- Server mode: authentication, ownership, permissions, optimistic concurrency and revision history.
- Quota indicator and project cleanup tools.

### Acceptance

- Project doosre computer par assets ke saath open ho.
- Interrupted save last valid revision damage na kare.
- Two-user overwrite conflict silently data replace na kare.

## Phase 10 — Professional output and QA

**Purpose:** Demo se review-ready planning output tak jana.

### Work

- PDF planning report with site, assumptions, constraints, metrics and screenshots.
- GeoJSON, CSV and image exports with CRS/source metadata.
- Print layouts, scale bar, north arrow, legend and coordinate grid.
- Accessibility and keyboard workflow audit.
- Responsive UI checks at supported screen sizes and browser zoom levels.
- Performance budgets for loading, camera movement and analysis.
- Unit, topology, migration, worker, persistence and end-to-end test suites.
- Clear banner: concept planning vs engineering/legal approval.

### Acceptance

- Exported report reproduces current scenario and analysis timestamp.
- No critical geometry, save/open or view-state regression.
- Supported project size meets agreed performance budget.

## Recommended delivery chunks

1. **Chunk A:** Phase 0 + water/existing-context intersection from Phase 1.
2. **Chunk B:** Terrain/slope buildability and incomplete-data states.
3. **Chunk C:** Full footprint collision, topology and snapping.
4. **Chunk D:** Parcels, zones, setbacks, height, coverage and FAR.
5. **Chunk E:** Road graph, access, gradients and emergency routes.
6. **Chunk F:** Population, facilities, parking and green-space dashboard.
7. **Chunk G:** Utilities and stormwater.
8. **Chunk H:** Hazard adapters, sun/shadow and environment checks.
9. **Chunk I:** Suitability models and scenario comparison.
10. **Chunk J:** Portable packages, autosave, revision history and professional reports.

## Recommended first release boundary

The first credible planning release should include Chunks A-E. Until these are complete, Sitecraft should remain labelled **Concept planning — no engineering or legal validation**.

## Free/open data and technology direction

- OpenStreetMap/Overpass for contextual features, with attribution and confidence warnings.
- LINZ open parcels and elevation services for New Zealand context.
- Council open-data portals for regional hazard layers where licensing permits.
- CesiumJS for geospatial 3D.
- Turf.js/polygon-clipping for spatial operations where appropriate.
- RBush or equivalent spatial index for collision performance.
- GeoJSON as exchange format; packaged Sitecraft format for complete projects.

## Implementation gate for every chunk

- Data source and limitations documented.
- Rules have unit tests and visible user-facing reasons.
- 2D, 3D and Street state remains consistent.
- Save/open migration tested.
- Existing demo projects still open.
- Build, unit tests and focused browser workflow pass before moving to the next chunk.
