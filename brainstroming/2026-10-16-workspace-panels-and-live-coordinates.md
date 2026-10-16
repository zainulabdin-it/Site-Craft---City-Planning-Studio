# Clear workspace panels and live map coordinates

Date: 2026-10-16
Status: Implemented

## Problem

Project settings occupied too much of the Layers panel. Inspector mixed object properties, assets and utility controls. The small map status bar showed fixed coordinates and camera values. Two Inspector help messages used Roman Urdu.

## Changes

- The left header now shows the project name and compact New, Open, Open file and Frame controls.
- Save destination is in the Project menu. GeoJSON import/export are also in that menu.
- Inspector contains the selected object's properties and related zoning settings.
- Assets has its own panel for searching, choosing and importing assets.
- Utilities has its own panel with a road selector and service corridor controls.
- Warnings remains a separate panel for live issues and the planning report.
- All four panels are accessible from the right rail and the panel header.
- Help text in the application uses standard English.
- The larger status bar shows longitude and latitude under the pointer. Moving the pointer outside the map clears the reading.
- Camera altitude, bearing and pitch come from the actual camera. Fixed placeholder values were removed.
- Pointer and camera updates are limited in frequency to avoid unnecessary UI updates. On narrower layouts, coordinates take priority over secondary camera details.

## Verification

Production build and all 43 existing tests passed. Browser checks covered panel separation, road-specific utility creation, relocated project controls, English Inspector text and changing pointer coordinates.
