// ============================================================
// AIFORGE v6 — UNIVERSAL ACTION ADAPTER v0.1
//
// Bezpečně aplikuje schválené AI actions na univerzální konstrukci.
// Nepoužívá pravidla brány. Podporuje 2D i volitelnou Z souřadnici.
// ============================================================

const ALLOWED_ACTIONS = new Set([
  "add_element",
  "update_element",
  "delete_element",
  "move_element",
  "update_dimension"
]);

const ALLOWED_ELEMENT_PATHS = [
  /^name$/,
  /^role$/,
  /^category$/,
  /^orientation$/,
  /^material(\.|$)/,
  /^profile(\.|$)/,
  /^start\.(x|y|z)$/,
  /^end\.(x|y|z)$/,
  /^parameters(\.|$)/,
  /^source$/
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePoint(point) {
  if (!isObject(point)) return null;
  if (!finite(point.x) || !finite(point.y)) return null;
  const result = { x: point.x, y: point.y };
  if (point.z != null) {
    if (!finite(point.z)) return null;
    result.z = point.z;
  }
  return result;
}

function calculateLengthMm(start, end) {
  const a = normalizePoint(start);
  const b = normalizePoint(end);
  if (!a || !b) return null;
  const dz = (b.z || 0) - (a.z || 0);
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y, dz));
}

