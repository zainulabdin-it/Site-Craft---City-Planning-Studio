# Sitecraft Product and Planning Architecture

## Product purpose

Sitecraft is a spatial concept-design studio for planning a site in its real geographic context. It should let a user move from a location and boundary to a legible neighborhood proposal without requiring specialist CAD or GIS knowledge.

The product combines two kinds of information:

- **Context data** explains what already exists: maps, parcels, terrain, roads, waterways, planning zones, hazards, imagery, and imported GeoJSON layers.
- **Design objects** describe what the user proposes: site boundary, plots, roads, buildings, trees, vehicles, benches, and bridges.

Context data informs decisions. Design objects are editable, saved, compared, and presented as a proposal.

## Example design scenario

The reference project is a compact mixed-use neighborhood within a 10.8-hectare site. It includes every object currently available in Sitecraft.

### Spatial structure

1. **Site boundary** — defines the design canvas and total intervention area.
2. **Roads** — one east-west avenue forms the main address; a southern connection provides site access and creates a connected junction.
3. **Plots** — development parcels organize land ownership, setbacks, and building placement.
4. **Buildings** — houses, townhouses, apartments, and commercial buildings create the built form. Width, depth, floors, floor height, rotation, façade color, and roof form remain editable.
5. **Trees** — native canopy trees form shade corridors along streets and public spaces. Palm and columnar variants allow different landscape characters.
6. **Cars** — sedan, SUV, and van objects test parking, access, turning space, and street scale.
7. **Benches** — timber, modern, and stone seating objects define resting places and public-space use.
8. **Bridge** — beam, arch, or pedestrian bridge variants connect across a waterway, grade change, or protected landscape corridor.
9. **Rectangle, circle, polygon, and free-style shapes** — create plazas, lawns, play areas, building pads, water features, landscape zones, and other concept areas using plot geometry.
10. **Imported data layers** — GeoJSON parcels, zoning, hazards, existing trees, utilities, or survey information provide evidence for the proposal.

## How a user designs a project

### 1. Establish context

The user searches for a New Zealand location. Sitecraft moves the camera without discarding the existing proposal. The user can return to the saved project boundary at any time.

The user imports relevant GeoJSON layers such as:

- cadastral parcels;
- district-plan zones;
- flood or coastal-hazard areas;
- existing roads and paths;
- waterways;
- protected vegetation;
- survey or asset data.

Each context layer has visibility, opacity, color, and delete controls. Layer settings remain in the project file.

### 2. Define the design canvas

The user draws the Site Boundary around the study area. Sitecraft frames that boundary and treats it as the editable design canvas. The boundary is conceptual unless it comes from an authoritative imported parcel layer.

The user checks:

- total site area;
- access points;
- important edges;
- waterways and hazards;
- neighboring streets and buildings;
- north orientation and likely sunlight direction.

### 3. Organize land

The user draws Plots or uses Rectangle, Circle, and Free style tools to divide the site into functional areas.

Typical areas include:

- residential parcels;
- mixed-use or commercial frontage;
- civic or community space;
- parks and planted buffers;
- stormwater areas;
- parking and servicing;
- pedestrian plazas;
- future-development land.

### 4. Build the movement network

The user draws the primary road first, followed by secondary streets and connections. Snapping creates shared road nodes for connected T and X junctions.

The network should be designed in this order:

1. external connections;
2. public-transport and emergency routes;
3. primary streets;
4. local streets;
5. pedestrian and cycling links;
6. service and parking access.

Cars are placed after roads to test scale and access rather than define the network.

### 5. Place built form

The user places buildings within plots and adjusts:

- building type;
- footprint width and depth;
- orientation;
- floor count and floor height;
- flat or pitched roof;
- façade color;
- exact local coordinates.

Buildings should be placed to create street edges, courtyards, view corridors, usable private space, and appropriate relationships with neighboring buildings.

### 6. Design landscape and public space

Trees establish shade, wind protection, ecological corridors, and visual structure. Benches identify where people can stop, meet, and observe activity. Free-style shapes represent lawns, rain gardens, playgrounds, plazas, or planting beds.

The landscape sequence should connect building entrances, streets, parks, and bridges rather than treat trees and benches as isolated decoration.

### 7. Test movement and connections

Cars test parking bays, drop-off areas, driveways, and lane proportions. Bridges test connections across waterways or landscape corridors. The user moves and rotates objects while Move mode remains active for repeated adjustment.

### 8. Review the proposal

The user reviews in both top-down and perspective views:

- land-use organization;
- road connectivity;
- building spacing and height;
- public-space distribution;
- landscape coverage;
- access and circulation;
- relationship to imported constraints;
- visibility and opacity of every layer.

