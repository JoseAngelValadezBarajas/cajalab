import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { buildArtifacts, clampNumber, makeFileName } from "./geometry.js";

const INCH_IN_MM = 25.4;
const STORAGE_KEY = "cajalab.settings.v1";

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
  cutColor: "white",
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

function useFitView(stageRef, panRef, activeSvg, layout) {
  const [zoom, setZoomState] = useState(1);
  const [needsFit, setNeedsFit] = useState(true);

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
    setNeedsFit(false);
    setZoomState(clamped);
    requestAnimationFrame(() => applyZoom(clamped));
  };

  const fitToView = () => {
    const svg = panRef.current?.querySelector("svg");
    const stage = stageRef.current;
    if (!svg || !stage) return;

    const [, , width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
    const availableWidth = Math.max(120, stage.clientWidth - 36);
    const availableHeight = Math.max(120, stage.clientHeight - 36);
    const nextZoom = Math.max(Math.min(availableWidth / width, availableHeight / height, 2), 0.25);
    setZoomState(nextZoom);
    applyZoom(nextZoom);
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
    setNeedsFit(false);
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      applyZoom(zoom);
      if (needsFit) fitToView();
    });
  }, [activeSvg, layout.canvasWidth, layout.canvasHeight]);

  useEffect(() => {
    const onResize = () => setNeedsFit(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (needsFit) requestAnimationFrame(fitToView);
  }, [needsFit]);

  return { zoom, setZoom, fitToView: () => setNeedsFit(true) };
}

