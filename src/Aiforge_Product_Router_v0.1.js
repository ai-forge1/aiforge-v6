// ============================================================
// AIFORGE v6 — PRODUCT ROUTER v0.3
//
// Rozlišuje specializovanou samonosnou bránu od univerzálních
// zámečnických konstrukcí. Neprovádí geometrii a nic neodhaduje.
// v0.3: lepší čeština + výrazně kratší Universal Brain prompt.
// ============================================================

const PRODUCT_RULES = [
  {
    type: "sliding_gate",
    label: "Samonosná / posuvná brána",
    specialized: true,
    patterns: [
      /\bsamonosn\w*\s+br[aá]n\w*/i,
      /\bposuvn\w*\s+br[aá]n\w*/i,
      /\bbr[aá]n\w*\s+samonosn\w*/i
    ]
  },
  {
    type: "swing_gate",
    label: "Křídlová brána / vrata",
    patterns: [/\bkř[ií]dlov\w*\s+br[aá]n\w*/i, /\bvrat\w*/i]
  },
  {
    type: "wicket",
    label: "Branka",
    patterns: [/\bbrank\w*/i]
  },
  {
    type: "railing",
    label: "Zábradlí",
    patterns: [/\bz[aá]bradl\w*/i]
  },
  {
    type: "fence",
    label: "Plot / plotové pole",
    patterns: [/\bplot\w*/i, /\boplocen\w*/i]
  },
  {
    type: "stairs",
    label: "Schody / schodiště",
    patterns: [/\bschod\w*/i, /\bschodi[sš]t\w*/i]
  },
  {
    type: "table_frame",
    label: "Pracovní stůl / podnož",
    patterns: [
      /\bst[oů]l\w*/i,
      /\bpracovn\w*\s+st[oů]l\w*/i,
      /\bpodno[zž]\w*/i
    ]
  },
  {
    type: "rack",
    label: "Regál / stojan",
    patterns: [/\breg[aá]l\w*/i, /\bstojan\w*/i]
  },
  {
    type: "canopy",
    label: "Přístřešek / pergola",
    patterns: [/\bpř[ií]stře[sš]ek\w*/i, /\bpergol\w*/i]
  },
  {
    type: "door",
    label: "Ocelové dveře / rám dveří",
    patterns: [/\bdveř\w*/i, /\bocelov\w*\s+r[aá]m\w*/i]
  },
  {
    type: "frame",
    label: "Svařovaný rám",
    patterns: [/\bsvařovan\w*\s+r[aá]m\w*/i, /\br[aá]m\w*\s+z\s+jekl\w*/i]
  },
  {
    type: "platform",
    label: "Plošina / lávka",
    patterns: [/\bplo[sš]in\w*/i, /\bl[aá]vk\w*/i]
  },
  {
    type: "shelf",
    label: "Police / konzola",
    patterns: [/\bpolic\w*/i, /\bkonzol\w*/i]
  }
];

const NEW_CONSTRUCTION_PATTERNS = [
  /\budělej\b/i,
  /\bvytvoř\b/i,
  /\bnavrhni\b/i,
  /\bvyrob\w*/i,
  /\bchci\b/i,
  /\bpotřebuj\w*/i,
  /\bnov\w*\s+(konstrukc|r[aá]m|br[aá]n|brank|z[aá]bradl|plot|schod|st[oů]l|reg[aá]l|př[ií]stře[sš]ek|pergol)/i
];

function detectProduct(prompt) {
  const text = String(prompt || "").trim();

  for (const rule of PRODUCT_RULES) {
    if (rule.patterns.some(rx => rx.test(text))) {
      return {
        type: rule.type,
        label: rule.label,
        specialized: !!rule.specialized,
        recognized: true
      };
    }
  }

  return {
    type: "generic",
    label: "Obecná zámečnická konstrukce",
    specialized: false,
    recognized: false
  };
}

function looksLikeNewConstruction(prompt) {
  const text = String(prompt || "");
  return NEW_CONSTRUCTION_PATTERNS.some(rx => rx.test(text));
}

export function routeConstructionPrompt(prompt, currentConstruction) {
  const detected = detectProduct(prompt);
  const currentEngine = currentConstruction?.engine || "gate";
  const currentType = currentConstruction?.productType || "sliding_gate";
  const isNew = looksLikeNewConstruction(prompt);

  if (detected.specialized) {
    return {
      mode: "gate",
      productType: detected.type,
      productLabel: detected.label,
      isNewConstruction: isNew && currentType !== detected.type,
      reason: "specialized_gate_engine"
    };
  }

  if (detected.recognized) {
    const changingProduct = currentType !== detected.type;
    return {
      mode: "universal",
      productType: detected.type,
      productLabel: detected.label,
      isNewConstruction: isNew || changingProduct || currentEngine !== "universal",
      reason: "recognized_universal_product"
    };
  }

  if (currentEngine === "universal") {
    return {
      mode: "universal",
      productType: currentType || "generic",
      productLabel: currentConstruction?.productLabel || "Obecná konstrukce",
      isNewConstruction: false,
      reason: "continue_universal_project"
    };
  }

  if (isNew) {
    return {
      mode: "universal",
      productType: "generic",
      productLabel: "Obecná zámečnická konstrukce",
      isNewConstruction: true,
      reason: "unknown_new_construction_safe_fallback"
    };
  }

  return {
    mode: "gate",
    productType: currentType,
    productLabel: currentConstruction?.productLabel || "Samonosná / posuvná brána",
    isNewConstruction: false,
    reason: "continue_current_gate"
  };
}

export function createUniversalConstructionBase(productType, productLabel) {
  return {
    schemaVersion: 1,
    engine: "universal",
    productType: productType || "generic",
    productLabel: productLabel || "Obecná zámečnická konstrukce",
    globalDimensions: {},
    elements: [],
    metadata: {
      createdBy: "aiforge_product_router_v0.3",
      geometryMode: "straight_profile_elements",
      units: "mm"
    }
  };
}

export function buildUniversalBrainPrompt(userPrompt, route) {
  return `AIFORGE UNIVERSAL MODE
PRODUCT=${route.productType}; LABEL=${route.productLabel}; MODE=${route.isNewConstruction ? "new" : "edit"}

Return ONLY valid proposal JSON:
{"intent":"modify_construction","actions":[],"warnings":[],"questions":[]}

RULES:
1. Use only add_element, update_element, delete_element, move_element, update_dimension.
2. Straight profiles use exact start/end mm. x=width, y=height, z=depth. Never send lengthMm; Adapter calculates it.
3. Keep response compact. For profile send only {"name":"..."} unless verified weight/price was explicitly supplied. Do NOT repeat null/unknown metadata.
4. Max 12 actions. Repeated equal members MUST use one add_element template with parameters.repeatLinear={"axis":"x|y|z","spacingMm":N,"fromMm":N,"toMm":N} or count.
5. Never invent missing critical dimensions, prices, weights or catalog values. If required data is missing, ask in questions and do not guess.
6. Do not apply gate-specific rules outside a sliding/cantilever gate.
7. Current universal engine models straight profile members. Sheet/plate/panel parts are NOT line members: do not fake them. Mention unsupported sheet/plate in warnings while still creating the supported profile skeleton when possible.
8. For 3D frames, use z coordinates and repeatLinear wherever possible so the proposal stays below 12 actions.

USER REQUEST:
${String(userPrompt || "").trim()}`;
}

export const AIFORGE_PRODUCT_ROUTER_VERSION = "0.3";
