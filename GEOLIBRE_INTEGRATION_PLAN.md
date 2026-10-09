# GeoLibre Feature Integration Plan

## Goal

Bring selected GeoLibre capabilities into Sitecraft while preserving Sitecraft's city-design workflow, Cesium 3D editor, portable project files, New Zealand search, and current interaction model.

GeoLibre is a reference implementation and an optional source of MIT-licensed code. Sitecraft will not become a copy of GeoLibre. Every imported feature must serve planning and design work, use Sitecraft's design system, and be functional before it appears in the interface.

## Rules

1. Follow `DESIGN.md` for layout, typography, color, controls, and interaction.
2. Keep the map as the primary workspace.
3. Add only functional controls.
4. Preserve existing project files through explicit schema migrations.
5. Keep Cesium as the authoritative 3D editor until the shared map-engine interface is complete.
6. Prefer adapting concepts and small isolated modules over copying GeoLibre application components.
7. Record copied or substantially adapted GeoLibre code in `THIRD_PARTY_NOTICES.md`, including its MIT copyright and source path.
8. Review licenses of GeoLibre dependencies separately. GeoLibre's MIT license does not replace dependency licenses or service terms.

## Target Architecture

### Project model

Extend the Sitecraft project into four collections:

- `designObjects`: parametric buildings, roads, plots, trees, vehicles, benches, and bridges.
- `dataLayers`: imported vector, raster, and tiled datasets.
- `layerGroups`: ordering, visibility, opacity, styling, and group membership.
- `viewState`: camera, active basemap, rendering engine, and comparison layout.

Move from schema version 1 to version 2 with a migration that maps the current `objects` array into `designObjects`. Opening old projects must remain automatic and lossless.

### Services

- `importers/`: GeoJSON first, followed by CSV, KML, GPX, and zipped Shapefile.
- `layers/`: layer store, groups, ordering, styling, filtering, and selection.
- `engines/`: a shared adapter implemented first by Cesium and later by MapLibre.
- `measurements/`: distance, area, bearing, coordinates, and clear-results actions.
- `tables/`: feature properties, selection synchronization, filtering, and export.
- `processing/`: small browser-side vector operations before any large WASM toolbox.

## Delivery Phases

### Phase 0 — Licensing and test baseline

- Add `THIRD_PARTY_NOTICES.md` with GeoLibre MIT attribution before copying source.
- Record the exact GeoLibre commit and source files used for every adaptation.
- Add tests for loading the current schema and a saved demo project.
- Capture the current build, unit-test, and editor interaction baseline.

Acceptance:

- Existing projects still open.
- Current tests and production build pass.
- Attribution is included when required.

### Phase 1 — Layer foundation

- Introduce `DataLayer`, `LayerGroup`, and `LayerStyle` types.
- Replace the current kind-only layer state with persistent project layer records.
- Support group collapse, visibility, opacity, ordering, rename, duplicate, delete, zoom-to-layer, and layer metadata.
- Keep current design-object layers populated automatically.
- Persist layer state in project JSON.

Acceptance:

- Every layer control immediately affects Cesium.
- Layer state survives save, close, and reopen.
- Undo/redo covers layer changes that alter project data.

### Phase 2 — Real data import

- Add drag-and-drop and file-picker import.
- Implement GeoJSON FeatureCollection, Feature, Point, LineString, Polygon, and MultiPolygon support.
- Reproject supported coordinates into the project context.
- Validate file type, size, geometry, and coordinate ranges before changing the project.
- Show import progress and useful errors.
- Add CSV import for latitude/longitude columns after GeoJSON is stable.

Acceptance:

- Imported files appear as named layers.
- Attributes are preserved.
- Invalid files do not partially modify the project.
- Imported layers round-trip through project save/open.

### Phase 3 — Measurements and drawing