export default function App() {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [drawingMode, setDrawingMode] = useState("preview");
  const [view, setView] = useState({ rx: -22, ry: 34 });
  const [dragStart, setDragStart] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const stageRef = useRef(null);
  const panRef = useRef(null);

  const cutSettings = useMemo(() => geometrySettings(settings), [settings]);
  const artifacts = useMemo(() => buildArtifacts(cutSettings), [cutSettings]);
  const { layout } = artifacts;
  const activeSvg = drawingMode === "preview" ? artifacts.previewSvg : artifacts.cutSvg;
  const { zoom, setZoom, fitToView } = useFitView(stageRef, panRef, activeSvg, layout);

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

  const setField = (name, rawValue) => {
    setSettings((current) => {
      if (numberLimits[name]) {
        const [min, max] = numberLimits[name];
        const value = clampNumber(fromDisplayUnit(rawValue, current.unit), min, max);
        const next = { ...current, [name]: value };
        if (name === "bedWidth" || name === "bedHeight") next.bedPreset = "custom";
        if (name === "thickness" || name === "kerf" || name === "finger") next.materialPreset = "custom";
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

  const setUnit = (unit) => {
    setSettings((current) => ({ ...current, unit }));
  };

  const onScenePointerDown = (event) => {
    setDragStart({ x: event.clientX, y: event.clientY, rx: view.rx, ry: view.ry });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onScenePointerMove = (event) => {
    if (!dragStart) return;
    setView({
      ry: dragStart.ry + (event.clientX - dragStart.x) * 0.35,
      rx: Math.max(-70, Math.min(35, dragStart.rx - (event.clientY - dragStart.y) * 0.28)),
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
    ? `Cabe en cama ${formatMeasurement(settings.bedWidth, settings.unit)} x ${formatMeasurement(settings.bedHeight, settings.unit)}${settings.joinPieces ? " - piezas juntas" : ""}`
    : `No cabe: ${layout.oversized.join(", ")}`;
  const generatedSize = `${formatMeasurement(cutSettings.width, settings.unit)} x ${formatMeasurement(cutSettings.depth, settings.unit)} x ${formatMeasurement(cutSettings.height, settings.unit)}`;

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Vista previa">
        <header className="topbar">
          <div>
            <p className="eyebrow">CajaLab</p>
            <h1>Generador de cajas para corte laser</h1>
          </div>
          <div className="actions">
            <button className="icon-button" type="button" aria-label="Reiniciar vista" title="Reiniciar vista" onClick={() => setView({ rx: -22, ry: 34 })}>
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
          </div>
        </header>

        <div className="preview-grid">
          <section className="model-panel" aria-label="Modelo 3D">
            <div
              className="scene"
              onPointerDown={onScenePointerDown}
              onPointerMove={onScenePointerMove}
              onPointerUp={() => setDragStart(null)}
            >
              <div className="box-model" data-joint={cutSettings.jointType} style={modelStyle}>
                <div className="face face-front">Frente</div>
                <div className="face face-back">Atras</div>
                <div className="face face-right">Derecha</div>
                <div className="face face-left">Izquierda</div>
                {!settings.openTop && <div className="face face-top">Arriba</div>}
                <div className="face face-bottom">Abajo</div>
              </div>
            </div>
          </section>

          <section className="drawing-panel" aria-label="Plano SVG">
            <div className="drawing-head">
              <div className="drawing-title">
                <span>Plano 2D</span>
                <div className="segmented" aria-label="Modo de vista">
                  <button className={`segment ${drawingMode === "preview" ? "active" : ""}`} type="button" onClick={() => setDrawingMode("preview")}>Preview</button>
                  <button className={`segment ${drawingMode === "cut" ? "active" : ""}`} type="button" onClick={() => setDrawingMode("cut")}>Corte</button>
                </div>
              </div>
              <div className="zoom-tools" aria-label="Zoom del plano">
                <button className="icon-button small" type="button" aria-label="Alejar" title="Alejar" onClick={() => setZoom(zoom / 1.2)}>
                  <Minus />
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button className="icon-button small" type="button" aria-label="Acercar" title="Acercar" onClick={() => setZoom(zoom * 1.2)}>
                  <Plus />
                </button>
                <button className="icon-button small" type="button" aria-label="Ajustar a pantalla" title="Ajustar a pantalla" onClick={fitToView}>
                  <Maximize2 />
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

      <aside className="controls" aria-label="Controles de caja">
        <div className="control-group">
          <h2>Medidas</h2>
          <label>
            Unidades
            <select value={settings.unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="mm">Milimetros</option>
              <option value="in">Pulgadas</option>
            </select>
          </label>
          <label>
            Tipo de medida
            <select value={settings.dimensionMode} onChange={(event) => setField("dimensionMode", event.target.value)}>
              <option value="internal">Interna</option>
              <option value="external">Externa</option>
            </select>
          </label>
          <NumberField label="Ancho" name="width" value={settings.width} min="20" max="800" unit={settings.unit} onChange={setField} />
          <NumberField label="Fondo" name="depth" value={settings.depth} min="20" max="800" unit={settings.unit} onChange={setField} />
          <NumberField label="Alto" name="height" value={settings.height} min="20" max="800" unit={settings.unit} onChange={setField} />
          <p className="control-note">
            Plano generado: {generatedSize}
          </p>
        </div>

        <div className="control-group">
          <h2>Uniones</h2>
          <label>
            Tipo
            <select value={settings.jointType} onChange={(event) => setField("jointType", event.target.value)}>
              <option value="finger">Dedos intercalados</option>
              <option value="plain">Canto recto</option>
            </select>
          </label>
          <NumberField label="Tamano de dedo" name="finger" value={settings.finger} min="4" max="80" unit={settings.unit} onChange={setField} />
          <NumberField label="Kerf" name="kerf" value={settings.kerf} min="0" max="1.5" step="0.01" unit={settings.unit} onChange={setField} />
        </div>

        <div className="control-group">
          <h2>Caja</h2>
          <label className="switch-row">
            Sin tapa
            <input type="checkbox" checked={settings.openTop} onChange={(event) => setCheckbox("openTop", event.target.checked)} />
          </label>
          <NumberField label="Separacion del plano" name="gap" value={settings.gap} min="4" max="60" unit={settings.unit} onChange={setField} />
        </div>

        <div className="control-group">
          <h2>Material</h2>
          <label>
            Material
            <select value={settings.materialPreset} onChange={(event) => setMaterialPreset(event.target.value)}>
              {Object.entries(materialPresets).map(([value, preset]) => (
                <option key={value} value={value}>{preset.label}</option>
              ))}
            </select>
          </label>
          <NumberField label="Grosor material" name="thickness" value={settings.thickness} min="1" max="20" step="0.1" unit={settings.unit} onChange={setField} />
          <label>
            Cama
            <select value={settings.bedPreset} onChange={(event) => setBedPreset(event.target.value)}>
              <option value="300x200">300 x 200 mm</option>
              <option value="600x400">600 x 400 mm</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <NumberField label="Ancho cama" name="bedWidth" value={settings.bedWidth} min="80" max="1600" unit={settings.unit} onChange={setField} />
          <NumberField label="Alto cama" name="bedHeight" value={settings.bedHeight} min="80" max="1200" unit={settings.unit} onChange={setField} />
          <NumberField label="Margen material" name="margin" value={settings.margin} min="0" max="80" unit={settings.unit} onChange={setField} />
          <label className="switch-row">
            Juntar en fila
            <input type="checkbox" checked={settings.joinPieces} onChange={(event) => setCheckbox("joinPieces", event.target.checked)} />
          </label>
        </div>

        <div className="control-group">
          <h2>Exportacion</h2>
          <button
            className={`tool-button ${settings.terrariumMode ? "active" : ""}`}
            type="button"
            onClick={() => setCheckbox("terrariumMode", !settings.terrariumMode)}
          >
            Preparar para terrario
          </button>
          <label>
            Color de corte
            <select value={settings.cutColor} onChange={(event) => setField("cutColor", event.target.value)}>
              <option value="white">Blanco</option>
              <option value="red">Rojo</option>
              <option value="black">Negro</option>
            </select>
          </label>
          <label className="switch-row">
            Marcas internas
            <input type="checkbox" checked={settings.includeMarks} onChange={(event) => setCheckbox("includeMarks", event.target.checked)} />
          </label>
        </div>

        <div className={`status-box ${layout.fitsBed ? "" : "warning"}`}>
          <span>Longitud estimada de corte</span>
          <strong>{artifacts.cutLengthMeters.toFixed(2)} m</strong>
          <small>{layoutStatus}</small>
        </div>
      </aside>
    </main>
  );
}
