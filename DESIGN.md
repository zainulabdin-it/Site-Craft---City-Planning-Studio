# Sitecraft Design System

This document is the visual source of truth for future UI changes.

## Layout

- The map is the primary work surface and must receive the majority of the viewport.
- The left Layers panel is open by default and uses about 28vw, with a minimum width of 300px.
- The right Inspector is independently collapsible and uses about 220px when open.
- Browser, Layers, Tools, and Inspector rails are full-height, aligned to the workspace edges, and never overlap content.
- Collapsed rails retain a solid background, an icon, and a readable vertical label.
- The map header, view controls, tool palette, and coordinate/status bar must remain visible above map imagery.

## Typography

- Use the existing DM Sans body font and Manrope for prominent headings.
- Body text: 13px minimum.
- Panel labels and navigation: 12px.
- Eyebrow labels: 9–10px, uppercase, letter spacing 1.5px.
- Coordinate/status text: 11px monospace.
- Keep text high contrast and avoid tiny labels that require zooming.

## Color

- Primary blue: `#2563eb`.
- Active blue: `#1d4ed8`.
- Pale blue surface: `#eff5ff`.
- Active surface: `#e8f0ff`.
- Text: `#172b4d`; rail icons and labels: `#111827`.
- Borders: `#cbdcfb` or `#dce3df`.
- Reserve red for errors and destructive actions.

## Controls

- Every visible control must perform a real action or be removed.
- Tool buttons use a consistent 48px hit area and clear active state.
- Panel collapse controls sit in the panel header without covering its label.
- 2D, 3D, fullscreen, compass, globe, and zoom controls stay inside the map area and above the imagery.
- Coordinate, zoom, eye altitude, bearing, pitch, and diagnostics remain visible in the bottom status bar.

## Interaction

- Move mode stays active until the user chooses Select or another tool.
- Layer visibility, opacity, and order controls update the map immediately.
- Search, save/open, drawing, selection, movement, undo, and redo must remain functional after layout changes.
