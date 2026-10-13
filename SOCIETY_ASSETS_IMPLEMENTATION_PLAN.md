# Society Assets and Custom Asset Upload - Implementation Plan

## 1. Goal

Extend Sitecraft from a neighbourhood concept tool into a practical society-planning studio.

The change has two parts:

1. Add ready-to-use society objects such as a mosque, school, clinic, shops, graveyard, streetlights and playground equipment.
2. Let a user import a custom 3D asset, preview it, place it on the map, edit it and save it with the project.

The first release will remain a concept-planning tool. It will not claim engineering, structural or legal approval.

## Implementation status

First vertical slice completed on 13 October 2026:

- shared custom-asset storage added with IndexedDB;
- `.glb` signature and 25 MB size validation added;
- Asset Library now includes a placeable Mosque;
- custom assets can be named, categorised and given real-world dimensions;
- imported models can be placed, selected, moved, rotated, resized, duplicated and deleted through the existing object workflow;
- browser reload restores custom asset files and project references;
- missing custom models fall back to editable building geometry;
- production build and all current unit tests pass.
- built-in society library expanded with faith, school, health, commercial,
  community, burial, emergency, street, recreation and utility objects;
- asset search and category filters added for the larger catalogue;
- graveyard rows, playground equipment, sports-field markings, streetlights,
  traffic signals and facility labels added to the 3D view.

Portable `.sitecraft` packages and the remaining society object packs are the next milestones.

## 2. Current Technical Base

The existing implementation uses:

- React 19 and TypeScript for the interface;
- Vite for development and production builds;
- Cesium 1.146 for the 2D, 3D and Street planning viewport;
- Zod for project-data validation;
- Vitest for unit tests;
- Playwright for end-to-end tests;
- browser storage, JSON computer files and the local API for project save/load;
- GLB models for the current houses, cars and trees.

The new work will extend the current `DesignObject`, `assetRef`, renderer, inspector and persistence flow rather than create a separate editor.

## 3. Object Scope

### Release 1 - Essential society pack

| Category | Objects | Main editable values |
| --- | --- | --- |
| Faith | Mosque, church, temple, gurdwara, multi-faith centre | Variant, width, depth, height, rotation, colours |
| Education | School, nursery, playground | Size, floors, colour, entrance direction |
| Health | Clinic, hospital, pharmacy | Size, floors, entrance direction, parking count |
| Commercial | Shop row, supermarket, office, restaurant | Variant, size, floors, colour, service access |
| Community | Community centre, library, security office | Variant, size and colour |
| Burial | Graveyard boundary, grave row, prayer shelter, entrance gate | Area, row direction, spacing and capacity |

### Release 2 - Streets and public space

- Footpath and cycle lane;
- streetlight, traffic light and road sign;
- zebra crossing, speed breaker, divider and roundabout;
- bus stop, bicycle rack, bin, planter and bollard;
- public toilet, gazebo, fountain and food kiosk;
- outdoor gym and sports/playground objects;
- wall, fence, gate, stairs and accessible ramp;
- parking bay and parking row.

### Release 3 - Utilities and services

- water tank and tube well;
- electric transformer and solar panel;
- drainage, sewer, water, power and telecom lines;
- garbage and recycling point;
- fire station, police station, ambulance, fire truck and service vehicle;
- emergency access and fire turning area.

## 4. Object Data Design

Add an asset catalogue that is separate from placed project objects.

```ts
type AssetSource = "builtin" | "custom";

type AssetCategory =
  | "faith"
  | "education"
  | "health"
  | "commercial"
  | "community"
  | "burial"
  | "street"
  | "recreation"
  | "utility"
  | "emergency"
  | "custom";

type AssetDefinition = {
  id: string;
  name: string;
  category: AssetCategory;
  source: AssetSource;
  modelUrl: string;
  previewUrl?: string;
  defaultWidth: number;
  defaultDepth: number;
  defaultHeight: number;
  defaultScale: number;
  groundOffset: number;
  license?: {
    name: string;
    author?: string;
    sourceUrl?: string;
  };
};
```

