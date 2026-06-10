import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Maximize2, Minus, Moon, Plus, RotateCcw, Save, Sun, Trash2, Upload } from "lucide-react";
import { buildArtifacts, clampNumber, makeFileName } from "./geometry.js";

const INCH_IN_MM = 25.4;
const STORAGE_KEY = "cajalab.settings.v1";
const VIEW_STORAGE_KEY = "cajalab.view.v1";
const THEME_STORAGE_KEY = "cajalab.theme.v1";
const LANGUAGE_STORAGE_KEY = "cajalab.language.v1";
const SECTIONS_STORAGE_KEY = "cajalab.sections.v1";
const RECENTS_STORAGE_KEY = "cajalab.recents.v1";

const translations = {
  es: {
    appTitle: "Generador de cajas para corte laser",
    theme: "Tema",
    light: "Claro",
    dark: "Oscuro",
    language: "Idioma",
    resetView: "Reiniciar vista",
    previewLabel: "Vista previa",
    model3d: "Modelo 3D",
    svgPlan: "Plano SVG",
    plan2d: "Plano 2D",
    preview: "Preview",
    cut: "Corte",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    fitView: "Ajustar a pantalla",
    autoFit: "Auto-ajustar al cambiar medidas",
    auto: "Auto",
    cutFile: "Archivo de corte",
    ready: "Listo",
    review: "Revisar",
    bed: "Cama",
    fitsBed: "Cabe en cama",
    joinedPieces: "piezas juntas",
    doesNotFit: "No cabe",
    dimensions: "Dimensiones",
    material: "Material",
    export: "Exportacion",
    measurements: "Medidas",
    units: "Unidades",
    millimeters: "Milimetros",
    inches: "Pulgadas",
    dimensionType: "Tipo de medida",
    internal: "Interna",
    external: "Externa",
    width: "Ancho",
    depth: "Fondo",
    height: "Alto",
    generatedPlan: "Plano generado",
    joints: "Uniones",
    type: "Tipo",
    fingerJoint: "Dedos intercalados",
    plainEdge: "Canto recto",
    tSlotJoint: "T-slot",
    fingerSize: "Tamano de dedo",
    screwDiameter: "Diametro tornillo",
    nutWidth: "Ancho tuerca",
    slotDepth: "Profundidad slot",
    slotSpacing: "Separacion slots",
    box: "Caja",
    openTop: "Sin tapa",
    layoutGap: "Separacion del plano",
    materialThickness: "Grosor material",
    bedWidth: "Ancho cama",
    bedHeight: "Alto cama",
    materialMargin: "Margen material",
    joinPieces: "Juntar en fila",
    autoNest: "Nesting automatico",
    allowRotation: "Rotar piezas",
    cncMode: "Modo CNC",
    dogbones: "Dogbones",
    toolDiameter: "Diametro herramienta",
    terrarium: "Preparar para terrario",
    preset: "Preset",
    cutColor: "Color de corte",
    scoreColor: "Color de score",
    red: "Rojo",
    black: "Negro",
    white: "Blanco",
    blue: "Azul",
    green: "Verde",
    darkBlue: "Azul oscuro",
    cutLine: "Linea corte",
    scoreLine: "Linea score",
    internalMarks: "Marcas internas",
    importJson: "Importar JSON",
    exportJson: "Exportar JSON",
    recents: "Recientes",
    saveDesign: "Guardar actual",
    noRecents: "Sin diseños guardados",
    restore: "Restaurar",
    delete: "Eliminar",
    savedNow: "Guardado ahora",
    importError: "No se pudo importar el archivo.",
    custom: "Personalizado",
    genericExport: "Generico SVG/DXF",
    front: "Frente",
    back: "Atras",
    right: "Derecha",
    left: "Izquierda",
    top: "Arriba",
    bottom: "Abajo",
    smallFingers: "Dedos pequenos para el grosor del material.",
    largeFingers: "Tamano de dedo demasiado grande para piezas pequenas.",
    oddKerf: "Kerf fuera del rango comun para corte laser.",
    thickLine: "Grosor de linea alto; algunas maquinas esperan trazos finos.",
    tslotSmall: "Los slots son pequenos para el tornillo o tuerca configurados.",
    dogboneLaser: "Dogbones activos: confirma que estas cortando en CNC/router.",
  },
  en: {
    appTitle: "Laser cut box generator",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    resetView: "Reset view",
    previewLabel: "Preview",
    model3d: "3D model",
    svgPlan: "SVG plan",
    plan2d: "2D plan",
    preview: "Preview",
    cut: "Cut",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fitView: "Fit to view",
    autoFit: "Auto-fit when dimensions change",
    auto: "Auto",
    cutFile: "Cut file",
    ready: "Ready",
    review: "Review",
    bed: "Bed",
    fitsBed: "Fits bed",
    joinedPieces: "joined pieces",
    doesNotFit: "Does not fit",
    dimensions: "Dimensions",
    material: "Material",
    export: "Export",
    measurements: "Measurements",
    units: "Units",
    millimeters: "Millimeters",
    inches: "Inches",
    dimensionType: "Dimension type",
    internal: "Internal",
    external: "External",
    width: "Width",
    depth: "Depth",
    height: "Height",
    generatedPlan: "Generated plan",
    joints: "Joints",
    type: "Type",
    fingerJoint: "Finger joints",
    plainEdge: "Plain edge",
    tSlotJoint: "T-slot",
    fingerSize: "Finger size",
    screwDiameter: "Screw diameter",
    nutWidth: "Nut width",
    slotDepth: "Slot depth",
    slotSpacing: "Slot spacing",
    box: "Box",
    openTop: "Open top",
    layoutGap: "Layout gap",
    materialThickness: "Material thickness",
    bedWidth: "Bed width",
    bedHeight: "Bed height",
    materialMargin: "Material margin",
    joinPieces: "Join in row",
    autoNest: "Auto nesting",
    allowRotation: "Rotate parts",
    cncMode: "CNC mode",
    dogbones: "Dogbones",
    toolDiameter: "Tool diameter",
    terrarium: "Prepare terrarium",
    preset: "Preset",
    cutColor: "Cut color",
    scoreColor: "Score color",
    red: "Red",
    black: "Black",
    white: "White",
    blue: "Blue",
    green: "Green",
    darkBlue: "Dark blue",
    cutLine: "Cut line",
    scoreLine: "Score line",
    internalMarks: "Internal marks",
    importJson: "Import JSON",
    exportJson: "Export JSON",
    recents: "Recent",
    saveDesign: "Save current",
    noRecents: "No saved designs",
    restore: "Restore",
    delete: "Delete",
    savedNow: "Saved now",
    importError: "Could not import the file.",
    custom: "Custom",
    genericExport: "Generic SVG/DXF",
    front: "Front",
    back: "Back",
    right: "Right",
    left: "Left",
    top: "Top",
    bottom: "Bottom",
    smallFingers: "Finger size is small for the material thickness.",
    largeFingers: "Finger size is too large for small panels.",
    oddKerf: "Kerf is outside the common laser cutting range.",
    thickLine: "Line width is high; some machines expect fine strokes.",
    tslotSmall: "Slots are small for the configured screw or nut.",
    dogboneLaser: "Dogbones are active: confirm you are cutting on a CNC/router.",
  },
};

