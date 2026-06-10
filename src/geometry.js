export function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

export function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

function edgeSegments(length, fingerTarget) {
  let count = Math.max(3, Math.round(length / fingerTarget));
  if (count % 2 === 0) count += 1;
  const step = length / count;
  return Array.from({ length: count }, (_, index) => ({ start: index * step, end: (index + 1) * step }));
}

function normalizeEdgeVariants(edgeVariants) {
  if (typeof edgeVariants === "number") {
    return {
      top: edgeVariants,
      right: edgeVariants + 1,
      bottom: edgeVariants,
      left: edgeVariants + 1,
    };
  }

  return {
    top: 0,
    right: 1,
    bottom: 0,
    left: 1,
    ...edgeVariants,
  };
}

function fillCornerSquares(points, width, height, tab) {
  return points.map(([x, y]) => {
    if (x === 0 && y === 0) return [rounded(-tab), rounded(-tab)];
    if (x === width && y === 0) return [rounded(width + tab), rounded(-tab)];
    if (x === width && y === height) return [rounded(width + tab), rounded(height + tab)];
    if (x === 0 && y === height) return [rounded(-tab), rounded(height + tab)];
    return [x, y];
  });
}

function panelPoints(width, height, tab, finger, edgeVariants, jointType, cornerFill = false) {
  if (jointType === "plain") {
    return [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
  }

  const variants = normalizeEdgeVariants(edgeVariants);
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
  addEdge("top", -1, variants.top);
  addEdge("right", 1, variants.right);
  addEdge("bottom", 1, variants.bottom);
  addEdge("left", -1, variants.left);
  return cornerFill ? fillCornerSquares(points, width, height, tab) : points;
}

function panelPath(width, height, tab, finger, edgeVariants, jointType, cornerFill = false) {
  const points = panelPoints(width, height, tab, finger, edgeVariants, jointType, cornerFill);
  return `M ${points.map((point) => point.join(" ")).join(" L ")} Z`;
}

function cutStroke(color) {
  if (typeof color === "string" && color.startsWith("#")) return color;
  return {
    white: "#fff",
    red: "#f04438",
    black: "#101418",
  }[color] || "#fff";
}

function dxfColor(color) {
  if (typeof color === "string" && color.startsWith("#")) {
    return {
      "#ffffff": "7",
      "#fff": "7",
      "#ff0000": "1",
      "#f04438": "1",
      "#0000ff": "5",
      "#2b65b1": "5",
      "#00ff00": "3",
      "#101418": "250",
      "#000000": "250",
    }[color.toLowerCase()] || "7";
  }

  return {
    white: "7",
    red: "1",
    black: "250",
    blue: "5",
    green: "3",
  }[color] || "7";
}

function scoreStroke(settings) {
  return cutStroke(settings.scoreColor || "#2b65b1");
}

function cutLineWidth(settings) {
  return settings.cutLineWidth ?? 0.35;
}

function scoreLineWidth(settings) {
  return settings.scoreLineWidth ?? 0.25;
}

function panelBounds(width, height, tab, jointType) {
  if (jointType === "plain") return { w: width, h: height, ox: 0, oy: 0 };
  return { w: width + tab * 2, h: height + tab * 2, ox: tab, oy: tab };
}

function placedBounds(panel) {
  const bounds = panelBounds(panel.width, panel.height, panel.tab, effectiveJointType(panel));
  if (panel.rotated) {
    return { w: bounds.h, h: bounds.w, ox: bounds.oy, oy: bounds.ox };
  }
  return bounds;
}

function transformPanelPoint(panel, px, py) {
  const bounds = panelBounds(panel.width, panel.height, panel.tab, effectiveJointType(panel));
  if (panel.rotated) {
    return [
      rounded(panel.x + bounds.h - (py + bounds.oy)),
      rounded(panel.y + px + bounds.ox),
    ];
  }

  return [
    rounded(panel.x + px + bounds.ox),
    rounded(panel.y + py + bounds.oy),
  ];
}

function bedSvg(settings) {
  const safeWidth = Math.max(0, settings.bedWidth - settings.margin * 2);
  const safeHeight = Math.max(0, settings.bedHeight - settings.margin * 2);
  return `
    <rect class="bed-outline" x="0" y="0" width="${settings.bedWidth}" height="${settings.bedHeight}"/>
    <rect class="bed-margin" x="${settings.margin}" y="${settings.margin}" width="${safeWidth}" height="${safeHeight}"/>`;
}

function effectiveJointType(panel) {
  return panel.plainShape ? "plain" : panel.jointType;
}

function makePreviewPanel(panel) {
  const { id, label, x, y, width, height, tab, finger, edgeVariants, cornerFill } = panel;
  const jointType = effectiveJointType(panel);
  const path = panelPath(width, height, tab, finger, edgeVariants, jointType, cornerFill);
  const bounds = panelBounds(width, height, tab, jointType);
  const tx = panel.rotated ? x + bounds.h - bounds.oy : x + bounds.ox;
  const ty = panel.rotated ? y + bounds.ox : y + bounds.oy;
  const rotation = panel.rotated ? ` rotate(90)` : "";
  return `
    <g id="${id}" transform="translate(${rounded(tx)} ${rounded(ty)})${rotation}">
      <path class="cut-line" d="${path}"/>
      <line class="fold-line" x1="0" y1="0" x2="${width}" y2="0"/>
      <line class="fold-line" x1="${width}" y1="0" x2="${width}" y2="${height}"/>
      <line class="fold-line" x1="${width}" y1="${height}" x2="0" y2="${height}"/>
      <line class="fold-line" x1="0" y1="${height}" x2="0" y2="0"/>
      <text class="panel-label" x="${width / 2}" y="${height / 2}">${label}</text>
    </g>`;
}

function panelCutSegments(panel) {
  const { x, y, width, height, tab, finger, edgeVariants, cornerFill } = panel;
  const jointType = effectiveJointType(panel);
  const points = panelPoints(width, height, tab, finger, edgeVariants, jointType, cornerFill)
    .map(([px, py]) => transformPanelPoint(panel, px, py));

  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return { layer: "CUT", x1: point[0], y1: point[1], x2: next[0], y2: next[1] };
  });
}

