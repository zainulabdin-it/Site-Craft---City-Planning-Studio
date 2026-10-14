# Sitecraft Professional Planning Roadmap

## Purpose

Move Sitecraft from a visual concept editor to a planning decision tool that can validate a site, compare options, generate practical layouts, measure outcomes, and produce review-ready reports.

This document is an implementation plan only. It does not authorize regulatory, survey, traffic, environmental, or structural claims. Every calculated result must show its source, assumptions, units, and confidence level.

## Delivery assumptions

- The existing React, TypeScript, CesiumJS, FastAPI, SQLAlchemy, Shapely, PyProj, and PostGIS direction remains.
- PostgreSQL/PostGIS becomes the required shared-project database before collaboration and heavy spatial analysis.
- Long-running imports, terrain processing, layout generation, and reports will require a background job service.
- Project JSON remains portable, but schema migrations must preserve old saved projects.
- One product team means one phase at a time. A larger team can run asset, reporting, and collaboration work in parallel after the shared data model is stable.
- Ranges below are planning estimates for a small product team, not fixed delivery promises.

## Product milestones

| Milestone | Result | Included phases |
|---|---|---|
| Professional editor | Accurate drawing, measurements, snapping, rules, warnings, scenarios, and live metrics | 0–3 |
| Site intelligence | Real terrain, constraints, suitability, and professional road/plot systems | 4–5 |
| Smart planner | Generated and editable society alternatives | 6 |
| Delivery platform | Environmental, cost, export, collaboration, and expanded assets | 7–9 |

---

## Phase 0 — Stabilise the foundation

**Estimated range:** 2–3 weeks

### Goal

Create a reliable base so future rules, scenarios, generators, and reports do not depend on UI-only state or demo-specific logic.

### Work

- Confirm the current project schema version and publish a migration policy.
- Split project state into explicit domains: sites, scenarios, zones, networks, parcels, objects, assets, analyses, and source records.
- Add stable IDs and revision fields for every entity that will be referenced by rules or reports.
- Verify PostgreSQL/PostGIS migrations, save/load, revision conflict handling, geometry columns, and spatial indexes.
- Store map, imagery, terrain, and analysis-source attribution with each project.
- Add structured diagnostics and error codes instead of UI-only warning strings.
- Establish performance fixtures for 500, 1,000, and 2,000 objects.
- Add automated schema-migration, save/load, and geometry-regression tests.

### Deliverables

- Versioned project schema and migration guide.
- Verified PostGIS development setup.
- Shared domain interfaces for the web app and API.
- Baseline performance and regression report.

### Acceptance gate

- Existing browser and computer-file projects reopen without losing position, assets, layers, or scenarios.
- Concurrent server saves return a clear conflict instead of overwriting data.
- A 2,000-object fixture loads, frames, saves, and reopens within the agreed performance budget.

---

## Phase 1 — Precision drawing and measurement

**Estimated range:** 3–5 weeks

### Goal

Make manual planning accurate enough to support rules and automatic generation.

### Work

#### Measurement tools

- Distance, polyline length, polygon area, angle, radius, and coordinate picker.
- Live dimensions while drawing.
- Elevation profile placeholder that becomes terrain-aware in Phase 4.
- Unit selector for metric and imperial display while storing metric values internally.

#### Snapping

- Grid, vertex, edge, midpoint, road centre, perpendicular, parallel, and equal-spacing snaps.
- Visible snap guides and a temporary snap-distance label.
- User-configurable snap tolerance.

#### Geometry editing

- Split, merge, trim, extend, offset, buffer, rotate, mirror, align, distribute, and copy-along-path.
- Proper on-map handles for vertices, rotation, and resizing.
- Multi-select and grouped movement.
- Automatic plot numbering.

### Deliverables

- Measurement toolbar and results panel.
- Snap settings panel.
- Geometry editing command set integrated with undo/redo.

### Acceptance gate

- Measurements use NZTM metric calculations and match backend Shapely/PyProj results within the agreed tolerance.
- Every editing command can be undone and redone without breaking road nodes or object IDs.
- Snapping gives clear visual feedback before a point is committed.

---

## Phase 2 — Planning rules and zoning

**Estimated range:** 5–7 weeks

### Goal

Turn design requirements into reusable rules that can validate every current and future project.

### Work