const defaultSettings = {
  unit: "mm",
  dimensionMode: "internal",
  width: 180,
  depth: 120,
  height: 80,
  materialPreset: "mdf3",
  thickness: 3,
  finger: 18,
  kerf: 0.12,
  gap: 12,
  openTop: false,
  jointType: "finger",
  screwDiameter: 3,
  nutWidth: 6,
  slotDepth: 10,
  slotSpacing: 45,
  autoNest: false,
  allowRotation: true,
  cncMode: false,
  dogbones: false,
  toolDiameter: 3.175,
  exportPreset: "lightburn",
  cutColor: "#ff0000",
  scoreColor: "#0000ff",
  cutLineWidth: 0.1,
  scoreLineWidth: 0.1,
  includeMarks: false,
  bedPreset: "300x200",
  bedWidth: 300,
  bedHeight: 200,
  margin: 10,
  joinPieces: false,
  terrariumMode: false,
};

const materialPresets = {
  mdf3: { label: "MDF 3 mm", thickness: 3, kerf: 0.12, finger: 18 },
  plywood3: { label: "Triplay 3 mm", thickness: 3, kerf: 0.15, finger: 18 },
  acrylic28: { label: "Acrilico 2.8 mm", thickness: 2.8, kerf: 0.1, finger: 16 },
  plywood6: { label: "Triplay 6 mm", thickness: 6, kerf: 0.18, finger: 24 },
  custom: { label: "Personalizado" },
};

const exportPresets = {
  lightburn: {
    label: "LightBurn",
    cutColor: "#ff0000",
    scoreColor: "#0000ff",
    cutLineWidth: 0.1,
    scoreLineWidth: 0.1,
    includeMarks: true,
  },
  glowforge: {
    label: "Glowforge",
    cutColor: "#ff0000",
    scoreColor: "#00aa00",
    cutLineWidth: 0.1,
    scoreLineWidth: 0.1,
    includeMarks: true,
  },
  xtool: {
    label: "xTool",
    cutColor: "#ff0000",
    scoreColor: "#0000ff",
    cutLineWidth: 0.1,
    scoreLineWidth: 0.1,
    includeMarks: true,
  },
  generic: {
    label: "Generico SVG/DXF",
    cutColor: "#101418",
    scoreColor: "#2b65b1",
    cutLineWidth: 0.25,
    scoreLineWidth: 0.2,
    includeMarks: false,
  },
  custom: {
    label: "Personalizado",
  },
};

