import { LockKeyhole, UnlockKeyhole, Layers } from "lucide-react";
import { type Kind, type LayerControl, type Project } from "./model";
import { getLayerControl, utilityLabels, utilityTypes } from "./layerControls";

export function LayerWorkspace({
  project,
  onUpdate,
  onPresentation,
  onImport,
  terrainAvailable,
  onReorder,
  onBrowse,
}: {
  project: Project;
  onUpdate: (id: string, changes: Partial<LayerControl>) => void;
  onPresentation: (changes: Partial<Project["layerPresentation"]>) => void;
  onImport: () => void;
  terrainAvailable: boolean;
  onReorder: (order: Kind[]) => void;
  onBrowse: (kind: Kind) => void;
}) {
  const reference = project.dataLayers.filter((layer) => !layer.hazardType);
  const hazards = project.dataLayers.filter((layer) => layer.hazardType);
  const groups = [
    {
      name: "Existing data",
      rows: [
        { id: "basemap", name: "Background map", count: undefined },
        ...reference.map((layer) => ({
          id: `data:${layer.id}`,
          name: layer.name,
          count: layer.features.length,
        })),
      ],
    },
    {
      name: "Proposed design",
      rows: project.designLayers.map(({ kind }) => ({
        id: `design:${kind}`,
        name:
          kind === "boundary"
            ? "Site boundaries"
            : kind === "plot"
              ? "Plots"
              : kind[0].toUpperCase() + kind.slice(1),
        count: project.objects.filter((object) => object.kind === kind).length,
      })),
    },
    {
      name: "Utility networks",
      rows: utilityTypes.map((type) => ({
        id: `utility:${type}`,
        name: utilityLabels[type],
        count: project.utilityNetworks.filter(
          (network) => network.type === type,
        ).length,
      })),
    },
    {
      name: "Analysis & hazards",
      rows: hazards.map((layer) => ({
        id: `data:${layer.id}`,
        name: layer.name,
        count: layer.features.length,
      })),
    },
  ];
  return (
    <div className="layer-workspace">
      <section className="layer-presentation">
        <label>
          <input
            type="checkbox"
            aria-label="Exploded layer view"
            checked={project.layerPresentation.exploded}
            onChange={(event) =>
              onPresentation({ exploded: event.target.checked })
            }
          />{" "}
          Exploded view (3D)
        </label>
        <details
          className="layer-display-options"
          open={project.layerPresentation.exploded}
        >
          <summary>Spacing and display options</summary>
          <label className="field">
            Layer spacing (m)
            <input
              aria-label="Layer spacing (m)"
              type="range"
              min="0"
              max="100"
              step="5"
              value={project.layerPresentation.spacingM}
              onChange={(event) =>
                onPresentation({ spacingM: Number(event.target.value) })
              }
            />
            <span>{project.layerPresentation.spacingM} m</span>
          </label>
          <small>
            Display spacing only. Stored coordinates and network connections
            stay unchanged. Assemble layers before dragging geometry.
          </small>
          <button onClick={() => onPresentation({ exploded: false })}>
            Assemble layers
          </button>
        </details>
      </section>
      <button className="wide import-layer" onClick={onImport}>
        Import GIS layer (GeoJSON)
      </button>
      {groups.map((group) => (
        <details className="gis-layer-group" key={group.name} open>
          <summary>
            <Layers size={14} />
            {group.name}
            <small>{group.rows.length}</small>
          </summary>
          {group.name === "Existing data" && (
            <p className="layer-source-note">
              Terrain elevation:{" "}
              {terrainAvailable ? "configured source available" : "not loaded"}.
              Slope and land ownership need separate source data.
            </p>
          )}
          {!group.rows.length && (
            <p className="layer-source-note">
              No hazard datasets imported. This does not mean the site is safe.
            </p>
          )}
          {group.rows.map((row) => {
            const control = getLayerControl(project, row.id);
            return (
              <details className="layer-control-card" key={row.id}>
                <summary>
                  <input
                    aria-label={`Show ${row.name} layer`}
                    type="checkbox"
                    checked={control.visible}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onUpdate(row.id, { visible: event.target.checked })
                    }
                  />
                  <span>{row.name}</span>
                  <small>{row.count}</small>
                  {row.id.startsWith("design:") &&
                    ([-1, 1] as const).map((direction) => {
                      const kind = row.id.slice(7) as Kind;
                      const order = project.designLayers.map(
                        (layer) => layer.kind,
                      );
                      const index = order.indexOf(kind);
                      return (
                        <button
                          key={direction}
                          aria-label={`Move ${row.name} layer ${direction < 0 ? "up" : "down"}`}
                          disabled={
                            index + direction < 0 ||
                            index + direction >= order.length
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            [order[index], order[index + direction]] = [
                              order[index + direction],
                              order[index],
                            ];
                            onReorder(order);
                          }}
                        >
                          {direction < 0 ? "↑" : "↓"}
                        </button>
                      );
                    })}
                  <button
                    aria-label={`${control.locked ? "Unlock" : "Lock"} ${row.name} layer`}
                    disabled={row.id === "basemap"}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onUpdate(row.id, { locked: !control.locked });
                    }}
                  >
                    {control.locked ? (
                      <LockKeyhole size={14} />
                    ) : (
                      <UnlockKeyhole size={14} />
                    )}
                  </button>
                </summary>
                <label className="field">
                  Opacity
                  <input
                    aria-label={`${row.name} opacity`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={control.opacity}
                    onChange={(event) =>
                      onUpdate(row.id, { opacity: Number(event.target.value) })
                    }
                  />
                  <span>{Math.round(control.opacity * 100)}%</span>
                </label>
                {row.id !== "basemap" && (
                  <label className="field">
                    Display offset (m)
                    <input
                      aria-label={`${row.name} display offset (m)`}
                      type="number"
                      min="-200"
                      max="500"
                      value={control.displayOffsetM}
                      onChange={(event) => {
                        if (Number.isFinite(event.target.valueAsNumber))
                          onUpdate(row.id, {
                            displayOffsetM: event.target.valueAsNumber,
                          });
                      }}
                    />
                  </label>
                )}
                {row.id.startsWith("design:") && (
                  <button onClick={() => onBrowse(row.id.slice(7) as Kind)}>
                    View objects ({row.count})
                  </button>
                )}
                <small>
                  {row.id === "basemap"
                    ? "Reference imagery. Display controls only."
                    : row.id.startsWith("data:")
                      ? control.locked
                        ? "Reference data is protected. Display settings remain adjustable."
                        : "Reference removal is enabled. Source geometry editing is not available."
                      : row.id.startsWith("utility:") && row.count === 0
                        ? "No network drawn yet. Settings will apply when a corridor is added."
                        : control.locked
                          ? "Geometry is protected. Display settings remain adjustable."
                          : row.id.startsWith("utility:")
                            ? "Edit corridor settings in Utilities."
                            : "Geometry editing is enabled."}
                </small>
              </details>
            );
          })}
        </details>
      ))}
    </div>
  );
}
