import { useState, useRef, useEffect } from "react";
import {
  MousePointer2,
  Pentagon,
  Route,
  Building2,
  Trees,
  Car,
  Box,
  Undo2,
  Redo2,
  Save,
  Download,
  Plus,
  Move,
  Trash2,
  Copy,
  Focus,
  Layers,
  ChevronRight,
  MapPin,
  X,
  Search,
  RotateCcw,
  FolderOpen,
  Minus,
  Maximize,
  Compass,
  Globe2,
  PanelLeftClose,
  PanelRightClose,
  Circle,
  Square,
  Pencil,
} from "lucide-react";
import {
  newProject,
  demoProject,
  newObject,
  kinds,
  type Project,
  type Kind,
  type Point,
  type DesignObject,
  type DataLayer,
} from "./model";
import {
  validateProject,
  connectRoad,
  length,
  area,
  distance,
  moveTo,
} from "./geometry";
import { command, applyCommand, type Command } from "./history";
import {
  listLocal,
  saveLocal,
  saveServer,
  loadServer,
  download,
  saveToComputer,
} from "./persistence";
import { Viewport, type ViewAction } from "./Viewport";
import { searchLocations, type LocationResult } from "./geocoding";
import { importGeoJSON } from "./geojson";
function initial() {
  try {
    const all = listLocal();
    const saved = all.find(
      (p) => p.id === localStorage.getItem("sitecraft.active"),
    );
    return {
      project: saved || demoProject(),
      status: saved ? "Saved" : "Unsaved",
      error: "",
    };
  } catch {
    return {
      project: demoProject(),
      status: "Restore failed",
      error:
        "Saved browser data could not be read. The demo is open; existing stored data has not been overwritten.",
    };
  }
}
const icons = {
  boundary: Pentagon,
  road: Route,
  building: Building2,
  plot: Pentagon,
  tree: Trees,
  car: Car,
  bench: Box,
  bridge: Box,
};
export default function App() {
  const [boot] = useState(initial);
  const [project, setProject] = useState<Project>(boot.project),
    [selected, setSelected] = useState(""),
    [tool, setTool] = useState<
      Kind | "select" | "move" | "rectangle" | "circle" | "freehand"
    >("select"),
    [draft, setDraft] = useState<Point[]>([]),
    [visible, setVisible] = useState(
      Object.fromEntries(
        boot.project.designLayers.map((layer) => [layer.kind, layer.visible]),
      ) as Record<Kind, boolean>,
    ),
    [opacity, setOpacity] = useState<Record<Kind, number>>(
      Object.fromEntries(
        boot.project.designLayers.map((layer) => [layer.kind, layer.opacity]),
      ) as Record<Kind, number>,
    ),
    [layerOrder, setLayerOrder] = useState<Kind[]>(
      boot.project.designLayers.map((layer) => layer.kind),
    ),
    [engine, setEngine] = useState("Cesium 3D"),
    [layersOpen, setLayersOpen] = useState(true),
    [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(false),
    [toolsOpen, setToolsOpen] = useState(true),
    [status, setStatus] = useState(boot.status),
    [error, setError] = useState(boot.error),
    [context, setContext] = useState("Loading map…"),
    [undo, setUndo] = useState<Command[]>([]),
    [redo, setRedo] = useState<Command[]>([]),
    [action, setAction] = useState<ViewAction>({ type: "frame", seq: 0 }),
    [dialog, setDialog] = useState<"new" | "open" | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [name, setName] = useState(""),
    [storage, setStorage] = useState<"local" | "server">("local"),
    [locationQuery, setLocationQuery] = useState(""),
    [locationResults, setLocationResults] = useState<LocationResult[]>([]),
    [searching, setSearching] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    version = useRef(0);
  const current = project.objects.find((o) => o.id === selected);
  const edit = (
    updates: DesignObject[],
    remove: string[] = [],
    label = "Edit object",
  ) => {
    try {
      const c = command(project, label, updates, remove);
      const p = applyCommand(project, c);
      setProject(p);
      version.current++;
      setUndo([...undo, c].slice(-100));
      setRedo([]);
      setStatus("Unsaved");
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const frame = (id?: string, type: ViewAction["type"] = "frame") =>
    setAction({ id, type, seq: Date.now() });
  const persistDesignLayers = (
    order: Kind[],
    nextVisible = visible,
    nextOpacity = opacity,
  ) => {
    setProject((p) => ({
      ...p,
      designLayers: order.map((kind) => ({
        kind,
        visible: nextVisible[kind],
        opacity: nextOpacity[kind],
      })),
    }));
    version.current++;
    setStatus("Unsaved");
  };
  const cancel = () => {
    setDraft([]);
    setTool("select");
  };
  const history = (back: boolean) => {
    try {
      const stack = back ? undo : redo,
        c = stack.at(-1);
      if (!c) return;
      setProject(applyCommand(project, c, back));
      version.current++;
      if (back) {
        setUndo(undo.slice(0, -1));
        setRedo([...redo, c]);
      } else {
        setRedo(redo.slice(0, -1));
        setUndo([...undo, c]);
      }
      setStatus("Unsaved");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "Escape") cancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history(!e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const finish = () => {
    if (!["boundary", "road", "plot", "freehand"].includes(tool)) return;
    const objectKind = tool === "freehand" ? "plot" : tool;
    let o = newObject(project, objectKind as Kind, draft);
    if (tool === "freehand") o.name = "Free style shape";
    const existing = project.objects.find((x) => x.kind === "boundary");
    if (tool === "boundary" && existing)
      o = { ...o, id: existing.id, name: existing.name };
    const updates = tool === "road" ? connectRoad(o, project.objects) : [o];
    if (edit(updates, [], `Draw ${tool}`)) {
      setSelected(o.id);
      cancel();
      if (tool === "boundary") frame(o.id, "top");
    }
  };
  const click = (p: Point, id?: string) => {
    if (tool === "select") {
      setSelected(project.objects.some((o) => o.id === id) ? id! : "");
      return;
    }
    if (tool === "move") {
      if (!current) {
        const target = project.objects.find((o) => o.id === id);
        if (target && target.kind !== "boundary") {
          setSelected(target.id);
          setError("");
          return;
        }
        setError("Click an object, then click its new position.");
        return;
      }
      if (current.kind === "boundary") {
        setError("Edit the boundary vertices in the inspector.");
        setTool("select");
        return;
      }
      updateConnected(moveTo(current, p));
      return;
    }
    if (
      !project.objects.some((o) => o.kind === "boundary") &&
      tool !== "boundary"
    ) {
      setError("Draw a project boundary first.");
      return;
    }
    if (tool === "rectangle" || tool === "circle") {
      if (!draft.length) {
        setDraft([p]);
        return;
      }
      const start = draft[0];
      const points: Point[] =
        tool === "rectangle"
          ? [start, [p[0], start[1]], p, [start[0], p[1]]]
          : Array.from({ length: 36 }, (_, i) => {
              const angle = (i / 36) * Math.PI * 2,
                radius = distance(start, p);
              return [
                start[0] + Math.cos(angle) * radius,
                start[1] + Math.sin(angle) * radius,
              ] as Point;
            });
      const shape = newObject(project, "plot", points);
      shape.name = tool === "rectangle" ? "Rectangle" : "Circle";
      if (edit([shape], [], `Draw ${tool}`)) {
        setSelected(shape.id);
        setDraft([]);
      }
      return;
    }
    if (["boundary", "road", "plot", "freehand"].includes(tool)) {
      if (draft.length && distance(draft.at(-1)!, p) < 0.1) return;
      setDraft([...draft, p]);
      return;
    }
    const o = newObject(project, tool as Kind, [p]);
    if (edit([o], [], `Place ${tool}`)) setSelected(o.id);
  };
  const updateConnected = (o: DesignObject) => {
    const updates = [o];
    if (o.kind === "road")
      for (const r of project.objects.filter(
        (r) => r.kind === "road" && r.id !== o.id,
      )) {
        let changed = false;
        const points = r.points.map((p, i) => {
          const idx = o.nodeIds.indexOf(r.nodeIds[i]);
          if (idx >= 0) {
            changed = true;
            return o.points[idx];
          }
          return p;
        });
        if (changed) updates.push({ ...r, points });
      }
    return edit(updates);
  };
  const moveObject = (id: string, anchor: Point) => {
    const object = project.objects.find((o) => o.id === id);
    if (!object || object.kind === "boundary") return;
    setSelected(id);
    updateConnected(moveTo(object, anchor));
  };
  const save = async () => {
    const captured = version.current;
    setStatus("Saving…");
    try {
      if (storage === "server") {
        const saved = await saveServer(project);
        if (version.current === captured) {
          setProject(saved);
          saveLocal(saved);
        } else {
          setProject((p) =>
            p.id === saved.id ? { ...p, revision: saved.revision } : p,
          );
        }
      } else saveLocal(project);
      setStatus(version.current === captured ? "Saved" : "Unsaved");
      setError("");
    } catch (e) {
      setStatus("Save failed");
      setError(String(e));
    }
  };
  const switchProject = (p: Project) => {
    const validated = validateProject(p);
    setProject(validated);
    const nextVisible = Object.fromEntries(
        validated.designLayers.map((layer) => [layer.kind, layer.visible]),
      ) as Record<Kind, boolean>,
      nextOpacity = Object.fromEntries(
        validated.designLayers.map((layer) => [layer.kind, layer.opacity]),
      ) as Record<Kind, number>;
    setVisible(nextVisible);
    setOpacity(nextOpacity);
    setLayerOrder(validated.designLayers.map((layer) => layer.kind));
    version.current++;
    setSelected("");
    setUndo([]);
    setRedo([]);
    cancel();
    setStatus("Unsaved");
    setDialog(null);
    frame();
  };
  const updateDataLayer = (id: string, changes: Partial<DataLayer>) => {
    setProject((p) => ({
      ...p,
      dataLayers: p.dataLayers.map((layer) =>
        layer.id === id ? { ...layer, ...changes } : layer,
      ),
    }));
    version.current++;
    setStatus("Unsaved");
  };
  const open = async () => {
    try {
      setProjects(storage === "server" ? await loadServer() : listLocal());
      setDialog("open");
    } catch (e) {
      setError(String(e));
    }
  };
  const searchMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    try {
      const results = await searchLocations(locationQuery);
      setLocationResults(results);
      setError(results.length ? "" : "No matching locations found.");
    } catch (e) {
      setLocationResults([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };
  const goToLocation = (result: LocationResult) => {
    setLocationQuery(result.name);
    setLocationResults([]);
    setAction({
      type: "location",
      location: { center: result.center, bounds: result.bounds },
      seq: Date.now(),
    });
  };
  const openComputerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 5_000_000) throw Error("Project file exceeds 5 MB.");
      const parsed = JSON.parse(await f.text());
      if (
        f.name.toLowerCase().endsWith(".geojson") ||
        parsed?.type === "FeatureCollection" ||
        parsed?.type === "Feature"
      ) {
        const layer = importGeoJSON(parsed, f.name);
        setProject((p) => ({ ...p, dataLayers: [...p.dataLayers, layer] }));
        version.current++;
        setStatus("Unsaved");
        setLeftOpen(true);
        setLayersOpen(true);
        setError("");
      } else switchProject(validateProject(parsed));
    } catch (err) {
      setError(String(err));
    }
    e.target.value = "";
  };
  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">s</span>sitecraft
          <span className="studio">PLANNING STUDIO</span>
        </div>
        <nav className="top-nav" aria-label="Application menu">
          <button
            onClick={() => {
              setName("New Christchurch site");
              setDialog("new");
            }}
          >
            <FolderOpen size={16} /> Project
          </button>
          <button onClick={() => setTool("select")}>
            <MousePointer2 size={16} /> Edit
          </button>
          <button onClick={() => setAction({ type: "top", seq: Date.now() })}>
            <Compass size={16} /> View
          </button>
        </nav>
        <div className="project-title">
          {project.name}
          <span> / {project.scenarioName}</span>
        </div>
        <div className="header-map-actions">
          <span className="pill">
            <span className="live-dot" /> CONCEPT DESIGN
          </span>
          <form className="location-search" onSubmit={searchMap}>
            <label>
              <Search size={15} />
              <input
                aria-label="Search map location in header"
                placeholder="Search in New Zealand"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={searching || locationQuery.trim().length < 2}
            >
              {searching ? "…" : "Search"}
            </button>
            {locationResults.length > 0 && (
              <div className="location-results" role="listbox">
                {locationResults.map((result) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={result.id}
                    onClick={() => goToLocation(result)}
                  >
                    <MapPin size={14} />
                    <span>{result.name}</span>
                  </button>
                ))}
                <small>New Zealand search · © OpenStreetMap contributors</small>
              </div>
            )}
          </form>
          <button
            className="return-project"
            onClick={() => frame(undefined, "top")}
          >
            <RotateCcw size={14} /> Return to project
          </button>
        </div>
        <span className={`save-state ${status === "Saved" ? "saved" : ""}`}>
          ● {status}
        </span>
        <select
          className="engine-picker"
          value={engine}
          onChange={(e) => {
            setEngine(e.target.value);
            setContext(`${e.target.value} view · synced to project`);
          }}
          aria-label="Rendering engine"
        >
          <option>Cesium 3D</option>
          <option disabled>MapLibre (coming soon)</option>
          <option disabled>Mapbox (coming soon)</option>
        </select>
        <button
          onClick={save}
          disabled={status === "Saving…"}
          className="primary"
        >
          <Save size={15} /> Save project
        </button>
      </header>
      <div
        className={`workspace ${leftOpen ? "left-open" : "left-collapsed"} ${rightOpen ? "right-open" : "right-collapsed"}`}
      >
        {leftOpen ? (
          <aside className="left">
            <button
              className="panel-collapse"
              aria-label="Collapse layers panel"
              title="Collapse layers panel"
              onClick={() => setLeftOpen(false)}
            >
              <PanelLeftClose size={16} />
            </button>
            <div className="eyebrow">
              WORKSPACE <span>01</span>
            </div>
            <h2>Your next place.</h2>
            <p className="muted">Shape a proposal in its real-world context.</p>
            <div className="project-buttons">
              <button
                onClick={() => {
                  setName("New Christchurch site");
                  setDialog("new");
                }}
              >
                <Plus size={14} />
                New
              </button>
              <button onClick={open}>Open project</button>
              <button onClick={() => switchProject(demoProject())}>
                Open demo
              </button>
            </div>
            <label className="field">
              Save destination
              <select
                value={storage}
                onChange={(e) =>
                  setStorage(e.target.value as "local" | "server")
                }
              >
                <option value="local">This browser</option>
                <option value="server">Local API server</option>
              </select>
            </label>
            <button
              className="section-title layer-heading collapsible"
              onClick={() => setLayersOpen(!layersOpen)}
              aria-expanded={layersOpen}
            >
              <Layers size={15} /> Layers{" "}
              <span>
                {kinds.length + project.dataLayers.length}{" "}
                {layersOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {layersOpen && (
              <div className="layers">
                <button
                  className="wide import-layer"
                  onClick={() => file.current?.click()}
                >
                  <Plus size={14} /> Import GeoJSON
                </button>
                {layerOrder.map((k, index) => {
                  const Icon = icons[k];
                  return (
                    <div key={k} className="layer-card">
                      <div className="layer">
                        <input
                          aria-label={`Show ${k} layer`}
                          type="checkbox"
                          checked={visible[k]}
                          onChange={(e) => {
                            const next = { ...visible, [k]: e.target.checked };
                            setVisible(next);
                            persistDesignLayers(layerOrder, next, opacity);
                          }}
                        />
                        <Icon size={15} />
                        <span>
                          {k === "boundary"
                            ? "Site boundary"
                            : k[0].toUpperCase() + k.slice(1)}
                        </span>
                        <small>
                          {project.objects.filter((o) => o.kind === k).length}
                        </small>
                        <button
                          className="icon-button"
                          aria-label={`Move ${k} layer up`}
                          disabled={index === 0}
                          onClick={() => {
                            const next = [...layerOrder];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            setLayerOrder(next);
                            persistDesignLayers(next);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Move ${k} layer down`}
                          disabled={index === layerOrder.length - 1}
                          onClick={() => {
                            const next = [...layerOrder];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            setLayerOrder(next);
                            persistDesignLayers(next);
                          }}
                        >
                          ↓
                        </button>
                      </div>
                      <label className="layer-opacity">
                        Opacity{" "}
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={opacity[k]}
                          style={{
                            background: `linear-gradient(to right, #2563eb ${opacity[k] * 100}%, #dbeafe ${opacity[k] * 100}%)`,
                          }}
                          onChange={(e) => {
                            const next = {
                              ...opacity,
                              [k]: Number(e.target.value),
                            };
                            setOpacity(next);
                            persistDesignLayers(layerOrder, visible, next);
                          }}
                        />
                        <span>{Math.round(opacity[k] * 100)}%</span>
                      </label>
                    </div>
                  );
                })}
                {project.dataLayers.map((layer) => (
                  <div key={layer.id} className="layer-card imported-layer">
                    <div className="layer">
                      <input
                        aria-label={`Show ${layer.name} layer`}
                        type="checkbox"
                        checked={layer.visible}
                        onChange={(e) =>
                          updateDataLayer(layer.id, {
                            visible: e.target.checked,
                          })
                        }
                      />
                      <Layers size={15} />
                      <span title={layer.name}>{layer.name}</span>
                      <small>{layer.features.length}</small>
                      <input
                        aria-label={`${layer.name} color`}
                        className="layer-color"
                        type="color"
                        value={layer.color}
                        onChange={(e) =>
                          updateDataLayer(layer.id, { color: e.target.value })
                        }
                      />
                      <button
                        className="icon-button"
                        aria-label={`Delete ${layer.name} layer`}
                        onClick={() => {
                          setProject((p) => ({
                            ...p,
                            dataLayers: p.dataLayers.filter(
                              (x) => x.id !== layer.id,
                            ),
                          }));
                          version.current++;
                          setStatus("Unsaved");
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <label className="layer-opacity">
                      Opacity
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layer.opacity}
                        style={{
                          background: `linear-gradient(to right, #2563eb ${layer.opacity * 100}%, #dbeafe ${layer.opacity * 100}%)`,
                        }}
                        onChange={(e) =>
                          updateDataLayer(layer.id, {
                            opacity: Number(e.target.value),
                          })
                        }
                      />
                      <span>{Math.round(layer.opacity * 100)}%</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div className="section-title">
              DESIGN OBJECTS <span>{project.objects.length}</span>
            </div>
            <div className="object-list">
              {project.objects.map((o) => {
                const Icon = icons[o.kind];
                return (
                  <button
                    key={o.id}
                    className={selected === o.id ? "object active" : "object"}
                    onClick={() => {
                      setSelected(o.id);
                      setTool("select");
                    }}
                  >
                    <Icon size={14} />
                    <span>{o.name}</span>
                    <ChevronRight size={13} />
                  </button>
                );
              })}
              {!project.objects.length && (
                <p className="muted">Start by drawing your site boundary.</p>
              )}
            </div>
            <button onClick={() => frame()} className="wide">
              <Focus size={15} /> Frame whole project
            </button>
            <div className="location-card">
              <MapPin size={17} />
              <div>
                <b>Christchurch, NZ</b>
                <small>43.5321° S · 172.6362° E</small>
              </div>
            </div>
          </aside>
        ) : (
          <div className="collapsed-rail left-rail">
            <button
              className="panel-tab"
              aria-label="Open project browser"
              onClick={() => setLeftOpen(true)}
            >
              <FolderOpen size={16} />
              <span>Browser</span>
            </button>
            <button
              className="panel-tab"
              aria-label="Open layers panel"
              onClick={() => setLeftOpen(true)}
            >
              <Layers size={16} />
              <span>Layers</span>
            </button>
          </div>
        )}
        <main>
          <Viewport
            project={project}
            selected={selected}
            visible={visible}
            opacity={opacity}
            draft={draft}
            onClick={click}
            onMove={moveObject}
            onError={setError}
            onContext={setContext}
            action={action}
          />
          <div className="map-top">
            <div className="map-actions">
              <span className="pill">
                <span className="live-dot" />
                CONCEPT DESIGN
              </span>
              <form className="location-search" onSubmit={searchMap}>
                <label>
                  <Search size={15} />
                  <input
                    aria-label="Search map location"
                    placeholder="Search in New Zealand"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  aria-label="Search location"
                  disabled={searching || locationQuery.trim().length < 2}
                >
                  {searching ? "Searching…" : "Search"}
                </button>
                {locationResults.length > 0 && (
                  <div className="location-results">
                    {locationResults.map((result) => (
                      <button
                        type="button"
                        key={result.id}
                        onClick={() => goToLocation(result)}
                      >
                        <MapPin size={14} />
                        <span>{result.name}</span>
                      </button>
                    ))}
                    <small>
                      New Zealand search · © OpenStreetMap contributors
                    </small>
                  </div>
                )}
              </form>
              <button
                className="return-project"
                onClick={() => frame(undefined, "top")}
              >
                <RotateCcw size={14} /> Return to project
              </button>
            </div>
            <div className="view-switch">
              <button onClick={() => frame(undefined, "top")}>2D</button>
              <button onClick={() => frame(undefined, "perspective")}>
                3D
              </button>
            </div>
          </div>
          {toolsOpen ? (
            <div className="toolbar">
              <button
                aria-label="Collapse tools"
                title="Collapse tools"
                onClick={() => setToolsOpen(false)}
              >
                <X size={19} />
              </button>
              {(
                [
                  ["select", MousePointer2, "Select"],
                  ["boundary", Pentagon, "Boundary"],
                  ["road", Route, "Road"],
                  ["building", Building2, "Building"],
                  ["plot", Pentagon, "Plot"],
                  ["rectangle", Square, "Rectangle"],
                  ["circle", Circle, "Circle"],
                  ["freehand", Pencil, "Free style"],
                  ["move", Move, "Move"],
                ] as const
              ).map(([t, Icon, label]) => (
                <button
                  key={t}
                  className={tool === t ? "active" : ""}
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    if (t === "move" && current?.kind === "boundary") {
                      setError("Edit the boundary vertices in the inspector.");
                      return;
                    }
                    setTool(t);
                    setDraft([]);
                  }}
                >
                  <Icon size={19} />
                </button>
              ))}
              <i />
              <button
                aria-label="Frame project"
                title="Frame project"
                onClick={() => frame()}
              >
                <Focus size={19} />
              </button>
              <button
                aria-label="Reset view"
                title="Reset view"
                onClick={() => frame(undefined, "top")}
              >
                <RotateCcw size={19} />
              </button>
              <i />
              <button
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!undo.length}
                onClick={() => history(true)}
              >
                <Undo2 size={19} />
              </button>
              <button
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!redo.length}
                onClick={() => history(false)}
              >
                <Redo2 size={19} />
              </button>
              <i />
              <button
                aria-label="Delete selected"
                title="Delete selected"
                disabled={!current}
                onClick={() => {
                  if (current && edit([], [current.id], "Delete object"))
                    setSelected("");
                }}
              >
                <Trash2 size={19} />
              </button>
              <button
                aria-label="Duplicate selected"
                title="Duplicate selected"
                disabled={!current}
                onClick={() =>
                  setError("Duplicate is available from the inspector.")
                }
              >
                <Copy size={19} />
              </button>
            </div>
          ) : (
            <button
              className="tools-tab"
              aria-label="Open tools"
              title="Open tools"
              onClick={() => setToolsOpen(true)}
            >
              <Move size={18} />
              <span>Tools</span>
            </button>
          )}
          <div className="zoom-controls" aria-label="Map zoom controls">
            <button
              aria-label="Fullscreen map"
              title="Fullscreen map"
              onClick={() => {
                const target = document.querySelector("main");
                if (document.fullscreenElement) document.exitFullscreen();
                else target?.requestFullscreen?.();
              }}
            >
              <Maximize size={18} />
            </button>
            <button
              aria-label="Reset north"
              title="Reset north"
              onClick={() => setAction({ type: "top", seq: Date.now() })}
            >
              <Compass size={18} />
            </button>
            <button
              aria-label="Toggle globe context"
              title="Toggle globe context"
              onClick={() => setContext("Cesium globe · OpenStreetMap imagery")}
            >
              <Globe2 size={18} />
            </button>
            <button
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => setAction({ type: "zoom-in", seq: Date.now() })}
            >
              <Plus size={16} />
            </button>
            <button
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => setAction({ type: "zoom-out", seq: Date.now() })}
            >
              <Minus size={16} />
            </button>
          </div>
          {tool !== "select" && (
            <div className="drawing-hint">
              <b>
                {tool === "move"
                  ? current
                    ? `Click a new position for ${current.name}, or drag it`
                    : "Click an object to move, then click its new position"
                  : `Click the map to ${["road", "boundary", "plot", "rectangle", "circle", "freehand"].includes(tool) ? "draw" : "place"} ${tool}`}
              </b>
              {["road", "boundary", "plot", "freehand"].includes(tool) && (
                <>
                  <span>
                    {draft.length} points ·{" "}
                    {tool === "road"
                      ? `${length(draft).toFixed(1)} m`
                      : `${area(draft).toFixed(0)} m²`}
                  </span>
                  <button
                    className="primary"
                    onClick={finish}
                    disabled={draft.length < (tool === "road" ? 2 : 3)}
                  >
                    Finish drawing
                  </button>
                </>
              )}
              <button onClick={cancel}>Cancel (Esc)</button>
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="map-bottom">
            <span>
              Coords: {project.origin[0].toFixed(5)},{" "}
              {project.origin[1].toFixed(5)}
            </span>
            <span>Zoom: 2.46</span>
            <span>Eye alt: 12,424 km</span>
            <span>Bearing: 0.0°</span>
            <span>Pitch: 0.0°</span>
            <span className="map-context">{context}</span>
            <span className="diagnostics">⚙ Diagnostics: 0</span>
          </div>
        </main>
        {rightOpen ? (
          <aside className="right">
            <button
              className="panel-collapse right-collapse"
              aria-label="Collapse inspector panel"
              title="Collapse inspector panel"
              onClick={() => setRightOpen(false)}
            >
              <PanelRightClose size={16} />
            </button>
            <div className="eyebrow">
              INSPECTOR <span>PROPOSAL</span>
            </div>
            {current ? (
              <Properties
                key={current.id}
                object={current}
                onUpdate={updateConnected}
                onFrame={() => frame(current.id)}
                onMove={() => {
                  setTool("move");
                  setDraft([]);
                }}
                onDelete={() => {
                  if (edit([], [current.id], "Delete object")) setSelected("");
                }}
                onDuplicate={() => {
                  if (current.kind === "boundary") {
                    setError("A project can have only one boundary.");
                    return;
                  }
                  const o = {
                    ...current,
                    id: crypto.randomUUID(),
                    name: current.name + " copy",
                    points: current.points.map(
                      ([x, y]) => [x + 20, y + 20] as Point,
                    ),
                    nodeIds: current.nodeIds.map(() => crypto.randomUUID()),
                  };
                  if (edit([o], [], "Duplicate object")) setSelected(o.id);
                }}
              />
            ) : (
              <div className="empty-inspector">
                <MousePointer2 size={30} />
                <h3>Make room for ideas.</h3>
                <p>
                  Select an object to edit its dimensions, placement and
                  appearance.
                </p>
              </div>
            )}
            <div className="section-title">
              ASSET LIBRARY <span>4</span>
            </div>
            <p className="muted small">
              Original low-detail concept placeholders
            </p>
            <div className="assets">
              {(["tree", "car", "bench", "bridge"] as Kind[]).map((k) => {
                const Icon = icons[k];
                return (
                  <button
                    key={k}
                    className={tool === k ? "active" : ""}
                    onClick={() => {
                      setTool(k);
                      setDraft([]);
                    }}
                  >
                    <Icon size={24} />
                    <span>{k[0].toUpperCase() + k.slice(1)}</span>
                  </button>
                );
              })}
            </div>
            <div className="export">
              <button
                onClick={async () => {
                  try {
                    await saveToComputer(project);
                  } catch (e) {
                    setError(`Computer save failed: ${String(e)}`);
                  }
                }}
              >
                <Download size={14} /> Save to computer
              </button>
              <button onClick={() => download(project, true)}>GeoJSON</button>
              <button onClick={() => file.current?.click()}>
                <FolderOpen size={14} /> Open from computer
              </button>
            </div>
          </aside>
        ) : (
          <button
            className="panel-tab right-tab"
            aria-label="Open inspector panel"
            onClick={() => setRightOpen(true)}
          >
            <Focus size={16} />
            <span>Inspector</span>
          </button>
        )}
      </div>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,.geojson,application/json,application/geo+json"
        onChange={openComputerFile}
      />
      <footer>
        <span>
          <span className="live-dot" /> LOCAL PLANNING WORKSPACE
        </span>
        <span>
          {project.objects.filter((o) => o.kind === "road").length} roads ·{" "}
          {project.objects.filter((o) => o.kind === "building").length}{" "}
          buildings
        </span>
        <span>Concept geometry · no engineering validation</span>
      </footer>
      {dialog && (
        <div className="modal-backdrop">
          <section role="dialog" className="modal">
            <h2>
              {dialog === "new" ? "Create a project" : "Open a saved project"}
            </h2>
            <p className="muted">
              Save your current work before switching projects.
            </p>
            {dialog === "new" ? (
              <>
                <label className="field">
                  Project name
                  <input
                    autoFocus
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={!name.trim()}
                  onClick={() => switchProject(newProject(name.trim()))}
                >
                  Create project
                </button>
              </>
            ) : (
              <>
                <div className="saved-projects">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => switchProject(p)}>
                      {p.name}
                      <small>{p.objects.length} objects</small>
                    </button>
                  ))}
                </div>
                {!projects.length && <p>No saved projects here yet.</p>}
                <button onClick={() => switchProject(demoProject())}>
                  Load labelled demo proposal
                </button>
              </>
            )}
            <button onClick={() => setDialog(null)}>Cancel</button>
          </section>
        </div>
      )}
    </div>
  );
}
function Properties({
  object: o,
  onUpdate,
  onFrame,
  onMove,
  onDelete,
  onDuplicate,
}: {
  object: DesignObject;
  onUpdate: (o: DesignObject) => boolean;
  onFrame: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [vertices, setVertices] = useState("");
  useEffect(
    () =>
      setVertices(
        o.points.map((p) => p.map((n) => n.toFixed(2)).join(", ")).join("\n"),
      ),
    [o.points],
  );
  const number = (
    key:
      | "width"
      | "depth"
      | "floors"
      | "floorHeight"
      | "rotation"
      | "scale"
      | "lanes",
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field">
      {label}
      <input
        type="number"
        aria-label={label}
        key={`${key}-${o[key]}`}
        defaultValue={o[key]}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          const n = e.target.valueAsNumber;
          if (n !== o[key] && !onUpdate({ ...o, [key]: n }))
            e.target.value = String(o[key]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
  return (
    <div className="properties">
      <h2>{o.kind[0].toUpperCase() + o.kind.slice(1)}</h2>
      <label className="field">
        Name
        <input
          key={o.name}
          defaultValue={o.name}
          maxLength={100}
          onBlur={(e) => {
            if (e.target.value !== o.name)
              onUpdate({ ...o, name: e.target.value });
          }}
        />
      </label>
      <div className="property-actions">
        <button aria-label="Frame selected" onClick={onFrame}>
          <Focus size={15} />
        </button>
        <button aria-label="Duplicate selected" onClick={onDuplicate}>
          <Copy size={15} />
        </button>
        {o.kind !== "boundary" && (
          <button aria-label="Move selected on canvas" onClick={onMove}>
            <Move size={15} />
          </button>
        )}
        <button aria-label="Delete selected" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
      {o.kind === "road" && (
        <>
          <div className="measure">
            <span>Alignment length</span>
            <b>{length(o.points).toFixed(1)} m</b>
          </div>
          {number("width", "Road width (m)", 1, 100)}
          {number("lanes", "Lane count", 1, 8)}
          <p className="muted small">
            Snap a new road point within 6 m of an existing road for a connected
            T or X. Width regenerates the surface. Lane count is metadata.
          </p>
        </>
      )}
      {o.kind === "building" && (
        <>
          <label className="field">
            Building type
            <select
              value={o.buildingType}
              onChange={(e) =>
                onUpdate({
                  ...o,
                  buildingType: e.target.value as DesignObject["buildingType"],
                })
              }
            >
              {["Detached house", "Townhouse", "Apartment", "Commercial"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <div className="field-grid">
            {number("floors", "Floors", 1, 60)}
            {number("floorHeight", "Floor height (m)", 2, 6, 0.1)}
          </div>
          <div className="measure">
            <span>Total wall height</span>
            <b>{(o.floors * o.floorHeight).toFixed(1)} m</b>
          </div>
          <div className="field-grid">
            {number("width", "Footprint width (m)", 1, 100)}
            {number("depth", "Footprint depth (m)", 1, 100)}
          </div>
          <label className="field">
            Roof
            <select
              value={o.roof}
              onChange={(e) =>
                onUpdate({ ...o, roof: e.target.value as "flat" | "pitched" })
              }
            >
              <option value="flat">Flat</option>
              <option value="pitched">Pitched concept</option>
            </select>
          </label>
          <label className="field">
            Facade colour
            <input
              type="color"
              value={o.color}
              onChange={(e) => onUpdate({ ...o, color: e.target.value })}
            />
          </label>
        </>
      )}
      {["boundary", "plot"].includes(o.kind) && (
        <div className="measure">
          <span>Plan area</span>
          <b>{area(o.points).toFixed(0)} m²</b>
        </div>
      )}
      {!["boundary", "plot", "road"].includes(o.kind) &&
        number("rotation", "Rotation (°)", -360, 360)}
      {["tree", "car", "bench", "bridge"].includes(o.kind) && (
        <>
          <label className="field">
            Shape
            <select
              value={
                o.assetRef.endsWith(":v1")
                  ? `builtin:${o.kind}:${o.kind === "tree" ? "native" : o.kind === "car" ? "sedan" : o.kind === "bench" ? "timber" : "beam"}`
                  : o.assetRef
              }
              onChange={(e) => onUpdate({ ...o, assetRef: e.target.value })}
            >
              {(o.kind === "tree"
                ? [
                    ["builtin:tree:native", "Native canopy"],
                    ["builtin:tree:palm", "Palm"],
                    ["builtin:tree:columnar", "Columnar"],
                  ]
                : o.kind === "car"
                  ? [
                      ["builtin:car:sedan", "Sedan"],
                      ["builtin:car:suv", "SUV"],
                      ["builtin:car:van", "Van"],
                    ]
                  : o.kind === "bench"
                    ? [
                        ["builtin:bench:timber", "Timber bench"],
                        ["builtin:bench:modern", "Modern bench"],
                        ["builtin:bench:stone", "Stone bench"],
                      ]
                    : [
                        ["builtin:bridge:beam", "Beam bridge"],
                        ["builtin:bridge:arch", "Arch bridge"],
                        ["builtin:bridge:pedestrian", "Pedestrian bridge"],
                      ]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {number("scale", "Asset scale", 0.2, 5, 0.1)}
        </>
      )}
      {o.kind === "bridge" && (
        <p className="muted small">
          Fixed concept deck, 10 × 30 m, 5 m ellipsoid offset. No approaches,
          clearance or structural checks.
        </p>
      )}
      <details>
        <summary>
          {o.points.length > 1 ? "Edit vertices" : "Edit position"} · local
          metres
        </summary>
        <textarea
          aria-label="Local coordinates"
          value={vertices}
          rows={Math.min(8, o.points.length + 1)}
          onChange={(e) => setVertices(e.target.value)}
        />
        <button
          onClick={() => {
            const points = vertices
              .trim()
              .split("\n")
              .map((line) => line.split(",").map(Number) as Point);
            onUpdate({ ...o, points });
          }}
        >
          Apply coordinates
        </button>
        <p className="muted small">
          One east, north pair per line. Keep road vertex count unchanged to
          preserve connections.
        </p>
      </details>
    </div>
  );
}
