import * as C from "cesium";
import type { Project } from "./model";
import { displayOffset, getLayerControl } from "./layerControls";

type Applied = { offset: number; clamp?: C.Property };
export function applyLayerPresentation(
  viewer: C.Viewer,
  project: Project,
  viewMode: string,
  applied: WeakMap<C.Entity, Applied>,
) {
  const time = viewer.clock.currentTime;
  const kinds = new Map(
    project.objects.map((object) => [object.id, object.kind]),
  );
  const utilities = new Map(
    project.utilityNetworks.map((network) => [network.id, network.type]),
  );
  const background = getLayerControl(project, "basemap");
  for (let i = 0; i < viewer.imageryLayers.length; i++) {
    const layer = viewer.imageryLayers.get(i);
    layer.show = background.visible;
    layer.alpha = background.opacity;
  }
  for (const entity of viewer.entities.values) {
    const id = String(entity.id),
      parts = id.split(":");
    const kind = kinds.get(parts[0]);
    const key = kind
      ? `design:${kind}`
      : id.startsWith("_utility:")
        ? `utility:${utilities.get(parts[1])}`
        : id.startsWith("_data:")
          ? `data:${parts[1]}`
          : /^_(surface|curb|sidewalk)/.test(id)
            ? "design:road"
            : null;
    if (!key) continue;
    const offset = displayOffset(project, key, viewMode);
    const state = applied.get(entity) ?? {
      offset: 0,
      clamp: entity.polyline?.clampToGround,
    };
    const delta = offset - state.offset;
    if (Math.abs(delta) < 0.0001) continue;
    const position = entity.position?.getValue(time);
    if (position) {
      const cartographic = C.Cartographic.fromCartesian(position);
      cartographic.height += delta;
      entity.position = new C.ConstantPositionProperty(
        C.Cartographic.toCartesian(cartographic),
      );
    }
    for (const geometry of [entity.polygon, entity.ellipse])
      if (geometry) {
        const height = geometry.height?.getValue(time) ?? 0;
        geometry.height = new C.ConstantProperty(height + delta);
        if (geometry.extrudedHeight)
          geometry.extrudedHeight = new C.ConstantProperty(
            geometry.extrudedHeight.getValue(time) + delta,
          );
      }
    const positions = entity.polyline?.positions?.getValue(time) as
      C.Cartesian3[] | undefined;
    if (entity.polyline && positions) {
      entity.polyline.positions = new C.ConstantProperty(
        positions.map((position) => {
          const cartographic = C.Cartographic.fromCartesian(position);
          cartographic.height += delta;
          return C.Cartographic.toCartesian(cartographic);
        }),
      );
      entity.polyline.clampToGround = offset
        ? new C.ConstantProperty(false)
        : state.clamp;
    }
    state.offset = offset;
    applied.set(entity, state);
  }
}
