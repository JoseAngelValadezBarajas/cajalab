const $ = (id) => document.getElementById(id);

const inputs = {
  width: $("width"),
  depth: $("depth"),
  height: $("height"),
  thickness: $("thickness"),
  finger: $("finger"),
  kerf: $("kerf"),
  gap: $("gap"),
  openTop: $("openTop"),
  jointType: $("jointType"),
  cutColor: $("cutColor"),
  includeMarks: $("includeMarks"),
  bedPreset: $("bedPreset"),
  bedWidth: $("bedWidth"),
  bedHeight: $("bedHeight"),
  margin: $("margin"),
};

const svgStage = $("svgStage");
const svgPan = $("svgPan");
const svgSize = $("svgSize");
const cutLength = $("cutLength");
const layoutStatus = $("layoutStatus");
const boxModel = $("boxModel");
const scene = $("scene");
const previewModeButton = $("previewMode");
const cutModeButton = $("cutMode");
const zoomInButton = $("zoomIn");
const zoomOutButton = $("zoomOut");
const fitViewButton = $("fitView");
const zoomValue = $("zoomValue");

let previewSvg = "";
let currentSvg = "";
let currentDxf = "";
let drawingMode = "preview";
let zoom = 1;
let needsFit = true;
let view = { rx: -22, ry: 34 };
let dragging = false;
let dragStart = { x: 0, y: 0, rx: 0, ry: 0 };
let panning = false;
let panStart = { x: 0, y: 0, left: 0, top: 0 };

