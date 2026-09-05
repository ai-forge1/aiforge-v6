import { applyUniversalApprovedActions as applyV01 } from "./Aiforge_Universal_Action_Adapter_v0.1.js";

// ============================================================
// AIFORGE v6 — UNIVERSAL ACTION ADAPTER v0.3
//
// Nad v0.1 přidává kompaktní parametrické opakování prvků.
// AI nemusí vypisovat desítky stejných add_element akcí.
//
// v0.3 navíc chrání hranici Universal vs Gate:
// gate-only globální rozměry nesmí být aplikovány na universal projekt.
//
// Supported element.parameters.repeatLinear:
// {
//   axis: "x" | "y" | "z",
//   spacingMm: 110,
//   fromMm: 110,
//   toMm: 3090
// }
// nebo místo toMm: count: 28
//
// Template start/end se posune po zvolené ose; délku vždy
// dopočítává původní Universal Adapter z výsledných start/end.
// ============================================================

const MAX_PATTERN_ITEMS = 500;

const GATE_ONLY_DIMENSION_FIELDS = new Set([
  "openingWidth",
  "frameHeight",
  "counterweightLength",
  "totalLength"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateUniversalBoundary(actions) {
  if (!Array.isArray(actions)) {
    throw new Error("actions musí být pole.");
  }

  actions.forEach((action, index) => {
    if (
      action?.type === "update_dimension" &&
      GATE_ONLY_DIMENSION_FIELDS.has(action?.field)
    ) {
      throw new Error(
        `actions[${index}]: rozměr ${action.field} patří do Gate Engine a nesmí být aplikován přes Universal Adapter.`
      );
    }
  });
}

function normalizePattern(pattern, template) {
  if (!isObject(pattern)) {
    throw new Error("repeatLinear musí být objekt.");
  }

  const axis = pattern.axis;
  if (!["x", "y", "z"].includes(axis)) {
    throw new Error("repeatLinear.axis musí být x, y nebo z.");
  }

  const spacingMm = pattern.spacingMm;
  if (!finite(spacingMm) || spacingMm <= 0) {
    throw new Error("repeatLinear.spacingMm musí být > 0.");
  }

  const templateAnchor = template?.start?.[axis];
  const fromMm = finite(pattern.fromMm) ? pattern.fromMm : templateAnchor;
  if (!finite(fromMm)) {
    throw new Error("repeatLinear.fromMm chybí a nelze jej odvodit z template start.");
  }

  if (pattern.count != null) {
    if (!Number.isInteger(pattern.count) || pattern.count < 1 || pattern.count > MAX_PATTERN_ITEMS) {
      throw new Error(`repeatLinear.count musí být celé číslo 1–${MAX_PATTERN_ITEMS}.`);
    }
    return {
      axis,
      spacingMm,
      positions: Array.from({ length: pattern.count }, (_, i) => fromMm + i * spacingMm)
    };
  }

  const toMm = pattern.toMm;
  if (!finite(toMm) || toMm < fromMm) {
    throw new Error("repeatLinear.toMm musí být číslo >= fromMm.");
  }

  const count = Math.floor((toMm - fromMm) / spacingMm + 1e-9) + 1;
  if (count < 1 || count > MAX_PATTERN_ITEMS) {
    throw new Error(`repeatLinear vytvoří nepovolený počet prvků (${count}). Maximum je ${MAX_PATTERN_ITEMS}.`);
  }

  return {
    axis,
    spacingMm,
    positions: Array.from({ length: count }, (_, i) => fromMm + i * spacingMm)
  };
}

function expandPatternAction(action) {
  if (action?.type !== "add_element" || !isObject(action.element)) {
    return [action];
  }

  const repeat = action.element?.parameters?.repeatLinear;
  if (!repeat) return [action];

  const template = clone(action.element);
  const normalized = normalizePattern(repeat, template);
  const axis = normalized.axis;
  const anchor = template.start?.[axis];

  if (!finite(anchor) || !finite(template.end?.[axis])) {
    throw new Error(`repeatLinear: template start/end musí obsahovat osu ${axis}.`);
  }

  const baseParameters = isObject(template.parameters) ? clone(template.parameters) : {};
  delete baseParameters.repeatLinear;

  return normalized.positions.map((position, index) => {
    const delta = position - anchor;
    const element = clone(template);

    element.start[axis] += delta;
    element.end[axis] += delta;
    element.parameters = {
      ...baseParameters,
      generatedPattern: "repeatLinear",
      patternAxis: axis,
      patternSpacingMm: normalized.spacingMm,
      patternIndex: index + 1,
      patternCount: normalized.positions.length
    };

    return {
      type: "add_element",
      temporaryId: `${action.temporaryId || "PATTERN"}_${String(index + 1).padStart(3, "0")}`,
      element
    };
  });
}

export function expandUniversalPatternActions(actions) {
  if (!Array.isArray(actions)) {
    throw new Error("actions musí být pole.");
  }

  const expanded = [];
  for (const action of actions) {
    expanded.push(...expandPatternAction(action));
  }
  return expanded;
}

export function applyUniversalApprovedActions(currentConstruction, actions) {
  try {
    validateUniversalBoundary(actions);

    const expandedActions = expandUniversalPatternActions(actions);
    const result = applyV01(currentConstruction, expandedActions);

    if (!result.ok) return result;

    return {
      ...result,
      inputActionCount: actions.length,
      expandedActionCount: expandedActions.length
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      construction: currentConstruction,
      applied: []
    };
  }
}

export const AIFORGE_UNIVERSAL_ACTION_ADAPTER_VERSION = "0.3";