- Add land-use zones and zoning boundaries.
- Create reusable rule profiles for residential, commercial, community, utility, recreation, and protected areas.
- Support minimum plot area, maximum height/floors, FAR, site coverage, density, front/side/rear setbacks, parking ratios, green-space targets, road width, water clearance, and permitted uses.
- Generate 2D setback lines and optional 3D maximum building envelopes.
- Validate full object footprints, not only anchor points.
- Classify messages as error, warning, or advisory.
- Allow rule overrides only with a written reason stored in project history.
- Add rule source, effective date, jurisdiction, and disclaimer fields.

### Data/API changes

- `zoning_profiles`
- `zoning_boundaries`
- `rule_sets`
- `rule_results`
- Endpoints to validate a site, scenario, or selected object.

### Deliverables

- Zoning editor.
- Rule profile manager.
- Live warnings on the map and a filterable issues panel.
- Compliance summary for each site and scenario.

### Acceptance gate

- Moving or resizing an object updates relevant warnings immediately.
- The same rule engine validates manual objects, imported objects, and generated layouts.
- Every warning identifies the object, failed rule, measured value, required value, and source.

---

## Phase 3 — Scenarios and live planning dashboard

**Estimated range:** 4–6 weeks

### Goal

Let users test alternatives without damaging the existing design and compare them with clear numbers.

### Work

- Add Existing, Option A/B/C, and Approved scenario states.
- Duplicate, rename, lock, archive, and delete scenarios.
- Store scenario changes efficiently while keeping stable shared context.
- Add side-by-side, swipe, and overlay comparison modes.
- Build a metric engine for site area, buildable area, plots, units, estimated population, floor area, FAR, coverage, road length/area, green space, parking, facility capacity, remaining land, and rule violations.
- Add metric definitions and formulas to project settings.
- Export comparison data to CSV and Excel-ready format.

### Deliverables

- Scenario switcher and scenario manager.
- Live dashboard with metric cards and charts.
- Scenario comparison table.
- Existing-versus-proposed map comparison.

### Acceptance gate

- Editing one scenario does not change another scenario.
- All dashboard metrics recalculate after relevant edits.
- Metric exports reproduce the values shown in the application.

### Professional editor milestone

At the end of Phase 3, Sitecraft should support accurate manual design, enforce planning rules, compare alternatives, and report measurable outcomes.

---

## Phase 4 — Real terrain, context, and suitability

**Estimated range:** 6–9 weeks

### Goal

Understand what already exists at a site and where development is suitable before generating a layout.

### Work

- Integrate an authorised terrain/elevation source for the pilot area.
- Define and document the vertical datum workflow; remove flat-ellipsoid assumptions from terrain-aware calculations.
- Sample elevations for boundaries, roads, plots, and buildings.
- Add contours, slope bands, elevation profile, and high/low-point views.
- Import or connect parcels, existing buildings, roads, waterways, flood layers, wetlands, protected land, utilities, and easements.
- Create configurable water, infrastructure, and protected-area buffers.
- Add weighted suitability criteria with green/yellow/red output and an explainable score.
- Store source date, licence, resolution, coverage, and confidence for every layer.

### Architecture additions

- Background jobs for raster/vector ingestion and analysis.
- Source catalogue and provenance records.
- Tiled or simplified analysis results for responsive display.

### Deliverables

- Site context report.
- Terrain and contour layers.
- Constraint map.
- Suitability heatmap and score explanation.

### Acceptance gate

- A boundary analysis reports existing roads, water, structures, slope, constraints, and possible access points.
- Buildings and generated plots cannot silently occupy excluded water or protected areas.
- Terrain-aware results clearly state datum, resolution, source, and limitations.

---

## Phase 5 — Professional roads, plots, and parking

**Estimated range:** 6–8 weeks

### Goal

Model a connected, practical movement network that can support automatic subdivision.

### Work

- Road hierarchy: arterial, collector, local, service, pedestrian, and cycle.
- Parametric cross-sections: carriageway, lanes, median, footpath, verge, cycle lane, parking lane, bus lane, and drainage allowance.
- Curved roads, cul-de-sacs, roundabouts, T/X junctions, split, merge, and widening tools.
- Basic grade limits using terrain, with explicit conceptual warnings.
- Connectivity graph, entrance validation, dead-end checks, and shortest path.
- Automatic blocks from the road network.
- Plot subdivision by frontage, depth, area, and corner rules.
- Parking generator with standard, accessible, EV, loading, aisle, and circulation settings.
- Generators for footpaths, streetlights, tree rows, fences, and crossings.

