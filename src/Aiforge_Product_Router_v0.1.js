// ============================================================
// AIFORGE v6 — PRODUCT ROUTER v0.2
//
// Rozlišuje specializovanou samonosnou bránu od univerzálních
// zámečnických konstrukcí. Neprovádí geometrii a nic neodhaduje.
// v0.2: Universal Brain používá kompaktní parametrické patterny.
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
    label: "Rám / podnož stolu",
    patterns: [/\bstol\w*/i, /\bpodno[zž]\w*/i]
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
  /\bnov\w*\s+(konstrukc|r[aá]m|br[aá]n|brank|z[aá]bradl|plot|schod|stol|reg[aá]l|př[ií]stře[sš]ek|pergol)/i
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
      createdBy: "aiforge_product_router_v0.2",
      geometryMode: "straight_profile_elements",
      units: "mm"
    }
  };
}

export function buildUniversalBrainPrompt(userPrompt, route) {
  return `AIFORGE UNIVERSAL CONSTRUCTION MODE\n\nVýrobek: ${route.productLabel} (${route.productType})\nRežim: ${route.isNewConstruction ? "nová konstrukce" : "úprava existující konstrukce"}\n\nVrať VÝHRADNĚ jeden validní JSON objekt proposal. Žádný markdown, žádné vysvětlení před ani za JSONem.\n\nPovinný obal:\n{\n  "intent": "modify_construction",\n  "actions": [],\n  "warnings": [],\n  "questions": []\n}\n\nPravidla:\n- Pracuj produktově neutrálně. Nepoužívej pravidla samonosné brány, pokud uživatel výslovně nepožaduje samonosnou/posuvnou bránu.\n- Každý rovný profil reprezentuj přes add_element/update_element s přesnými start/end souřadnicemi v mm.\n- Souřadnice: x = vodorovně, y = svisle, z = hloubka, pokud je potřeba 3D.\n- lengthMm NEPOSÍLEJ; Adapter jej vždy vypočítá ze start/end.\n- Nevymýšlej chybějící kritické výrobní rozměry. Pokud bez nich nelze bezpečně určit geometrii, vrať questions a actions nech prázdné.\n- Hmotnost, cenu a katalogové údaje neodhaduj. Neznámé hodnoty nech null/unknown.\n- Pro nový výrobek dostáváš prázdný construction; vytvoř jen prvky, které skutečně vyplývají ze zadání.\n- Používej pouze actions: add_element, update_element, delete_element, move_element, update_dimension.\n\nKRITICKÉ PRAVIDLO PRO OPAKOVANÉ PRVKY:\n- NIKDY nevypisuj desítky stejných add_element akcí.\n- Pokud se stejný profil pravidelně opakuje (svislé výplně, latě, příčky, sloupky, rošty apod.), pošli JEDEN template add_element s element.parameters.repeatLinear.\n- repeatLinear má tvar:\n  { "axis": "x", "spacingMm": 110, "fromMm": 110, "toMm": 3090 }\n  nebo { "axis": "x", "spacingMm": 110, "fromMm": 110, "count": 28 }.\n- Template start/end popisuje jeden skutečný opakovaný prvek. Adapter v0.2 jej deterministicky rozmnoží.\n- Maximálně 12 AI actions v jednom proposal. Pokud by bylo potřeba více kvůli opakování, použij repeatLinear.\n\nPříklad kompaktního opakování svislé výplně:\n{\n  "type": "add_element",\n  "temporaryId": "PATTERN01",\n  "element": {\n    "role": "vertical_infill",\n    "name": "Svislá výplň",\n    "profile": {\n      "name": "Jekl 20x20x2",\n      "weightPerMeter": null,\n      "weightSource": "unknown",\n      "pricePerMeter": null,\n      "pricePerKg": null,\n      "priceSource": "unknown"\n    },\n    "start": { "x": 110, "y": 40 },\n    "end": { "x": 110, "y": 960 },\n    "parameters": {\n      "repeatLinear": { "axis": "x", "spacingMm": 110, "fromMm": 110, "toMm": 3090 }\n    },\n    "source": "ai_proposal"\n  }\n}\n\nPožadavek uživatele:\n${String(userPrompt || "").trim()}`;
}

export const AIFORGE_PRODUCT_ROUTER_VERSION = "0.2";
