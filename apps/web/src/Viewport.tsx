import { useEffect, useRef, useState } from "react";
import * as C from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  type Project,
  type Point,
  type Kind,
  type DesignObject,
} from "./model";
import { toGeo, toLocal, footprint, area, length } from "./geometry";
import { getCustomAssetUrlSync, hydrateCustomAssetUrls } from "./assetStorage";
export type ViewAction = {
  type:
    | "frame"
    | "top"
    | "perspective"
    | "street"
    | "location"
    | "zoom-in"
    | "zoom-out"
    | "rotate-left"
    | "rotate-right"
    | "tilt-up"
    | "tilt-down"
    | "move-forward"
    | "move-backward";
  id?: string;
  location?: {
    center: Point;
    bounds: [number, number, number, number];
  };
  seq: number;
};
interface Props {
  project: Project;
  visible: Record<Kind, boolean>;
  opacity: Record<Kind, number>;
  objectOpacity?: Record<string, number>;
  selected: string;
  draft: Point[];
  onClick: (p: Point, id?: string) => void;
  onMove: (id: string, p: Point) => void;
  onResize: (id: string, handle: number, p: Point) => void;
  onError: (s: string) => void;
  action: ViewAction;
  onContext: (s: string) => void;
  navigationMode: boolean;
  viewMode: "2d" | "3d" | "street";
}
export function Viewport(props: Props) {
  const [assetVersion, setAssetVersion] = useState(0);
  const container = useRef<HTMLDivElement>(null),
    viewer = useRef<C.Viewer | null>(null),
    latest = useRef(props),
    cache = useRef(new Map<string, DesignObject>()),
    opacityCache = useRef(new Map<string, number>()),
    modeCache = useRef("");
  latest.current = props;
  useEffect(() => {
    let active = true;
    const refresh = () =>
      hydrateCustomAssetUrls()
        .then(() => active && setAssetVersion((value) => value + 1))
        .catch((error) =>
          latest.current.onError(
            `Custom assets could not load: ${String(error)}`,
          ),
        );
    refresh();
    window.addEventListener("sitecraft-assets-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("sitecraft-assets-changed", refresh);
    };
  }, []);
  useEffect(() => {
    cache.current.clear();
  }, [assetVersion]);
  const roadKey = JSON.stringify([
    props.project.origin,
    props.project.objects.filter((o) => o.kind === "road"),
  ]);
  useEffect(() => {
    let v: C.Viewer;
    try {
      v = new C.Viewer(container.current!, {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        animation: false,
        timeline: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
        targetFrameRate: 30,
        shadows: true,
      });
    } catch (e) {
      props.onError(`3D viewport could not start: ${String(e)}`);
      return;
    }
    viewer.current = v;
    v.scene.shadowMap.softShadows = true;
    v.scene.backgroundColor = C.Color.fromCssColorString("#8dccf3");
    v.scene.highDynamicRange = true;
    v.scene.fog.enabled = true;
    v.scene.fog.density = 0.00018;
    v.scene.globe.baseColor = C.Color.fromCssColorString("#e2e8dd");
    v.scene.globe.depthTestAgainstTerrain = false;
    const provider = new C.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/",
      maximumLevel: 19,
    });
    // Background imagery is optional once the user is working on the opaque
    // site canvas. A missing high-zoom tile should not interrupt editing with
    // the same alert used for invalid design geometry.
    provider.errorEvent.addEventListener(() =>
      latest.current.onContext(
        "Some OpenStreetMap tiles unavailable · design canvas remains active",
      ),
    );
    v.imageryLayers.addImageryProvider(provider);
    latest.current.onContext(
      "OpenStreetMap · flat ellipsoid (no elevation data)",
    );
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (token) {
      C.Ion.defaultAccessToken = token;
      C.createWorldTerrainAsync()
        .then((t) => {
          if (!v.isDestroyed()) {
            v.terrainProvider = t;
            latest.current.onContext(
              "Cesium World Terrain · conceptual designs use ellipsoid offsets",
            );
            v.scene.requestRender();
          }
        })
        .catch(() =>
          latest.current.onError(
            "Terrain could not load. Flat ellipsoid fallback is active.",
          ),
        );
    }
    const imagery = import.meta.env.VITE_IMAGERY_URL;
    if (imagery) {
      v.imageryLayers.addImageryProvider(
        new C.UrlTemplateImageryProvider({
          url: imagery,
          credit: import.meta.env.VITE_IMAGERY_CREDIT || "Configured imagery",
        }),
      );
    }
    v.scene.renderError.addEventListener((_s, e) =>
      latest.current.onError(`Rendering error: ${String(e)}`),
    );
    v.camera.setView({
      destination: C.Cartesian3.fromDegrees(...props.project.origin, 850),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
    });
    const h = new C.ScreenSpaceEventHandler(v.canvas);
    const pickedIds = (position: C.Cartesian2) =>
      v.scene
        .drillPick(position)
        .map((hit) => hit?.id?.id)
        .filter((id): id is string => typeof id === "string");
    const objectAt = (position: C.Cartesian2) => {
      const ids = new Set(latest.current.project.objects.map((o) => o.id));
      for (const raw of pickedIds(position)) {
        const id = raw.replace(/:.*$/, "");
        if (ids.has(id)) return id;
      }
    };
    const groundAt = (position: C.Cartesian2) => {
      const ray = v.camera.getPickRay(position),
        hit = ray && v.scene.globe.pick(ray, v.scene);
      if (!hit) return;
      const c = C.Cartographic.fromCartesian(hit);
      return toLocal(
        [C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude)],
        latest.current.project.origin,
      );
    };
    h.setInputAction((e: { position: C.Cartesian2 }) => {
      if (latest.current.navigationMode) return;
      if (pickedIds(e.position).some((id) => id.startsWith("_handle:"))) return;
      const p = groundAt(e.position);
      if (p) latest.current.onClick(p, objectAt(e.position));
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    let drag:
      | { kind: "move"; id: string; start: C.Cartesian2; end: C.Cartesian2 }
      | {
          kind: "resize";
          id: string;
          handle: number;
          start: C.Cartesian2;
          end: C.Cartesian2;
        }
      | undefined;
    let hovered = "";
    h.setInputAction((e: { position: C.Cartesian2 }) => {
      if (latest.current.navigationMode) return;
      const handleRaw = pickedIds(e.position).find((id) =>
        id.startsWith("_handle:"),
      );
      if (handleRaw) {
        const [, id, index] = handleRaw.split(":");
        drag = {
          kind: "resize",
          id,
          handle: Number(index),
          start: C.Cartesian2.clone(e.position),
          end: C.Cartesian2.clone(e.position),
        };
        v.scene.screenSpaceCameraController.enableInputs = false;
        return;
      }
      const id = objectAt(e.position),
        object = latest.current.project.objects.find((o) => o.id === id);
      if (!id || object?.kind === "boundary") return;
      drag = {
        kind: "move",
        id,
        start: C.Cartesian2.clone(e.position),
        end: C.Cartesian2.clone(e.position),
      };
      v.scene.screenSpaceCameraController.enableInputs = false;
    }, C.ScreenSpaceEventType.LEFT_DOWN);
    h.setInputAction((e: { endPosition: C.Cartesian2 }) => {
      if (latest.current.navigationMode) {
        if (hovered) {
          hovered = "";
          v.entities.removeById("_hover");
          v.scene.requestRender();
        }
        return;
      }
      if (drag) {
        drag.end = C.Cartesian2.clone(e.endPosition);
        return;
      }
      const id = objectAt(e.endPosition);
      if (id === hovered) return;
      hovered = id || "";
      v.entities.removeById("_hover");
      const object = latest.current.project.objects.find((o) => o.id === id);
      if (!object) {
        v.scene.requestRender();
        return;
      }
      const [longitude, latitude] = toGeo(
          object.points[0],
          latest.current.project.origin,
        ),
        [east, north] = object.points[0],
        dimensions =
          object.kind === "road"
            ? `${length(object.points).toFixed(1)} m long · ${object.width.toFixed(1)} m wide`
            : ["boundary", "plot"].includes(object.kind)
              ? `${area(object.points).toFixed(0)} m² · ${object.points.length} points`
              : ["building", "bridge"].includes(object.kind)
                ? `${object.width.toFixed(1)} × ${object.depth.toFixed(1)} m`
                : `Scale ${object.scale.toFixed(1)}× · Rotation ${object.rotation.toFixed(0)}°`,
        height =
          object.kind === "building"
            ? object.floors * object.floorHeight + 5
            : 5;
      v.entities.add({
        id: "_hover",
        position: C.Cartesian3.fromDegrees(longitude, latitude, height),
        label: {
          text: `${object.name} · ${object.kind}\nLon ${longitude.toFixed(6)} · Lat ${latitude.toFixed(6)}\nE ${east.toFixed(1)} m · N ${north.toFixed(1)} m\n${dimensions}`,
          font: "600 13px DM Sans, sans-serif",
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.fromCssColorString("#0f172a"),
          outlineWidth: 2,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor:
            C.Color.fromCssColorString("#172554").withAlpha(0.94),
          backgroundPadding: new C.Cartesian2(10, 8),
          pixelOffset: new C.Cartesian2(0, -24),
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      v.scene.requestRender();
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
    h.setInputAction((e: { position: C.Cartesian2 }) => {
      if (!drag) return;
      const moved = C.Cartesian2.distance(drag.start, drag.end) > 4,
        p = moved ? groundAt(e.position) : undefined,
        current = drag;
      drag = undefined;
      v.scene.screenSpaceCameraController.enableInputs = true;
      if (!p) return;
      if (current.kind === "resize")
        latest.current.onResize(current.id, current.handle, p);
      else latest.current.onMove(current.id, p);
    }, C.ScreenSpaceEventType.LEFT_UP);
    v.screenSpaceEventHandler.removeInputAction(
      C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    return () => {
      v.scene.screenSpaceCameraController.enableInputs = true;
      h.destroy();
      v.destroy();
      viewer.current = null;
      cache.current.clear();
      opacityCache.current.clear();
    };
  }, []);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    const p = props.project;
    const is2D = props.viewMode === "2d";
    if (modeCache.current !== props.viewMode) {
      cache.current.clear();
      opacityCache.current.clear();
      modeCache.current = props.viewMode;
    }
    const objectOpacity = (object: DesignObject) =>
      props.opacity[object.kind] * (props.objectOpacity?.[object.id] ?? 1);
    const position = (xy: Point, z = 0) =>
      C.Cartesian3.fromDegrees(...toGeo(xy, p.origin), z);
    const polygon = (
      points: Point[],
      z: number,
      height: number,
      color: C.Color,
    ) => ({
      hierarchy: new C.PolygonHierarchy(points.map((q) => position(q))),
      height: z,
      extrudedHeight: z + height,
      material: color,
      outline: false,
    });
    const removeParts = (id: string) => {
      for (const part of [...v.entities.values])
        if (typeof part.id === "string" && part.id.startsWith(`${id}:`))
          v.entities.remove(part);
    };
    const model = (
      uri: string,
      scale: number,
      alpha: number,
      selected: boolean,
      minimumPixelSize: number,
      tint = C.Color.WHITE,
      tintAmount = 0.72,
    ) => ({
      uri,
      scale,
      minimumPixelSize,
      maximumScale: scale * 2.4,
      color: tint.withAlpha(alpha),
      colorBlendMode: C.ColorBlendMode.MIX,
      colorBlendAmount: tint.equals(C.Color.WHITE) ? 0 : tintAmount,
      imageBasedLightingFactor: new C.Cartesian2(1, 0.65),
      lightColor: C.Color.WHITE,
      silhouetteColor: selected
        ? C.Color.fromCssColorString("#f8b84b")
        : C.Color.TRANSPARENT,
      silhouetteSize: selected ? 3 : 0,
      shadows: C.ShadowMode.ENABLED,
    });
    const alive = new Set(p.objects.map((o) => o.id));
    for (const id of cache.current.keys())
      if (!alive.has(id)) {
        v.entities.removeById(id);
        removeParts(id);
        cache.current.delete(id);
      }
    for (const o of p.objects) {
      let entity = v.entities.getById(o.id);
      if (
        cache.current.get(o.id) !== o ||
        opacityCache.current.get(o.id) !== objectOpacity(o)
      ) {
        if (entity) v.entities.remove(entity);
        removeParts(o.id);
        const selected = o.id === props.selected;
        const color = C.Color.fromCssColorString(o.color);
        const variant = o.assetRef.split(":").at(-1) || "v1";
        const e: { id: string; [k: string]: unknown } = {
          id: o.id,
          name: o.name,
        };
        if (o.kind === "boundary" || o.kind === "plot") {
          const water =
            o.kind === "plot" &&
            (o.name.toLowerCase().includes("water") ||
              o.name.toLowerCase().includes("pond") ||
              o.name.toLowerCase().includes("canal") ||
              o.name.toLowerCase().includes("fountain"));
          e.polygon = polygon(
            o.points,
            o.kind === "boundary" ? 0 : o.elevation + 0.15,
            0,
            (o.kind === "boundary"
              ? C.Color.fromCssColorString(is2D ? "#f3efe7" : "#eaf4dc")
              : color
            ).withAlpha(
              (o.kind === "boundary"
                ? is2D
                  ? 0.035
                  : 0.88
                : is2D
                  ? 0.22
                  : 0.62) * objectOpacity(o),
            ),
          );
          if (water)
            (e.polygon as C.Entity.ConstructorOptions["polygon"])!.material =
              new C.ImageMaterialProperty({
                image: "/assets/textures/water-surface.svg",
                repeat: new C.Cartesian2(8, 3),
                color: C.Color.WHITE.withAlpha(0.88 * objectOpacity(o)),
              });
          e.polyline = {
            positions: [...o.points, o.points[0]].map((q) => position(q, 0.3)),
            width: o.kind === "boundary" ? (is2D ? 2 : 3) : is2D ? 1 : 2,
            material: C.Color.fromCssColorString(
              is2D ? "#78a899" : "#25b895",
            ).withAlpha(is2D ? (o.kind === "boundary" ? 0.42 : 0.58) : 1),
          };
          if (o.kind === "plot" && o.name.toLowerCase().includes("parking")) {
            const xs = o.points.map(([x]) => x),
              ys = o.points.map(([, y]) => y),
              minX = Math.min(...xs),
              maxX = Math.max(...xs),
              minY = Math.min(...ys),
              maxY = Math.max(...ys),
              columns = Math.max(2, Math.round((maxX - minX) / 6));
            for (let bay = 1; bay < columns; bay++) {
              const x = minX + ((maxX - minX) * bay) / columns;
              v.entities.add({
                id: `${o.id}:parking-bay-${bay}`,
                polyline: {
                  positions: [
                    position([x, minY + 1], o.elevation + 0.34),
                    position([x, maxY - 1], o.elevation + 0.34),
                  ],
                  width: 2,
                  material: C.Color.WHITE.withAlpha(0.85 * objectOpacity(o)),
                },
              });
            }
          }
          if (
            !is2D &&
            o.kind === "plot" &&
            o.assetRef === "builtin:society:graveyard"
          ) {
            const xs = o.points.map(([x]) => x),
              ys = o.points.map(([, y]) => y),
              minX = Math.min(...xs),
              maxX = Math.max(...xs),
              minY = Math.min(...ys),
              maxY = Math.max(...ys);
            let grave = 0;
            for (let x = minX + 4; x < maxX - 2; x += 5.5)
              for (let y = minY + 4; y < maxY - 2; y += 7) {
                v.entities.add({
                  id: `${o.id}:grave-${grave++}`,
                  position: position([x, y], o.elevation + 0.48),
                  box: {
                    dimensions: new C.Cartesian3(1.05, 2.4, 0.45),
                    material: C.Color.fromCssColorString("#d8d2c5").withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
              }
          }
          if (
            o.kind === "plot" &&
            o.assetRef === "builtin:society:sports-field"
          ) {
            const ring = [...o.points, o.points[0]];
            v.entities.add({
              id: `${o.id}:field-lines`,
              polyline: {
                positions: ring.map((point) =>
                  position(point, o.elevation + 0.4),
                ),
                width: 3,
                material: C.Color.WHITE.withAlpha(objectOpacity(o)),
              },
            });
          }
          if (
            !is2D &&
            o.kind === "plot" &&
            o.assetRef === "builtin:society:playground"
          ) {
            const center: Point = [
              o.points.reduce((sum, point) => sum + point[0], 0) /
                o.points.length,
              o.points.reduce((sum, point) => sum + point[1], 0) /
                o.points.length,
            ];
            [
              [-7, 0, "#e84c3d"],
              [0, 4, "#2f80ed"],
              [7, -2, "#f2c94c"],
            ].forEach(([dx, dy, shade], index) =>
              v.entities.add({
                id: `${o.id}:play-${index}`,
                position: position(
                  [center[0] + Number(dx), center[1] + Number(dy)],
                  o.elevation + 1.4,
                ),
                box: {
                  dimensions: new C.Cartesian3(4, 3, 2.4),
                  material: C.Color.fromCssColorString(String(shade)).withAlpha(
                    objectOpacity(o),
                  ),
                },
              }),
            );
          }
        } else if (o.kind === "road") {
          e.polyline = {
            show: o.lanes > 1 || selected,
            positions: o.points.map((q) => position(q, o.elevation + 0.3)),
            width: selected ? 5 : 2.5,
            material: selected
              ? C.Color.fromCssColorString("#f8b84b")
              : new C.PolylineDashMaterialProperty({
                  color: C.Color.WHITE.withAlpha(objectOpacity(o)),
                  dashLength: 18,
                }),
          };
        } else if (o.kind === "building") {
          const customUri = getCustomAssetUrlSync(o.assetRef);
          const isMosque = o.assetRef === "builtin:society:mosque";
          const useHouseModel =
            !customUri &&
            !isMosque &&
            (o.buildingType === "Detached house" ||
              o.buildingType === "Townhouse");
          const houseUris: Record<string, string> = {
            a: "/assets/kenney/suburban/building-type-a.glb",
            f: "/assets/kenney/suburban/building-type-f.glb",
            k: "/assets/kenney/suburban/building-type-k.glb",
            t: "/assets/kenney/suburban/building-type-t.glb",
          };
          const houseUri = houseUris[variant] ?? houseUris.f;
          const houseScale = ((o.width + o.depth) / 4) * o.scale * 1.35;
          if (is2D) {
            const mapColor =
              o.buildingType === "Detached house" ||
              o.buildingType === "Townhouse"
                ? C.Color.fromCssColorString("#cbbfb1")
                : color;
            e.polygon = polygon(
              footprint(o),
              o.elevation + 0.22,
              0.16,
              mapColor.withAlpha(0.78 * objectOpacity(o)),
            );
            const flat = e.polygon as C.Entity.ConstructorOptions["polygon"];
            if (flat) {
              flat.outline = true;
              flat.outlineColor = C.Color.fromCssColorString(
                "#9f978d",
              ).withAlpha(objectOpacity(o));
            }
          } else if (customUri) {
            e.position = position(o.points[0], o.elevation + 0.15);
            e.orientation = C.Transforms.headingPitchRollQuaternion(
              position(o.points[0]),
              new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
            );
            e.model = model(
              customUri,
              o.scale,
              objectOpacity(o),
              selected,
              32,
              C.Color.WHITE,
              0,
            );
          } else if (useHouseModel) {
            e.position = position(o.points[0], o.elevation + 0.2);
            e.orientation = C.Transforms.headingPitchRollQuaternion(
              position(o.points[0]),
              new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
            );
            e.model = model(
              houseUri,
              houseScale,
              objectOpacity(o),
              selected,
              28,
              color,
              0.34,
            );
          } else {
            e.polygon = polygon(
              footprint(o),
              o.elevation + 0.2,
              o.floors * o.floorHeight,
              color.withAlpha(objectOpacity(o)),
            );
            v.entities.add({
              id: `${o.id}:roof-cap`,
              polygon: polygon(
                footprint(o),
                o.elevation + o.floors * o.floorHeight + 0.15,
                0.35,
                C.Color.fromCssColorString("#5b6470").withAlpha(
                  objectOpacity(o),
                ),
              ),
            });
            if (isMosque) {
              const opacity = objectOpacity(o);
              v.entities.add({
                id: `${o.id}:dome`,
                position: position(
                  o.points[0],
                  o.elevation + o.floors * o.floorHeight + 2.6,
                ),
                ellipsoid: {
                  radii: new C.Cartesian3(
                    o.width * 0.28 * o.scale,
                    o.depth * 0.28 * o.scale,
                    3.2 * o.scale,
                  ),
                  maximumCone: Math.PI / 2,
                  material:
                    C.Color.fromCssColorString("#2d9b68").withAlpha(opacity),
                },
              });
              const angle = (o.rotation * Math.PI) / 180;
              const minaretPoint: Point = [
                o.points[0][0] +
                  Math.cos(angle) * o.width * 0.42 -
                  Math.sin(angle) * o.depth * 0.38,
                o.points[0][1] +
                  Math.sin(angle) * o.width * 0.42 +
                  Math.cos(angle) * o.depth * 0.38,
              ];
              v.entities.add({
                id: `${o.id}:minaret`,
                position: position(
                  minaretPoint,
                  o.elevation + o.floors * o.floorHeight * 0.9,
                ),
                cylinder: {
                  length: o.floors * o.floorHeight * 1.8,
                  topRadius: 0.65 * o.scale,
                  bottomRadius: 1.15 * o.scale,
                  material:
                    C.Color.fromCssColorString("#f4f0df").withAlpha(opacity),
                },
              });
              v.entities.add({
                id: `${o.id}:minaret-cap`,
                position: position(
                  minaretPoint,
                  o.elevation + o.floors * o.floorHeight * 1.82,
                ),
                ellipsoid: {
                  radii: new C.Cartesian3(1.2, 1.2, 1.5),
                  material:
                    C.Color.fromCssColorString("#2d9b68").withAlpha(opacity),
                },
              });
            }
            if (o.assetRef.startsWith("builtin:society:")) {
              const facility = o.assetRef.split(":").at(-1) || "facility";
              v.entities.add({
                id: `${o.id}:label`,
                position: position(
                  o.points[0],
                  o.elevation + o.floors * o.floorHeight + 5.5,
                ),
                label: {
                  show: props.viewMode !== "street",
                  text: o.name,
                  font: "600 14px sans-serif",
                  fillColor: C.Color.fromCssColorString("#172b4d"),
                  outlineColor: C.Color.WHITE,
                  outlineWidth: 4,
                  style: C.LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: new C.Cartesian2(0, -8),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  distanceDisplayCondition: new C.DistanceDisplayCondition(
                    0,
                    450,
                  ),
                },
              });
              if (["clinic", "hospital", "pharmacy"].includes(facility)) {
                const orientation = C.Transforms.headingPitchRollQuaternion(
                  position(o.points[0]),
                  new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
                );
                [
                  new C.Cartesian3(o.width * 0.3, 0.35, 1.4),
                  new C.Cartesian3(1.4, 0.35, o.width * 0.3),
                ].forEach((dimensions, index) =>
                  v.entities.add({
                    id: `${o.id}:health-cross-${index}`,
                    position: position(
                      o.points[0],
                      o.elevation + o.floors * o.floorHeight + 0.55,
                    ),
                    orientation,
                    box: {
                      dimensions,
                      material: C.Color.fromCssColorString("#dc2626").withAlpha(
                        objectOpacity(o),
                      ),
                    },
                  }),
                );
              }
              if (["church", "temple", "gurdwara"].includes(facility)) {
                v.entities.add({
                  id: `${o.id}:faith-crown`,
                  position: position(
                    o.points[0],
                    o.elevation + o.floors * o.floorHeight + 2.2,
                  ),
                  ellipsoid: {
                    radii: new C.Cartesian3(
                      o.width * 0.22,
                      o.depth * 0.22,
                      facility === "church" ? 4.5 : 2.5,
                    ),
                    material: C.Color.fromCssColorString(
                      facility === "temple" ? "#d97706" : "#e8dcc5",
                    ).withAlpha(objectOpacity(o)),
                  },
                });
              }
            }
          }
          const buildingOrientation = C.Transforms.headingPitchRollQuaternion(
            position(o.points[0]),
            new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
          );
          for (
            let floor = 0;
            !useHouseModel && !customUri && floor < Math.min(o.floors, 12);
            floor++
          )
            v.entities.add({
              id: `${o.id}:windows-${floor}`,
              position: position(
                o.points[0],
                o.elevation + floor * o.floorHeight + o.floorHeight * 0.62,
              ),
              orientation: buildingOrientation,
              box: {
                dimensions: new C.Cartesian3(
                  o.width * o.scale + 0.08,
                  o.depth * o.scale + 0.08,
                  Math.min(0.55, o.floorHeight * 0.2),
                ),
                material: C.Color.fromCssColorString("#84b9d6").withAlpha(
                  objectOpacity(o) * 0.78,
                ),
              },
            });
          if (
            !useHouseModel &&
            !customUri &&
            !isMosque &&
            o.roof === "pitched"
          ) {
            const ring = footprint(o),
              center = position(
                o.points[0],
                o.elevation + o.floors * o.floorHeight + 3,
              );
            for (let face = 0; face < 4; face++)
              v.entities.add({
                id: `${o.id}:roof${face}`,
                polygon: {
                  hierarchy: new C.PolygonHierarchy([
                    position(
                      ring[face],
                      o.elevation + o.floors * o.floorHeight + 0.2,
                    ),
                    position(
                      ring[(face + 1) % 4],
                      o.elevation + o.floors * o.floorHeight + 0.2,
                    ),
                    center,
                  ]),
                  perPositionHeight: true,
                  material: C.Color.fromCssColorString("#66594c").withAlpha(
                    objectOpacity(o),
                  ),
                },
              });
          }
        } else {
          const z = o.elevation,
            scale = o.scale;
          e.position = position(
            o.points[0],
            z + (o.kind === "tree" ? 5 : o.kind === "bridge" ? 0 : 1) * scale,
          );
          e.orientation = C.Transforms.headingPitchRollQuaternion(
            position(o.points[0]),
            new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
          );
          if (o.kind === "tree") {
            if (is2D) {
              e.position = position(o.points[0], z + 0.28);
              e.ellipse = {
                semiMajorAxis: 3.2 * scale,
                semiMinorAxis: 3.2 * scale,
                material: C.Color.fromCssColorString(
                  variant === "columnar" ? "#568a4c" : "#72a963",
                ).withAlpha(0.82 * objectOpacity(o)),
                outline: true,
                outlineColor: C.Color.fromCssColorString("#4f7b47").withAlpha(
                  objectOpacity(o),
                ),
              };
            } else {
              const palm = variant === "palm",
                columnar = variant === "columnar";
              if (!palm && !columnar) {
                const treeScale = 6.2 * scale;
                e.position = position(o.points[0], z + 0.15);
                e.model = model(
                  variant === "small"
                    ? "/assets/kenney/suburban/tree-small.glb"
                    : "/assets/kenney/suburban/tree-large.glb",
                  treeScale,
                  objectOpacity(o),
                  selected,
                  20,
                  C.Color.fromCssColorString(
                    variant === "small" ? "#75dc22" : "#4fcb21",
                  ),
                  0.1,
                );
              } else {
                e.ellipsoid = {
                  radii: new C.Cartesian3(
                    (palm ? 2.8 : 1.8) * scale,
                    (palm ? 2.8 : 1.8) * scale,
                    (palm ? 1.5 : 5.2) * scale,
                  ),
                  material: C.Color.fromCssColorString("#2f7d4f").withAlpha(
                    objectOpacity(o),
                  ),
                };
                v.entities.add({
                  id: `${o.id}:trunk`,
                  position: position(o.points[0], z + (palm ? 4 : 2.1) * scale),
                  cylinder: {
                    length: (palm ? 8 : 4.2) * scale,
                    topRadius: (palm ? 0.22 : 0.32) * scale,
                    bottomRadius: (palm ? 0.42 : 0.48) * scale,
                    material: C.Color.fromCssColorString("#79563d").withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
              }
            }
          } else {
            if (o.kind === "car") {
              if (is2D) {
                e.position = position(o.points[0], z + 0.3);
                e.box = {
                  dimensions: new C.Cartesian3(4.2 * scale, 1.8 * scale, 0.12),
                  material: C.Color.fromCssColorString(o.color).withAlpha(
                    0.82 * objectOpacity(o),
                  ),
                  outline: true,
                  outlineColor: C.Color.fromCssColorString("#ffffff").withAlpha(
                    0.8 * objectOpacity(o),
                  ),
                };
              } else {
                const carUri =
                  variant === "van"
                    ? "/assets/kenney/cars/van.glb"
                    : variant === "suv"
                      ? "/assets/kenney/cars/suv.glb"
                      : "/assets/kenney/cars/sedan.glb";
                const carScale = 2.25 * scale;
                e.position = position(o.points[0], z + 0.25);
                e.model = model(
                  carUri,
                  carScale,
                  objectOpacity(o),
                  selected,
                  18,
                  C.Color.fromCssColorString(o.color),
                  0.28,
                );
              }
            } else if (o.assetRef === "builtin:society:streetlight") {
              e.position = position(o.points[0], z + 4 * scale);
              e.box = {
                dimensions: new C.Cartesian3(0.3, 0.3, 8 * scale),
                material: C.Color.fromCssColorString("#39434d").withAlpha(
                  objectOpacity(o),
                ),
              };
              v.entities.add({
                id: `${o.id}:lamp`,
                position: position(o.points[0], z + 8.1 * scale),
                ellipsoid: {
                  radii: new C.Cartesian3(0.9, 0.9, 0.45),
                  material: C.Color.fromCssColorString("#ffe9a6").withAlpha(
                    objectOpacity(o),
                  ),
                },
              });
            } else if (o.assetRef === "builtin:society:traffic-signal") {
              e.position = position(o.points[0], z + 3 * scale);
              e.box = {
                dimensions: new C.Cartesian3(0.32, 0.32, 6 * scale),
                material: C.Color.fromCssColorString("#343a40").withAlpha(
                  objectOpacity(o),
                ),
              };
              ["#ef4444", "#facc15", "#22c55e"].forEach((shade, index) =>
                v.entities.add({
                  id: `${o.id}:signal-${index}`,
                  position: position(
                    o.points[0],
                    z + (6.8 - index * 0.55) * scale,
                  ),
                  ellipsoid: {
                    radii: new C.Cartesian3(0.24, 0.24, 0.24),
                    material: C.Color.fromCssColorString(shade).withAlpha(
                      objectOpacity(o),
                    ),
                  },
                }),
              );
            } else if (
              o.kind === "bench" &&
              o.assetRef.startsWith("builtin:society:")
            ) {
              const height = o.floors * o.floorHeight;
              e.position = position(o.points[0], z + (height * scale) / 2);
              e.box = {
                dimensions: new C.Cartesian3(
                  o.width * scale,
                  o.depth * scale,
                  height * scale,
                ),
                material: C.Color.fromCssColorString(o.color).withAlpha(
                  objectOpacity(o),
                ),
              };
            } else
              e.box = {
                dimensions: new C.Cartesian3(
                  (o.kind === "bridge" ? o.width : 2) * scale,
                  (o.kind === "bridge" ? o.depth : 0.7) * scale,
                  (o.kind === "bridge" ? 0.8 : 0.18) * scale,
                ),
                material: C.Color.fromCssColorString(
                  o.kind === "bench" && variant === "timber"
                    ? "#8b5e3c"
                    : "#8d9ca0",
                ).withAlpha(objectOpacity(o)),
              };
            if (
              o.kind === "bench" &&
              !o.assetRef.startsWith("builtin:society:")
            ) {
              const wood =
                variant === "stone"
                  ? ["#b7b0a7", "#97918a", "#c9c3bb"]
                  : variant === "modern"
                    ? ["#66727c", "#414b54", "#7b8791"]
                    : ["#a96f3f", "#7d4c2d", "#c58a55"];
              for (let slat = -1; slat <= 1; slat++)
                v.entities.add({
                  id: `${o.id}:seat-slat-${slat}`,
                  position: position(
                    [
                      o.points[0][0] -
                        Math.sin((o.rotation * Math.PI) / 180) *
                          slat *
                          0.19 *
                          scale,
                      o.points[0][1] +
                        Math.cos((o.rotation * Math.PI) / 180) *
                          slat *
                          0.19 *
                          scale,
                    ],
                    z + 1.12 * scale,
                  ),
                  orientation: e.orientation as C.Quaternion,
                  box: {
                    dimensions: new C.Cartesian3(
                      (variant === "modern" ? 2.7 : 2.1) * scale,
                      0.15 * scale,
                      0.1 * scale,
                    ),
                    material: C.Color.fromCssColorString(
                      wood[slat + 1],
                    ).withAlpha(objectOpacity(o)),
                  },
                });
              for (const side of [-0.7, 0.7])
                v.entities.add({
                  id: `${o.id}:leg-${side}`,
                  position: position(
                    [
                      o.points[0][0] +
                        Math.cos((o.rotation * Math.PI) / 180) * side * scale,
                      o.points[0][1] +
                        Math.sin((o.rotation * Math.PI) / 180) * side * scale,
                    ],
                    z + 0.48 * scale,
                  ),
                  orientation: e.orientation as C.Quaternion,
                  box: {
                    dimensions: new C.Cartesian3(
                      0.16 * scale,
                      0.58 * scale,
                      0.85 * scale,
                    ),
                    material: C.Color.fromCssColorString("#343a40").withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
              for (let slat = 0; slat < 3; slat++)
                v.entities.add({
                  id: `${o.id}:back-slat-${slat}`,
                  position: position(
                    o.points[0],
                    z + (1.32 + slat * 0.28) * scale,
                  ),
                  orientation: e.orientation as C.Quaternion,
                  box: {
                    dimensions: new C.Cartesian3(
                      (variant === "modern" ? 2.7 : 2.1) * scale,
                      (variant === "stone" ? 0.3 : 0.14) * scale,
                      0.18 * scale,
                    ),
                    material: C.Color.fromCssColorString(wood[slat]).withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
            } else if (o.kind === "bridge") {
              const angle = (o.rotation * Math.PI) / 180;
              const localPoint = (across: number, along: number): Point => [
                o.points[0][0] +
                  Math.cos(angle) * across -
                  Math.sin(angle) * along,
                o.points[0][1] +
                  Math.sin(angle) * across +
                  Math.cos(angle) * along,
              ];
              const steel = variant === "pedestrian" ? "#d76831" : "#475569";
              for (const side of [-1, 1]) {
                v.entities.add({
                  id: `${o.id}:rail-${side}`,
                  position: position(
                    localPoint((side * (o.width * scale - 0.4)) / 2, 0),
                    z + 1.4 * scale,
                  ),
                  orientation: e.orientation as C.Quaternion,
                  box: {
                    dimensions: new C.Cartesian3(
                      (variant === "pedestrian" ? 0.12 : 0.18) * scale,
                      o.depth * scale,
                      0.14 * scale,
                    ),
                    material: C.Color.fromCssColorString(steel).withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
                for (let post = -4; post <= 4; post++)
                  v.entities.add({
                    id: `${o.id}:rail-post-${side}-${post}`,
                    position: position(
                      localPoint(
                        (side * (o.width * scale - 0.4)) / 2,
                        (post / 9) * o.depth * scale,
                      ),
                      z + 0.9 * scale,
                    ),
                    orientation: e.orientation as C.Quaternion,
                    box: {
                      dimensions: new C.Cartesian3(
                        0.16 * scale,
                        0.16 * scale,
                        1.15 * scale,
                      ),
                      material: C.Color.fromCssColorString(steel).withAlpha(
                        objectOpacity(o),
                      ),
                    },
                  });
              }
              v.entities.add({
                id: `${o.id}:center-line`,
                position: position(o.points[0], z + 0.43 * scale),
                orientation: e.orientation as C.Quaternion,
                box: {
                  dimensions: new C.Cartesian3(
                    0.12 * scale,
                    o.depth * 0.92 * scale,
                    0.04 * scale,
                  ),
                  material: C.Color.fromCssColorString("#f4c542").withAlpha(
                    objectOpacity(o),
                  ),
                },
              });
              for (const along of [-0.32, 0.32])
                v.entities.add({
                  id: `${o.id}:pier-${along}`,
                  position: position(
                    localPoint(0, along * o.depth * scale),
                    Math.max(0.5, z / 2),
                  ),
                  orientation: e.orientation as C.Quaternion,
                  box: {
                    dimensions: new C.Cartesian3(
                      Math.max(2, o.width * scale - 1.5),
                      0.7 * scale,
                      Math.max(1, z + 0.8),
                    ),
                    material: C.Color.fromCssColorString("#70777b").withAlpha(
                      objectOpacity(o),
                    ),
                  },
                });
              if (variant === "arch")
                for (const side of [-1, 1])
                  for (let step = -3; step <= 3; step++) {
                    const along = (step / 7) * o.depth * scale;
                    const archHeight =
                      (1.2 + 2.2 * (1 - Math.pow(step / 3, 2))) * scale;
                    v.entities.add({
                      id: `${o.id}:arch-${side}-${step}`,
                      position: position(
                        localPoint((side * (o.width * scale - 0.4)) / 2, along),
                        z + 0.8 * scale + archHeight / 2,
                      ),
                      orientation: e.orientation as C.Quaternion,
                      box: {
                        dimensions: new C.Cartesian3(
                          0.22 * scale,
                          0.35 * scale,
                          archHeight,
                        ),
                        material: C.Color.fromCssColorString(
                          "#4f5c63",
                        ).withAlpha(objectOpacity(o)),
                      },
                    });
                  }
            }
          }
        }
        entity = v.entities.add(e as C.Entity.ConstructorOptions);
        cache.current.set(o.id, o);
        opacityCache.current.set(o.id, objectOpacity(o));
      }
      entity!.show = props.visible[o.kind];
      for (const part of v.entities.values)
        if (typeof part.id === "string" && part.id.startsWith(`${o.id}:`))
          part.show = props.visible[o.kind];
      if (o.kind === "road" && entity?.polyline)
        entity.polyline.material =
          o.id === props.selected
            ? new C.ColorMaterialProperty(C.Color.fromCssColorString("#f8b84b"))
            : new C.PolylineDashMaterialProperty({
                color: (is2D
                  ? C.Color.fromCssColorString("#aeb5b7")
                  : C.Color.WHITE
                ).withAlpha(objectOpacity(o)),
                dashLength: is2D ? 14 : 18,
              });
    }
    // A single transient highlight avoids mutating stored design objects.
    v.entities.removeById("_selection");
    for (const entity of [...v.entities.values])
      if (typeof entity.id === "string" && entity.id.startsWith("_handle:"))
        v.entities.remove(entity);
    const selected = p.objects.find((o) => o.id === props.selected);
    if (selected && !props.navigationMode) {
      v.entities.add({
        id: "_selection",
        position: position(
          selected.points[0],
          selected.kind === "building"
            ? selected.floors * selected.floorHeight + 8
            : 12,
        ),
        point: {
          pixelSize: 10,
          color: C.Color.fromCssColorString("#f8b84b"),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      const handles: { point: Point; index: number }[] = [
        "building",
        "bridge",
      ].includes(selected.kind)
        ? footprint(selected).map((point, index) => ({ point, index }))
        : ["boundary", "plot", "road"].includes(selected.kind)
          ? selected.points.map((point, index) => ({ point, index }))
          : ["tree", "car", "bench"].includes(selected.kind)
            ? [
                {
                  point: [
                    selected.points[0][0] +
                      selected.scale *
                        (selected.kind === "tree"
                          ? 4
                          : selected.kind === "car"
                            ? 3
                            : 2.5),
                    selected.points[0][1],
                  ],
                  index: -1,
                },
              ]
            : [];
      handles.forEach(({ point, index }) =>
        v.entities.add({
          id: `_handle:${selected.id}:${index}`,
          position: position(point, 1.5),
          point: {
            pixelSize: 13,
            color: C.Color.fromCssColorString("#2563eb"),
            outlineColor: C.Color.WHITE,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      );
    }
    v.entities.removeById("_draft");
    if (props.draft.length > 1)
      v.entities.add({
        id: "_draft",
        polyline: {
          positions: props.draft.map((q) => position(q, 0.5)),
          width: 3,
          material: C.Color.YELLOW,
        },
      });
    v.scene.requestRender();
  }, [
    props.project,
    props.visible,
    props.opacity,
    props.selected,
    props.draft,
    props.navigationMode,
    assetVersion,
    props.viewMode,
  ]);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    for (const entity of [...v.entities.values])
      if (typeof entity.id === "string" && entity.id.startsWith("_data:"))
        v.entities.remove(entity);
    const point = (coordinate: unknown) => {
      const xy = coordinate as number[];
      return C.Cartesian3.fromDegrees(xy[0], xy[1], Number(xy[2] || 0) + 1);
    };
    for (const layer of props.project.dataLayers) {
      if (!layer.visible) continue;
      const color = C.Color.fromCssColorString(layer.color).withAlpha(
        layer.opacity,
      );
      layer.features.forEach((feature, featureIndex) => {
        const base = `_data:${layer.id}:${feature.id}:${featureIndex}`;
        const addPoint = (coordinate: unknown, suffix = "") =>
          v.entities.add({
            id: `${base}${suffix}`,
            position: point(coordinate),
            point: {
              pixelSize: 9,
              color,
              outlineColor: C.Color.WHITE.withAlpha(layer.opacity),
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        const addLine = (coordinates: unknown[], suffix = "") =>
          v.entities.add({
            id: `${base}${suffix}`,
            polyline: {
              positions: coordinates.map(point),
              width: 3,
              material: color,
              clampToGround: true,
            },
          });
        const addPolygon = (coordinates: unknown[][], suffix = "") =>
          v.entities.add({
            id: `${base}${suffix}`,
            polygon: {
              hierarchy: new C.PolygonHierarchy(
                coordinates[0].map(point),
                coordinates
                  .slice(1)
                  .map((hole) => new C.PolygonHierarchy(hole.map(point))),
              ),
              material: color.withAlpha(layer.opacity * 0.32),
              outline: true,
              outlineColor: color,
              height: 0.5,
            },
          });
        const coordinates = feature.geometry.coordinates as unknown[];
        switch (feature.geometry.type) {
          case "Point":
            addPoint(coordinates);
            break;
          case "MultiPoint":
            coordinates.forEach((value, i) => addPoint(value, `:${i}`));
            break;
          case "LineString":
            addLine(coordinates);
            break;
          case "MultiLineString":
            coordinates.forEach((value, i) =>
              addLine(value as unknown[], `:${i}`),
            );
            break;
          case "Polygon":
            addPolygon(coordinates as unknown[][]);
            break;
          case "MultiPolygon":
            coordinates.forEach((value, i) =>
              addPolygon(value as unknown[][], `:${i}`),
            );
            break;
        }
      });
    }
    v.scene.requestRender();
  }, [props.project.dataLayers]);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    let cancelled = false;
    const w = new Worker(new URL("./geometry.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = ({ data }) => {
      if (cancelled || v.isDestroyed()) return;
      if (data.error) {
        props.onError(data.error);
        return;
      }
      for (const e of [...v.entities.values])
        if (e.id.startsWith("_surface") || e.id.startsWith("_sidewalk"))
          v.entities.remove(e);
      let i = 0;
      for (const s of data.surfaces) {
        for (const poly of s.sidewalks) {
          const ring = (r: Point[]) =>
            r.map((q) =>
              C.Cartesian3.fromDegrees(...toGeo(q, props.project.origin)),
            );
          v.entities.add({
            id: `_sidewalk${i++}`,
            show: props.visible.road && props.opacity.road > 0,
            polygon: {
              hierarchy: new C.PolygonHierarchy(
                ring(poly[0]),
                poly
                  .slice(1)
                  .map((r: Point[]) => new C.PolygonHierarchy(ring(r))),
              ),
              height: s.elevation + 0.08,
              material: C.Color.fromCssColorString(
                props.viewMode === "2d" ? "#f4f3ef" : "#d9d7cf",
              ).withAlpha(props.opacity.road),
            },
          });
        }
        for (const poly of s.polygons) {
          const ring = (r: Point[]) =>
            r.map((q) =>
              C.Cartesian3.fromDegrees(...toGeo(q, props.project.origin)),
            );
          v.entities.add({
            id: `_surface${i++}`,
            show: props.visible.road && props.opacity.road > 0,
            polygon: {
              hierarchy: new C.PolygonHierarchy(
                ring(poly[0]),
                poly
                  .slice(1)
                  .map((r: Point[]) => new C.PolygonHierarchy(ring(r))),
              ),
              height: s.elevation + 0.14,
              material: C.Color.fromCssColorString(
                props.viewMode === "2d" ? "#d7d9d8" : "#3f474d",
              ).withAlpha(props.opacity.road),
            },
          });
        }
      }
      v.scene.requestRender();
    };
    w.postMessage({
      id: 1,
      roads: props.project.objects.filter((o) => o.kind === "road"),
    });
    return () => {
      cancelled = true;
      w.onmessage = null;
      w.terminate();
    };
  }, [roadKey, props.visible.road, props.opacity.road, props.viewMode]);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    if (props.action.type === "zoom-in" || props.action.type === "zoom-out") {
      const height = v.camera.positionCartographic.height,
        amount = Math.max(2, height * 0.35);
      if (props.action.type === "zoom-in") v.camera.zoomIn(amount);
      else v.camera.zoomOut(amount);
      v.scene.requestRender();
      return;
    }
    const cameraStep = 5;
    const turnStep = C.Math.toRadians(12);
    if (props.action.type === "rotate-left") v.camera.lookLeft(turnStep);
    else if (props.action.type === "rotate-right") v.camera.lookRight(turnStep);
    else if (props.action.type === "tilt-up") v.camera.lookUp(turnStep / 2);
    else if (props.action.type === "tilt-down") v.camera.lookDown(turnStep / 2);
    else if (props.action.type === "move-forward")
      v.camera.moveForward(cameraStep);
    else if (props.action.type === "move-backward")
      v.camera.moveBackward(cameraStep);
    if (
      [
        "rotate-left",
        "rotate-right",
        "tilt-up",
        "tilt-down",
        "move-forward",
        "move-backward",
      ].includes(props.action.type)
    ) {
      v.scene.requestRender();
      return;
    }
    if (props.action.type === "location" && props.action.location) {
      const { center, bounds } = props.action.location,
        width = Math.max(bounds[2] - bounds[0], 0.01),
        height = Math.max(bounds[3] - bounds[1], 0.01),
        rectangle = C.Rectangle.fromDegrees(
          center[0] - width / 2,
          center[1] - height / 2,
          center[0] + width / 2,
          center[1] + height / 2,
        );
      v.camera.flyTo({ destination: rectangle, duration: 1.1 });
      return;
    }
    if (props.action.type === "street") {
      const roads = props.project.objects.filter(
          (object) => object.kind === "road" && object.points.length > 1,
        ),
        obstacles = props.project.objects.filter((object) =>
          ["building", "bridge"].includes(object.kind),
        ),
        candidates = roads.flatMap((road) =>
          road.points.slice(0, -1).flatMap((start, index) => {
            const end = road.points[index + 1],
              segmentLength = Math.hypot(
                end[0] - start[0],
                end[1] - start[1],
              );
            if (segmentLength < 18) return [];
            return [0.35, 0.5, 0.65].map((fraction) => {
              const eye: Point = [
                  start[0] + (end[0] - start[0]) * fraction,
                  start[1] + (end[1] - start[1]) * fraction,
                ],
                clearance = obstacles.length
                  ? Math.min(
                      ...obstacles.map((object) => {
                        const center = object.points[0],
                          radius = Math.hypot(object.width, object.depth) / 2;
                        return (
                          Math.hypot(eye[0] - center[0], eye[1] - center[1]) -
                          radius
                        );
                      }),
                    )
                  : 100,
                preferredRoad = /main|boulevard|avenue|collector/i.test(
                  road.name,
                )
                  ? 35
                  : 0;
              return {
                road,
                start,
                end,
                eye,
                score:
                  Math.min(clearance, 80) +
                  Math.min(segmentLength, 120) * 0.2 +
                  preferredRoad +
                  road.width,
              };
            });
          }),
        ),
        safest = candidates.sort((a, b) => b.score - a.score)[0],
        road = safest?.road || roads[0],
        start = safest?.start || road?.points[0] || ([0, -120] as Point),
        end = safest?.end || road?.points[1] || ([0, 0] as Point),
        direction: Point = [end[0] - start[0], end[1] - start[1]],
        distance = Math.hypot(direction[0], direction[1]) || 1,
        eye: Point =
          safest?.eye ||
          ([
            start[0] + (direction[0] / distance) * 6,
            start[1] + (direction[1] / distance) * 6,
          ] as Point),
        ll = toGeo(eye, props.project.origin);
      v.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(...ll, (road?.elevation ?? 0) + 2.2),
        orientation: {
          heading: Math.atan2(direction[0], direction[1]),
          pitch: -0.04,
          roll: 0,
        },
        duration: 0.8,
      });
      return;
    }
    const o = props.project.objects.find((o) => o.id === props.action.id);
    const points = o?.points ||
      props.project.objects.find((o) => o.kind === "boundary")?.points || [
        [0, 0],
      ];
    const center: Point = [
      points.reduce((s, q) => s + q[0], 0) / points.length,
      points.reduce((s, q) => s + q[1], 0) / points.length,
    ];
    const radius = Math.max(
      o ? 65 : 300,
      ...points.map((q) => Math.hypot(q[0] - center[0], q[1] - center[1])),
    );
    const ll = toGeo(center, props.project.origin);
    v.camera.flyToBoundingSphere(
      new C.BoundingSphere(C.Cartesian3.fromDegrees(...ll), radius),
      {
        duration: 0.6,
        offset: new C.HeadingPitchRange(
          0,
          props.action.type === "perspective" ? -0.65 : -Math.PI / 2,
          radius * 3,
        ),
      },
    );
  }, [props.action]);
  return (
    <div
      className={`viewport${props.navigationMode ? " navigate" : ""}`}
      ref={container}
      aria-label="3D planning viewport"
    />
  );
}