const numberLimits = {
  width: [20, 800],
  depth: [20, 800],
  height: [20, 800],
  thickness: [1, 20],
  finger: [4, 80],
  kerf: [0, 1.5],
  gap: [4, 60],
  bedWidth: [80, 1600],
  bedHeight: [80, 1200],
  margin: [0, 80],
  cutLineWidth: [0.01, 2],
  scoreLineWidth: [0.01, 2],
  screwDiameter: [1, 12],
  nutWidth: [2, 20],
  slotDepth: [3, 40],
  slotSpacing: [12, 160],
  toolDiameter: [0.5, 20],
};

function toDisplayUnit(value, unit) {
  if (unit === "in") return Math.round((value / INCH_IN_MM) * 1000) / 1000;
  return value;
}

function fromDisplayUnit(value, unit) {
  if (unit === "in") return Number(value) * INCH_IN_MM;
  return Number(value);
}

function unitLabel(unit) {
  return unit === "in" ? "in" : "mm";
}

function formatMeasurement(value, unit) {
  const displayValue = toDisplayUnit(value, unit);
  const precision = unit === "in" ? 3 : 1;
  return `${Number(displayValue.toFixed(precision))} ${unitLabel(unit)}`;
}

function unitStep(name, unit, step) {
  if (unit === "mm") return step;
  return name === "kerf" ? 0.001 : 0.01;
}

function loadInitialSettings() {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return { ...defaultSettings, ...saved };
  } catch {
    return defaultSettings;
  }
}

function geometrySettings(settings) {
  if (settings.dimensionMode === "internal") return settings;

  const heightAllowance = settings.openTop ? settings.thickness : settings.thickness * 2;
  return {
    ...settings,
    width: Math.max(20, settings.width - settings.thickness * 2),
    depth: Math.max(20, settings.depth - settings.thickness * 2),
    height: Math.max(20, settings.height - heightAllowance),
  };
}

