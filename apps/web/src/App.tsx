import { useState, useRef, useEffect, useMemo } from "react";
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
  Check,
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
  Hand,
  Upload,
  Landmark,
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
  type ProjectLayer,
} from "./model";
import {
  validateProject,
  connectRoad,
  length,
  area,
  distance,
  footprint,
  moveTo,
  resizeFromHandle,
} from "./geometry";
import { command, applyCommand, type Command } from "./history";
import {
  listLocal,
  saveLocal,
  deleteLocal,
  saveServer,
  loadServer,
  download,
  saveToComputer,
} from "./persistence";
import { Viewport, type ViewAction } from "./Viewport";
import { searchLocations, type LocationResult } from "./geocoding";
import { importGeoJSON } from "./geojson";
import { zarajNzProject } from "./zarajDemo";
import {
  importCustomAsset,
  listCustomAssets,
  type CustomAsset,
  type CustomAssetCategory,
} from "./assetStorage";
import {
  societyAssets,
  societyAssetCategories,
  type SocietyAssetCategory,
} from "./societyAssets";
import { analyzeSite, type SiteAnalysis } from "./siteAnalysis";

type ShapeChoice = { value: string; label: string; preview: string };
const quickLocations: Array<{
  id: string;
  name: string;
  center: [number, number];
}> = [
  { id: "auckland", name: "Auckland", center: [174.7633, -36.8485] },
  { id: "wellington", name: "Wellington", center: [174.7762, -41.2866] },
  { id: "christchurch", name: "Christchurch", center: [172.6362, -43.5321] },
  { id: "hamilton", name: "Hamilton", center: [175.2793, -37.787] },
  { id: "tauranga", name: "Tauranga", center: [176.1651, -37.6878] },
  { id: "dunedin", name: "Dunedin", center: [170.5028, -45.8788] },
  { id: "queenstown", name: "Queenstown", center: [168.6626, -45.0312] },
  { id: "rolleston", name: "Rolleston", center: [172.3847, -43.5907] },
];
const shapeChoices = (object: DesignObject): ShapeChoice[] => {
  const choices: Partial<Record<Kind, ShapeChoice[]>> = {
    building: [
      { value: "kenney:house:a", label: "Classic", preview: "house-a" },
      { value: "kenney:house:f", label: "Family", preview: "house-f" },
      { value: "kenney:house:k", label: "Modern", preview: "house-k" },
      { value: "kenney:house:t", label: "Townhouse", preview: "house-t" },
    ],
    tree: [
      {
        value: "builtin:tree:large",
        label: "Broadleaf",
        preview: "tree-large",
      },
      { value: "builtin:tree:small", label: "Small", preview: "tree-small" },
      { value: "builtin:tree:palm", label: "Palm", preview: "tree-palm" },
      {
        value: "builtin:tree:columnar",
        label: "Columnar",
        preview: "tree-columnar",
      },
    ],
    car: [
      { value: "kenney:car:sedan", label: "Sedan", preview: "car-sedan" },
      { value: "kenney:car:suv", label: "SUV", preview: "car-suv" },
      { value: "kenney:car:van", label: "Van", preview: "car-van" },
    ],
    bench: [
      {
        value: "builtin:bench:classic",
        label: "Classic",
        preview: "bench-classic",
      },
      {
        value: "builtin:bench:modern",
        label: "Modern",
        preview: "bench-modern",
      },
      { value: "builtin:bench:wood", label: "Wood", preview: "bench-wood" },
    ],
    bridge: [
      {
        value: "builtin:bridge:suspension",
        label: "Suspension",
        preview: "bridge-suspension",
      },
      { value: "builtin:bridge:arch", label: "Arch", preview: "bridge-arch" },
      {
        value: "builtin:bridge:truss",
        label: "Truss",
        preview: "bridge-truss",
      },
    ],
  };
  const available = choices[object.kind] ?? [];
  if (
    object.assetRef &&
    !available.some((choice) => choice.value === object.assetRef)
  )
    return [
      {
        value: object.assetRef,
        label: object.assetRef.startsWith("custom:")
          ? "Imported model"
          : "Selected asset",
        preview: "custom-asset",
      },
      ...available,
    ];
  return available;
};
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
      Kind | "select" | "move" | "hand" | "rectangle" | "circle" | "freehand"
    >("select"),
    [draft, setDraft] = useState<Point[]>([]),
    [draftPointer, setDraftPointer] = useState<Point | null>(null),
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
    [viewMode, setViewMode] = useState<"2d" | "3d" | "street">("2d"),
    [navigationProfile, setNavigationProfile] = useState<
      "walk" | "orbit" | "drone"
    >("orbit"),
    [layersOpen, setLayersOpen] = useState(true),
    [currentProjectExpanded, setCurrentProjectExpanded] = useState(true),
    [expandedProjectLayers, setExpandedProjectLayers] = useState<Set<string>>(
      new Set(),
    ),
    [expandedProjectKinds, setExpandedProjectKinds] = useState<Set<string>>(
      new Set(),
    ),
    [objectsOpen, setObjectsOpen] = useState(false),
    [objectSearch, setObjectSearch] = useState(""),
    [objectKindFilter, setObjectKindFilter] = useState<Kind | "all">("all"),
    [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(false),
    [toolsOpen, setToolsOpen] = useState(true),
    [status, setStatus] = useState(boot.status),
    [error, setError] = useState(boot.error),
    [context, setContext] = useState("Loading map…"),
    [undo, setUndo] = useState<Command[]>([]),
    [redo, setRedo] = useState<Command[]>([]),
    [action, setAction] = useState<ViewAction>({ type: "frame", seq: 0 }),
    [activeMenu, setActiveMenu] = useState<"project" | "edit" | "view" | null>(
      null,
    ),
    [placementDialog, setPlacementDialog] = useState<{
      object: DesignObject;
      command: string;
    } | null>(null),
    [siteAnalysis, setSiteAnalysis] = useState<{
      status: "loading" | "ready";
      boundary: Point[];
      result?: SiteAnalysis;
    } | null>(null),
    [dialog, setDialog] = useState<"new" | "open" | "confirm-switch" | null>(
      null,
    ),
    [pendingDeleteProject, setPendingDeleteProject] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [pendingProject, setPendingProject] = useState<Project | null>(null),
    [pendingProjectStorage, setPendingProjectStorage] = useState<
      "local" | "server" | "computer" | null
    >(null),
    [name, setName] = useState(""),
    [storage, setStorage] = useState<"local" | "server" | "computer">("local"),
    [locationQuery, setLocationQuery] = useState(""),
    [locationResults, setLocationResults] = useState<LocationResult[]>([]),
    [searching, setSearching] = useState(false),
    [placementAsset, setPlacementAsset] = useState<{
      assetRef: string;
      name: string;
      kind: Kind;
      buildingType: DesignObject["buildingType"];
      width: number;
      depth: number;
      height: number;
      color: string;
    } | null>(null),
    [customAssets, setCustomAssets] = useState<CustomAsset[]>([]),
    [assetDialog, setAssetDialog] = useState(false),
    [assetFile, setAssetFile] = useState<File | null>(null),
    [assetName, setAssetName] = useState(""),
    [assetCategory, setAssetCategory] = useState<CustomAssetCategory>("Custom"),
    [assetWidth, setAssetWidth] = useState(12),
    [assetDepth, setAssetDepth] = useState(12),
    [assetHeight, setAssetHeight] = useState(8),
    [importingAsset, setImportingAsset] = useState(false),
    [assetCategoryFilter, setAssetCategoryFilter] = useState<
      SocietyAssetCategory | "All" | "My Assets"
    >("All"),
    [assetSearch, setAssetSearch] = useState("");
  const file = useRef<HTMLInputElement>(null),
    projectFile = useRef<HTMLInputElement>(null),
    version = useRef(0);
  const current = project.objects.find((o) => o.id === selected);
  const updatePlacementObject = (changes: Partial<DesignObject>) =>
    setPlacementDialog((dialog) =>
      dialog ? { ...dialog, object: { ...dialog.object, ...changes } } : dialog,
    );
  const refreshAssets = () =>
    listCustomAssets()
      .then(setCustomAssets)
      .catch((e) => setError(`Asset library could not open: ${String(e)}`));
  useEffect(() => {
    refreshAssets();
    window.addEventListener("sitecraft-assets-changed", refreshAssets);
    return () =>
      window.removeEventListener("sitecraft-assets-changed", refreshAssets);
  }, []);
  useEffect(() => {
    const initialFrame = window.setTimeout(
      () => setAction({ type: "frame", seq: Date.now() }),
      250,
    );
    return () => window.clearTimeout(initialFrame);
  }, []);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 2000);
    return () => window.clearTimeout(timeout);
  }, [error]);
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
  const frame = (id?: string, type: ViewAction["type"] = "frame") => {
    if (type === "top") setViewMode("2d");
    else if (type === "perspective" || type === "drone") setViewMode("3d");
    else if (type === "street") setViewMode("street");
    setAction({ id, type, seq: Date.now() });
  };
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
    setDraftPointer(null);
    setTool("select");
    setPlacementAsset(null);
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
      if (e.key === "Escape") {
        setActiveMenu(null);
        cancel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history(!e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setName("New Christchurch site");
        setDialog("new");
      }
      if (tool === "hand" && viewMode !== "2d") {
        const key = e.key.toLowerCase();
        const navigationKeys: Partial<Record<string, ViewAction["type"]>> = {
          w: "move-forward",
          s: "move-backward",
          a: "strafe-left",
          d: "strafe-right",
          q: navigationProfile === "drone" ? "move-down" : "rotate-left",
          e: navigationProfile === "drone" ? "move-up" : "rotate-right",
          arrowleft: "rotate-left",
          arrowright: "rotate-right",
          arrowup: "tilt-up",
          arrowdown: "tilt-down",
        };
        const type = navigationKeys[key];
        if (type) {
          e.preventDefault();
          setAction({ type, seq: Date.now() });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!activeMenu) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".top-nav"))
        setActiveMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [activeMenu]);
  const confirmPlacement = () => {
    if (!placementDialog) return;
    const o = placementDialog.object,
      updates = o.kind === "road" ? connectRoad(o, project.objects) : [o];
    if (!edit(updates, [], placementDialog.command)) return;
    setSelected(o.id);
    setPlacementDialog(null);
    setPlacementAsset(null);
    cancel();
    if (o.kind === "boundary") {
      frame(o.id, "top");
      const boundary = o.points.map((point) => [...point] as Point);
      setSiteAnalysis({ status: "loading", boundary });
      void analyzeSite(boundary, project.origin).then((result) =>
        setSiteAnalysis({ status: "ready", boundary, result }),
      );
    }
  };
  const finish = () => {
    if (!["boundary", "road", "plot", "freehand"].includes(tool)) return;
    const objectKind = tool === "freehand" ? "plot" : tool;
    const o = newObject(project, objectKind as Kind, draft);
    if (tool === "freehand") o.name = "Free style shape";
    if (tool === "boundary") {
      const siteNumber =
        project.objects.filter((object) => object.kind === "boundary").length +
        1;
      o.name = `Site ${siteNumber} boundary`;
    }
    setPlacementDialog({ object: o, command: `Draw ${tool}` });
    setDraftPointer(null);
  };
  const click = (p: Point, id?: string) => {
    if (tool === "hand") return;
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
    if (placementAsset) {
      const points: Point[] =
        placementAsset.kind === "plot"
          ? [
              [
                p[0] - placementAsset.width / 2,
                p[1] - placementAsset.depth / 2,
              ],
              [
                p[0] + placementAsset.width / 2,
                p[1] - placementAsset.depth / 2,
              ],
              [
                p[0] + placementAsset.width / 2,
                p[1] + placementAsset.depth / 2,
              ],
              [
                p[0] - placementAsset.width / 2,
                p[1] + placementAsset.depth / 2,
              ],
            ]
          : [p];
      const o = newObject(project, placementAsset.kind, points);
      o.name = placementAsset.name;
      o.assetRef = placementAsset.assetRef;
      o.buildingType = placementAsset.buildingType;
      o.width = placementAsset.width;
      o.depth = placementAsset.depth;
      o.color = placementAsset.color;
      o.floors = Math.max(1, Math.round(placementAsset.height / 3));
      o.floorHeight = Math.min(
        6,
        Math.max(2, placementAsset.height / o.floors),
      );
      o.roof = "pitched";
      setPlacementDialog({
        object: o,
        command: `Place ${placementAsset.name}`,
      });
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
      setDraft([]);
      setPlacementDialog({ object: shape, command: `Draw ${tool}` });
      return;
    }
    if (["boundary", "road", "plot", "freehand"].includes(tool)) {
      if (draft.length && distance(draft.at(-1)!, p) < 0.1) return;
      setDraft([...draft, p]);
      setDraftPointer(p);
      return;
    }
    const o = newObject(project, tool as Kind, [p]);
    if (o.assetRef.endsWith(":v1"))
      o.assetRef =
        o.kind === "tree"
          ? "builtin:tree:large"
          : o.kind === "car"
            ? "kenney:car:sedan"
            : o.kind === "bench"
              ? "builtin:bench:classic"
              : o.kind === "bridge"
                ? "builtin:bridge:suspension"
                : o.assetRef;
    setPlacementDialog({ object: o, command: `Place ${tool}` });
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
  const resizeObject = (id: string, handle: number, target: Point) => {
    const object = project.objects.find((o) => o.id === id);
    if (!object) return;
    setSelected(id);
    const resized = resizeFromHandle(object, handle, target);
    if (object.kind === "road") updateConnected(resized);
    else edit([resized], [], "Resize object");
  };
  const save = async () => {
    const captured = version.current;
    setStatus("Saving…");
    try {
      if (storage === "computer") {
        const saved = await saveToComputer(project);
        if (!saved) {
          setStatus("Unsaved");
          return false;
        }
      } else if (storage === "server") {
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
      return true;
    } catch (e) {
      setStatus("Save failed");
      setError(String(e));
      return false;
    }
  };
  const switchProject = (
    p: Project,
    saved = true,
    destination: "local" | "server" | "computer" = storage,
  ) => {
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
    setStatus(saved ? "Saved" : "Unsaved");
    setStorage(destination);
    setDialog(null);
    setPendingProject(null);
    setPendingProjectStorage(null);
    frame();
  };
  const requestProjectSwitch = (
    next: Project,
    saved = true,
    forceConfirmation = false,
    destination: "local" | "server" | "computer" = storage,
  ) => {
    const sameSite =
      Math.abs(next.origin[0] - project.origin[0]) < 0.0001 &&
      Math.abs(next.origin[1] - project.origin[1]) < 0.0001;
    if (
      project.objects.length &&
      (forceConfirmation || status === "Unsaved" || sameSite)
    ) {
      setPendingProject(next);
      setPendingProjectStorage(destination);
      setDialog("confirm-switch");
      return;
    }
    switchProject(next, saved, destination);
  };
  const addProjectLayer = (source: Project) => {
    const sameSite =
      Math.abs(source.origin[0] - project.origin[0]) < 0.0001 &&
      Math.abs(source.origin[1] - project.origin[1]) < 0.0001;
    if (!sameSite) {
      setError(
        "Only projects at the same map location can be added as a layer.",
      );
      return;
    }
    const layer: ProjectLayer = {
      id: crypto.randomUUID(),
      sourceProjectId: source.id,
      name: source.name,
      origin: source.origin,
      visible: true,
      opacity: 1,
      locked: true,
      objects: source.objects.map((object) => ({
        ...object,
        id: crypto.randomUUID(),
        nodeIds: object.nodeIds.map(() => crypto.randomUUID()),
      })),
      designLayers: source.designLayers.map((item) => ({ ...item })),
    };
    setProject((current) => ({
      ...current,
      projectLayers: [...current.projectLayers, layer],
    }));
    version.current++;
    setStatus("Unsaved");
    setPendingProject(null);
    setPendingProjectStorage(null);
    setDialog(null);
    setLayersOpen(true);
    setObjectsOpen(false);
  };
  const updateProjectLayer = (id: string, changes: Partial<ProjectLayer>) => {
    setProject((current) => ({
      ...current,
      projectLayers: current.projectLayers.map((layer) =>
        layer.id === id ? { ...layer, ...changes } : layer,
      ),
    }));
    version.current++;
    setStatus("Unsaved");
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
      if (storage === "computer") {
        projectFile.current?.click();
        return;
      }
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
  const jumpToLocation = (value: string) => {
    if (!value) return;
    if (value === "project") {
      frame();
      return;
    }
    if (value.startsWith("site:")) {
      frame(value.slice(5));
      return;
    }
    if (value.startsWith("place:")) {
      frame(value.slice(6));
      return;
    }
    const location = quickLocations.find((item) => item.id === value);
    if (!location) return;
    const [longitude, latitude] = location.center;
    setLocationQuery(location.name);
    setLocationResults([]);
    setAction({
      type: "location",
      location: {
        center: location.center,
        bounds: [
          longitude - 0.045,
          latitude - 0.032,
          longitude + 0.045,
          latitude + 0.032,
        ],
      },
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
      } else requestProjectSwitch(validateProject(parsed), true, true);
    } catch (err) {
      setError(String(err));
    }
    e.target.value = "";
  };
  const openProjectComputerFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    try {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;
      if (selectedFile.size > 5_000_000)
        throw Error("Project file exceeds 5 MB.");
      const parsed = JSON.parse(await selectedFile.text());
      if (parsed?.type === "FeatureCollection" || parsed?.type === "Feature")
        throw Error(
          "This is a GeoJSON layer. Use Import GeoJSON inside the Layers panel.",
        );
      requestProjectSwitch(validateProject(parsed), true, true, "computer");
    } catch (err) {
      setError(String(err));
    }
    e.target.value = "";
  };
  const viewportProject = useMemo(
    () => ({
      ...project,
      objects: [
        ...project.objects,
        ...project.projectLayers
          .filter((layer) => layer.visible)
          .flatMap((layer) =>
            layer.objects.filter(
              (object) =>
                layer.designLayers.find((item) => item.kind === object.kind)
                  ?.visible !== false,
            ),
          ),
      ],
    }),
    [project],
  );
  const projectLayerOpacity = useMemo(
    () =>
      Object.fromEntries(
        project.projectLayers.flatMap((layer) =>
          layer.objects.map((object) => [
            object.id,
            layer.opacity *
              (layer.designLayers.find((item) => item.kind === object.kind)
                ?.opacity ?? 1),
          ]),
        ),
      ),
    [project.projectLayers],
  );
  const internalLocations = useMemo(() => {
    const destinationName =
        /mosque|church|temple|gurdwara|school|nursery|hospital|clinic|pharmacy|community (club|centre|center)|library|graveyard|cemetery|police|fire station|playground|sports field|main park|commercial (area|centre|center)|neighbourhood market|supermarket/i,
      mainRoadName =
        /main boulevard|main avenue|park avenue|entrance road|access road|society gate/i,
      seen = new Set<string>();
    return project.objects
      .filter(
        (object) =>
          (object.kind === "road" && mainRoadName.test(object.name)) ||
          (["building", "plot"].includes(object.kind) &&
            destinationName.test(object.name)),
      )
      .filter((object) => {
        const name = object.name.trim().toLowerCase();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [project.objects]);

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="brand-mark">s</span>sitecraft
          <span className="studio">PLANNING STUDIO</span>
        </div>
        <nav className="top-nav" aria-label="Application menu">
          <div className="top-menu">
            <button
              className={activeMenu === "project" ? "active" : ""}
              onClick={() =>
                setActiveMenu(activeMenu === "project" ? null : "project")
              }
            >
              <FolderOpen size={16} /> Project
            </button>
            {activeMenu === "project" && (
              <div className="top-menu-popover">
                <button
                  onClick={() => {
                    setName("New Christchurch site");
                    setDialog("new");
                    setActiveMenu(null);
                  }}
                >
                  New project <kbd>Ctrl+N</kbd>
                </button>
                <button
                  onClick={() => {
                    void open();
                    setActiveMenu(null);
                  }}
                >
                  Open saved
                </button>
                <button
                  onClick={() => {
                    projectFile.current?.click();
                    setActiveMenu(null);
                  }}
                >
                  Open computer file
                </button>
                <i />
                <button
                  onClick={() => {
                    void save();
                    setActiveMenu(null);
                  }}
                >
                  Save project <kbd>Ctrl+S</kbd>
                </button>
                <button
                  onClick={() => {
                    void saveToComputer(project);
                    setActiveMenu(null);
                  }}
                >
                  Save to computer
                </button>
              </div>
            )}
          </div>
          <div className="top-menu">
            <button
              className={activeMenu === "edit" ? "active" : ""}
              onClick={() =>
                setActiveMenu(activeMenu === "edit" ? null : "edit")
              }
            >
              <MousePointer2 size={16} /> Edit
            </button>
            {activeMenu === "edit" && (
              <div className="top-menu-popover">
                <button
                  disabled={!undo.length}
                  onClick={() => {
                    history(true);
                    setActiveMenu(null);
                  }}
                >
                  Undo <kbd>Ctrl+Z</kbd>
                </button>
                <button
                  disabled={!redo.length}
                  onClick={() => {
                    history(false);
                    setActiveMenu(null);
                  }}
                >
                  Redo <kbd>Ctrl+Shift+Z</kbd>
                </button>
                <i />
                <button
                  onClick={() => {
                    setTool("select");
                    setActiveMenu(null);
                  }}
                >
                  Select tool
                </button>
                <button
                  disabled={!current}
                  onClick={() => {
                    if (current && edit([], [current.id], "Delete object"))
                      setSelected("");
                    setActiveMenu(null);
                  }}
                >
                  Delete selected
                </button>
              </div>
            )}
          </div>
          <div className="top-menu">
            <button
              className={activeMenu === "view" ? "active" : ""}
              onClick={() =>
                setActiveMenu(activeMenu === "view" ? null : "view")
              }
            >
              <Compass size={16} /> View
            </button>
            {activeMenu === "view" && (
              <div className="top-menu-popover">
                <button
                  onClick={() => (frame(undefined, "top"), setActiveMenu(null))}
                >
                  2D map
                </button>
                <button
                  onClick={() => (
                    frame(undefined, "perspective"),
                    setActiveMenu(null)
                  )}
                >
                  3D perspective
                </button>
                <button
                  onClick={() => (
                    frame(undefined, "street"),
                    setActiveMenu(null)
                  )}
                >
                  Street view
                </button>
                <i />
                <button onClick={() => (frame(), setActiveMenu(null))}>
                  Frame whole project
                </button>
                <button
                  onClick={() => {
                    setLeftOpen((open) => !open);
                    setActiveMenu(null);
                  }}
                >
                  Toggle layers panel
                </button>
                <button
                  onClick={() => {
                    setRightOpen((open) => !open);
                    setActiveMenu(null);
                  }}
                >
                  Toggle inspector
                </button>
              </div>
            )}
          </div>
        </nav>
        <div className="project-title">
          {project.name}
          <span> / {project.scenarioName}</span>
        </div>
        <div className="header-map-actions">
          <span className="pill">
            <span className="live-dot" /> CONCEPT DESIGN
          </span>
          <label
            className="location-jump"
            title="Move the map to another location"
          >
            <MapPin size={14} />
            <select
              aria-label="Move to location"
              value=""
              onChange={(event) => jumpToLocation(event.target.value)}
            >
              <option value="">Move to location</option>
              <option value="project">Current project</option>
              {project.objects.some((object) => object.kind === "boundary") && (
                <optgroup label="Project sites">
                  {project.objects
                    .filter((object) => object.kind === "boundary")
                    .map((boundary, index) => (
                      <option key={boundary.id} value={`site:${boundary.id}`}>
                        {boundary.name || `Site ${index + 1}`}
                      </option>
                    ))}
                </optgroup>
              )}
              {internalLocations.length > 0 && (
                <optgroup label="Inside current site">
                  {internalLocations.map((location) => (
                    <option key={location.id} value={`place:${location.id}`}>
                      {location.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="New Zealand cities">
                {quickLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
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
            <RotateCcw size={15} /> <span>Return to project</span>
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
          className={`primary save-project-button ${status === "Saved" ? "is-saved" : ""}`}
          title={
            status === "Saved"
              ? "Project is saved"
              : status === "Saving…"
                ? "Saving project"
                : "Save project"
          }
        >
          {status === "Saved" ? <Check size={16} /> : <Save size={15} />}
          <span>
            {status === "Saving…"
              ? "Saving…"
              : status === "Saved"
                ? "Saved"
                : "Save project"}
          </span>
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
            <div className="project-setup">
              <div className="eyebrow">
                WORKSPACE <span>01</span>
              </div>
              <div className="workspace-intro">
                <div>
                  <h2>Your next place.</h2>
                  <p className="muted">Plan in a real-world context.</p>
                </div>
              </div>
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
                <button onClick={open}>Open</button>
                <button
                  className="open-computer-button"
                  onClick={() => projectFile.current?.click()}
                  title="Open a project file from this computer"
                >
                  <Upload size={14} />
                  Open file
                </button>
                <button
                  onClick={() => requestProjectSwitch(zarajNzProject(), false)}
                  title="Open the Zaraj-inspired New Zealand society demo"
                >
                  Zaraj demo
                </button>
              </div>
              <label className="field compact-save-field">
                <span>Save to</span>
                <select
                  value={storage}
                  onChange={(e) =>
                    setStorage(
                      e.target.value as "local" | "server" | "computer",
                    )
                  }
                >
                  <option value="local">This browser</option>
                  <option value="server">Local API server</option>
                  <option value="computer">Computer file</option>
                </select>
              </label>
              <div className="project-context-row">
                <button
                  onClick={() => frame()}
                  className="compact-frame-button"
                >
                  <Focus size={14} /> <span>Frame project</span>
                </button>
                <div
                  className="compact-location"
                  title={`${project.origin[1].toFixed(4)}°, ${project.origin[0].toFixed(4)}°`}
                >
                  <MapPin size={15} />
                  <div>
                    <b>
                      {project.name.includes("Zaraj")
                        ? "Rolleston fringe, NZ"
                        : "Christchurch, NZ"}
                    </b>
                    <small>
                      {Math.abs(project.origin[1]).toFixed(4)}° S ·{" "}
                      {project.origin[0].toFixed(4)}° E
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <button
              className="section-title layer-heading collapsible"
              onClick={() => {
                const next = !layersOpen;
                setLayersOpen(next);
                if (next) setObjectsOpen(false);
              }}
              aria-expanded={layersOpen}
            >
              <Layers size={15} /> Layers{" "}
              <span>
                {kinds.length +
                  project.dataLayers.length +
                  project.projectLayers.length}{" "}
                {layersOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {layersOpen && (
              <div className="layers">
                <button
                  className="current-project-layer"
                  onClick={() => setCurrentProjectExpanded((open) => !open)}
                  aria-expanded={currentProjectExpanded}
                >
                  <Layers size={16} />
                  <div>
                    <b>Current project</b>
                    <span>{project.name}</span>
                  </div>
                  <small>{project.objects.length} objects</small>
                  <ChevronRight
                    className={currentProjectExpanded ? "expanded" : ""}
                    size={14}
                  />
                </button>
                {project.projectLayers.length > 0 && (
                  <div className="layer-group-label">Compared projects</div>
                )}
                {project.projectLayers.map((layer) => (
                  <div key={layer.id} className="layer-card project-layer-card">
                    <div
                      className="layer project-layer-header"
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedProjectLayers.has(layer.id)}
                      onClick={() =>
                        setExpandedProjectLayers((current) => {
                          const next = new Set(current);
                          if (next.has(layer.id)) next.delete(layer.id);
                          else next.add(layer.id);
                          return next;
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ")
                          event.currentTarget.click();
                      }}
                    >
                      <input
                        aria-label={`Show ${layer.name} project layer`}
                        type="checkbox"
                        checked={layer.visible}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateProjectLayer(layer.id, {
                            visible: event.target.checked,
                          })
                        }
                      />
                      <Layers size={15} />
                      <input
                        className="project-layer-name"
                        aria-label="Project layer name"
                        value={layer.name}
                        maxLength={100}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateProjectLayer(layer.id, {
                            name: event.target.value,
                          })
                        }
                      />
                      <small>{layer.objects.length}</small>
                      <ChevronRight
                        className={
                          expandedProjectLayers.has(layer.id) ? "expanded" : ""
                        }
                        size={13}
                      />
                      <button
                        className={
                          layer.locked ? "icon-button active" : "icon-button"
                        }
                        title={layer.locked ? "Unlock layer" : "Lock layer"}
                        onClick={(event) => {
                          event.stopPropagation();
                          updateProjectLayer(layer.id, {
                            locked: !layer.locked,
                          });
                        }}
                      >
                        {layer.locked ? "🔒" : "🔓"}
                      </button>
                      <button
                        className="icon-button"
                        title="Remove project layer"
                        onClick={(event) => {
                          event.stopPropagation();
                          setProject((current) => ({
                            ...current,
                            projectLayers: current.projectLayers.filter(
                              (item) => item.id !== layer.id,
                            ),
                          }));
                          version.current++;
                          setStatus("Unsaved");
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {expandedProjectLayers.has(layer.id) && (
                      <div className="project-sublayers">
                        {layer.designLayers.map((subLayer) => {
                          const Icon = icons[subLayer.kind];
                          const key = `${layer.id}:${subLayer.kind}`;
                          const objects = layer.objects.filter(
                            (object) => object.kind === subLayer.kind,
                          );
                          if (!objects.length) return null;
                          return (
                            <div key={key} className="project-sublayer">
                              <div className="project-sublayer-row">
                                <input
                                  aria-label={`Show ${layer.name} ${subLayer.kind} layer`}
                                  type="checkbox"
                                  checked={subLayer.visible}
                                  onChange={(event) =>
                                    updateProjectLayer(layer.id, {
                                      designLayers: layer.designLayers.map(
                                        (item) =>
                                          item.kind === subLayer.kind
                                            ? {
                                                ...item,
                                                visible: event.target.checked,
                                              }
                                            : item,
                                      ),
                                    })
                                  }
                                />
                                <button
                                  className="project-sublayer-toggle"
                                  onClick={() =>
                                    setExpandedProjectKinds((current) => {
                                      const next = new Set(current);
                                      if (next.has(key)) next.delete(key);
                                      else next.add(key);
                                      return next;
                                    })
                                  }
                                >
                                  <Icon size={14} />
                                  <span>
                                    {subLayer.kind === "boundary"
                                      ? "Site boundary"
                                      : subLayer.kind[0].toUpperCase() +
                                        subLayer.kind.slice(1)}
                                  </span>
                                  <small>{objects.length}</small>
                                  <ChevronRight
                                    className={
                                      expandedProjectKinds.has(key)
                                        ? "expanded"
                                        : ""
                                    }
                                    size={12}
                                  />
                                </button>
                              </div>
                              <label className="project-sublayer-opacity">
                                Opacity
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={subLayer.opacity}
                                  style={{
                                    background: `linear-gradient(to right, #2563eb ${subLayer.opacity * 100}%, #dbeafe ${subLayer.opacity * 100}%)`,
                                  }}
                                  onChange={(event) =>
                                    updateProjectLayer(layer.id, {
                                      designLayers: layer.designLayers.map(
                                        (item) =>
                                          item.kind === subLayer.kind
                                            ? {
                                                ...item,
                                                opacity: Number(
                                                  event.target.value,
                                                ),
                                              }
                                            : item,
                                      ),
                                    })
                                  }
                                />
                                <span>
                                  {Math.round(subLayer.opacity * 100)}%
                                </span>
                              </label>
                              {expandedProjectKinds.has(key) && (
                                <div className="project-layer-objects">
                                  {objects.map((object) => (
                                    <button
                                      key={object.id}
                                      onClick={() =>
                                        setAction({
                                          type: "frame",
                                          id: object.id,
                                          seq: Date.now(),
                                        })
                                      }
                                    >
                                      <Icon size={13} />
                                      <span>{object.name}</span>
                                      <small>{object.kind}</small>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                        onChange={(event) =>
                          updateProjectLayer(layer.id, {
                            opacity: Number(event.target.value),
                          })
                        }
                      />
                      <span>{Math.round(layer.opacity * 100)}%</span>
                    </label>
                  </div>
                ))}
                {currentProjectExpanded && (
                  <div className="current-project-contents">
                    <div className="layer-group-label">
                      Current object layers
                    </div>
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
                                const next = {
                                  ...visible,
                                  [k]: e.target.checked,
                                };
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
                              {
                                project.objects.filter((o) => o.kind === k)
                                  .length
                              }
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
                              updateDataLayer(layer.id, {
                                color: e.target.value,
                              })
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
              </div>
            )}
            <button
              className="section-title object-heading collapsible"
              aria-expanded={objectsOpen}
              onClick={() => {
                const next = !objectsOpen;
                setObjectsOpen(next);
                if (next) setLayersOpen(false);
              }}
            >
              DESIGN OBJECTS
              <span>
                {project.objects.length} {objectsOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {objectsOpen && (
              <div className="object-manager">
                <label className="object-search">
                  <Search size={14} />
                  <input
                    aria-label="Search design objects"
                    placeholder="Search objects"
                    value={objectSearch}
                    onChange={(e) => setObjectSearch(e.target.value)}
                  />
                </label>
                <div className="object-filters">
                  <button
                    className={objectKindFilter === "all" ? "active" : ""}
                    onClick={() => setObjectKindFilter("all")}
                  >
                    All
                  </button>
                  {kinds.map((kind) => (
                    <button
                      key={kind}
                      className={objectKindFilter === kind ? "active" : ""}
                      onClick={() => setObjectKindFilter(kind)}
                    >
                      {kind === "boundary"
                        ? "Boundary"
                        : kind[0].toUpperCase() + kind.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="object-list">
                  {project.objects
                    .filter(
                      (object) =>
                        (objectKindFilter === "all" ||
                          object.kind === objectKindFilter) &&
                        object.name
                          .toLowerCase()
                          .includes(objectSearch.trim().toLowerCase()),
                    )
                    .map((o) => {
                      const Icon = icons[o.kind];
                      return (
                        <button
                          key={o.id}
                          className={
                            selected === o.id ? "object active" : "object"
                          }
                          onClick={() => {
                            setSelected(o.id);
                            setTool("select");
                          }}
                        >
                          <Icon size={14} />
                          <span>{o.name}</span>
                          <small>{o.kind}</small>
                          <ChevronRight size={13} />
                        </button>
                      );
                    })}
                  {!project.objects.some(
                    (object) =>
                      (objectKindFilter === "all" ||
                        object.kind === objectKindFilter) &&
                      object.name
                        .toLowerCase()
                        .includes(objectSearch.trim().toLowerCase()),
                  ) && <p className="muted">No matching objects.</p>}
                </div>
              </div>
            )}
          </aside>
        ) : (
          <div className="collapsed-rail left-rail">
            <button
              className="panel-tab"
              aria-label="Open layers panel"
              onClick={() => setLeftOpen(true)}
            >
              <Layers size={16} />
              <span>Layers</span>
            </button>
            <button
              className={toolsOpen ? "panel-tab active" : "panel-tab"}
              aria-label={toolsOpen ? "Collapse tools" : "Open tools"}
              onClick={() => setToolsOpen((open) => !open)}
            >
              <Move size={16} />
              <span>Tools</span>
            </button>
          </div>
        )}
        <main>
          <Viewport
            project={viewportProject}
            objectOpacity={projectLayerOpacity}
            selected={selected}
            visible={visible}
            opacity={opacity}
            draft={draft}
            draftPointer={draftPointer}
            drawingKind={tool}
            onPointer={setDraftPointer}
            onClick={click}
            onMove={moveObject}
            onResize={resizeObject}
            onError={setError}
            onContext={setContext}
            action={action}
            navigationMode={tool === "hand"}
            navigationProfile={navigationProfile}
            viewMode={viewMode}
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
              <button
                className={viewMode === "2d" ? "active" : ""}
                onClick={() => frame(undefined, "top")}
              >
                2D
              </button>
              <button
                className={viewMode === "3d" ? "active" : ""}
                onClick={() => frame(undefined, "perspective")}
              >
                3D
              </button>
              <button
                className={viewMode === "street" ? "active" : ""}
                onClick={() => {
                  setNavigationProfile("walk");
                  setTool("hand");
                  frame(undefined, "street");
                }}
              >
                Street
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
                  ["hand", Hand, "Hand · explore 360°"],
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
                    setPlacementAsset(null);
                    setDraft([]);
                    if (t === "hand") setSelected("");
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
          {viewMode !== "2d" && (
            <div
              className="street-controls"
              aria-label="3D navigation controls"
            >
              <div className="navigation-profiles" aria-label="Navigation mode">
                <button
                  className={navigationProfile === "walk" ? "active" : ""}
                  onClick={() => {
                    setNavigationProfile("walk");
                    setTool("hand");
                    if (viewMode !== "street") frame(undefined, "street");
                  }}
                >
                  Walk
                </button>
                <button
                  className={navigationProfile === "orbit" ? "active" : ""}
                  onClick={() => {
                    setNavigationProfile("orbit");
                    setTool("hand");
                  }}
                >
                  360°
                </button>
                <button
                  className={navigationProfile === "drone" ? "active" : ""}
                  onClick={() => {
                    setNavigationProfile("drone");
                    setTool("hand");
                    frame(undefined, "drone");
                  }}
                >
                  Drone
                </button>
              </div>
              <span>
                {navigationProfile === "drone" ? "FLY" : "MOVE & LOOK"}
              </span>
              <div className="street-control-grid">
                <button
                  aria-label="Tilt view up"
                  title="Look up"
                  onClick={() =>
                    setAction({ type: "tilt-up", seq: Date.now() })
                  }
                >
                  ↑
                </button>
                <button
                  aria-label="Rotate view left"
                  title="Turn left"
                  onClick={() =>
                    setAction({ type: "rotate-left", seq: Date.now() })
                  }
                >
                  ↶
                </button>
                <button
                  aria-label="Move forward"
                  title="Move forward"
                  onClick={() =>
                    setAction({ type: "move-forward", seq: Date.now() })
                  }
                >
                  ▲
                </button>
                <button
                  aria-label="Rotate view right"
                  title="Turn right"
                  onClick={() =>
                    setAction({ type: "rotate-right", seq: Date.now() })
                  }
                >
                  ↷
                </button>
                <button
                  aria-label="Tilt view down"
                  title="Look down"
                  onClick={() =>
                    setAction({ type: "tilt-down", seq: Date.now() })
                  }
                >
                  ↓
                </button>
                <button
                  aria-label="Move backward"
                  title="Move backward"
                  onClick={() =>
                    setAction({ type: "move-backward", seq: Date.now() })
                  }
                >
                  ▼
                </button>
                <button
                  aria-label="Move left"
                  title="Move left"
                  onClick={() =>
                    setAction({ type: "strafe-left", seq: Date.now() })
                  }
                >
                  ←
                </button>
                <button
                  aria-label={
                    navigationProfile === "drone" ? "Fly up" : "Look forward"
                  }
                  title={
                    navigationProfile === "drone" ? "Fly up" : "Look forward"
                  }
                  onClick={() =>
                    setAction({
                      type:
                        navigationProfile === "drone" ? "move-up" : "tilt-up",
                      seq: Date.now(),
                    })
                  }
                >
                  {navigationProfile === "drone" ? "＋" : "•"}
                </button>
                <button
                  aria-label="Move right"
                  title="Move right"
                  onClick={() =>
                    setAction({ type: "strafe-right", seq: Date.now() })
                  }
                >
                  →
                </button>
              </div>
              {navigationProfile === "drone" && (
                <button
                  className="drone-down"
                  onClick={() =>
                    setAction({ type: "move-down", seq: Date.now() })
                  }
                >
                  Lower drone
                </button>
              )}
              <small>
                {navigationProfile === "walk"
                  ? "2 m step · WASD / arrows"
                  : navigationProfile === "drone"
                    ? "25 m step · WASD · Q/E height"
                    : "Drag to explore 360°"}
              </small>
            </div>
          )}
          {tool !== "select" && tool !== "hand" && (
            <div className="drawing-hint">
              <b>
                {tool === "move"
                  ? current
                    ? `Click a new position for ${current.name}, or drag it`
                    : "Click an object to move, then click its new position"
                  : placementAsset
                    ? `Click the map to place ${placementAsset.name}`
                    : `Click the map to ${["road", "boundary", "plot", "rectangle", "circle", "freehand"].includes(tool) ? "draw" : "place"} ${tool}`}
              </b>
              {["road", "boundary", "plot", "freehand"].includes(tool) && (
                <>
                  <span>
                    {draft.length} points ·{" "}
                    {tool === "road"
                      ? `${length(draftPointer && draft.length ? [...draft, draftPointer] : draft).toFixed(1)} m`
                      : (() => {
                          const preview =
                            draftPointer && draft.length
                              ? [...draft, draftPointer]
                              : draft;
                          const squareMetres = area(preview);
                          const segment =
                            draftPointer && draft.length
                              ? distance(draft.at(-1)!, draftPointer)
                              : 0;
                          return `${segment.toFixed(1)} m current edge · ${squareMetres.toFixed(1)} m² · ${(squareMetres / 25.2929).toFixed(2)} marla`;
                        })()}
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
            <div role="alert" aria-live="assertive" className="error">
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
              ASSET LIBRARY{" "}
              <span>{societyAssets.length + 4 + customAssets.length}</span>
            </div>
            <p className="muted small">
              Choose an object, then click the map to place it.
            </p>
            <label className="asset-search">
              <Search size={14} />
              <input
                aria-label="Search assets"
                placeholder="Search assets"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
            </label>
            <div className="asset-categories">
              {[...societyAssetCategories, "My Assets"].map((category) => (
                <button
                  key={category}
                  className={assetCategoryFilter === category ? "active" : ""}
                  onClick={() =>
                    setAssetCategoryFilter(
                      category as SocietyAssetCategory | "All" | "My Assets",
                    )
                  }
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="assets">
              {assetCategoryFilter === "All" &&
                (["tree", "car", "bench", "bridge"] as Kind[]).map((k) => {
                  const Icon = icons[k];
                  return (
                    <button
                      key={k}
                      className={tool === k && !placementAsset ? "active" : ""}
                      onClick={() => {
                        setPlacementAsset(null);
                        setTool(k);
                        setDraft([]);
                      }}
                    >
                      <Icon size={24} />
                      <span>{k[0].toUpperCase() + k.slice(1)}</span>
                    </button>
                  );
                })}
              {societyAssets
                .filter(
                  (asset) =>
                    assetCategoryFilter !== "My Assets" &&
                    (assetCategoryFilter === "All" ||
                      asset.category === assetCategoryFilter) &&
                    asset.name
                      .toLowerCase()
                      .includes(assetSearch.toLowerCase()),
                )
                .map((asset) => {
                  const Icon =
                    asset.category === "Faith" ? Landmark : Building2;
                  return (
                    <button
                      key={asset.assetRef}
                      className={
                        placementAsset?.assetRef === asset.assetRef
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setPlacementAsset(asset);
                        setTool(asset.kind);
                        setDraft([]);
                      }}
                    >
                      <Icon size={24} />
                      <span>{asset.name}</span>
                      <small>{asset.category}</small>
                    </button>
                  );
                })}
              {customAssets
                .filter(
                  (asset) =>
                    (assetCategoryFilter === "All" ||
                      assetCategoryFilter === "My Assets") &&
                    asset.name
                      .toLowerCase()
                      .includes(assetSearch.toLowerCase()),
                )
                .map((asset) => (
                  <button
                    key={asset.id}
                    className={
                      placementAsset?.assetRef === `custom:${asset.id}`
                        ? "active"
                        : ""
                    }
                    title={`${asset.category} · ${(asset.size / 1024 / 1024).toFixed(1)} MB`}
                    onClick={() => {
                      setPlacementAsset({
                        assetRef: `custom:${asset.id}`,
                        name: asset.name,
                        kind: "building",
                        buildingType:
                          asset.category === "Faith"
                            ? "Place of worship"
                            : asset.category === "Education"
                              ? "School"
                              : asset.category === "Health"
                                ? "Clinic"
                                : "Commercial",
                        width: asset.width,
                        depth: asset.depth,
                        height: asset.height,
                        color: "#d8e2ea",
                      });
                      setTool("building");
                      setDraft([]);
                    }}
                  >
                    <Box size={24} />
                    <span>{asset.name}</span>
                    <small>{asset.category}</small>
                  </button>
                ))}
              <button
                className="asset-import"
                onClick={() => setAssetDialog(true)}
              >
                <Upload size={24} />
                <span>Import GLB</span>
              </button>
            </div>
            <div className="export">
              <button
                onClick={async () => {
                  try {
                    if (await saveToComputer(project)) {
                      setStatus("Saved");
                      setError("");
                    }
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
        accept=".geojson,application/geo+json"
        onChange={openComputerFile}
      />
      <input
        hidden
        ref={projectFile}
        type="file"
        accept=".json,application/json"
        onChange={openProjectComputerFile}
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
          <section
            role="dialog"
            className={`modal ${dialog === "confirm-switch" ? "confirm-switch-modal" : ""}`}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {dialog === "new"
                    ? "Create a project"
                    : dialog === "confirm-switch"
                      ? "Save current project?"
                      : "Open a saved project"}
                </h2>
                <p className="muted">
                  {dialog === "confirm-switch"
                    ? pendingProject &&
                      Math.abs(pendingProject.origin[0] - project.origin[0]) <
                        0.0001 &&
                      Math.abs(pendingProject.origin[1] - project.origin[1]) <
                        0.0001
                      ? "This project uses the same site. Open it separately or add all of its objects as a new project layer."
                      : status === "Unsaved"
                        ? "You have unsaved work. Save it before opening another project."
                        : "The selected project uses another map location. It can be opened separately, but cannot be added as a project layer."
                    : dialog === "open"
                      ? "The last active browser project opens by default. With no active save, the Christchurch demo opens."
                      : "Projects retain their exact map origin, boundary and object positions."}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => {
                  setPendingProject(null);
                  setPendingProjectStorage(null);
                  setPendingDeleteProject("");
                  setDialog(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            {dialog === "confirm-switch" ? (
              <>
                <div className="modal-actions confirm-switch-actions">
                  <button
                    className="primary"
                    onClick={async () => {
                      if (!pendingProject) return;
                      const next = pendingProject;
                      if (await save())
                        switchProject(
                          next,
                          true,
                          pendingProjectStorage ?? storage,
                        );
                    }}
                  >
                    Save current &amp; open
                  </button>
                  <button
                    onClick={() => {
                      if (pendingProject)
                        switchProject(
                          pendingProject,
                          true,
                          pendingProjectStorage ?? storage,
                        );
                    }}
                  >
                    Open separately
                  </button>
                  {pendingProject &&
                    Math.abs(pendingProject.origin[0] - project.origin[0]) <
                      0.0001 &&
                    Math.abs(pendingProject.origin[1] - project.origin[1]) <
                      0.0001 && (
                      <button onClick={() => addProjectLayer(pendingProject)}>
                        Add as project layer
                      </button>
                    )}
                  <button onClick={() => setDialog(null)}>Cancel</button>
                </div>
              </>
            ) : dialog === "new" ? (
              <>
                <div className="modal-body">
                  <label className="field">
                    Project name
                    <input
                      autoFocus
                      value={name}
                      maxLength={100}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setDialog(null)}>Cancel</button>
                  <button
                    className="primary"
                    disabled={!name.trim()}
                    onClick={() =>
                      requestProjectSwitch(newProject(name.trim()), false)
                    }
                  >
                    Create project
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="saved-projects">
                  {projects.map((savedProject) => (
                    <div className="saved-project-row" key={savedProject.id}>
                      <button
                        className="saved-project-open"
                        onClick={() => requestProjectSwitch(savedProject)}
                      >
                        <span>{savedProject.name}</span>
                        <small>{savedProject.objects.length} objects</small>
                      </button>
                      <button
                        className={
                          pendingDeleteProject === savedProject.id
                            ? "saved-project-delete confirming"
                            : "saved-project-delete"
                        }
                        aria-label={`Delete ${savedProject.name}`}
                        title={
                          pendingDeleteProject === savedProject.id
                            ? "Click again to confirm"
                            : "Delete saved project"
                        }
                        onClick={() => {
                          if (pendingDeleteProject !== savedProject.id) {
                            setPendingDeleteProject(savedProject.id);
                            return;
                          }
                          setProjects(deleteLocal(savedProject.id));
                          setPendingDeleteProject("");
                          if (savedProject.id === project.id)
                            setStatus("Unsaved");
                        }}
                      >
                        {pendingDeleteProject === savedProject.id ? (
                          <span>Confirm</span>
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                {!projects.length && (
                  <p className="empty-saved-projects">
                    No browser projects saved yet.
                  </p>
                )}
                <div className="modal-actions">
                  <button onClick={() => setDialog(null)}>Cancel</button>
                  <button
                    onClick={() =>
                      requestProjectSwitch(zarajNzProject(), false)
                    }
                  >
                    Load Zaraj demo
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {placementDialog && (
        <div className="modal-backdrop object-setup-backdrop">
          <section
            role="dialog"
            aria-label={`Configure ${placementDialog.object.kind}`}
            className="modal object-setup-modal"
          >
            <div className="modal-header">
              <div>
                <small>NEW {placementDialog.object.kind.toUpperCase()}</small>
                <h2>Object settings</h2>
                <p className="muted">
                  Check the default values before placing this object.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Cancel object placement"
                onClick={() => {
                  setPlacementDialog(null);
                  setPlacementAsset(null);
                  setDraft([]);
                  setTool("select");
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="object-setup-grid">
              <label className="field wide">
                Object name
                <input
                  autoFocus
                  value={placementDialog.object.name}
                  maxLength={100}
                  onChange={(event) =>
                    updatePlacementObject({ name: event.target.value })
                  }
                />
              </label>
              {["building", "tree", "car", "bench", "bridge"].includes(
                placementDialog.object.kind,
              ) && (
                <fieldset className="shape-picker wide">
                  <legend>Choose design / shape</legend>
                  <div className="shape-choice-grid">
                    {shapeChoices(placementDialog.object).map((choice) => (
                      <button
                        type="button"
                        key={choice.value}
                        className={
                          placementDialog.object.assetRef === choice.value
                            ? "shape-choice active"
                            : "shape-choice"
                        }
                        aria-pressed={
                          placementDialog.object.assetRef === choice.value
                        }
                        onClick={() =>
                          updatePlacementObject({ assetRef: choice.value })
                        }
                      >
                        <span
                          className={`shape-preview ${choice.preview}`}
                          aria-hidden="true"
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                        <b>{choice.label}</b>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {["building", "bridge"].includes(placementDialog.object.kind) && (
                <>
                  <label className="field">
                    Width (m)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={placementDialog.object.width}
                      onChange={(event) =>
                        updatePlacementObject({
                          width: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Depth (m)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={placementDialog.object.depth}
                      onChange={(event) =>
                        updatePlacementObject({
                          depth: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </>
              )}
              {placementDialog.object.kind === "road" && (
                <>
                  <label className="field">
                    Road width (m)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={placementDialog.object.width}
                      onChange={(event) =>
                        updatePlacementObject({
                          width: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Lanes
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={placementDialog.object.lanes}
                      onChange={(event) =>
                        updatePlacementObject({
                          lanes: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </>
              )}
              {placementDialog.object.kind === "building" && (
                <>
                  <label className="field">
                    Floors
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={placementDialog.object.floors}
                      onChange={(event) =>
                        updatePlacementObject({
                          floors: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Floor height (m)
                    <input
                      type="number"
                      min="2"
                      max="6"
                      step="0.1"
                      value={placementDialog.object.floorHeight}
                      onChange={(event) =>
                        updatePlacementObject({
                          floorHeight: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Roof
                    <select
                      value={placementDialog.object.roof}
                      onChange={(event) =>
                        updatePlacementObject({
                          roof: event.target.value as DesignObject["roof"],
                        })
                      }
                    >
                      <option value="pitched">Pitched</option>
                      <option value="flat">Flat</option>
                    </select>
                  </label>
                </>
              )}
              {!["boundary", "road", "plot"].includes(
                placementDialog.object.kind,
              ) && (
                <label className="field">
                  Scale
                  <input
                    type="number"
                    min="0.2"
                    max="5"
                    step="0.1"
                    value={placementDialog.object.scale}
                    onChange={(event) =>
                      updatePlacementObject({
                        scale: Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
              {!["boundary", "road", "plot"].includes(
                placementDialog.object.kind,
              ) && (
                <label className="field">
                  Rotation (°)
                  <input
                    type="number"
                    min="-360"
                    max="360"
                    value={placementDialog.object.rotation}
                    onChange={(event) =>
                      updatePlacementObject({
                        rotation: Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
              <label className="field color-field">
                Color
                <input
                  type="color"
                  value={placementDialog.object.color}
                  onChange={(event) =>
                    updatePlacementObject({ color: event.target.value })
                  }
                />
              </label>
            </div>
            {(() => {
              const object = placementDialog.object;
              const required =
                object.kind === "boundary" || object.kind === "plot"
                  ? area(object.points)
                  : ["building", "bridge"].includes(object.kind)
                    ? area(footprint(object))
                    : 0;
              const siteAreas = project.objects
                .filter((item) => item.kind === "boundary")
                .map((item) => area(item.points));
              const capacity = siteAreas.length
                ? Math.max(...siteAreas)
                : required;
              if (!required) return null;
              const fits = object.kind === "boundary" || required <= capacity;
              return (
                <div
                  className={`capacity-check ${fits ? "fits" : "too-large"}`}
                >
                  <div>
                    <small>
                      {object.kind === "boundary" ? "SITE SIZE" : "SIZE CHECK"}
                    </small>
                    <b>
                      {required.toFixed(1)} m² ·{" "}
                      {(required / 25.2929).toFixed(2)} marla
                    </b>
                  </div>
                  {object.kind !== "boundary" && (
                    <span>
                      {fits
                        ? `Fits area capacity · site ${capacity.toFixed(1)} m²`
                        : `Too large · site capacity ${capacity.toFixed(1)} m²`}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="modal-actions">
              <button
                onClick={() => {
                  setPlacementDialog(null);
                  setPlacementAsset(null);
                  setDraft([]);
                  setTool("select");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={!placementDialog.object.name.trim()}
                onClick={confirmPlacement}
              >
                Place object
              </button>
            </div>
          </section>
        </div>
      )}
      {siteAnalysis && (
        <div className="modal-backdrop site-analysis-backdrop">
          <section
            role="dialog"
            aria-label="Site analysis"
            className="modal site-analysis-modal"
          >
            <div className="site-analysis-heading">
              <div>
                <small>BOUNDARY CHECK</small>
                <h2>Site analysis</h2>
                <p className="muted">
                  Existing map context around the boundary.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close site analysis"
                onClick={() => setSiteAnalysis(null)}
              >
                <X size={18} />
              </button>
            </div>
            {siteAnalysis.status === "loading" || !siteAnalysis.result ? (
              <div className="site-analysis-loading">
                <span className="analysis-spinner" />
                <b>Checking roads and nearby map features…</b>
                <small>
                  OpenStreetMap analysis usually takes a few seconds.
                </small>
              </div>
            ) : (
              <>
                <div
                  className={`buildability-status ${siteAnalysis.result.buildability}`}
                >
                  <div>
                    <small>BUILDABILITY SCREEN</small>
                    <b>
                      {siteAnalysis.result.buildability === "blocked"
                        ? "Mapped constraint intersects this site"
                        : siteAnalysis.result.buildability === "review"
                          ? "No mapped water overlap · professional review required"
                          : "Data incomplete · suitability unknown"}
                    </b>
                  </div>
                  <span>
                    {siteAnalysis.result.sourceAvailable
                      ? "OSM context checked"
                      : "Live source unavailable"}
                  </span>
                </div>
                <div className="analysis-metrics">
                  <article>
                    <small>AREA</small>
                    <b>{siteAnalysis.result.areaHa.toFixed(2)} ha</b>
                  </article>
                  <article>
                    <small>SIZE</small>
                    <b>
                      {siteAnalysis.result.widthM.toFixed(0)} ×{" "}
                      {siteAnalysis.result.depthM.toFixed(0)} m
                    </b>
                  </article>
                  <article>
                    <small>PERIMETER</small>
                    <b>{siteAnalysis.result.perimeterM.toFixed(0)} m</b>
                  </article>
                  <article>
                    <small>ROADS WITHIN 150 M</small>
                    <b>{siteAnalysis.result.nearbyRoads}</b>
                  </article>
                </div>
                <div className="analysis-sections">
                  <article>
                    <h3>Road access</h3>
                    {siteAnalysis.result.nearestRoad ? (
                      <p>
                        Nearest mapped road:{" "}
                        <b>{siteAnalysis.result.nearestRoad.name}</b> ·{" "}
                        {siteAnalysis.result.nearestRoad.distanceM.toFixed(0)} m
                      </p>
                    ) : (
                      <p>No mapped road was found nearby.</p>
                    )}
                    <div className="analysis-tags">
                      {siteAnalysis.result.accessRoads.map((road) => (
                        <span key={road}>{road}</span>
                      ))}
                      {!siteAnalysis.result.accessRoads.length && (
                        <span className="warning-tag">Access required</span>
                      )}
                    </div>
                  </article>
                  <article>
                    <h3>Existing context</h3>
                    <p>
                      {siteAnalysis.result.existingBuildings} mapped buildings ·{" "}
                      {siteAnalysis.result.waterFeatures} water features
                    </p>
                    <p className="intersection-summary">
                      <b>{siteAnalysis.result.intersectingBuildings}</b>{" "}
                      buildings ·{" "}
                      <b>{siteAnalysis.result.intersectingWaterFeatures}</b>{" "}
                      water features ·{" "}
                      <b>{siteAnalysis.result.intersectingRoads}</b> roads
                      intersect site
                    </p>
                    <div className="analysis-tags">
                      {(siteAnalysis.result.intersectingLandUse.length
                        ? siteAnalysis.result.intersectingLandUse
                        : siteAnalysis.result.landUse
                      ).map((item) => (
                        <span key={item}>{item.replaceAll("_", " ")}</span>
                      ))}
                      {!siteAnalysis.result.landUse.length && (
                        <span>No mapped land use</span>
                      )}
                    </div>
                  </article>
                  <article className="analysis-notes">
                    <h3>Before designing</h3>
                    <ul>
                      {siteAnalysis.result.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </article>
                </div>
                <small className="analysis-source">
                  {siteAnalysis.result.sourceAvailable
                    ? `Map context: © OpenStreetMap contributors · checked ${new Date(siteAnalysis.result.checkedAt).toLocaleString()}. Concept check only.`
                    : "Local boundary measurements only."}
                </small>
              </>
            )}
            <div className="modal-actions">
              {siteAnalysis.status === "ready" && (
                <button
                  onClick={() => {
                    const boundary = siteAnalysis.boundary;
                    setSiteAnalysis({ status: "loading", boundary });
                    void analyzeSite(boundary, project.origin).then((result) =>
                      setSiteAnalysis({ status: "ready", boundary, result }),
                    );
                  }}
                >
                  Run again
                </button>
              )}
              <button
                className="primary"
                disabled={siteAnalysis.status === "loading"}
                onClick={() => setSiteAnalysis(null)}
              >
                Start designing
              </button>
            </div>
          </section>
        </div>
      )}
      {assetDialog && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-label="Import 3D asset"
            className="modal asset-modal"
          >
            <div className="modal-header">
              <div>
                <h2>Import a 3D asset</h2>
                <p className="muted">
                  Add one binary GLB model to My Assets. The file stays in this
                  browser.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close asset import"
                onClick={() => {
                  setAssetDialog(false);
                  setAssetFile(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <label className="asset-drop">
              <Upload size={24} />
              <b>{assetFile?.name || "Choose a .glb file"}</b>
              <small>Maximum 25 MB</small>
              <input
                type="file"
                accept=".glb,model/gltf-binary"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setAssetFile(next);
                  if (next && !assetName)
                    setAssetName(next.name.replace(/\.glb$/i, ""));
                }}
              />
            </label>
            <div className="field-grid">
              <label className="field">
                Asset name
                <input
                  value={assetName}
                  maxLength={60}
                  onChange={(e) => setAssetName(e.target.value)}
                />
              </label>
              <label className="field">
                Category
                <select
                  value={assetCategory}
                  onChange={(e) =>
                    setAssetCategory(e.target.value as CustomAssetCategory)
                  }
                >
                  {[
                    "Faith",
                    "Education",
                    "Health",
                    "Commercial",
                    "Community",
                    "Street",
                    "Park",
                    "Utility",
                    "Custom",
                  ].map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-grid three">
              {[
                ["Width (m)", assetWidth, setAssetWidth],
                ["Depth (m)", assetDepth, setAssetDepth],
                ["Height (m)", assetHeight, setAssetHeight],
              ].map(([label, value, setter]) => (
                <label className="field" key={label as string}>
                  {label as string}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={value as number}
                    onChange={(e) =>
                      (setter as React.Dispatch<React.SetStateAction<number>>)(
                        Number(e.target.value),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setAssetDialog(false);
                  setAssetFile(null);
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  importingAsset ||
                  !assetFile ||
                  !assetName.trim() ||
                  [assetWidth, assetDepth, assetHeight].some(
                    (value) => !Number.isFinite(value) || value < 1,
                  )
                }
                onClick={async () => {
                  if (!assetFile) return;
                  setImportingAsset(true);
                  try {
                    const asset = await importCustomAsset(assetFile, {
                      name: assetName.trim(),
                      category: assetCategory,
                      width: assetWidth,
                      depth: assetDepth,
                      height: assetHeight,
                    });
                    setCustomAssets(await listCustomAssets());
                    setPlacementAsset({
                      assetRef: `custom:${asset.id}`,
                      name: asset.name,
                      kind: "building",
                      buildingType:
                        asset.category === "Faith"
                          ? "Place of worship"
                          : asset.category === "Education"
                            ? "School"
                            : asset.category === "Health"
                              ? "Clinic"
                              : "Commercial",
                      width: asset.width,
                      depth: asset.depth,
                      height: asset.height,
                      color: "#d8e2ea",
                    });
                    setTool("building");
                    setAssetDialog(false);
                    setAssetFile(null);
                    setAssetName("");
                    setError("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setImportingAsset(false);
                  }
                }}
              >
                {importingAsset ? "Importing…" : "Add to library"}
              </button>
            </div>
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
      <p className="muted small">
        Map par blue point ko drag karke shape ya size adjust karein.
      </p>
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
                  assetRef:
                    e.target.value === "Townhouse"
                      ? "kenney:house:t"
                      : e.target.value === "Detached house" &&
                          !o.assetRef.startsWith("kenney:house:")
                        ? "kenney:house:f"
                        : o.assetRef,
                })
              }
            >
              {[
                "Detached house",
                "Townhouse",
                "Apartment",
                "Commercial",
                "Place of worship",
                "School",
                "Clinic",
                "Community",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
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
          {["Detached house", "Townhouse"].includes(o.buildingType) && (
            <>
              <label className="field">
                House design
                <select
                  value={
                    o.assetRef.startsWith("kenney:house:")
                      ? o.assetRef
                      : "kenney:house:f"
                  }
                  onChange={(e) => onUpdate({ ...o, assetRef: e.target.value })}
                >
                  <option value="kenney:house:a">Modern compact</option>
                  <option value="kenney:house:f">Suburban gable</option>
                  <option value="kenney:house:k">Family villa</option>
                  <option value="kenney:house:t">Townhouse row</option>
                </select>
              </label>
              {number("scale", "3D model size", 0.5, 2, 0.1)}
            </>
          )}
          {(o.assetRef.startsWith("custom:") ||
            o.assetRef.startsWith("builtin:society:")) &&
            number("scale", "3D model size", 0.2, 5, 0.1)}
          <div className="measure">
            <span>Footprint / floor area</span>
            <b>
              {(o.width * o.depth).toFixed(0)} m² /{" "}
              {(o.width * o.depth * o.floors).toFixed(0)} m²
            </b>
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
            Facade tint
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
          {o.kind === "car" && (
            <label className="field">
              Vehicle colour
              <input
                type="color"
                value={o.color}
                onChange={(e) => onUpdate({ ...o, color: e.target.value })}
              />
            </label>
          )}
        </>
      )}
      {o.kind === "bridge" && (
        <p className="muted small">
          Blue corner handles se deck ki width aur length adjust karein. No
          approaches, clearance or structural checks.
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
