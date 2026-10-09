import { useEffect, useRef } from "react";
import * as C from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  type Project,
  type Point,
  type Kind,
  type DesignObject,
} from "./model";
import { toGeo, toLocal, footprint } from "./geometry";
export type ViewAction = {
  type: "frame" | "top" | "perspective" | "location" | "zoom-in" | "zoom-out";
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
  selected: string;
  draft: Point[];
  onClick: (p: Point, id?: string) => void;
  onMove: (id: string, p: Point) => void;
  onError: (s: string) => void;
  action: ViewAction;
  onContext: (s: string) => void;
}
export function Viewport(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    viewer = useRef<C.Viewer | null>(null),
    latest = useRef(props),
    cache = useRef(new Map<string, DesignObject>()),
    opacityCache = useRef(new Map<string, number>());
  latest.current = props;
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
      });
    } catch (e) {
      props.onError(`3D viewport could not start: ${String(e)}`);
      return;
    }
    viewer.current = v;
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
    const objectAt = (position: C.Cartesian2) => {
      const ids = new Set(latest.current.project.objects.map((o) => o.id));
      for (const hit of v.scene.drillPick(position)) {
        const raw = hit?.id?.id;
        if (typeof raw !== "string") continue;
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
      const p = groundAt(e.position);
      if (p) latest.current.onClick(p, objectAt(e.position));
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    let drag:
      { id: string; start: C.Cartesian2; end: C.Cartesian2 } | undefined;
    h.setInputAction((e: { position: C.Cartesian2 }) => {
      const id = objectAt(e.position),
        object = latest.current.project.objects.find((o) => o.id === id);
      if (!id || object?.kind === "boundary") return;
      drag = {
        id,
        start: C.Cartesian2.clone(e.position),
        end: C.Cartesian2.clone(e.position),
      };
    }, C.ScreenSpaceEventType.LEFT_DOWN);
    h.setInputAction((e: { endPosition: C.Cartesian2 }) => {
      if (drag) drag.end = C.Cartesian2.clone(e.endPosition);
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
    h.setInputAction((e: { position: C.Cartesian2 }) => {
      if (!drag) return;
      const moved = C.Cartesian2.distance(drag.start, drag.end) > 4,
        p = moved ? groundAt(e.position) : undefined,
        id = drag.id;
      drag = undefined;
      if (p) latest.current.onMove(id, p);
    }, C.ScreenSpaceEventType.LEFT_UP);
    v.screenSpaceEventHandler.removeInputAction(
      C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    return () => {
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
    const alive = new Set(p.objects.map((o) => o.id));
    for (const id of cache.current.keys())
      if (!alive.has(id)) {
        v.entities.removeById(id);
        for (let face = 0; face < 4; face++)
          v.entities.removeById(`${id}:roof${face}`);
        cache.current.delete(id);
      }
    for (const o of p.objects) {
      let entity = v.entities.getById(o.id);
      if (
        cache.current.get(o.id) !== o ||
        opacityCache.current.get(o.id) !== props.opacity[o.kind]
      ) {
        if (entity) v.entities.remove(entity);
        for (let face = 0; face < 4; face++)
          v.entities.removeById(`${o.id}:roof${face}`);
        const selected = o.id === props.selected;
        const color = C.Color.fromCssColorString(o.color);
        const e: { id: string; [k: string]: unknown } = {
          id: o.id,
          name: o.name,
        };
        if (o.kind === "boundary" || o.kind === "plot") {
          e.polygon = polygon(
            o.points,
            o.kind === "boundary" ? 0 : 0.15,
            0,
            (o.kind === "boundary"
              ? C.Color.fromCssColorString("#f7faf5")
              : color
            ).withAlpha(
              (o.kind === "boundary" ? 0.96 : 0.12) * props.opacity[o.kind],
            ),
          );
          e.polyline = {
            positions: [...o.points, o.points[0]].map((q) => position(q, 0.3)),
            width: o.kind === "boundary" ? 3 : 2,
            material: C.Color.fromCssColorString("#25b895"),
          };
        } else if (o.kind === "road") {
          e.polyline = {
            positions: o.points.map((q) => position(q, o.elevation + 0.3)),
            width: 3,
            material: selected
              ? C.Color.YELLOW
              : C.Color.WHITE.withAlpha(0.75 * props.opacity[o.kind]),
          };
        } else if (o.kind === "building") {
          e.polygon = polygon(
            footprint(o),
            o.elevation + 0.2,
            o.floors * o.floorHeight,
            color.withAlpha(props.opacity[o.kind]),
          );
          if (o.roof === "pitched") {
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
                    props.opacity[o.kind],
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
          if (o.kind === "tree")
            e.ellipsoid = {
              radii: new C.Cartesian3(3 * scale, 3 * scale, 5 * scale),
              material: C.Color.fromCssColorString("#36775a"),
            };
          else
            e.box = {
              dimensions: new C.Cartesian3(
                (o.kind === "bridge" ? o.width : o.kind === "car" ? 2 : 2) *
                  scale,
                (o.kind === "bridge" ? o.depth : o.kind === "car" ? 4.5 : 0.7) *
                  scale,
                (o.kind === "bridge" ? 0.8 : o.kind === "car" ? 1.5 : 1) *
                  scale,
              ),
              material:
                o.kind === "car"
                  ? C.Color.fromCssColorString("#d99152").withAlpha(
                      props.opacity[o.kind],
                    )
                  : C.Color.fromCssColorString("#8d9ca0").withAlpha(
                      props.opacity[o.kind],
                    ),
            };
        }
        entity = v.entities.add(e as C.Entity.ConstructorOptions);
        cache.current.set(o.id, o);
        opacityCache.current.set(o.id, props.opacity[o.kind]);
      }
      entity!.show = props.visible[o.kind];
      for (let face = 0; face < 4; face++) {
        const roof = v.entities.getById(`${o.id}:roof${face}`);
        if (roof) roof.show = props.visible[o.kind];
      }
      if (o.kind === "road" && entity?.polyline)
        entity.polyline.material = new C.ColorMaterialProperty(
          o.id === props.selected
            ? C.Color.YELLOW
            : C.Color.WHITE.withAlpha(0.75 * props.opacity[o.kind]),
        );
    }
    // A single transient highlight avoids mutating stored design objects.
    v.entities.removeById("_selection");
    const selected = p.objects.find((o) => o.id === props.selected);
    if (selected) {
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
  ]);
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    const w = new Worker(new URL("./geometry.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = ({ data }) => {
      if (v.isDestroyed()) return;
      if (data.error) {
        props.onError(data.error);
        return;
      }
      for (const e of [...v.entities.values])
        if (e.id.startsWith("_surface")) v.entities.remove(e);
      let i = 0;
      for (const s of data.surfaces)
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
              height: s.elevation + 0.1,
              material: C.Color.fromCssColorString("#54616a").withAlpha(
                props.opacity.road,
              ),
            },
          });
        }
      v.scene.requestRender();
    };
    w.postMessage({
      id: 1,
      roads: props.project.objects.filter((o) => o.kind === "road"),
    });
    return () => w.terminate();
  }, [roadKey, props.visible.road, props.opacity.road]);
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
      className="viewport"
      ref={container}
      aria-label="3D planning viewport"
    />
  );
}