function NumberField({ label, name, value, min, max, step = 1, unit, onChange }) {
  return (
    <label>
      {label}
      <span className="field">
        <input
          type="number"
          min={toDisplayUnit(Number(min), unit)}
          max={toDisplayUnit(Number(max), unit)}
          step={unitStep(name, unit, step)}
          value={toDisplayUnit(value, unit)}
          onChange={(event) => onChange(name, event.target.value)}
        />
        <small>{unitLabel(unit)}</small>
      </span>
    </label>
  );
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportProject(settings) {
  return JSON.stringify({
    app: "CajaLab",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
  }, null, 2);
}

function projectFileName(settings) {
  return makeFileName(geometrySettings(settings), "cajalab.json");
}

function validateFabrication(settings, layout, t) {
  const warnings = [];
  const checks = [
    { label: t.dimensions, ok: true },
    { label: t.material, ok: true },
    { label: t.bed, ok: layout.fitsBed },
    { label: t.export, ok: true },
  ];

  if (!layout.fitsBed) warnings.push(`${t.doesNotFit}: ${layout.oversized.join(", ")}`);

  if (settings.jointType === "finger") {
    if (settings.finger < settings.thickness * 1.5) {
      warnings.push(t.smallFingers);
      checks[1].ok = false;
    }
    if (settings.finger > Math.min(settings.width, settings.depth, settings.height) / 2) {
      warnings.push(t.largeFingers);
      checks[0].ok = false;
    }
  }

  if (settings.kerf < 0 || settings.kerf > 0.5) {
    warnings.push(t.oddKerf);
    checks[1].ok = false;
  }

  if (settings.cutLineWidth > 0.35 || settings.scoreLineWidth > 0.35) {
    warnings.push(t.thickLine);
    checks[3].ok = false;
  }

  if (settings.jointType === "tslot" && (settings.slotDepth < settings.screwDiameter * 1.8 || settings.nutWidth < settings.screwDiameter * 1.4)) {
    warnings.push(t.tslotSmall);
    checks[1].ok = false;
  }

  if (settings.dogbones && !settings.cncMode) {
    warnings.push(t.dogboneLaser);
    checks[3].ok = false;
  }

  return { checks, warnings };
}

function loadViewPrefs() {
  if (typeof window === "undefined") return { zoom: 1, autoFit: false };

  try {
    const rawPrefs = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (!rawPrefs) return { zoom: 1, autoFit: false };
    const saved = JSON.parse(rawPrefs);
    return {
      zoom: clampNumber(saved?.zoom ?? 1, 0.25, 4),
      autoFit: saved?.mode === "auto" && saved?.autoFit === true,
    };
  } catch {
    return { zoom: 1, autoFit: false };
  }
}

function loadTheme() {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadLanguage() {
  if (typeof window === "undefined") return "es";
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === "es" || savedLanguage === "en") return savedLanguage;
  return window.navigator?.language?.toLowerCase().startsWith("en") ? "en" : "es";
}

function loadOpenSections() {
  const fallback = {
    recents: true,
    measurements: true,
    joints: true,
    box: true,
    material: false,
    export: false,
  };
  if (typeof window === "undefined") return fallback;

  try {
    return { ...fallback, ...JSON.parse(window.localStorage.getItem(SECTIONS_STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function loadRecentDesigns() {
  if (typeof window === "undefined") return [];

  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENTS_STORAGE_KEY));
    return Array.isArray(saved) ? saved.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function AccordionSection({ id, title, badge, open, onToggle, children }) {
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;

  return (
    <section className={`control-group accordion-section ${open ? "open" : ""}`}>
      <button
        id={buttonId}
        className="accordion-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        {badge && <small>{badge}</small>}
        <ChevronDown />
      </button>
      {open && (
        <div id={panelId} className="accordion-panel" aria-labelledby={buttonId}>
          {children}
        </div>
      )}
    </section>
  );
}

function normalizeAngle(angle) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function useFitView(stageRef, panRef, activeSvg, layout) {
  const initialViewPrefs = useMemo(loadViewPrefs, []);
  const [zoom, setZoomState] = useState(initialViewPrefs.zoom);
  const [autoFit, setAutoFit] = useState(initialViewPrefs.autoFit);
  const lastBedSizeRef = useRef(`${layout.canvasWidth}x${layout.canvasHeight}`);

  const applyZoom = (nextZoom) => {
    const svg = panRef.current?.querySelector("svg");
    if (svg) {
      const [, , width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
      svg.style.width = `${width}px`;
      svg.style.height = `${height}px`;
      panRef.current.style.width = `${width * nextZoom}px`;
      panRef.current.style.height = `${height * nextZoom}px`;
    }
    if (panRef.current) {
      panRef.current.style.transform = `scale(${nextZoom})`;
    }
  };

  const setZoom = (nextZoom) => {
    const clamped = Math.min(Math.max(nextZoom, 0.25), 4);
    setAutoFit(false);
    setZoomState(clamped);
    requestAnimationFrame(() => applyZoom(clamped));
  };

  const fitToView = ({ keepAutoFit = false } = {}) => {
    const svg = panRef.current?.querySelector("svg");
    const stage = stageRef.current;
    if (!svg || !stage) return;

    const [, , width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
    const availableWidth = Math.max(120, stage.clientWidth - 36);
    const availableHeight = Math.max(120, stage.clientHeight - 36);
    const nextZoom = Math.max(Math.min(availableWidth / width, availableHeight / height, 1.25), 0.25);
    setZoomState(nextZoom);
    applyZoom(nextZoom);
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
    if (!keepAutoFit) setAutoFit(false);
  };

  const toggleAutoFit = () => {
    setAutoFit((current) => {
      const next = !current;
      if (next) requestAnimationFrame(() => fitToView({ keepAutoFit: true }));
      return next;
    });
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      const bedSize = `${layout.canvasWidth}x${layout.canvasHeight}`;
      const bedSizeChanged = lastBedSizeRef.current !== bedSize;
      lastBedSizeRef.current = bedSize;

      if (autoFit && bedSizeChanged) {
        fitToView({ keepAutoFit: true });
      } else {
        applyZoom(zoom);
      }
    });
  }, [activeSvg, layout.canvasWidth, layout.canvasHeight, autoFit]);

  useLayoutEffect(() => {
    applyZoom(zoom);
  });

  useEffect(() => {
    const onResize = () => {
      if (autoFit) requestAnimationFrame(() => fitToView({ keepAutoFit: true }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [autoFit]);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ zoom, autoFit, mode: autoFit ? "auto" : "manual" }));
  }, [zoom, autoFit]);

  return { zoom, autoFit, setZoom, fitToView, toggleAutoFit };
}

export default function App() {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [theme, setTheme] = useState(loadTheme);
  const [language, setLanguage] = useState(loadLanguage);
  const [openSections, setOpenSections] = useState(loadOpenSections);
  const [recentDesigns, setRecentDesigns] = useState(loadRecentDesigns);
  const [drawingMode, setDrawingMode] = useState("preview");
  const [view, setView] = useState({ rx: -22, ry: 34 });
  const [dragStart, setDragStart] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const stageRef = useRef(null);
  const panRef = useRef(null);
  const importInputRef = useRef(null);

  const cutSettings = useMemo(() => ({ ...geometrySettings(settings), language }), [settings, language]);
  const artifacts = useMemo(() => buildArtifacts(cutSettings), [cutSettings]);
  const { layout } = artifacts;
  const activeSvg = drawingMode === "preview" ? artifacts.previewSvg : artifacts.cutSvg;
  const { zoom, autoFit, setZoom, fitToView, toggleAutoFit } = useFitView(stageRef, panRef, activeSvg, layout);
  const t = translations[language];

  const maxDimension = Math.max(cutSettings.width, cutSettings.depth, cutSettings.height);
  const modelScale = 270 / maxDimension;
  const modelStyle = {
    "--model-w": `${Math.max(cutSettings.width * modelScale, 70)}px`,
    "--model-d": `${Math.max(cutSettings.depth * modelScale, 55)}px`,
    "--model-h": `${Math.max(cutSettings.height * modelScale, 55)}px`,
    "--rx": `${view.rx}deg`,
    "--ry": `${view.ry}deg`,
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recentDesigns));
  }, [recentDesigns]);

  const toggleSection = (id) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const setField = (name, rawValue) => {
    setSettings((current) => {
      if (numberLimits[name]) {
        const [min, max] = numberLimits[name];
        const value = clampNumber(fromDisplayUnit(rawValue, current.unit), min, max);
        const next = { ...current, [name]: value };
        if (name === "bedWidth" || name === "bedHeight") next.bedPreset = "custom";
        if (name === "thickness" || name === "kerf" || name === "finger") next.materialPreset = "custom";
        if (name === "cutLineWidth" || name === "scoreLineWidth") next.exportPreset = "custom";
        return next;
      }
      return { ...current, [name]: rawValue };
    });
  };

  const setCheckbox = (name, checked) => {
    setSettings((current) => ({ ...current, [name]: checked }));
  };

  const setBedPreset = (value) => {
    setSettings((current) => {
      if (value === "300x200") return { ...current, bedPreset: value, bedWidth: 300, bedHeight: 200 };
      if (value === "600x400") return { ...current, bedPreset: value, bedWidth: 600, bedHeight: 400 };
      return { ...current, bedPreset: value };
    });
  };

  const setMaterialPreset = (value) => {
    setSettings((current) => {
      const preset = materialPresets[value];
      if (!preset || value === "custom") return { ...current, materialPreset: "custom" };
      return {
        ...current,
        materialPreset: value,
        thickness: preset.thickness,
        kerf: preset.kerf,
        finger: preset.finger,
      };
    });
  };

  const setExportPreset = (value) => {
    setSettings((current) => {
      const preset = exportPresets[value];
      if (!preset || value === "custom") return { ...current, exportPreset: "custom" };
      return {
        ...current,
        exportPreset: value,
        cutColor: preset.cutColor,
        scoreColor: preset.scoreColor,
        cutLineWidth: preset.cutLineWidth,
        scoreLineWidth: preset.scoreLineWidth,
        includeMarks: preset.includeMarks,
      };
    });
  };

  const setExportField = (name, value) => {
    setSettings((current) => ({ ...current, [name]: value, exportPreset: "custom" }));
  };

  const importProject = async (file) => {
    if (!file) return;
    const text = await file.text();
    const project = JSON.parse(text);
    const nextSettings = project.settings || project;
    setSettings({ ...defaultSettings, ...nextSettings });
    importInputRef.current.value = "";
  };

  const setUnit = (unit) => {
    setSettings((current) => ({ ...current, unit }));
  };

  const saveRecentDesign = () => {
    const name = `${Math.round(cutSettings.width)} x ${Math.round(cutSettings.depth)} x ${Math.round(cutSettings.height)} mm`;
    const design = {
      id: crypto.randomUUID(),
      name,
      savedAt: new Date().toISOString(),
      settings,
    };
    setRecentDesigns((current) => [design, ...current.filter((item) => item.name !== name)].slice(0, 5));
  };

  const restoreRecentDesign = (design) => {
    setSettings({ ...defaultSettings, ...design.settings });
  };

  const deleteRecentDesign = (id) => {
    setRecentDesigns((current) => current.filter((design) => design.id !== id));
  };

  const onScenePointerDown = (event) => {
    event.preventDefault();
    setDragStart({ x: event.clientX, y: event.clientY, rx: view.rx, ry: view.ry, active: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onScenePointerMove = (event) => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (!dragStart.active && Math.hypot(dx, dy) < 4) return;
    if (!dragStart.active) setDragStart((current) => current ? { ...current, active: true } : current);

    setView({
      ry: normalizeAngle(dragStart.ry + dx * 0.22),
      rx: Math.max(-58, Math.min(28, dragStart.rx - dy * 0.18)),
    });
  };

  const onStagePointerDown = (event) => {
    if (event.button !== 0) return;
    setPanStart({
      x: event.clientX,
      y: event.clientY,
      left: stageRef.current.scrollLeft,
      top: stageRef.current.scrollTop,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStagePointerMove = (event) => {
    if (!panStart || !stageRef.current) return;
    stageRef.current.scrollLeft = panStart.left - (event.clientX - panStart.x);
    stageRef.current.scrollTop = panStart.top - (event.clientY - panStart.y);
  };

  const layoutStatus = layout.fitsBed
    ? `${t.fitsBed} ${formatMeasurement(settings.bedWidth, settings.unit)} x ${formatMeasurement(settings.bedHeight, settings.unit)}${settings.joinPieces ? ` - ${t.joinedPieces}` : ""}`
    : `${t.doesNotFit}: ${layout.oversized.join(", ")}`;
  const generatedSize = `${formatMeasurement(cutSettings.width, settings.unit)} x ${formatMeasurement(cutSettings.depth, settings.unit)} x ${formatMeasurement(cutSettings.height, settings.unit)}`;
  const materialLabel = settings.materialPreset === "custom" ? t.custom : materialPresets[settings.materialPreset]?.label || t.custom;
  const exportLabel = settings.exportPreset === "generic" ? t.genericExport : settings.exportPreset === "custom" ? t.custom : exportPresets[settings.exportPreset]?.label || t.custom;
  const fabrication = validateFabrication(cutSettings, layout, t);

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Vista previa">
        <header className="topbar">
          <div>
            <p className="eyebrow">CajaLab</p>
            <h1>{t.appTitle}</h1>
          </div>
          <div className="actions">
            <div className="preference-toggles" aria-label="Preferencias">
              <div className="mini-toggle" aria-label={t.theme}>
                <button className={theme === "light" ? "active" : ""} type="button" onClick={() => setTheme("light")}>
                  <Sun />
                  {t.light}
                </button>
                <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => setTheme("dark")}>
                  <Moon />
                  {t.dark}
                </button>
              </div>
              <div className="mini-toggle language-toggle" aria-label={t.language}>
                <button className={language === "es" ? "active" : ""} type="button" onClick={() => setLanguage("es")}>ES</button>
                <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>EN</button>
              </div>
            </div>
            <button className="icon-button" type="button" aria-label={t.resetView} title={t.resetView} onClick={() => setView({ rx: -22, ry: 34 })}>
              <RotateCcw />
            </button>
            <button className="primary-button" type="button" onClick={() => downloadFile(artifacts.cutSvg, makeFileName(cutSettings, "svg"), "image/svg+xml")}>
              <Download />
              SVG
            </button>
            <button className="primary-button" type="button" onClick={() => downloadFile(artifacts.dxf, makeFileName(cutSettings, "dxf"), "application/dxf")}>
              <Download />
              DXF
            </button>
            <button className="primary-button secondary" type="button" onClick={() => downloadFile(exportProject(settings), projectFileName(settings), "application/json")}>
              <Download />
              JSON
            </button>
          </div>
        </header>

        <div className="preview-grid">
          <section className="model-panel" aria-label={t.model3d}>
            <div
              className={`scene ${dragStart?.active ? "is-dragging" : ""}`}
              onPointerDown={onScenePointerDown}
              onPointerMove={onScenePointerMove}
              onPointerUp={() => setDragStart(null)}
              onPointerCancel={() => setDragStart(null)}
              onLostPointerCapture={() => setDragStart(null)}
              onDoubleClick={() => setView({ rx: -22, ry: 34 })}
            >
              <div className="box-model" data-joint={cutSettings.jointType} style={modelStyle}>
                <div className="face face-front">{t.front}</div>
                <div className="face face-back">{t.back}</div>
                <div className="face face-right">{t.right}</div>
                <div className="face face-left">{t.left}</div>
                {!settings.openTop && <div className="face face-top">{t.top}</div>}
                <div className="face face-bottom">{t.bottom}</div>
              </div>
            </div>
          </section>

          <section className="drawing-panel" aria-label={t.svgPlan}>
            <div className="drawing-head">
              <div className="drawing-title">
                <span>{t.plan2d}</span>
                <div className="segmented" aria-label="Modo de vista">
                  <button className={`segment ${drawingMode === "preview" ? "active" : ""}`} type="button" onClick={() => setDrawingMode("preview")}>{t.preview}</button>
                  <button className={`segment ${drawingMode === "cut" ? "active" : ""}`} type="button" onClick={() => setDrawingMode("cut")}>{t.cut}</button>
                </div>
              </div>
              <div className="zoom-tools" aria-label="Zoom del plano">
                <button className="icon-button small" type="button" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => setZoom(zoom / 1.2)}>
                  <Minus />
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button className="icon-button small" type="button" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => setZoom(zoom * 1.2)}>
                  <Plus />
                </button>
                <button className="icon-button small" type="button" aria-label={t.fitView} title={t.fitView} onClick={fitToView}>
                  <Maximize2 />
                </button>
                <button
                  className={`text-toggle ${autoFit ? "active" : ""}`}
                  type="button"
                  title={t.autoFit}
                  onClick={toggleAutoFit}
                >
                  {t.auto}
                </button>
              </div>
              <output>{Math.ceil(layout.canvasWidth)} x {Math.ceil(layout.canvasHeight)} mm</output>
            </div>
            <div
              className={`svg-stage ${panStart ? "is-panning" : ""}`}
              data-cut-color={settings.cutColor}
              ref={stageRef}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={() => setPanStart(null)}
              onWheel={(event) => {
                if (!event.ctrlKey) return;
                event.preventDefault();
                setZoom(event.deltaY > 0 ? zoom / 1.1 : zoom * 1.1);
              }}
            >
              <div className="svg-pan" ref={panRef} dangerouslySetInnerHTML={{ __html: activeSvg }} />
            </div>
          </section>
        </div>
      </section>

      <aside className="controls" aria-label={t.box}>
        <div className={`status-box ${layout.fitsBed ? "" : "warning"}`}>
          <div className="status-head">
            <span>{t.cutFile}</span>
            <strong>{layout.fitsBed ? t.ready : t.review}</strong>
          </div>
          <div className="metric-grid">
            <span>
              <small>{t.cut}</small>
              <strong>{artifacts.cutLengthMeters.toFixed(2)} m</strong>
            </span>
            <span>
              <small>{t.bed}</small>
              <strong>{formatMeasurement(settings.bedWidth, settings.unit)} x {formatMeasurement(settings.bedHeight, settings.unit)}</strong>
            </span>
          </div>
          <small>{layoutStatus}</small>
          <div className="checklist" aria-label="Checklist">
            {fabrication.checks.map((check) => (
              <span key={check.label} className={check.ok ? "ok" : "warn"}>{check.label}</span>
            ))}
          </div>
          {fabrication.warnings.length > 0 && (
            <ul className="warning-list">
              {fabrication.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>

        <AccordionSection id="recents" title={t.recents} open={openSections.recents} onToggle={toggleSection}>
          <button className="tool-button full" type="button" onClick={saveRecentDesign}>
            <Save />
            {t.saveDesign}
          </button>
          <div className="recent-list">
            {recentDesigns.length === 0 && <p className="control-note">{t.noRecents}</p>}
            {recentDesigns.map((design) => (
              <div className="recent-item" key={design.id}>
                <button type="button" onClick={() => restoreRecentDesign(design)}>
                  <strong>{design.name}</strong>
                  <small>{new Date(design.savedAt).toLocaleString(language === "en" ? "en-US" : "es-MX")}</small>
                </button>
                <button className="icon-button small" type="button" aria-label={t.delete} title={t.delete} onClick={() => deleteRecentDesign(design.id)}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection id="measurements" title={t.measurements} open={openSections.measurements} onToggle={toggleSection}>
          <label>
            {t.units}
            <select value={settings.unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="mm">{t.millimeters}</option>
              <option value="in">{t.inches}</option>
            </select>
          </label>
          <label>
            {t.dimensionType}
            <select value={settings.dimensionMode} onChange={(event) => setField("dimensionMode", event.target.value)}>
              <option value="internal">{t.internal}</option>
              <option value="external">{t.external}</option>
            </select>
          </label>
          <NumberField label={t.width} name="width" value={settings.width} min="20" max="800" unit={settings.unit} onChange={setField} />
          <NumberField label={t.depth} name="depth" value={settings.depth} min="20" max="800" unit={settings.unit} onChange={setField} />
          <NumberField label={t.height} name="height" value={settings.height} min="20" max="800" unit={settings.unit} onChange={setField} />
          <p className="control-note">
            {t.generatedPlan}: {generatedSize}
          </p>
        </AccordionSection>

        <AccordionSection id="joints" title={t.joints} open={openSections.joints} onToggle={toggleSection}>
          <label>
            {t.type}
            <select value={settings.jointType} onChange={(event) => setField("jointType", event.target.value)}>
              <option value="finger">{t.fingerJoint}</option>
              <option value="plain">{t.plainEdge}</option>
              <option value="tslot">{t.tSlotJoint}</option>
            </select>
          </label>
          <NumberField label={t.fingerSize} name="finger" value={settings.finger} min="4" max="80" unit={settings.unit} onChange={setField} />
          <NumberField label="Kerf" name="kerf" value={settings.kerf} min="0" max="1.5" step="0.01" unit={settings.unit} onChange={setField} />
          {settings.jointType === "tslot" && (
            <>
              <NumberField label={t.screwDiameter} name="screwDiameter" value={settings.screwDiameter} min="1" max="12" step="0.1" unit={settings.unit} onChange={setField} />
              <NumberField label={t.nutWidth} name="nutWidth" value={settings.nutWidth} min="2" max="20" step="0.1" unit={settings.unit} onChange={setField} />
              <NumberField label={t.slotDepth} name="slotDepth" value={settings.slotDepth} min="3" max="40" step="0.1" unit={settings.unit} onChange={setField} />
              <NumberField label={t.slotSpacing} name="slotSpacing" value={settings.slotSpacing} min="12" max="160" unit={settings.unit} onChange={setField} />
            </>
          )}
        </AccordionSection>

        <AccordionSection id="box" title={t.box} open={openSections.box} onToggle={toggleSection}>
          <label className="switch-row">
            {t.openTop}
            <input className="toggle-input" type="checkbox" checked={settings.openTop} onChange={(event) => setCheckbox("openTop", event.target.checked)} />
          </label>
          <NumberField label={t.layoutGap} name="gap" value={settings.gap} min="4" max="60" unit={settings.unit} onChange={setField} />
        </AccordionSection>

        <AccordionSection id="material" title={t.material} badge={materialLabel} open={openSections.material} onToggle={toggleSection}>
          <label>
            {t.material}
            <select value={settings.materialPreset} onChange={(event) => setMaterialPreset(event.target.value)}>
              {Object.entries(materialPresets).map(([value, preset]) => (
                <option key={value} value={value}>{value === "custom" ? t.custom : preset.label}</option>
              ))}
            </select>
          </label>
          <NumberField label={t.materialThickness} name="thickness" value={settings.thickness} min="1" max="20" step="0.1" unit={settings.unit} onChange={setField} />
          <label>
            {t.bed}
            <select value={settings.bedPreset} onChange={(event) => setBedPreset(event.target.value)}>
              <option value="300x200">300 x 200 mm</option>
              <option value="600x400">600 x 400 mm</option>
              <option value="custom">{t.custom}</option>
            </select>
          </label>
          <NumberField label={t.bedWidth} name="bedWidth" value={settings.bedWidth} min="80" max="1600" unit={settings.unit} onChange={setField} />
          <NumberField label={t.bedHeight} name="bedHeight" value={settings.bedHeight} min="80" max="1200" unit={settings.unit} onChange={setField} />
          <NumberField label={t.materialMargin} name="margin" value={settings.margin} min="0" max="80" unit={settings.unit} onChange={setField} />
          <label className="switch-row">
            {t.autoNest}
            <input className="toggle-input" type="checkbox" checked={settings.autoNest} onChange={(event) => setCheckbox("autoNest", event.target.checked)} />
          </label>
          <label className="switch-row">
            {t.allowRotation}
            <input className="toggle-input" type="checkbox" checked={settings.allowRotation} onChange={(event) => setCheckbox("allowRotation", event.target.checked)} />
          </label>
          <label className="switch-row">
            {t.joinPieces}
            <input className="toggle-input" type="checkbox" checked={settings.joinPieces} onChange={(event) => setCheckbox("joinPieces", event.target.checked)} />
          </label>
        </AccordionSection>

        <AccordionSection id="export" title={t.export} badge={exportLabel} open={openSections.export} onToggle={toggleSection}>
          <button
            className={`tool-button ${settings.terrariumMode ? "active" : ""}`}
            type="button"
            onClick={() => setCheckbox("terrariumMode", !settings.terrariumMode)}
          >
            {t.terrarium}
          </button>
          <label>
            {t.preset}
            <select value={settings.exportPreset} onChange={(event) => setExportPreset(event.target.value)}>
              {Object.entries(exportPresets).map(([value, preset]) => (
                <option key={value} value={value}>
                  {value === "generic" ? t.genericExport : value === "custom" ? t.custom : preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.cutColor}
            <select value={settings.cutColor} onChange={(event) => setExportField("cutColor", event.target.value)}>
              <option value="#ff0000">{t.red}</option>
              <option value="#101418">{t.black}</option>
              <option value="#ffffff">{t.white}</option>
            </select>
          </label>
          <label>
            {t.scoreColor}
            <select value={settings.scoreColor} onChange={(event) => setExportField("scoreColor", event.target.value)}>
              <option value="#0000ff">{t.blue}</option>
              <option value="#00aa00">{t.green}</option>
              <option value="#2b65b1">{t.darkBlue}</option>
            </select>
          </label>
          <NumberField label={t.cutLine} name="cutLineWidth" value={settings.cutLineWidth} min="0.01" max="2" step="0.01" unit="mm" onChange={setField} />
          <NumberField label={t.scoreLine} name="scoreLineWidth" value={settings.scoreLineWidth} min="0.01" max="2" step="0.01" unit="mm" onChange={setField} />
          <label className="switch-row">
            {t.internalMarks}
            <input className="toggle-input" type="checkbox" checked={settings.includeMarks} onChange={(event) => setCheckbox("includeMarks", event.target.checked)} />
          </label>
          <label className="switch-row">
            {t.cncMode}
            <input className="toggle-input" type="checkbox" checked={settings.cncMode} onChange={(event) => setCheckbox("cncMode", event.target.checked)} />
          </label>
          <label className="switch-row">
            {t.dogbones}
            <input className="toggle-input" type="checkbox" checked={settings.dogbones} onChange={(event) => setCheckbox("dogbones", event.target.checked)} />
          </label>
          {settings.cncMode && (
            <NumberField label={t.toolDiameter} name="toolDiameter" value={settings.toolDiameter} min="0.5" max="20" step="0.1" unit={settings.unit} onChange={setField} />
          )}
          <div className="file-actions">
            <button className="tool-button" type="button" onClick={() => importInputRef.current.click()}>
              <Upload />
              {t.importJson}
            </button>
            <button className="tool-button" type="button" onClick={() => downloadFile(exportProject(settings), projectFileName(settings), "application/json")}>
              <Download />
              {t.exportJson}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => importProject(event.target.files?.[0]).catch(() => window.alert(t.importError))}
            />
          </div>
        </AccordionSection>
      </aside>
    </main>
  );
}
