# Reliable Move to location navigation

Date: 2026-10-16
Status: Implemented locally after baseline commit cc967f6

## Problem

Cinematic city navigation fell back to a top-down camera. The 3D camera moved above a destination without aiming its view at the destination. Street landmark navigation used a fixed offset rather than a nearby project road. An older terrain request could also finish after a newer selection.

## Changes

- Keep the active 2D, 3D, Street or Cinematic mode when choosing a destination.
- Frame city bounds in metres, accounting for longitude scale at the destination latitude.
- In 3D and Cinematic, aim an oblique camera at the destination instead of applying a top-down rectangle view.
- Approach site landmarks from the nearest suitable project road when one is nearby. Face the landmark at walking height above that road.
- Fall back to an offset approach when there is no nearby project road. This does not verify real-world road access.
- Use a zero-height surface in flat mode. Ignore misleading coarse globe height readings while flat tiles load.
- Sample actual terrain when terrain is configured.
- Ignore superseded terrain results. Keyboard exploration also cancels a pending camera request.
- Frame all site boundaries for Current project, rather than only the first boundary.

## Verification

47 unit tests passed. Browser checks covered a school, a site and a city through the actual dropdown in all four modes. API tests for the committed baseline also passed.

Choosing a city does not fetch a real-world street network. Street approaches for society landmarks use roads stored in the project.
