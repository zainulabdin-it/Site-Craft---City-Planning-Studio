# Sitecraft free asset pipeline

Sitecraft only ships assets that allow free redistribution. Every imported model must keep its source, author, license, and any required attribution in `THIRD_PARTY_NOTICES.md`.

## Approved sources

- Poly Haven — CC0 models, PBR textures, and HDRIs.
- ambientCG — CC0 PBR materials.
- Quaternius — CC0 model packs; confirm the license on the selected pack page.
- Kenney — CC0 model packs already used by the prototype.
- OpenStreetMap — map data and imagery with attribution.

## Web model rules

- Use glTF or GLB.
- Keep one normal map and one packed material map where possible.
- Use 1K textures for common objects; use 2K only for hero buildings.
- Add close, medium, and far detail levels for trees and large buildings.
- Compress mesh geometry and textures before adding a model to the app.
- Do not ship a raw model larger than 8 MB without a reviewed performance reason.
- Test the model in 2D, 3D, Street, Walk, 360, and Drone views.

## Terrain rule

Mountains and slopes must come from real elevation data for the selected location. Sitecraft must not place decorative mountains on flat land. When no elevation provider is configured, the map stays flat and clearly reports that fallback.

## Delivery order

1. Trees, ground materials, roads, curbs, and street furniture.
2. Modern homes, apartments, shops, mosque, church, school, and hospital.
3. Cars, gates, parking, playground, sports field, cemetery, and utilities.
4. Terrain-aware placement, detail levels, performance tuning, and final walkthrough scenes.
