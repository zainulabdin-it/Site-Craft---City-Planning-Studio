# Layer workspace foundation

Date: 2026-10-16
Status: First implementation chunk complete; connected supply networks remain pending.

The application now groups reference data, proposed design, utility networks and hazards. Shared controls cover visibility, opacity, locks and display height. Exploded layers can be separated for visual inspection without changing their saved coordinates.

Gas is now a supported concept corridor category alongside water, sewerage, stormwater, electricity and telecom. This does not add a physical gas supply or a tank/transformer network automatically.

Old project files receive defaults. Layer presentation is saved in project files and supported by the API. Tests check migration, lock protection, unchanged design coordinates and reversible rendering offsets. Browser checks cover the actual Cesium view.

The full staged scope and remaining work are tracked in [the implementation plan](../docs/GIS_LAYERS_AND_NETWORKS_IMPLEMENTATION.md).
