import { applyGateDimensionChange } from "./Aiforge_Gate_Geometry_Engine_v0.1.js";

// ============================================================
// AIFORGE v6.0 — ACTION ADAPTER v0.2
//
// Účel:
// schválené AI actions[] -> bezpečně aplikovat na KOPII construction.
//
// NIKDY:
// - nemutuje původní construction objekt,
// - nepřijímá updatedConstruction,
// - nevymýšlí ceny, hmotnosti ani výrobní rozměry,
// - neaplikuje nepovolený action type.
//
// Tok:
// Brain -> Validator -> AI Change Review -> onApprove(actions)
// -> Action Adapter -> nový construction -> CORE renderer/cutlist/pricing
// ============================================================

const ALLOWED_ACTIONS = new Set([
  "add_element",
  "update_element",
  "delete_element",
  "move_element",
  "update_dimension"
]);

const ALLOWED_GLOBAL_DIMENSIONS = new Set([
  "openingWidth",
  "frameHeight",
  "counterweightLength"
]);

const ALLOWED_ELEMENT_PATHS = [
  /^name$/,
  /^role$/,
  /^category$/,
  /^orientation$/,
  /^material(\.|$)/,
  /^profile(\.|$)/,
  /^start\.(x|y)$/,
  /^end\.(x|y)$/,
  /^parameters(\.|$)/
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function finiteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function calculateLengthMm(start, end) {
  if (!isPlainObject(start) || !isPlainObject(end)) return null;
  if (!finiteNumber(start.x) || !finiteNumber(start.y)) return null;
  if (!finiteNumber(end.x) || !finiteNumber(end.y)) return null;

  return Math.round(
    Math.hypot(end.x - start.x, end.y - start.y)
  );
}

function getNextElementId(elements) {
  const nums = (elements || [])
    .map(el => {
      const m = String(el?.id || "").match(/^P(\d+)$/i);
      return m ? parseInt(m[1], 10) : 0;
    });

  return `P${String(Math.max(0, ...nums) + 1).padStart(2, "0")}`;
}

function getByPath(obj, path) {
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const parts = String(path).split(".");
  let cursor = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];

    if (!isPlainObject(cursor[key])) {
      cursor[key] = {};
    }

    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function isAllowedElementPath(path) {
  return ALLOWED_ELEMENT_PATHS.some(rx => rx.test(path));
}

function validateConstructionShape(construction) {
  const errors = [];

  if (!isPlainObject(construction)) {
    return ["construction musí být objekt."];
  }

  if (!isPlainObject(construction.globalDimensions)) {
    errors.push("construction.globalDimensions musí být objekt.");
  }

  if (!Array.isArray(construction.elements)) {
    errors.push("construction.elements musí být pole.");
  }

  return errors;
}

function validateElementInvariant(element, path = "element") {
  const errors = [];

  if (!isPlainObject(element)) {
    return [`${path} musí být objekt.`];
  }

  if (typeof element.id !== "string" || !/^P\d+$/i.test(element.id)) {
    errors.push(`${path}.id musí být Pxx.`);
  }

  if (typeof element.role !== "string" || !element.role.trim()) {
    errors.push(`${path}.role je povinné.`);
  }

  if (!isPlainObject(element.profile)) {
    errors.push(`${path}.profile musí být objekt.`);
  } else {
    if (typeof element.profile.name !== "string" || !element.profile.name.trim()) {
      errors.push(`${path}.profile.name je povinné.`);
    }

    const w = element.profile.weightPerMeter;
    if (w != null && (!finiteNumber(w) || w <= 0)) {
      errors.push(`${path}.profile.weightPerMeter musí být > 0 nebo null.`);
    }

    const ppm = element.profile.pricePerMeter;
    if (ppm != null && (!finiteNumber(ppm) || ppm < 0)) {
      errors.push(`${path}.profile.pricePerMeter musí být >= 0 nebo null.`);
    }

    const ppk = element.profile.pricePerKg;
    if (ppk != null && (!finiteNumber(ppk) || ppk < 0)) {
      errors.push(`${path}.profile.pricePerKg musí být >= 0 nebo null.`);
    }
  }

  if (!isPlainObject(element.start) || !isPlainObject(element.end)) {
    errors.push(`${path}.start/end musí být objekty.`);
  } else {
    for (const [label, point] of [["start", element.start], ["end", element.end]]) {
      if (!finiteNumber(point.x)) errors.push(`${path}.${label}.x musí být číslo.`);
      if (!finiteNumber(point.y)) errors.push(`${path}.${label}.y musí být číslo.`);
    }
  }

  return errors;
}

function normalizeElementLength(element) {
  const length = calculateLengthMm(element.start, element.end);
  if (length == null || length <= 0) {
    throw new Error(`Prvek ${element.id}: neplatná geometrie start/end.`);
  }
  element.lengthMm = length;
}

function recalculateDerivedDimensions(construction) {
  const g = construction.globalDimensions || {};

  if (
    finiteNumber(g.openingWidth) &&
    finiteNumber(g.counterweightLength)
  ) {
    g.totalLength = g.openingWidth + g.counterweightLength;
  }
}

function applyUpdateDimension(construction, action) {
  if (!ALLOWED_GLOBAL_DIMENSIONS.has(action.field)) {
    throw new Error(
      `update_dimension: nepovolené nebo odvozené pole "${action.field}".`
    );
  }

  if (!finiteNumber(action.value) || action.value <= 0) {
    throw new Error(`update_dimension ${action.field}: hodnota musí být > 0.`);
  }

  if (action.unit !== "mm") {
    throw new Error(`update_dimension ${action.field}: unit musí být "mm".`);
  }

  applyGateDimensionChange(
    construction,
    action.field,
    action.value
  );
}

function findElement(construction, id) {
  const upper = String(id || "").toUpperCase();
  return construction.elements.find(
    el => String(el?.id || "").toUpperCase() === upper
  );
}

function applyUpdateElement(construction, action) {
  const element = findElement(construction, action.id);

  if (!element) {
    throw new Error(`update_element: prvek ${action.id} neexistuje.`);
  }

  if (!isPlainObject(action.changes)) {
    throw new Error(`update_element ${action.id}: changes musí být objekt.`);
  }

  for (const [path, diff] of Object.entries(action.changes)) {
    if (!isAllowedElementPath(path)) {
      throw new Error(`update_element ${action.id}: nepovolená cesta "${path}".`);
    }

    if (!isPlainObject(diff) || !("after" in diff)) {
      throw new Error(`update_element ${action.id}.${path}: chybí after.`);
    }

    setByPath(element, path, deepClone(diff.after));
  }

  normalizeElementLength(element);

  const errors = validateElementInvariant(
    element,
    `element ${element.id}`
  );

  if (errors.length) {
    throw new Error(errors.join(" | "));
  }
}

function applyMoveElement(construction, action) {
  const element = findElement(construction, action.id);

  if (!element) {
    throw new Error(`move_element: prvek ${action.id} neexistuje.`);
  }

  if (!isPlainObject(action.changes)) {
    throw new Error(`move_element ${action.id}: changes musí být objekt.`);
  }

  for (const [path, diff] of Object.entries(action.changes)) {
    if (!/^((start|end)\.(x|y))$/.test(path)) {
      throw new Error(`move_element ${action.id}: povolené jsou pouze start/end x/y.`);
    }

    if (!isPlainObject(diff) || !finiteNumber(diff.after)) {
      throw new Error(`move_element ${action.id}.${path}: after musí být číslo.`);
    }

    setByPath(element, path, diff.after);
  }

  normalizeElementLength(element);
}

function applyDeleteElement(construction, action) {
  const index = construction.elements.findIndex(
    el => String(el?.id || "").toUpperCase() === String(action.id || "").toUpperCase()
  );

  if (index < 0) {
    throw new Error(`delete_element: prvek ${action.id} neexistuje.`);
  }

  construction.elements.splice(index, 1);
}

function applyAddElement(construction, action) {
  if (!isPlainObject(action.element)) {
    throw new Error("add_element: element chybí.");
  }

  const element = deepClone(action.element);
  element.id = getNextElementId(construction.elements);

  if (!element.source) {
    element.source = "ai_proposal";
  }

  normalizeElementLength(element);

  const errors = validateElementInvariant(
    element,
    `new element ${element.id}`
  );

  if (errors.length) {
    throw new Error(errors.join(" | "));
  }

  construction.elements.push(element);
}

function validateFinalConstruction(construction) {
  const errors = validateConstructionShape(construction);
  const ids = new Set();

  for (const element of construction.elements || []) {
    errors.push(...validateElementInvariant(element, `element ${element?.id || "?"}`));

    const id = String(element?.id || "").toUpperCase();
    if (ids.has(id)) {
      errors.push(`Duplicitní ID ${id}.`);
    }
    ids.add(id);

    const expectedLength = calculateLengthMm(element.start, element.end);
    if (
      expectedLength != null &&
      element.lengthMm !== expectedLength
    ) {
      errors.push(
        `${id}: lengthMm ${element.lengthMm} neodpovídá start/end ${expectedLength}.`
      );
    }
  }

  const g = construction.globalDimensions || {};

  const p01 = (construction.elements || []).find(el => el?.role === "bottom_c_profile");
  const p02 = (construction.elements || []).find(el => el?.role === "opening_upper_rail");
  const p03 = (construction.elements || []).find(el => el?.role === "leading_post");
  const p04 = (construction.elements || []).find(el => el?.role === "main_dividing_post");

  if (
    finiteNumber(g.openingWidth) &&
    finiteNumber(g.counterweightLength) &&
    finiteNumber(g.totalLength)
  ) {
    const expectedTotal = g.openingWidth + g.counterweightLength;

    if (g.totalLength !== expectedTotal) {
      errors.push(
        `globalDimensions.totalLength ${g.totalLength} neodpovídá openingWidth + counterweightLength = ${expectedTotal}.`
      );
    }

    if (p01 && p01.end?.x !== expectedTotal) {
      errors.push(`bottom_c_profile.end.x musí být ${expectedTotal}.`);
    }

    if (p02) {
      if (p02.start?.x !== g.counterweightLength) {
        errors.push(`opening_upper_rail.start.x musí být ${g.counterweightLength}.`);
      }
      if (p02.end?.x !== expectedTotal) {
        errors.push(`opening_upper_rail.end.x musí být ${expectedTotal}.`);
      }
    }

    if (p03 && (p03.start?.x !== expectedTotal || p03.end?.x !== expectedTotal)) {
      errors.push(`leading_post.x musí být ${expectedTotal}.`);
    }

    if (p04 && (p04.start?.x !== g.counterweightLength || p04.end?.x !== g.counterweightLength)) {
      errors.push(`main_dividing_post.x musí být ${g.counterweightLength}.`);
    }
  }

  for (const key of ["openingWidth", "frameHeight"]) {
    if (!finiteNumber(g[key]) || g[key] <= 0) {
      errors.push(`globalDimensions.${key} musí být > 0.`);
    }
  }

  if (
    g.counterweightLength != null &&
    (!finiteNumber(g.counterweightLength) || g.counterweightLength <= 0)
  ) {
    errors.push("globalDimensions.counterweightLength musí být > 0.");
  }

  return errors;
}

export function applyApprovedActions(currentConstruction, actions) {
  const initialErrors = validateConstructionShape(currentConstruction);

  if (initialErrors.length) {
    return {
      ok: false,
      errors: initialErrors,
      construction: currentConstruction,
      applied: []
    };
  }

  if (!Array.isArray(actions)) {
    return {
      ok: false,
      errors: ["actions musí být pole."],
      construction: currentConstruction,
      applied: []
    };
  }

  const draft = deepClone(currentConstruction);
  const applied = [];

  try {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      if (!isPlainObject(action)) {
        throw new Error(`actions[${i}] musí být objekt.`);
      }

      if (!ALLOWED_ACTIONS.has(action.type)) {
        throw new Error(`actions[${i}]: nepovolený type "${action.type}".`);
      }

      switch (action.type) {
        case "update_dimension":
          applyUpdateDimension(draft, action);
          break;
        case "update_element":
          applyUpdateElement(draft, action);
          break;
        case "move_element":
          applyMoveElement(draft, action);
          break;
        case "delete_element":
          applyDeleteElement(draft, action);
          break;
        case "add_element":
          applyAddElement(draft, action);
          break;
      }

      applied.push({
        index: i,
        type: action.type,
        id: action.id || action.temporaryId || null
      });
    }

    recalculateDerivedDimensions(draft);
    const finalErrors = validateFinalConstruction(draft);

    if (finalErrors.length) {
      return {
        ok: false,
        errors: finalErrors,
        construction: currentConstruction,
        applied: []
      };
    }

    return {
      ok: true,
      errors: [],
      construction: draft,
      applied
    };

  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error ? error.message : String(error)
      ],
      construction: currentConstruction,
      applied: []
    };
  }
}

export const AIFORGE_ACTION_ADAPTER_VERSION = "0.2";