function circleShape(x, y, radius, layer = "CUT") {
  return { type: "circle", layer, cx: rounded(x), cy: rounded(y), r: rounded(radius) };
}

function rectangleSegments(x, y, width, height, layer = "CUT") {
  return [
    { layer, x1: x, y1: y, x2: x + width, y2: y },
    { layer, x1: x + width, y1: y, x2: x + width, y2: y + height },
    { layer, x1: x + width, y1: y + height, x2: x, y2: y + height },
    { layer, x1: x, y1: y + height, x2: x, y2: y },
  ].map((segment) => ({
    ...segment,
    x1: rounded(segment.x1),
    y1: rounded(segment.y1),
    x2: rounded(segment.x2),
    y2: rounded(segment.y2),
  }));
}

function panelRectangleSegments(panel, x, y, width, height, layer = "CUT") {
  const corners = [
    transformPanelPoint(panel, x, y),
    transformPanelPoint(panel, x + width, y),
    transformPanelPoint(panel, x + width, y + height),
    transformPanelPoint(panel, x, y + height),
  ];

  return corners.map((point, index) => {
    const next = corners[(index + 1) % corners.length];
    return { type: "line", layer, x1: point[0], y1: point[1], x2: next[0], y2: next[1] };
  });
}

function panelCircle(panel, x, y, radius, layer = "CUT") {
  const [cx, cy] = transformPanelPoint(panel, x, y);
  return circleShape(cx, cy, radius, layer);
}

function lineBank({ x, y, length, count, spacing, orientation }) {
  return Array.from({ length: count }, (_, index) => {
    const offset = index * spacing;
    if (orientation === "vertical") {
      return { layer: "CUT", x1: rounded(x + offset), y1: rounded(y), x2: rounded(x + offset), y2: rounded(y + length) };
    }
    return { layer: "CUT", x1: rounded(x), y1: rounded(y + offset), x2: rounded(x + length), y2: rounded(y + offset) };
  });
}

