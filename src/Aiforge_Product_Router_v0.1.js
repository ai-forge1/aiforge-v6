// ============================================================
// AIFORGE v6 — PRODUCT ROUTER v0.1
//
// Rozlišuje specializovanou samonosnou bránu od univerzálních
// zámečnických konstrukcí. Neprovádí geometrii a nic neodhaduje.
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

  // Samonosná / posuvná brána zůstává na ověřeném Gate Geometry Engine.
  if (detected.specialized) {
    return {
      mode: "gate",
      productType: detected.type,
      productLabel: detected.label,
      isNewConstruction: isNew && currentType !== detected.type,
      reason: "specialized_gate_engine"
    };
  }

  // Explicitně rozpoznaný jiný výrobek = univerzální konstrukční engine.
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

  // Pokud už pracujeme v univerzálním projektu, neurčitý příkaz je jeho editace.
  if (currentEngine === "universal") {
    return {
      mode: "universal",
      productType: currentType || "generic",
      productLabel: currentConstruction?.productLabel || "Obecná konstrukce",
      isNewConstruction: false,
      reason: "continue_universal_project"
    };
  }

  // Neznámý nový výrobek nesmí být omylem nacpaný do geometrie brány.
  if (isNew) {
    return {
      mode: "universal",
      productType: "generic",
      productLabel: "Obecná zámečnická konstrukce",
      isNewConstruction: true,
      reason: "unknown_new_construction_safe_fallback"
    };
  }

  // Běžná editace existující brány pokračuje přes Gate Engine.
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
      createdBy: "aiforge_product_router_v0.1",
      geometryMode: "straight_profile_elements",
      units: "mm"
    }
  };
}

export function buildUniversalBrainPrompt(userPrompt, route) {
  return `AIFORGE UNIVERSAL CONSTRUCTION MODE\n\nVýrobek: ${route.productLabel} (${route.productType})\nRežim: ${route.isNewConstruction ? "nová konstrukce" : "úprava existující konstrukce"}\n\nPravidla:\n- Pracuj produktově neutrálně. Nepoužívej pravidla samonosné brány, pokud uživatel výslovně nepožaduje samonosnou/posuvnou bránu.\n- Každý rovný profil reprezentuj jako samostatný prvek přes add_element/update_element s přesnými start/end souřadnicemi v mm.\n- Souřadnice: x = vodorovně, y = svisle, z = hloubka, pokud je potřeba 3D.\n- lengthMm nevymýšlej; vypočítá jej Adapter ze start/end.\n- Nevymýšlej chybějící kritické výrobní rozměry. Pokud bez nich nelze bezpečně určit geometrii, vrať questions a žádné spekulativní prvky.\n- Hmotnost, cenu a katalogové údaje neodhaduj. Neznámé hodnoty nech null/unknown.\n- Používej stejné bezpečné actions: add_element, update_element, delete_element, move_element, update_dimension.\n- Pro nový výrobek dostáváš prázdný construction; vytvoř jen prvky, které skutečně vyplývají ze zadání.\n\nPožadavek uživatele:\n${String(userPrompt || "").trim()}`;
}

export const AIFORGE_PRODUCT_ROUTER_VERSION = "0.1";