function getNextElementId(elements) {
  const max = Math.max(
    0,
    ...(elements || []).map(el => {
      const match = String(el?.id || "").match(/^P(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
  );
  return `P${String(max + 1).padStart(2, "0")}`;
}

function getByPath(obj, path) {
  return String(path).split(".").reduce(
    (current, key) => current == null ? undefined : current[key],
    obj
  );
}

function setByPath(obj, path, value) {
  const parts = String(path).split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isObject(current[key])) current[key] = {};
    current = current[key];
  }
  current[parts.at(-1)] = value;
}

function allowedPath(path) {
  return ALLOWED_ELEMENT_PATHS.some(rx => rx.test(path));
}

function normalizeProfile(profile = {}) {
  const result = isObject(profile) ? clone(profile) : {};
  if (typeof result.name !== "string" || !result.name.trim()) {
    throw new Error("profile.name je povinné.");
  }

  for (const key of ["weightPerMeter", "pricePerMeter", "pricePerKg"]) {
    if (!(key in result)) result[key] = null;
  }
  if (!("weightSource" in result)) result.weightSource = "unknown";
  if (!("priceSource" in result)) result.priceSource = "unknown";

  if (result.weightPerMeter != null && (!finite(result.weightPerMeter) || result.weightPerMeter <= 0)) {
    throw new Error("profile.weightPerMeter musí být > 0 nebo null.");
  }
  if (result.pricePerMeter != null && (!finite(result.pricePerMeter) || result.pricePerMeter < 0)) {
    throw new Error("profile.pricePerMeter musí být >= 0 nebo null.");
  }
  if (result.pricePerKg != null && (!finite(result.pricePerKg) || result.pricePerKg < 0)) {
    throw new Error("profile.pricePerKg musí být >= 0 nebo null.");
  }

  return result;
}

function normalizeElement(element, id) {
  const result = clone(element);
  result.id = id;
  if (typeof result.role !== "string" || !result.role.trim()) {
    throw new Error(`${id}: role je povinné.`);
  }
  if (!result.name) result.name = result.role;
  result.profile = normalizeProfile(result.profile);

  const start = normalizePoint(result.start);
  const end = normalizePoint(result.end);
  if (!start || !end) {
    throw new Error(`${id}: start/end musí obsahovat platné x,y a volitelně z.`);
  }
  result.start = start;
  result.end = end;

  const length = calculateLengthMm(start, end);
  if (!finite(length) || length <= 0) {
    throw new Error(`${id}: prvek musí mít délku > 0.`);
  }
  result.lengthMm = length;
  if (!result.source) result.source = "ai_proposal";
  return result;
}

function findElement(construction, id) {
  const wanted = String(id || "").toUpperCase();
  return construction.elements.find(el => String(el?.id || "").toUpperCase() === wanted);
}

function clearStaleProfileMetadata(element, changedPaths) {
  if (!changedPaths.includes("profile.name")) return;
  const explicitlyChanged = new Set(changedPaths);
  for (const key of [
    "profile.weightPerMeter",
    "profile.weightSource",
    "profile.pricePerMeter",
    "profile.pricePerKg",
    "profile.priceSource"
  ]) {
    if (explicitlyChanged.has(key)) continue;
    const leaf = key.split(".")[1];
    if (leaf === "weightSource" || leaf === "priceSource") {
      element.profile[leaf] = "unknown";
    } else {
      element.profile[leaf] = null;
    }
  }
}

function applyUpdateElement(construction, action) {
  const element = findElement(construction, action.id);
  if (!element) throw new Error(`update_element: ${action.id} neexistuje.`);
  if (!isObject(action.changes)) throw new Error(`update_element ${action.id}: changes musí být objekt.`);

  const changedPaths = Object.keys(action.changes);
  for (const [path, diff] of Object.entries(action.changes)) {
    if (!allowedPath(path)) throw new Error(`update_element ${action.id}: nepovolená cesta ${path}.`);
    if (!isObject(diff) || !("after" in diff)) throw new Error(`update_element ${action.id}.${path}: chybí after.`);
    setByPath(element, path, clone(diff.after));
  }

  if (!isObject(element.profile)) element.profile = {};
  clearStaleProfileMetadata(element, changedPaths);
  const normalized = normalizeElement(element, element.id);
  Object.keys(element).forEach(key => delete element[key]);
  Object.assign(element, normalized);
}

function applyMoveElement(construction, action) {
  const element = findElement(construction, action.id);
  if (!element) throw new Error(`move_element: ${action.id} neexistuje.`);
  if (!isObject(action.changes)) throw new Error(`move_element ${action.id}: changes musí být objekt.`);

  for (const [path, diff] of Object.entries(action.changes)) {
    if (!/^((start|end)\.(x|y|z))$/.test(path)) {
      throw new Error(`move_element ${action.id}: povoleny jsou pouze start/end x/y/z.`);
    }
    if (!isObject(diff) || !finite(diff.after)) {
      throw new Error(`move_element ${action.id}.${path}: after musí být číslo.`);
    }
    setByPath(element, path, diff.after);
  }

  const normalized = normalizeElement(element, element.id);
  Object.keys(element).forEach(key => delete element[key]);
  Object.assign(element, normalized);
}

function applyAddElement(construction, action) {
  if (!isObject(action.element)) throw new Error("add_element: element chybí.");
  const id = getNextElementId(construction.elements);
  construction.elements.push(normalizeElement(action.element, id));
}

function applyDeleteElement(construction, action) {
  const wanted = String(action.id || "").toUpperCase();
  const index = construction.elements.findIndex(el => String(el?.id || "").toUpperCase() === wanted);
  if (index < 0) throw new Error(`delete_element: ${action.id} neexistuje.`);
  construction.elements.splice(index, 1);
}

function applyUpdateDimension(construction, action) {
  if (typeof action.field !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(action.field)) {
    throw new Error("update_dimension: neplatný název pole.");
  }
  if (!finite(action.value) || action.value <= 0) {
    throw new Error(`update_dimension ${action.field}: value musí být > 0.`);
  }
  if (action.unit !== "mm") {
    throw new Error(`update_dimension ${action.field}: unit musí být mm.`);
  }
  construction.globalDimensions[action.field] = action.value;
  construction.dimensionSources = construction.dimensionSources || {};
  construction.dimensionSources[action.field] = action.source || "userProvided";
}

function deriveBounds(construction) {
  const points = [];
  for (const el of construction.elements || []) {
    if (el?.start) points.push(el.start);
    if (el?.end) points.push(el.end);
  }
  if (!points.length) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => finite(p.z) ? p.z : 0);
  const bounds = {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
    minZ: Math.min(...zs), maxZ: Math.max(...zs)
  };
  bounds.width = bounds.maxX - bounds.minX;
  bounds.height = bounds.maxY - bounds.minY;
  bounds.depth = bounds.maxZ - bounds.minZ;
  return bounds;
}

function validateFinal(construction) {
  const errors = [];
  if (!isObject(construction) || construction.engine !== "universal") {
    errors.push("Universal Adapter vyžaduje construction.engine = universal.");
  }
  if (!isObject(construction.globalDimensions)) errors.push("globalDimensions musí být objekt.");
  if (!Array.isArray(construction.elements)) errors.push("elements musí být pole.");

  const ids = new Set();
  for (const el of construction.elements || []) {
    try {
      const normalized = normalizeElement(el, el.id);
      if (normalized.lengthMm !== el.lengthMm) errors.push(`${el.id}: lengthMm neodpovídá geometrii.`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    const id = String(el?.id || "").toUpperCase();
    if (ids.has(id)) errors.push(`Duplicitní ID ${id}.`);
    ids.add(id);
  }

  if ((construction.elements || []).length === 0) {
    errors.push("Konstrukce neobsahuje žádný výrobní prvek.");
  }
  return errors;
}

export function applyUniversalApprovedActions(currentConstruction, actions) {
  if (!isObject(currentConstruction) || currentConstruction.engine !== "universal") {
    return { ok: false, errors: ["Neplatný univerzální construction stav."], construction: currentConstruction, applied: [] };
  }
  if (!Array.isArray(actions)) {
    return { ok: false, errors: ["actions musí být pole."], construction: currentConstruction, applied: [] };
  }

  const draft = clone(currentConstruction);
  draft.globalDimensions = isObject(draft.globalDimensions) ? draft.globalDimensions : {};
  draft.elements = Array.isArray(draft.elements) ? draft.elements : [];
  const applied = [];

  try {
    actions.forEach((action, index) => {
      if (!isObject(action) || !ALLOWED_ACTIONS.has(action.type)) {
        throw new Error(`actions[${index}]: nepovolený action type.`);
      }
      switch (action.type) {
        case "add_element": applyAddElement(draft, action); break;
        case "update_element": applyUpdateElement(draft, action); break;
        case "delete_element": applyDeleteElement(draft, action); break;
        case "move_element": applyMoveElement(draft, action); break;
        case "update_dimension": applyUpdateDimension(draft, action); break;
      }
      applied.push({ index, type: action.type, id: action.id || action.temporaryId || null });
    });

    const bounds = deriveBounds(draft);
    if (bounds) {
      draft.bounds = bounds;
      draft.globalDimensions.overallWidth = bounds.width;
      draft.globalDimensions.overallHeight = bounds.height;
      draft.globalDimensions.overallDepth = bounds.depth;
    }

    const errors = validateFinal(draft);
    if (errors.length) {
      return { ok: false, errors, construction: currentConstruction, applied: [] };
    }
    return { ok: true, errors: [], construction: draft, applied };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      construction: currentConstruction,
      applied: []
    };
  }
}

export const AIFORGE_UNIVERSAL_ACTION_ADAPTER_VERSION = "0.1";