function ventInsertSpec(width, height) {
  const openingWidth = Math.max(60, width * 0.78);
  const openingHeight = Math.max(38, height * 0.62);
  const insertMargin = Math.max(8, Math.min(width, height) * 0.08);
  return {
    openingWidth,
    openingHeight,
    width: openingWidth + insertMargin * 2,
    height: openingHeight + insertMargin * 2,
    insertMargin,
  };
}

function ventInsertSegments(panel) {
  const bounds = panelBounds(panel.width, panel.height, panel.tab, effectiveJointType(panel));
  const tx = panel.x + bounds.ox;
  const ty = panel.y + bounds.oy;
  const openingWidth = panel.openingWidth || panel.width;
  const openingHeight = panel.openingHeight || panel.height;
  const openingX = tx + (panel.width - openingWidth) / 2;
  const openingY = ty + (panel.height - openingHeight) / 2;
  const slitCount = 6;
  const slitLength = openingWidth * 0.28;
  const slitSpacing = openingHeight / (slitCount + 1);
  const slitY = openingY + slitSpacing;
  const leftSlitX = openingX + openingWidth * 0.16;
  const rightSlitX = openingX + openingWidth * 0.56;

  return [
    ...lineBank({ x: leftSlitX, y: slitY, length: slitLength, count: slitCount, spacing: slitSpacing, orientation: "horizontal" }),
    ...lineBank({ x: rightSlitX, y: slitY, length: slitLength, count: slitCount, spacing: slitSpacing, orientation: "horizontal" }),
  ];
}

function panelTerrariumSegments(panel) {
  if (!panel.terrariumMode) return [];
  if (panel.id === "terrariumInsert") return ventInsertSegments(panel);
  if (panel.id !== "top") return [];

  const bounds = panelBounds(panel.width, panel.height, panel.tab, effectiveJointType(panel));
  const tx = panel.x + bounds.ox;
  const ty = panel.y + bounds.oy;
  const insert = ventInsertSpec(panel.width, panel.height);
  const openingWidth = insert.openingWidth;
  const openingHeight = insert.openingHeight;
  const slitCount = 6;
  const slitLength = openingWidth * 0.28;
  const slitSpacing = openingHeight / (slitCount + 1);
  const openingX = tx + (panel.width - openingWidth) / 2;
  const openingY = ty + (panel.height - openingHeight) / 2;
  const leftSlitX = openingX + openingWidth * 0.16;
  const rightSlitX = openingX + openingWidth * 0.56;
  const slitY = openingY + slitSpacing;

  return [
    ...rectangleSegments(openingX, openingY, openingWidth, openingHeight),
    ...lineBank({ x: leftSlitX, y: slitY, length: slitLength, count: slitCount, spacing: slitSpacing, orientation: "horizontal" }),
    ...lineBank({ x: rightSlitX, y: slitY, length: slitLength, count: slitCount, spacing: slitSpacing, orientation: "horizontal" }),
  ];
}

function panelTSlotSegments(panel, settings) {
  if (settings.jointType !== "tslot") return [];
  if (!["front", "back"].includes(panel.id)) return [];

  const screw = settings.screwDiameter || 3;
  const nutWidth = settings.nutWidth || 6;
  const slotDepth = settings.slotDepth || 10;
  const spacing = Math.max(settings.slotSpacing || 45, slotDepth * 2);
  const edgeInset = Math.max(panel.tab + slotDepth * 0.6, settings.thickness * 2);
  const usableHeight = Math.max(0, panel.height - edgeInset * 2);
  const count = Math.max(1, Math.floor(usableHeight / spacing) + 1);
  const step = count === 1 ? 0 : usableHeight / (count - 1);
  const xPositions = [settings.thickness * 1.8, panel.width - settings.thickness * 1.8];
  const shapes = [];

  xPositions.forEach((x) => {
    for (let index = 0; index < count; index += 1) {
      const y = edgeInset + step * index;
      shapes.push(panelCircle(panel, x, y, screw / 2));
      shapes.push(...panelRectangleSegments(panel, x - nutWidth / 2, y - screw / 2, nutWidth, screw));
    }
  });

  return shapes;
}