Each placed object keeps its own coordinates, scale, width, depth, height, rotation, elevation and colour overrides. Many objects can therefore use one model without copying the model file.

Add a project schema version and migration. Old saved projects must still open with the same location and appearance.

## 5. Custom Asset Upload Workflow

### User flow

1. User opens **Asset Library**.
2. User selects **Import 3D Asset**.
3. User chooses a `.glb` file. `.gltf` support can follow after bundled-resource handling is complete.
4. Sitecraft validates the file and shows a preview.
5. User enters a name, selects a category and confirms the real-world size.
6. User clicks **Add to Library**.
7. User selects the new asset and clicks the map to place it.
8. Inspector controls allow move, rotate, resize, elevation, duplicate and delete.
9. Save/open restores both the project and its custom assets.

### First-release file rules

- Accept `.glb` first because it stores the model and textures in one file.
- Recommended maximum file size: 25 MB.
- Reject executable, HTML, script and unknown file types.
- Read the file locally; do not upload it to an external server.
- Show a clear error for invalid, empty or unsupported models.
- Warn when polygon count, texture size or memory use is too high.
- Require asset name, category, dimensions and a license/source note when the model is not made by the user.

### Storage approach

- Store custom asset blobs in IndexedDB.
- Store asset metadata and references in the project JSON.
- For **Save to computer**, export one `.sitecraft` package containing `project.json`, asset files and metadata.
- During the transition, continue reading the existing plain JSON project format.
- When a project package is opened, resolve assets before rendering the project.
- If an asset is missing, show a placeholder and keep its position and settings.

## 6. Interface Changes

### Asset Library

Add category tabs and search:

- All;
- Buildings;
- Faith;
- Education;
- Health;
- Shops;
- Streets;
- Parks;
- Utilities;
- Emergency;
- My Assets.

Each card shows a preview, name and source. Built-in and custom assets use the same placement behaviour.

### Import dialog

The dialog contains:

- file picker and drag-and-drop area;
- live 3D preview;
- asset name and category;
- width, depth and height in metres;
- rotation and ground offset;
- license/source fields;
- validation result;
- **Add to Library** button.

### Inspector

For a placed asset, show:

- coordinates;
- width, depth and height;
- scale lock;
- rotation;
- elevation/ground offset;
- colour or material choices when the model supports them;
- variant selector;
- replace asset;
- duplicate and delete.

All controls follow `DESIGN.md`: readable font sizes, blue active state, black text/icons and no overlap with the map.

## 7. Rendering Work

1. Create an asset registry that maps an `assetRef` to a model URL and defaults.
2. Replace hard-coded asset selection in `Viewport.tsx` with registry lookup.
3. Add a model cache so repeated trees, lights or cars share loaded resources.
4. Calculate a stable ground position and bounding size for every model.
5. Show a simple loading placeholder while a custom model is prepared.
6. Show a missing-asset placeholder rather than breaking the viewport.
7. Keep selection, hover coordinates, movement handles, rotation, scale, opacity and layer visibility working for new objects.
8. Apply distance-based visibility or detail reduction for large projects.

## 8. Smart Society Behaviour

After basic placement works, add optional helpers:

- Generate an entrance road from a building, mosque, school, park or clinic gate to the nearest road.
- Create parking rows beside commercial, faith, school and health buildings.
- Estimate graveyard capacity from area and row spacing.
- Show service-radius circles for schools, clinics, parks and places of worship.
- Warn when emergency access is missing.
- Warn when a building entrance has no footpath or road connection.
- Calculate object count, built area, green area, parking spaces and land-use percentage.

These helpers must suggest changes. The user remains able to move or delete the generated objects.

## 9. Development Phases

### Phase 0 - Foundation and decisions (1-2 days)

- Confirm asset licence rules and folder structure.
- Add schema versioning and migration tests.
- Define `AssetDefinition`, categories and registry API.
- Prepare one small sample GLB for each first-release category.

**Done when:** old projects load successfully and catalogue metadata is validated by Zod.

### Phase 1 - Built-in asset system (3-5 days)

