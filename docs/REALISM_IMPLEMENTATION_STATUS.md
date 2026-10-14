# Realism implementation status

## Completed foundation

- Default 2D planning view with map-blended buildings, roads, curbs, and sidewalks.
- Walk, 360 look, Street, perspective, and Drone navigation profiles.
- Location-aware terrain endpoint support with a flat fallback when elevation is unavailable.
- Terrain-relative polygons, road surfaces, and glTF models.
- Natural tree color variation without adding expensive per-tree geometry.
- Modern facility facades with separated glass panels, entrances, and canopies.
- Recognizable mosque, church, temple, gurdwara, gazebo, security gate, water tank, and utility forms.
- Parking, cars, streetlights, traffic signals, benches, bins, bollards, and planters.
- Main park, playground, sports fields, fountain, graveyard, and family theme park.
- Distance-based detail limits and disabled editor shadows for responsive navigation.

## Asset policy

Only redistributable free assets may be bundled. Current glTF vehicles, houses, and trees use the existing CC0 Kenney set. Higher-detail replacements must follow `FREE_ASSET_PIPELINE.md` and be compressed before shipping.

## Known limit

The included demo uses lightweight geometry so it can run locally without a paid service or dedicated GPU. Photoreal output requires optimized PBR models and a configured real elevation source; the editor now supports that pipeline without inventing mountains on flat sites.