function readSettings() {
  return {
    width: clampNumber(inputs.width.value, 20, 800),
    depth: clampNumber(inputs.depth.value, 20, 800),
    height: clampNumber(inputs.height.value, 20, 800),
    thickness: clampNumber(inputs.thickness.value, 1, 20),
    finger: clampNumber(inputs.finger.value, 4, 80),
    kerf: clampNumber(inputs.kerf.value, 0, 1.5),
    gap: clampNumber(inputs.gap.value, 4, 60),
    openTop: inputs.openTop.checked,
    jointType: inputs.jointType.value,
    cutColor: inputs.cutColor.value,
    includeMarks: inputs.includeMarks.checked,
    bedPreset: inputs.bedPreset.value,
    bedWidth: clampNumber(inputs.bedWidth.value, 80, 1600),
    bedHeight: clampNumber(inputs.bedHeight.value, 80, 1200),
    margin: clampNumber(inputs.margin.value, 0, 80),
  };
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

function edgeSegments(length, fingerTarget) {
  let count = Math.max(3, Math.round(length / fingerTarget));
  if (count % 2 === 0) count += 1;
  const step = length / count;
  return Array.from({ length: count }, (_, index) => ({ start: index * step, end: (index + 1) * step }));
}

function panelPoints(width, height, tab, finger, variant, jointType) {
  if (jointType === "plain") {
    return [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
  }

  const points = [];
  const push = (x, y) => points.push([rounded(x), rounded(y)]);
  const addEdge = (side, sign, firstTab) => {
    const len = side === "top" || side === "bottom" ? width : height;
    const segments = edgeSegments(len, finger);
    segments.forEach((segment, index) => {
      const outward = (index + firstTab) % 2 === 0;
      const offset = outward ? sign * tab : 0;
      if (side === "top") {
        push(segment.start, offset);
        push(segment.end, offset);
        push(segment.end, 0);
      }
      if (side === "right") {
        push(width + offset, segment.start);
        push(width + offset, segment.end);
        push(width, segment.end);
      }
      if (side === "bottom") {
        push(width - segment.start, height + offset);
        push(width - segment.end, height + offset);
        push(width - segment.end, height);
      }
      if (side === "left") {
        push(offset, height - segment.start);
        push(offset, height - segment.end);
        push(0, height - segment.end);
      }
    });
  };

  push(0, 0);
  addEdge("top", -1, variant);
  addEdge("right", 1, variant + 1);
  addEdge("bottom", 1, variant);
  addEdge("left", -1, variant + 1);
  return points;
}

function panelPath(width, height, tab, finger, variant, jointType) {
  const points = panelPoints(width, height, tab, finger, variant, jointType);
  return `M ${points.map((point) => point.join(" ")).join(" L ")} Z`;
}

function cutStroke(color) {
  return {
    white: "#fff",
    red: "#f04438",
    black: "#101418",
  }[color] || "#fff";
}

function dxfColor(color) {
  return {
    white: "7",
    red: "1",
    black: "250",
  }[color] || "7";
}

function panelBounds(width, height, tab, jointType) {
  if (jointType === "plain") return { w: width, h: height, ox: 0, oy: 0 };
  return { w: width + tab * 2, h: height + tab * 2, ox: tab, oy: tab };
}

function bedSvg(settings) {
  const safeWidth = Math.max(0, settings.bedWidth - settings.margin * 2);
  const safeHeight = Math.max(0, settings.bedHeight - settings.margin * 2);
  return `
    <rect class="bed-outline" x="0" y="0" width="${settings.bedWidth}" height="${settings.bedHeight}"/>
    <rect class="bed-margin" x="${settings.margin}" y="${settings.margin}" width="${safeWidth}" height="${safeHeight}"/>`;
}

function makePreviewPanel({ id, label, x, y, width, height, tab, finger, variant, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const path = panelPath(width, height, tab, finger, variant, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  return `
    <g id="${id}" transform="translate(${rounded(tx)} ${rounded(ty)})">
      <path class="cut-line" d="${path}"/>
      <line class="fold-line" x1="0" y1="0" x2="${width}" y2="0"/>
      <line class="fold-line" x1="${width}" y1="0" x2="${width}" y2="${height}"/>
      <line class="fold-line" x1="${width}" y1="${height}" x2="0" y2="${height}"/>
      <line class="fold-line" x1="0" y1="${height}" x2="0" y2="0"/>
      <text class="panel-label" x="${width / 2}" y="${height / 2}">${label}</text>
    </g>`;
}

function makeCutPanel({ id, x, y, width, height, tab, finger, variant, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const path = panelPath(width, height, tab, finger, variant, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  return `
    <g id="${id}" transform="translate(${rounded(tx)} ${rounded(ty)})">
      <path class="cut-line" d="${path}"/>
    </g>`;
}

function makeMarkPanel({ id, x, y, width, height, tab, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  return `
    <g id="${id}-marks" transform="translate(${rounded(tx)} ${rounded(ty)})">
      <line class="fold-line" x1="0" y1="0" x2="${width}" y2="0"/>
      <line class="fold-line" x1="${width}" y1="0" x2="${width}" y2="${height}"/>
      <line class="fold-line" x1="${width}" y1="${height}" x2="0" y2="${height}"/>
      <line class="fold-line" x1="0" y1="${height}" x2="0" y2="0"/>
    </g>`;
}

function panelCutSegments({ x, y, width, height, tab, finger, variant, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  const points = panelPoints(width, height, tab, finger, variant, jointType)
    .map(([px, py]) => [rounded(px + tx), rounded(py + ty)]);

  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return { layer: "CUT", x1: point[0], y1: point[1], x2: next[0], y2: next[1] };
  });
}

function panelMarkSegments({ x, y, width, height, tab, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  return [
    { layer: "MARK", x1: tx, y1: ty, x2: tx + width, y2: ty },
    { layer: "MARK", x1: tx + width, y1: ty, x2: tx + width, y2: ty + height },
    { layer: "MARK", x1: tx + width, y1: ty + height, x2: tx, y2: ty + height },
    { layer: "MARK", x1: tx, y1: ty + height, x2: tx, y2: ty },
  ].map((line) => ({
    ...line,
    x1: rounded(line.x1),
    y1: rounded(line.y1),
    x2: rounded(line.x2),
    y2: rounded(line.y2),
  }));
}

function buildLayout(settings) {
  const { width, depth, height, thickness, finger, gap, openTop, jointType } = settings;
  const tab = jointType === "finger" ? thickness - settings.kerf / 2 : 0;
  const parts = [
    { id: "front", label: "Frente", width, height, variant: 0 },
    { id: "back", label: "Atras", width, height, variant: 1 },
    { id: "left", label: "Izquierda", width: depth, height, variant: 1 },
    { id: "right", label: "Derecha", width: depth, height, variant: 0 },
    { id: "bottom", label: "Base", width, height: depth, variant: 0 },
  ];

  if (!openTop) {
    parts.push({ id: "top", label: "Tapa", width, height: depth, variant: 1 });
  }

  const bedRight = settings.bedWidth - settings.margin;
  const bedBottom = settings.bedHeight - settings.margin;
  let x = settings.margin;
  let y = settings.margin;
  let rowHeight = 0;
  const placed = [];
  const oversized = [];

  parts.forEach((part) => {
    const bounds = panelBounds(part.width, part.height, tab, jointType);
    const fitsWidth = bounds.w <= settings.bedWidth - settings.margin * 2;
    const fitsHeight = bounds.h <= settings.bedHeight - settings.margin * 2;

    if (x > settings.margin && x + bounds.w > bedRight) {
      x = settings.margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    if (!fitsWidth || !fitsHeight || y + bounds.h > bedBottom) {
      oversized.push(part.label);
    }

    placed.push({ ...part, x, y, tab, finger, jointType, outOfBounds: y + bounds.h > bedBottom || !fitsWidth || !fitsHeight });
    x += bounds.w + gap;
    rowHeight = Math.max(rowHeight, bounds.h);
  });

  return {
    placed,
    canvasWidth: settings.bedWidth,
    canvasHeight: settings.bedHeight,
    tab,
    fitsBed: oversized.length === 0,
    oversized,
  };
}

function estimateCutLength(settings) {
  const panels = settings.openTop ? 5 : 6;
  const basic = 2 * (settings.width + settings.depth) + 4 * settings.height;
  const multiplier = settings.jointType === "finger" ? 1.18 : 1;
  return (basic * panels * multiplier) / 6000;
}

function dxfNumber(value) {
  return rounded(value).toString();
}

function makeDxfLine({ layer, x1, y1, x2, y2 }, canvasHeight, settings) {
  const color = layer === "CUT" ? dxfColor(settings.cutColor) : "5";
  return [
    "0", "LINE",
    "8", layer,
    "62", color,
    "10", dxfNumber(x1),
    "20", dxfNumber(canvasHeight - y1),
    "30", "0",
    "11", dxfNumber(x2),
    "21", dxfNumber(canvasHeight - y2),
    "31", "0",
  ].join("\n");
}

function buildLayerTable(settings) {
  const markLayer = settings.includeMarks
    ? ["0", "LAYER", "2", "MARK", "70", "0", "62", "5", "6", "CONTINUOUS"]
    : [];

  return [
    "0", "TABLE",
    "2", "LAYER",
    "70", settings.includeMarks ? "2" : "1",
    "0", "LAYER",
    "2", "CUT",
    "70", "0",
    "62", dxfColor(settings.cutColor),
    "6", "CONTINUOUS",
    ...markLayer,
    "0", "ENDTAB",
  ];
}

function buildDxf(layout, settings) {
  const cutSegments = layout.placed.flatMap(panelCutSegments);
  const markSegments = settings.includeMarks ? layout.placed.flatMap(panelMarkSegments) : [];
  const segments = [...cutSegments, ...markSegments];

  const lineEntities = segments.map((segment) => makeDxfLine(segment, layout.canvasHeight, settings)).join("\n");
  return [
    "0", "SECTION",
    "2", "HEADER",
    "9", "$ACADVER",
    "1", "AC1009",
    "9", "$INSUNITS",
    "70", "4",
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "TABLES",
    ...buildLayerTable(settings),
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "ENTITIES",
    lineEntities,
    "0", "ENDSEC",
    "0", "EOF",
  ].join("\n");
}

function makeFileName(settings, extension) {
  return `cajalab-${settings.width}x${settings.depth}x${settings.height}mm.${extension}`;
}

function render() {
  const settings = readSettings();
  const layout = buildLayout(settings);
  const cutColor = cutStroke(settings.cutColor);
  const panels = layout.placed.map(makePreviewPanel).join("");
  const cutPanels = layout.placed.map(makeCutPanel).join("");
  const markPanels = settings.includeMarks ? layout.placed.map(makeMarkPanel).join("") : "";

  previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rounded(layout.canvasWidth)} ${rounded(layout.canvasHeight)}" width="${rounded(layout.canvasWidth)}mm" height="${rounded(layout.canvasHeight)}mm">
  <style>
    .cut-line{fill:none;stroke:${cutColor};stroke-width:0.35;vector-effect:non-scaling-stroke}
    .fold-line{stroke:#8aa0b5;stroke-width:0.25;stroke-dasharray:3 2;vector-effect:non-scaling-stroke}
    .panel-label{fill:#9ba6af;font-size:7px;font-family:Arial,sans-serif;font-weight:700;text-anchor:middle}
    .bed-outline{fill:rgba(255,255,255,0.025);stroke:rgba(255,255,255,0.24);stroke-width:0.35;vector-effect:non-scaling-stroke}
    .bed-margin{fill:none;stroke:rgba(255,255,255,0.22);stroke-width:0.25;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
  </style>
  ${bedSvg(settings)}
  ${panels}
</svg>`;

  currentSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rounded(layout.canvasWidth)} ${rounded(layout.canvasHeight)}" width="${rounded(layout.canvasWidth)}mm" height="${rounded(layout.canvasHeight)}mm">
  <style>
    .cut-line{fill:none;stroke:${cutColor};stroke-width:0.35;vector-effect:non-scaling-stroke}
    .fold-line{stroke:#2b65b1;stroke-width:0.25;stroke-dasharray:3 2;vector-effect:non-scaling-stroke}
  </style>
  ${cutPanels}
  ${markPanels}
</svg>`;
  currentDxf = buildDxf(layout, settings);

  svgStage.dataset.cutColor = settings.cutColor;
  svgPan.innerHTML = drawingMode === "preview" ? previewSvg : currentSvg;
  svgSize.value = `${Math.ceil(layout.canvasWidth)} x ${Math.ceil(layout.canvasHeight)} mm`;
  cutLength.textContent = `${estimateCutLength(settings).toFixed(2)} m`;
  layoutStatus.textContent = layout.fitsBed
    ? `Cabe en cama ${settings.bedWidth} x ${settings.bedHeight} mm`
    : `No cabe: ${layout.oversized.join(", ")}`;
  cutLength.parentElement.classList.toggle("warning", !layout.fitsBed);
  applyZoom();
  if (needsFit) fitToView();
  updateModel(settings);
}

function setDrawingMode(mode) {
  drawingMode = mode;
  previewModeButton.classList.toggle("active", mode === "preview");
  cutModeButton.classList.toggle("active", mode === "cut");
  render();
}

function applyZoom() {
  const svg = svgPan.querySelector("svg");
  if (svg) {
    const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
    const width = viewBox[2];
    const height = viewBox[3];
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svgPan.style.width = `${width * zoom}px`;
    svgPan.style.height = `${height * zoom}px`;
  }
  svgPan.style.transform = `scale(${zoom})`;
  zoomValue.value = `${Math.round(zoom * 100)}%`;
}

function setZoom(nextZoom) {
  zoom = Math.min(Math.max(nextZoom, 0.25), 4);
  needsFit = false;
  applyZoom();
}

function fitToView() {
  const svg = svgPan.querySelector("svg");
  if (!svg) return;

  const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
  const width = viewBox[2];
  const height = viewBox[3];
  const availableWidth = Math.max(120, svgStage.clientWidth - 36);
  const availableHeight = Math.max(120, svgStage.clientHeight - 36);
  zoom = Math.min(availableWidth / width, availableHeight / height, 2);
  zoom = Math.max(zoom, 0.25);
  applyZoom();
  svgStage.scrollLeft = 0;
  svgStage.scrollTop = 0;
  needsFit = false;
}

function updateModel({ width, depth, height, openTop, jointType }) {
  const maxDimension = Math.max(width, depth, height);
  const scale = 270 / maxDimension;
  boxModel.style.setProperty("--model-w", `${Math.max(width * scale, 70)}px`);
  boxModel.style.setProperty("--model-d", `${Math.max(depth * scale, 55)}px`);
  boxModel.style.setProperty("--model-h", `${Math.max(height * scale, 55)}px`);
  boxModel.style.setProperty("--rx", `${view.rx}deg`);
  boxModel.style.setProperty("--ry", `${view.ry}deg`);
  boxModel.dataset.joint = jointType;
  document.querySelector(".face-top").style.display = openTop ? "none" : "grid";
}

function downloadSvg() {
  const settings = readSettings();
  const blob = new Blob([currentSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = makeFileName(settings, "svg");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadDxf() {
  const settings = readSettings();
  const blob = new Blob([currentDxf], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = makeFileName(settings, "dxf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
});

inputs.bedPreset.addEventListener("change", () => {
  if (inputs.bedPreset.value === "300x200") {
    inputs.bedWidth.value = 300;
    inputs.bedHeight.value = 200;
  }
  if (inputs.bedPreset.value === "600x400") {
    inputs.bedWidth.value = 600;
    inputs.bedHeight.value = 400;
  }
  needsFit = true;
  render();
});

inputs.bedWidth.addEventListener("input", () => {
  inputs.bedPreset.value = "custom";
});

inputs.bedHeight.addEventListener("input", () => {
  inputs.bedPreset.value = "custom";
});

$("downloadSvg").addEventListener("click", downloadSvg);
$("downloadDxf").addEventListener("click", downloadDxf);
previewModeButton.addEventListener("click", () => setDrawingMode("preview"));
cutModeButton.addEventListener("click", () => setDrawingMode("cut"));
zoomInButton.addEventListener("click", () => setZoom(zoom * 1.2));
zoomOutButton.addEventListener("click", () => setZoom(zoom / 1.2));
fitViewButton.addEventListener("click", () => {
  needsFit = true;
  fitToView();
});
$("resetView").addEventListener("click", () => {
  view = { rx: -22, ry: 34 };
  render();
});

scene.addEventListener("pointerdown", (event) => {
  dragging = true;
  dragStart = { x: event.clientX, y: event.clientY, rx: view.rx, ry: view.ry };
  scene.setPointerCapture(event.pointerId);
});

scene.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  view.ry = dragStart.ry + (event.clientX - dragStart.x) * 0.35;
  view.rx = Math.max(-70, Math.min(35, dragStart.rx - (event.clientY - dragStart.y) * 0.28));
  render();
});

scene.addEventListener("pointerup", () => {
  dragging = false;
});

svgStage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  panning = true;
  panStart = {
    x: event.clientX,
    y: event.clientY,
    left: svgStage.scrollLeft,
    top: svgStage.scrollTop,
  };
  svgStage.classList.add("is-panning");
  svgStage.setPointerCapture(event.pointerId);
});

svgStage.addEventListener("pointermove", (event) => {
  if (!panning) return;
  svgStage.scrollLeft = panStart.left - (event.clientX - panStart.x);
  svgStage.scrollTop = panStart.top - (event.clientY - panStart.y);
});

svgStage.addEventListener("pointerup", () => {
  panning = false;
  svgStage.classList.remove("is-panning");
});

svgStage.addEventListener("wheel", (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  setZoom(event.deltaY > 0 ? zoom / 1.1 : zoom * 1.1);
}, { passive: false });

window.addEventListener("resize", () => {
  needsFit = true;
  fitToView();
});

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
  render();
});