function panelDogboneShapes(panel, settings) {
  if (!settings.cncMode || !settings.dogbones || effectiveJointType(panel) === "plain") return [];

  const radius = Math.max(0.1, (settings.toolDiameter || 3.175) / 2);
  const jointType = effectiveJointType(panel);
  const points = panelPoints(panel.width, panel.height, panel.tab, panel.finger, panel.edgeVariants, jointType, panel.cornerFill);
  const shapes = [];

  points.forEach(([x, y], index) => {
    if (index % 3 !== 0) return;
    const onPanelEdge = x === 0 || y === 0 || x === panel.width || y === panel.height;
    if (!onPanelEdge) return;
    shapes.push(panelCircle(panel, x, y, radius));
  });

  return shapes;
}

function segmentKey({ layer, x1, y1, x2, y2 }) {
  const a = `${rounded(x1)},${rounded(y1)}`;
  const b = `${rounded(x2)},${rounded(y2)}`;
  return a < b ? `${layer}:${a}:${b}` : `${layer}:${b}:${a}`;
}

function uniqueSegments(segments) {
  const unique = new Map();
  segments.forEach((segment) => {
    if (segment.type === "circle") {
      unique.set(`${segment.layer}:circle:${segment.cx},${segment.cy},${segment.r}`, segment);
      return;
    }
    unique.set(segmentKey(segment), segment);
  });
  return Array.from(unique.values());
}

function cutSegmentsForLayout(layout, settings) {
  const segments = layout.placed.flatMap((panel) => [
    ...panelCutSegments(panel),
    ...panelTerrariumSegments(panel),
    ...panelTSlotSegments(panel, settings),
    ...panelDogboneShapes(panel, settings),
  ]);
  return settings.joinPieces ? uniqueSegments(segments) : segments;
}

function svgLine({ layer, x1, y1, x2, y2 }) {
  const className = layer === "CUT" ? "cut-line" : "score-line";
  return `<line class="${className}" data-layer="${layer}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

function svgShape(shape) {
  if (shape.type === "circle") {
    const className = shape.layer === "CUT" ? "cut-line" : "score-line";
    return `<circle class="${className}" data-layer="${shape.layer}" cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
  }
  return svgLine(shape);
}

function panelMarkSegments({ x, y, width, height, tab, jointType }) {
  const bounds = panelBounds(width, height, tab, jointType);
  const tx = x + bounds.ox;
  const ty = y + bounds.oy;
  return [
    { layer: "SCORE", x1: tx, y1: ty, x2: tx + width, y2: ty },
    { layer: "SCORE", x1: tx + width, y1: ty, x2: tx + width, y2: ty + height },
    { layer: "SCORE", x1: tx + width, y1: ty + height, x2: tx, y2: ty + height },
    { layer: "SCORE", x1: tx, y1: ty + height, x2: tx, y2: ty },
  ].map((line) => ({
    ...line,
    x1: rounded(line.x1),
    y1: rounded(line.y1),
    x2: rounded(line.x2),
    y2: rounded(line.y2),
  }));
}

