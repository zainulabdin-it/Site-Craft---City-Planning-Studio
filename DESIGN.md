# Sitecraft Design System

This document is the visual source of truth for future UI changes.

## Layout

- The map is the primary work surface and must receive the majority of the viewport.
- The left Layers panel is open by default and uses about 25vw, between 360px and 480px on wide screens.
- The right Inspector is independently collapsible and uses about 360px when open.
- Browser, Layers, Tools, and Inspector rails are full-height, aligned to the workspace edges, and never overlap content.
- Collapsed rails retain a solid background, an icon, and a readable vertical label.
- The map header, view controls, tool palette, and coordinate/status bar must remain visible above map imagery.

## Typography

- Use Inter throughout the interface, with Segoe UI as the local fallback.
- Main navigation: 14px, semibold.
- Body, controls, lists, and inspector fields: 13px minimum.
- Panel section headings: 15px, bold.
- Eyebrow labels: 11px, uppercase, letter spacing about 1.35px.
- Coordinate/status text: 11px monospace.
- Use `#0f172a` for primary text and `#64748b` for secondary text.
- Keep text high contrast and avoid tiny labels that require zooming.

## Color

- Primary blue: `#2563eb`.
- Active blue: `#1d4ed8`.
- Pale blue surface: `#eff5ff`.
- Active surface: `#e8f0ff`.
- Text: `#0f172a`; rail icons and labels: `#111827`.
- Secondary text: `#64748b`.
- Borders: `#d8dee8`; selected borders may use `#bfdbfe`.
- Reserve red for errors and destructive actions.

## Controls

- Every visible control must perform a real action or be removed.
- Tool buttons use a consistent 48px hit area and clear active state.
- Panel collapse controls sit in the panel header without covering its label.
- 2D, 3D, Street, fullscreen, compass, globe, and zoom controls stay inside the map area and above the imagery.
- Coordinate, zoom, eye altitude, bearing, pitch, and diagnostics remain visible in the bottom status bar.

## Interaction

- Hand mode is a view-only mode: it clears editing handles and lets the user
  orbit, tilt, pan, and zoom the 3D site without selecting or changing objects.
- Move mode stays active until the user chooses Select or another tool.
- Layer visibility, opacity, and order controls update the map immediately.
- Search, save/open, drawing, selection, movement, undo, and redo must remain functional after layout changes.