### Deliverables

- Road cross-section editor.
- Network validation panel.
- Block and plot subdivision tool.
- Parking layout tool.

### Acceptance gate

- Every generated plot has valid road access unless marked as an intentional exception.
- Entrances connect to a valid internal and external road node.
- Parking counts, stall dimensions, accessible spaces, and circulation are measurable and editable.

---

## Phase 6 — Smart society generator

**Estimated range:** 8–12 weeks

### Goal

Generate several valid, editable layouts from a site boundary, constraints, rules, and user targets.

### Inputs

- Population or housing target.
- Plot and housing mix.
- Commercial/community/green percentages.
- Road hierarchy and maximum block size.
- Parking ratios.
- Required schools, health, faith, recreation, emergency, burial, and utility facilities.
- Cost, density, or green-space priority.

### Generation pipeline

1. Remove excluded and constrained areas.
2. Select valid external access points.
3. Generate a connected road hierarchy.
4. Form blocks and subdivide plots.
5. Allocate land use and required facilities.
6. Place building and parking prototypes.
7. Apply rules and reject invalid arrangements.
8. Score remaining options.
9. Return 2–4 alternatives with an explanation of trade-offs.

### Required behaviour

- Generated content remains fully editable.
- Regeneration asks what scope may be replaced.
- Manual edits are preserved outside the selected regeneration scope.
- Each alternative records seed, inputs, rules, sources, score, and generation version.
- A deterministic mode reproduces the same layout from the same inputs and seed.

### Deliverables

- Generator setup wizard.
- Green, housing, family, commercial, and low-cost presets.
- Ranked option gallery.
- Generation report and rule-failure explanation.

### Acceptance gate

- Generated options contain no unresolved blocking rule violations.
- All plots and key facilities have connected access.
- Options meet their stated targets within documented tolerance.
- Users can edit and save a generated option as a normal scenario.

---

## Phase 7 — Environmental and feasibility analysis

**Estimated range:** 7–10 weeks

### Goal

Explain how a proposal performs and what it may cost.

### Analysis order

1. Sun and shadow study.
2. Green coverage and tree shade.
3. Water/flood clearance.
4. Solar roof potential.
5. Noise buffers from roads and rail.
6. Basic viewshed and line-of-sight.
7. Cut/fill estimate after the vertical workflow is validated.
8. Wind, daylight, microclimate, operational energy, and carbon only after methods and compute requirements are agreed.

### Feasibility model

- Object type, construction system, area, floors, capacity, unit cost, parking demand, water demand, electricity demand, and expected users.
- Road, building, landscape, utility, earthwork, and contingency cost groups.
- Quantity takeoff with editable rate tables.
- Cost per plot, unit, square metre, and resident.
- Low/base/high assumptions instead of one false-precision number.

### Deliverables

- Analysis launcher and progress states.
- Map overlays and result legends.
- Cost and quantity dashboard.
- Assumption editor and comparison charts.

### Acceptance gate

- Results state their method, data source, time/date, units, and limitations.
- Changing geometry invalidates stale dependent results.
- Scenario comparison includes environmental and cost ranges.

---

## Phase 8 — Reports and interoperability

**Estimated range:** 5–8 weeks

### Goal

Move project data cleanly between Sitecraft, GIS, CAD/BIM, stakeholders, and approval workflows.

### Export order

1. Professional PDF master-plan report.
2. CSV/XLSX schedules and metric tables.
3. Complete GeoJSON and KML/KMZ.
4. GLB/GLTF 3D scene export.
5. DXF exchange for roads, plots, boundaries, and building footprints.
6. CityJSON.
7. IFC/BIM exchange after a mapping specification is approved.

### Import order

1. CSV coordinates and KML/KMZ.
2. Shapefile and GeoPackage through backend GDAL processing.
3. GeoTIFF and drone orthophotos.
4. DXF.
5. IFC/OBJ/GLB with georeferencing workflow.
6. Point clouds only after storage, tiling, and performance requirements are defined.

### Deliverables