- Add distance, polygon area, bearing, coordinate inspection, rectangle, circle, free-style polygon, and text annotation tools.
- Keep transient measurements separate from saved design objects unless the user chooses Save measurement.
- Add vertex handles, insert/delete vertex, snapping, and finish/cancel states.
- Show live measurement values beside the cursor and in the bottom status bar.

Acceptance:

- Measurements agree with Cesium geodesic calculations within documented tolerances.
- Escape cancels safely.
- Undo/redo works for saved geometry.
- Tools do not interfere with object movement or camera navigation.

### Phase 4 — Attribute table

- Add a collapsible bottom panel for the active data layer.
- Support sortable columns, text/number filters, row selection, zoom-to-feature, multi-select, and CSV export.
- Synchronize table selection with map selection in both directions.
- Virtualize rows so large layers do not freeze the interface.

Acceptance:

- Selecting a row highlights the map feature.
- Selecting a map feature scrolls to its row.
- Filtering changes only the displayed feature set, not stored source data.

### Phase 5 — Basemaps and imagery

- Add a functional basemap selector with OpenStreetMap and configured URL-template sources.
- Support one active basemap plus optional overlays.
- Store attribution, minimum/maximum zoom, availability, and credentials per source.
- Add brightness, contrast, saturation, and opacity controls only where Cesium supports them reliably.
- Never ship provider credentials in source control.

Acceptance:

- Source attribution is visible.
- Offline or failed tiles do not block editing.
- Switching basemaps preserves camera and project state.

### Phase 6 — MapLibre 2D engine

- Define an `EngineAdapter` interface for camera, layers, selection, drawing, screenshots, and lifecycle.
- Refactor current Cesium behavior behind `CesiumEngineAdapter`.
- Implement `MapLibreEngineAdapter` for 2D vector and raster layers.
- Keep unsupported parametric 3D objects clearly identified in 2D rather than silently dropped.
- Synchronize camera center, zoom/height, bearing, selection, and layer visibility when switching engines.

Acceptance:

- The engine selector contains only working engines.
- Switching engines does not duplicate or lose project data.
- Returning to Cesium restores the 3D design state and camera context.

### Phase 7 — Comparison and processing

- Add synchronized split-map comparison after both engines are stable.
- Start processing with buffer, dissolve, clip, intersect, centroid, simplify, and geometry validation.
- Run expensive work in Web Workers.
- Evaluate GeoLibre's WASM processing integration separately before adding a large toolbox.

Acceptance:

- Processing never blocks the editor UI.
- Operations create new result layers and preserve their provenance.
- Failures leave source layers unchanged.

### Phase 8 — Plugin boundary

- Define a small internal plugin contract for tools, importers, panels, and layer actions.
- Require explicit permissions for network and file operations.
- Add plugin discovery only after the internal API is stable.

Acceptance:

- Core features use the same extension points offered to plugins.
- A failing plugin cannot prevent the editor from loading.

## Recommended First Milestone

Deliver Phases 0–2 together as the first reviewable milestone:

1. Licensing and schema migration.
2. Persistent layer groups and styling.
3. GeoJSON import with attributes.
4. Save/open round-trip tests.

This creates the shared data foundation required by measurements, attribute tables, basemaps, MapLibre, processing, and plugins. Implementing later features before this foundation would duplicate state and make project compatibility difficult.

## Verification for Every Phase

- Run unit tests and the production build.
- Add focused tests for parsers, schema migrations, and geometry operations.
- Verify the feature in the running editor at common desktop widths.
- Check collapsed/open panels, 2D/3D controls, opacity, selection, movement, undo/redo, save/open, and project export.
- Confirm there are no decorative or non-functional controls.
- Update `README.md`, `DESIGN.md`, and `THIRD_PARTY_NOTICES.md` when behavior or attribution changes.

## Git Strategy

- Keep each phase in reviewable commits.
- Separate license/attribution, schema migration, feature implementation, and UI polish when practical.
- Do not mix unrelated redesign work into integration commits.
- Push only when requested.