- Implement the shared registry and model cache.
- Move existing house, car, tree and bridge mappings into the registry.
- Build searchable Asset Library categories.
- Add Mosque, School, Clinic and Shop Row as the first objects.
- Connect placement and Inspector editing.

**Done when:** every visible asset card places a working object that can be selected, moved, resized, rotated, duplicated, deleted, undone and saved.

### Phase 2 - Custom GLB import (4-6 days)

- Add file selection, validation and preview.
- Store custom models in IndexedDB.
- Add the My Assets category.
- Place and edit imported models.
- Add delete/replace rules for library assets already used in a project.

**Done when:** a user can import a valid GLB, place it more than once, reload the browser and see every copy in the same place.

### Phase 3 - Portable project package (3-5 days)

- Define the `.sitecraft` package format.
- Save project JSON, custom assets and metadata together.
- Add safe import, migration and missing-file handling.
- Keep existing JSON import compatibility.

**Done when:** a saved project can be moved to another computer and opens at the same coordinates with the same custom models.

### Phase 4 - Complete essential society pack (5-8 days)

- Add remaining faith, education, health, community, burial and commercial objects.
- Add footpaths, lights, crossings, parking rows and playground objects.
- Add model previews, sensible dimensions and variants.
- Add license details to the third-party notice file.

**Done when:** the demo project can show a complete small society without needing a custom model.

### Phase 5 - Smart layout helpers (5-8 days)

- Entrance-to-road connection;
- parking generation;
- service-radius display;
- access and capacity warnings;
- society summary calculations.

**Done when:** helpers create editable geometry and never overwrite existing user work without confirmation.

## 10. Suggested Code Structure

```text
apps/web/src/
  assets/
    assetTypes.ts
    assetRegistry.ts
    assetValidation.ts
    assetStorage.ts
    packageFormat.ts
  components/
    AssetLibrary.tsx
    AssetCard.tsx
    ImportAssetDialog.tsx
    AssetPreview.tsx
    AssetInspector.tsx
  society/
    accessConnections.ts
    parkingGenerator.ts
    serviceAreas.ts
    societyMetrics.ts
```

Likely existing files to update:

- `model.ts`: schema, object categories and migration;
- `Viewport.tsx`: registry-based Cesium model rendering;
- `App.tsx`: library, import dialog, placement and Inspector;
- `persistence.ts`: IndexedDB references and `.sitecraft` packages;
- `style.css`: responsive library and dialog styling;
- `geometry.ts`: custom asset bounds, handles and smart connections.

## 11. Testing Plan

### Unit tests

- asset metadata validation;
- old-project migration;
- size and scale calculations;
- package manifest parsing;
- missing asset handling;
- entrance-road and parking geometry.

### End-to-end tests

- search and place a built-in asset;
- import and preview a valid GLB;
- reject an invalid or oversized file;
- move, resize and rotate a custom asset;
- undo/redo, duplicate and delete;
- save, reload and confirm coordinates;
- export a project package and open it again;
- verify 2D, 3D and Street modes still work;
- confirm toolbar, map controls and panels do not overlap at supported screen sizes.

### Performance checks

- 100 repeated trees or lights;
- 25 custom assets;
- project package size and load time;
- memory after opening and closing several projects;
- viewport frame rate during pan, zoom and 360 view.

## 12. Licensing Rules

- Use only original, public-domain or clearly licensed assets.
- Record asset author, source URL and licence.
- Do not copy models or visual designs from commercial city-planning products.
- Add required attribution to `THIRD_PARTY_NOTICES.md`.
- Custom uploads remain the user's responsibility; show this plainly in the import dialog.

## 13. Recommended First Sprint

The first sprint should deliver a complete vertical slice:

1. Asset registry and schema migration;
2. Asset Library with category search;
3. one built-in Mosque model;
4. custom `.glb` import and preview;
5. map placement;
6. move, rotate and resize controls;
7. browser save/load through IndexedDB;
8. unit and Playwright coverage for this flow.

This slice proves the full system before many models are added. School, clinic, shops, graveyard and street objects can then use the same pipeline without rewriting the editor.