export function buildLayout(settings) {
  const { width, depth, height, thickness, finger, gap, openTop, jointType } = settings;
  const labels = settings.language === "en"
    ? {
        front: "Front",
        back: "Back",
        left: "Left",
        right: "Right",
        bottom: "Bottom",
        top: "Lid",
        insert: "Insert",
      }
    : {
        front: "Frente",
        back: "Atras",
        left: "Izquierda",
        right: "Derecha",
        bottom: "Base",
        top: "Tapa",
        insert: "Inserto",
      };
  const tab = jointType === "finger" || jointType === "tslot" ? thickness - settings.kerf / 2 : 0;
  const layoutGapX = settings.joinPieces ? 0 : gap;
  const layoutGapY = gap;
  const parts = [
    { id: "front", label: labels.front, width, height, edgeVariants: { top: 1, right: 0, bottom: 1, left: 0 } },
    { id: "back", label: labels.back, width, height, edgeVariants: { top: 1, right: 0, bottom: 1, left: 0 } },
    { id: "left", label: labels.left, width: depth, height, edgeVariants: { top: 1, right: 1, bottom: 1, left: 1 } },
    { id: "right", label: labels.right, width: depth, height, edgeVariants: { top: 1, right: 1, bottom: 1, left: 1 } },
    { id: "bottom", label: labels.bottom, width, height: depth, edgeVariants: { top: 0, right: 0, bottom: 0, left: 0 }, cornerFill: true },
  ];

  if (!openTop) {
    parts.push({ id: "top", label: labels.top, width, height: depth, edgeVariants: { top: 0, right: 0, bottom: 0, left: 0 }, cornerFill: true });
  }

  if (settings.terrariumMode && !openTop) {
    const insert = ventInsertSpec(width, depth);
    parts.push({
      id: "terrariumInsert",
      label: labels.insert,
      width: insert.width,
      height: insert.height,
      openingWidth: insert.openingWidth,
      openingHeight: insert.openingHeight,
      edgeVariants: { top: 0, right: 0, bottom: 0, left: 0 },
      cornerFill: false,
      plainShape: true,
    });
  }

  const bedRight = settings.bedWidth - settings.margin;
  const bedBottom = settings.bedHeight - settings.margin;
  let x = settings.margin;
  let y = settings.margin;
  let rowHeight = 0;
  const placed = [];
  const oversized = [];

  const placePart = (part) => {
    const partJointType = part.plainShape ? "plain" : jointType;
    let rotated = false;
    let bounds = panelBounds(part.width, part.height, tab, partJointType);
    const safeWidth = settings.bedWidth - settings.margin * 2;
    const safeHeight = settings.bedHeight - settings.margin * 2;

    if (settings.allowRotation && bounds.w > safeWidth && bounds.h <= safeWidth && bounds.w <= safeHeight) {
      rotated = true;
      bounds = { w: bounds.h, h: bounds.w, ox: bounds.oy, oy: bounds.ox };
    }

    if (x > settings.margin && x + bounds.w > bedRight) {
      x = settings.margin;
      y += rowHeight + layoutGapY;
      rowHeight = 0;
    }

    if (settings.allowRotation && !rotated && x + bounds.w > bedRight) {
      const rotatedBounds = { w: bounds.h, h: bounds.w, ox: bounds.oy, oy: bounds.ox };
      if (x + rotatedBounds.w <= bedRight && y + rotatedBounds.h <= bedBottom) {
        rotated = true;
        bounds = rotatedBounds;
      }
    }

    const fitsWidth = bounds.w <= safeWidth;
    const fitsHeight = bounds.h <= safeHeight;

    if (!fitsWidth || !fitsHeight || y + bounds.h > bedBottom) {
      oversized.push(part.label);
    }

    placed.push({ ...part, x, y, tab, finger, jointType, rotated, terrariumMode: settings.terrariumMode, outOfBounds: y + bounds.h > bedBottom || !fitsWidth || !fitsHeight });
    x += bounds.w + layoutGapX;
    rowHeight = Math.max(rowHeight, bounds.h);
  };

  const sortedParts = settings.autoNest
    ? [...parts].sort((a, b) => {
        const aBounds = panelBounds(a.width, a.height, tab, a.plainShape ? "plain" : jointType);
        const bBounds = panelBounds(b.width, b.height, tab, b.plainShape ? "plain" : jointType);
        return Math.max(bBounds.w, bBounds.h) - Math.max(aBounds.w, aBounds.h);
      })
    : parts;

  sortedParts.forEach(placePart);

  return {
    placed,
    canvasWidth: settings.bedWidth,
    canvasHeight: settings.bedHeight,
    tab,
    fitsBed: oversized.length === 0,
    oversized,
  };
}

function estimateCutLength(layout, settings) {
  const cutSegments = cutSegmentsForLayout(layout, settings);
  const markSegments = settings.includeMarks ? layout.placed.flatMap(panelMarkSegments) : [];
  const totalMm = [...cutSegments, ...markSegments].reduce((sum, segment) => {
    if (segment.type === "circle") return sum + Math.PI * 2 * segment.r;
    return sum + Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
  }, 0);
  return totalMm / 1000;
}

