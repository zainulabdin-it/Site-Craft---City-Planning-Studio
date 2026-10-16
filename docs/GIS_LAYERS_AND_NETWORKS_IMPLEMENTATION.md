# GIS layers and connected infrastructure

Branch: `codex/gis-layers-and-utility-networks`
Started: 2026-10-16

## Delivery order

| Phase | Work | Status |
|---|---|---|
| 1A | Shared layer controls and display presentation | Implemented; see verified scope below |
| 1B | Custom layer membership, building subcategories, additional style controls and individual object locks | Pending |
| 2 | Source nodes, distribution nodes, consumer meters and explicit network connections | Pending |
| 3 | Small water demonstration: source, tank, pump, branches and house demand | Pending |
| 4 | Small electricity demonstration: incoming supply, transformer, cables and house loads | Pending |
| 5 | Sewerage, stormwater, gas and fibre network rules and outlets | Pending; basic corridor types already supported |
| 6 | Physical depths, underground/section views, terrain and hazard source integration, clash checks | Pending |
| 7 | Failure isolation, affected consumers, capacity summaries and network reports | Pending |

## Verified scope of the first chunk

- Existing data, proposed design, utility networks and analysis/hazard groups.
- Visibility, opacity, expand/collapse and protected geometry editing.
- Proposed layer ordering and shortcuts to the filtered Design Objects list.
- Six independently controlled corridor categories: water, sewerage, stormwater, electricity, gas and telecom.
- Background imagery visibility and opacity.
- Imported GIS data visibility/opacity and protected removal. Existing advanced reference style/hazard controls remain available.
- Per-layer display offsets and an exploded spacing view in 3D, Street and Cinematic modes.
- 2D retains geographically aligned footprints; layer visibility, opacity and locks remain shared across modes.
- Assemble restores display offsets. Stored coordinates, physical elevations and network connections do not change when presentation changes.
- Moving/resizing displayed, separated geometry requires assembling its layer first. Numeric object properties remain actual design values.
- Save/load retains settings. Existing version 1–4 projects migrate or receive safe defaults. The API accepts the new layer settings.

Layer locks protect affected design objects, shared road edits, deletion and history operations. Utility locks protect corridor changes. Imported references are locked by default; unlocking permits removal, not source-geometry editing. Individual object locks are separate pending work.

## Limits that must stay visible

Empty utility layers are available controls, not invented infrastructure. Current corridors are conceptual alignments with existing distance-based consumer lists. They are not yet explicit tank-to-house or transformer-to-meter networks.

Terrain, slope, land ownership and hazards need actual source datasets. A missing source must stay unavailable/unknown. Layer spacing is a visual inspection aid and must never be used as a pipe depth or an elevation survey.

## Next acceptance demonstration

Use a separate small test site with ten houses, a water tank/pump and a transformer. Each house should trace to a source. Disconnect a branch, disable a source, check affected consumers, and save/reload the network. Preserve the existing society projects.

Full pressure/flow, sewer gradients and electrical design checks require suitable input data and engineering models. Connectivity alone must never be reported as sufficient supply or design approval.
