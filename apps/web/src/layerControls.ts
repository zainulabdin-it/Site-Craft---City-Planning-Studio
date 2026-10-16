import {
  kinds,
  type DesignObject,
  type LayerControl,
  type Project,
} from "./model";

export const utilityTypes = [
  "water",
  "wastewater",
  "stormwater",
  "electricity",
  "gas",
  "telecom",
] as const;
export const utilityLabels: Record<string, string> = {
  water: "Water supply",
  wastewater: "Sewerage",
  stormwater: "Stormwater",
  electricity: "Electricity",
  gas: "Gas",
  telecom: "Telecom / fibre",
};
export function getLayerControl(project: Project, id: string): LayerControl {
  const kind = id.startsWith("design:") ? id.slice(7) : "";
  const design = project.designLayers.find((layer) => layer.kind === kind);
  const reference = id.startsWith("data:")
    ? project.dataLayers.find((layer) => layer.id === id.slice(5))
    : undefined;
  return (
    project.layerControls?.find((layer) => layer.id === id) ?? {
      id,
      visible: design?.visible ?? reference?.visible ?? true,
      opacity: design?.opacity ?? reference?.opacity ?? 1,
      locked: id.startsWith("data:") || id === "basemap",
      displayOffsetM: 0,
    }
  );
}
export function updateLayerControl(
  project: Project,
  id: string,
  changes: Partial<LayerControl>,
): Project {
  return {
    ...project,
    layerControls: [
      ...(project.layerControls ?? []).filter((layer) => layer.id !== id),
      { ...getLayerControl(project, id), ...changes, id },
    ],
  };
}
export function displayOffset(
  project: Project,
  id: string,
  viewMode: string,
): number {
  if (viewMode === "2d") return 0;
  const offset = getLayerControl(project, id).displayOffsetM;
  if (!project.layerPresentation?.exploded) return offset;
  const order = [
    ...utilityTypes.map((type) => `utility:${type}`),
    ...project.designLayers.map((layer) => `design:${layer.kind}`),
    ...project.dataLayers.map((layer) => `data:${layer.id}`),
  ];
  return (
    offset +
    (Math.max(0, order.indexOf(id)) + 1) * project.layerPresentation.spacingM
  );
}
export function assertLayersEditable(
  project: Project,
  objects: DesignObject[],
) {
  for (const object of objects)
    if (getLayerControl(project, `design:${object.kind}`).locked)
      throw Error(
        `The ${object.kind} layer is locked. Unlock it in Layers before editing.`,
      );
}
