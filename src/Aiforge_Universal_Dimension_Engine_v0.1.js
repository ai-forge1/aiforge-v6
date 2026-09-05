// ============================================================
// AIFORGE v6 — UNIVERSAL DIMENSION ENGINE v0.1
//
// Deterministicky odvozuje výrobní kóty z construction.elements[].
// AI kóty nevymýšlí. Engine pracuje pouze s reálnou geometrií.
// ============================================================

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function projectPoint(point, plane = "XY") {
  const x = finite(point?.x) ? point.x : 0;
  const y = finite(point?.y) ? point.y : 0;
  const z = finite(point?.z) ? point.z : 0;

  if (plane === "XZ") return { x, y: z };
  if (plane === "YZ") return { x: y, y: z };
  return { x, y };
}

export function getProjectionBounds(elements = [], plane = "XY") {
  const points = [];
  for (const element of elements) {
    if (element?.start) points.push(projectPoint(element.start, plane));
    if (element?.end) points.push(projectPoint(element.end, plane));
  }

  if (!points.length) {
    return {
      minX: 0,
      maxX: 1000,
      minY: 0,
      maxY: 1000,
      width: 1000,
      height: 1000
    };
  }

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function repeatedSpacingDimensions(elements, plane, bounds, offset) {
  const groups = new Map();

  for (const element of elements) {
    const params = element?.parameters || {};
    if (params.generatedPattern !== "repeatLinear") continue;
    if (!finite(params.patternSpacingMm) || params.patternSpacingMm <= 0) continue;

    const axis = params.patternAxis;
    const projectedAxis =
      plane === "XY" ? axis :
      plane === "XZ" ? (axis === "z" ? "y" : axis === "x" ? "x" : null) :
      plane === "YZ" ? (axis === "z" ? "y" : axis === "y" ? "x" : null) : null;

    if (!projectedAxis) continue;

    const key = `${element.role || "pattern"}|${axis}|${params.patternSpacingMm}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(element);
  }

  const dimensions = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    const first = projectPoint(group[0].start, plane);
    const second = projectPoint(group[1].start, plane);
    const spacing = group[0]?.parameters?.patternSpacingMm;
    const axis = group[0]?.parameters?.patternAxis;

    if (plane === "XY" && axis === "x" || plane === "XZ" && axis === "x" || plane === "YZ" && axis === "y") {
      dimensions.push({
        id: `spacing-${key}`,
        kind: "horizontal",
        valueMm: spacing,
        label: `rozteč ${spacing} mm`,
        x1: first.x,
        x2: second.x,
        y: bounds.minY - offset * 0.58,
        extensionY1: Math.min(first.y, second.y),
        source: "generated_pattern"
      });
    } else {
      dimensions.push({
        id: `spacing-${key}`,
        kind: "vertical",
        valueMm: spacing,
        label: `rozteč ${spacing} mm`,
        y1: first.y,
        y2: second.y,
        x: bounds.maxX + offset * 0.58,
        extensionX1: Math.max(first.x, second.x),
        source: "generated_pattern"
      });
    }
  }

  return dimensions;
}

export function buildUniversalDimensions(construction, plane = "XY") {
  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const bounds = getProjectionBounds(elements, plane);
  const span = Math.max(bounds.width || 0, bounds.height || 0, 1000);
  const offset = span * 0.09 + 70;

  const dimensions = [];

  if (bounds.width > 0) {
    dimensions.push({
      id: "overall-horizontal",
      kind: "horizontal",
      valueMm: Math.round(bounds.width),
      label: `${Math.round(bounds.width)} mm`,
      x1: bounds.minX,
      x2: bounds.maxX,
      y: bounds.maxY + offset,
      extensionY1: bounds.maxY,
      source: "geometry_bounds"
    });
  }

  if (bounds.height > 0) {
    dimensions.push({
      id: "overall-vertical",
      kind: "vertical",
      valueMm: Math.round(bounds.height),
      label: `${Math.round(bounds.height)} mm`,
      y1: bounds.minY,
      y2: bounds.maxY,
      x: bounds.minX - offset,
      extensionX1: bounds.minX,
      source: "geometry_bounds"
    });
  }

  dimensions.push(...repeatedSpacingDimensions(elements, plane, bounds, offset));

  return {
    plane,
    bounds,
    dimensions,
    drawingPadding: span * 0.2 + 180
  };
}

export const AIFORGE_UNIVERSAL_DIMENSION_ENGINE_VERSION = "0.1";