function dxfNumber(value) {
  return rounded(value).toString();
}

function makeDxfLine({ layer, x1, y1, x2, y2 }, canvasHeight, settings) {
  const color = layer === "CUT" ? dxfColor(settings.cutColor) : dxfColor(settings.scoreColor || "blue");
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

function makeDxfCircle({ layer, cx, cy, r }, canvasHeight, settings) {
  const color = layer === "CUT" ? dxfColor(settings.cutColor) : dxfColor(settings.scoreColor || "blue");
  return [
    "0", "CIRCLE",
    "8", layer,
    "62", color,
    "10", dxfNumber(cx),
    "20", dxfNumber(canvasHeight - cy),
    "30", "0",
    "40", dxfNumber(r),
  ].join("\n");
}

function buildLayerTable(settings) {
  const markLayer = settings.includeMarks
    ? ["0", "LAYER", "2", "SCORE", "70", "0", "62", dxfColor(settings.scoreColor || "blue"), "6", "CONTINUOUS"]
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
  const cutSegments = cutSegmentsForLayout(layout, settings);
  const markSegments = settings.includeMarks ? layout.placed.flatMap(panelMarkSegments) : [];
  const segments = [...cutSegments, ...markSegments];
  const lineEntities = segments.map((segment) => {
    if (segment.type === "circle") return makeDxfCircle(segment, layout.canvasHeight, settings);
    return makeDxfLine(segment, layout.canvasHeight, settings);
  }).join("\n");

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

export function makeFileName(settings, extension) {
  return `cajalab-${settings.width}x${settings.depth}x${settings.height}mm.${extension}`;
}

export function buildArtifacts(settings) {
  const layout = buildLayout(settings);
  const cutColor = cutStroke(settings.cutColor);
  const panels = layout.placed.map(makePreviewPanel).join("");
  const terrariumPanels = layout.placed.flatMap(panelTerrariumSegments).map(svgLine).join("");
  const cutPanels = cutSegmentsForLayout(layout, settings).map(svgShape).join("");
  const markPanels = settings.includeMarks ? layout.placed.flatMap(panelMarkSegments).map(svgLine).join("") : "";

  const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rounded(layout.canvasWidth)} ${rounded(layout.canvasHeight)}" width="${rounded(layout.canvasWidth)}mm" height="${rounded(layout.canvasHeight)}mm">
  <style>
    .cut-line{fill:none;stroke:${cutColor};stroke-width:${cutLineWidth(settings)};vector-effect:non-scaling-stroke}
    .fold-line,.score-line{stroke:#8aa0b5;stroke-width:${scoreLineWidth(settings)};stroke-dasharray:3 2;vector-effect:non-scaling-stroke}
    .panel-label{fill:#9ba6af;font-size:7px;font-family:Arial,sans-serif;font-weight:700;text-anchor:middle}
    .bed-outline{fill:rgba(255,255,255,0.025);stroke:rgba(255,255,255,0.24);stroke-width:0.35;vector-effect:non-scaling-stroke}
    .bed-margin{fill:none;stroke:rgba(255,255,255,0.22);stroke-width:0.25;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
  </style>
  ${bedSvg(settings)}
  ${panels}
  ${terrariumPanels}
</svg>`;

  const cutSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rounded(layout.canvasWidth)} ${rounded(layout.canvasHeight)}" width="${rounded(layout.canvasWidth)}mm" height="${rounded(layout.canvasHeight)}mm">
  <style>
    .cut-line{fill:none;stroke:${cutColor};stroke-width:${cutLineWidth(settings)};vector-effect:non-scaling-stroke}
    .score-line{stroke:${scoreStroke(settings)};stroke-width:${scoreLineWidth(settings)};stroke-dasharray:3 2;vector-effect:non-scaling-stroke}
  </style>
  <g>
    ${cutPanels}
    ${markPanels}
  </g>
</svg>`;

  return {
    layout,
    previewSvg,
    cutSvg,
    dxf: buildDxf(layout, settings),
    cutLengthMeters: estimateCutLength(layout, settings),
  };
}