The user then saves the complete project JSON and exports GeoJSON for exchange with GIS tools.

## Object hierarchy

| Level | Objects | Purpose |
| --- | --- | --- |
| Project | Origin, scenario, view state | Geographic and design context |
| Context layers | Imported vector data, basemaps | Existing conditions and constraints |
| Site structure | Boundary, plots, free-style shapes | Study area and land organization |
| Networks | Roads, bridges | Access, movement, and connectivity |
| Built form | Buildings | Density, height, frontage, and use |
| Landscape | Trees | Shade, ecology, buffering, and identity |
| Street life | Benches, cars | Human use, parking, access, and scale |

## Current object behavior

Every design object should support the relevant subset of:

- select;
- move;
- duplicate;
- delete;
- rotate;
- scale;
- change shape or variant;
- change dimensions;
- edit color or appearance;
- edit coordinates or vertices;
- control layer visibility and opacity;
- undo and redo;
- save, open, and export.

Objects must never become decorative toolbar buttons. If a tool is visible, its placement and editing workflow must work.

## Missing objects recommended for architecture

### High priority

1. **Doors and entrances** — identify public, private, service, and accessible entries.
2. **Windows and façade openings** — support architectural massing and elevation studies.
3. **Walls, fences, and retaining walls** — define privacy, edges, level changes, and security.
4. **Stairs and ramps** — represent vertical circulation and accessible routes.
5. **Footpaths and cycleways** — separate active travel from vehicle roads.
6. **Parking spaces and parking rows** — test capacity and geometry instead of using loose car objects.
7. **Streetlights** — test public-realm spacing and nighttime infrastructure.
8. **Water and stormwater areas** — ponds, swales, rain gardens, channels, and detention basins.
9. **Terrain and grading surfaces** — create pads, slopes, contours, cut, and fill concepts.
10. **Text labels and dimensions** — communicate names, distances, setbacks, heights, and design intent.

### City-planning priority

1. **Land-use zones** — residential, commercial, industrial, civic, open space, and mixed use.
2. **Setback and height envelopes** — visualize planning-rule limits around plots.
3. **Bus stops and transit stations** — organize access and walkability.
4. **Crossings and intersections** — pedestrian crossings, traffic islands, roundabouts, and signals.
5. **Utilities** — water, wastewater, stormwater, electricity, telecommunications, and easements.
6. **Waste and servicing areas** — bins, loading, delivery, and emergency access.
7. **Playgrounds and sports facilities** — represent community recreation.
8. **Street furniture** — bollards, bins, bicycle racks, signs, shelters, and planters.
9. **Existing/proposed status** — distinguish retained, removed, temporary, and proposed objects.
10. **Development phases** — organize construction or delivery stages over time.

### Advanced analysis objects

1. **Sun and shadow study controls**.
2. **View corridors and protected sightlines**.
3. **Noise and air-quality buffers**.
4. **Flood levels and minimum floor levels**.
5. **Fire access and turning templates**.
6. **Walking-distance and service-area zones**.
7. **Tree-canopy coverage and permeable-surface targets**.
8. **Density, floor-area ratio, site coverage, and parking calculations**.

## Recommended implementation order

### Object pack 1 — Complete public realm

- footpath;
- cycleway;
- crossing;
- streetlight;
- bin;
- bicycle rack;
- planter;
- text label.

### Object pack 2 — Architectural site design

- wall and fence;
- retaining wall;
- stairs;
- accessible ramp;
- parking bay and parking row;
- entrance marker;
- water and planting areas;
- dimension line.

### Object pack 3 — Planning controls

- land-use zone;
- setback envelope;
- height envelope;
- easement;
- hazard buffer;
- existing/proposed/demolish status;
- development phase.

### Object pack 4 — Infrastructure and analysis

- utility lines and nodes;
- transit stops;
- emergency access templates;
- terrain and grading;
- sun/shadow analysis;
- stormwater calculations;
- density and coverage dashboard.

## Design-quality checks

Before a proposal is considered ready for presentation, Sitecraft should eventually report:

- objects outside the site boundary;
- buildings outside their plots;
- disconnected roads or paths;
- inaccessible plots or entrances;
- overlapping buildings;
- insufficient road, path, or bridge clearance;
- missing pedestrian connections;
- parking count and accessible parking;
- site coverage and floor-area ratio;
- tree-canopy and permeable-area percentages;
- objects placed inside hazard or setback layers;
- missing names, classifications, or phases.

These checks should be advisory during concept design. Engineering, surveying, cadastral, planning, accessibility, and building-code compliance still require authoritative data and qualified review.