- Import mapping wizard with CRS selection and preview.
- Export centre with templates.
- PDF plan package with screenshots, legend, metrics, warnings, sources, and assumptions.
- Quantity and asset schedules.

### Acceptance gate

- Every spatial import requires or detects a CRS and shows a placement preview.
- Round-trip tests preserve geometry within documented tolerance.
- Reports match the selected saved scenario and revision.

---

## Phase 9 — Collaboration, presentation, and asset platform

**Estimated range:** 7–10 weeks

### Goal

Support professional teams, stakeholder review, reusable content, and controlled publishing.

### Collaboration

- Authentication and organisation/workspace membership.
- Owner, editor, reviewer, and viewer roles.
- Project comments pinned to map coordinates or objects.
- Markup shapes and review status.
- Immutable project revisions, version history, compare, and restore.
- Shareable read-only links with expiry and revocation.
- Approval workflow and audit log.

### Presentation

- Saved camera views.
- Guided 3D tour.
- Before/after slider.
- Presentation mode with selected metrics and analysis layers.
- Day/night controls.
- Screenshot and recorded-tour export.

### Asset platform

- Searchable catalogue with categories, tags, thumbnails, dimensions, capacity, planning metadata, cost ranges, source, licence, and variants.
- Low/medium/high level-of-detail models and GPU instancing.
- Residential, commercial, industrial, transport, utility, landscape, safety, and accessibility packs.
- Native New Zealand planting palette.
- Organisation asset libraries and approved presets.

### Deliverables

- Secure shared projects.
- Review and approval tools.
- Presentation builder.
- Versioned asset catalogue and ingestion pipeline.

### Acceptance gate

- Permissions are enforced by the API, not only hidden in the UI.
- Every restored revision opens as the exact saved geometry and map context.
- Asset licences and sources remain attached to exported reports and projects.

---

## Cross-phase engineering rules

- Use NZTM2000 for metric work and WGS84 longitude/latitude for exchange.
- Never mix conceptual ellipsoid heights with terrain or engineering elevations without an explicit transform.
- Use web workers for interactive geometry calculations and backend jobs for heavy spatial/raster work.
- Generated content, imports, and manual objects use the same object/rule/metric pipeline.
- Every calculation has a version so old results can be identified after formulas change.
- UI warnings must not claim statutory compliance, structural safety, or survey accuracy.
- Add automated unit, geometry, schema, API, migration, and end-to-end tests as each phase is implemented.
- Maintain `DESIGN.md` for every new panel, control, table, modal, and responsive state.

## Suggested technical modules

### Web

- `measurement/`
- `snapping/`
- `rules/`
- `scenarios/`
- `metrics/`
- `terrain/`
- `roads/`
- `subdivision/`
- `generation/`
- `analysis/`
- `reports/`
- `collaboration/`
- `assets/`

### API

- Rules and validation service.
- Scenario and revision service.
- Metric calculation service.
- Spatial context and suitability service.
- Generation job service.
- Environmental and feasibility analysis service.
- Import/export job service.
- Authentication, permissions, comments, and audit service.

### Infrastructure

- PostgreSQL/PostGIS.
- Object storage for assets, reports, rasters, and imports.
- Background queue and worker processes.
- Tile/asset CDN where required.
- Monitoring for API errors, job failures, storage, and analysis duration.

## Recommended first release boundary

The first professional release should stop after Phase 3 and include:

- Accurate measurements and snapping.
- Reusable planning rules and zoning.
- Setbacks and footprint collision checks.
- Scenario duplication and comparison.
- Live planning dashboard.
- Clear warnings, sources, units, and assumptions.

Do not start the full society generator before the rule engine, scenario model, metric engine, and site-constraint interfaces are stable. Otherwise generated layouts will look complete but will not be explainable, comparable, or reliably valid.

## Overall planning range

| Scope | Small-team planning range |
|---|---|
| Professional editor through Phase 3 | 14–21 weeks |
| Site intelligence through Phase 5 | 26–38 weeks total |
| Smart planner through Phase 6 | 34–50 weeks total |
| Full roadmap through Phase 9 | 53–78 weeks total |

Parallel specialists can shorten elapsed time, but the dependency order should remain: **stable data → precision tools → rules → scenarios/metrics → terrain/roads → generator → advanced analysis/delivery**.

