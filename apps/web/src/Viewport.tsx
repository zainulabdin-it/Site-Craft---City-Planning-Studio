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
    ) => ({
      uri,
      scale,
      color: C.Color.WHITE.withAlpha(alpha),
      colorBlendMode: C.ColorBlendMode.HIGHLIGHT,
      colorBlendAmount: 0,
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
        opacityCache.current.get(o.id) !== props.opacity[o.kind]
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
          e.polygon = polygon(
            o.points,
            o.kind === "boundary" ? 0 : 0.15,
            0,
            (o.kind === "boundary"
              ? C.Color.fromCssColorString("#f7faf5")
              : color
            ).withAlpha(
              (o.kind === "boundary" ? 0.86 : 0.42) * props.opacity[o.kind],
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
            width: selected ? 5 : 2.5,
            material: selected
              ? C.Color.fromCssColorString("#f8b84b")
              : new C.PolylineDashMaterialProperty({
                  color: C.Color.fromCssColorString("#f3c94b").withAlpha(
                    props.opacity[o.kind],
                  ),
                  dashLength: 18,
                }),
          };
        } else if (o.kind === "building") {
          const useHouseModel =
            o.buildingType === "Detached house" ||
            o.buildingType === "Townhouse";
          const houseUri =
            o.buildingType === "Townhouse"
              ? "/assets/kenney/suburban/building-type-t.glb"
              : variant === "k"
                ? "/assets/kenney/suburban/building-type-k.glb"
                : o.roof === "pitched"
                  ? "/assets/kenney/suburban/building-type-f.glb"
                  : "/assets/kenney/suburban/building-type-a.glb";
          const houseScale = Math.min(o.width, o.depth) * o.scale * 0.62;
          if (useHouseModel) {
            e.position = position(o.points[0], o.elevation + houseScale);
            e.orientation = C.Transforms.headingPitchRollQuaternion(
              position(o.points[0]),
              new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
            );
            e.model = model(
              houseUri,
              houseScale,
              props.opacity[o.kind],
              selected,
            );
          } else {
            e.polygon = polygon(
              footprint(o),
              o.elevation + 0.2,
              o.floors * o.floorHeight,
              color.withAlpha(props.opacity[o.kind]),
            );
            v.entities.add({
              id: `${o.id}:roof-cap`,
              polygon: polygon(
                footprint(o),
                o.elevation + o.floors * o.floorHeight + 0.15,
                0.35,
                C.Color.fromCssColorString("#5b6470").withAlpha(
                  props.opacity[o.kind],
                ),
              ),
            });
          }
          const buildingOrientation = C.Transforms.headingPitchRollQuaternion(
            position(o.points[0]),
            new C.HeadingPitchRoll((-o.rotation * Math.PI) / 180, 0, 0),
          );
          for (
            let floor = 0;
            !useHouseModel && floor < Math.min(o.floors, 12);
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
                  props.opacity[o.kind] * 0.78,
                ),
              },
            });
          if (!useHouseModel && o.roof === "pitched") {
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
          if (o.kind === "tree") {
            const palm = variant === "palm",
              columnar = variant === "columnar";
            if (!palm && !columnar) {
              const treeScale = 4.8 * scale;
              e.position = position(o.points[0], z + treeScale);
              e.model = model(
                variant === "small"
                  ? "/assets/kenney/suburban/tree-small.glb"
                  : "/assets/kenney/suburban/tree-large.glb",
                treeScale,
                props.opacity[o.kind],
                selected,
              );
            } else {
              e.ellipsoid = {
                radii: new C.Cartesian3(
                  (palm ? 2.8 : 1.8) * scale,
                  (palm ? 2.8 : 1.8) * scale,
                  (palm ? 1.5 : 5.2) * scale,
                ),
                material: C.Color.fromCssColorString("#2f7d4f").withAlpha(
                  props.opacity[o.kind],
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
                    props.opacity[o.kind],
                  ),
                },
              });
            }
          } else {
            if (o.kind === "car") {
              const carUri =
                variant === "van"
                  ? "/assets/kenney/cars/van.glb"
                  : variant === "suv"
                    ? "/assets/kenney/cars/suv.glb"
                    : "/assets/kenney/cars/sedan.glb";
              const carScale = 2.25 * scale;
              e.position = position(o.points[0], z + carScale);
              e.model = model(
                carUri,
                carScale,
                props.opacity[o.kind],
                selected,
              );
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
                ).withAlpha(props.opacity[o.kind]),
              };
            if (o.kind === "bench") {
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
                      props.opacity[o.kind],
                    ),
                  },
                });
              v.entities.add({
                id: `${o.id}:back`,
                position: position(o.points[0], z + 1.35 * scale),
                orientation: e.orientation as C.Quaternion,
                box: {
                  dimensions: new C.Cartesian3(
                    (variant === "modern" ? 2.7 : 2.1) * scale,
                    (variant === "stone" ? 0.4 : 0.22) * scale,
                    (variant === "stone" ? 0.65 : 1) * scale,
                  ),
                  material: C.Color.fromCssColorString(
                    variant === "stone"
                      ? "#a8a29e"
                      : variant === "modern"
                        ? "#4b5563"
                        : "#8b5e3c",
                  ).withAlpha(props.opacity[o.kind]),
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
              for (const side of [-1, 1])
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
                      1.2 * scale,
                    ),
                    material: C.Color.fromCssColorString("#6b7280").withAlpha(
                      props.opacity[o.kind],
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
                      props.opacity[o.kind],
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
                        ).withAlpha(props.opacity[o.kind]),
                      },
                    });
                  }
            }
          }
        }
        entity = v.entities.add(e as C.Entity.ConstructorOptions);
        cache.current.set(o.id, o);
        opacityCache.current.set(o.id, props.opacity[o.kind]);
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
                color: C.Color.fromCssColorString("#f3c94b").withAlpha(
                  props.opacity[o.kind],
                ),
                dashLength: 18,
              });
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
              material: C.Color.fromCssColorString("#d9d7cf").withAlpha(
                props.opacity.road,
              ),
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
              material: C.Color.fromCssColorString("#3f474d").withAlpha(
                props.opacity.road,
              ),
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
