// ============================================================
// AIFORGE v6 — UNIVERSAL COST ENGINE v0.1
//
// Deterministická kalkulace bez AI odhadů cen.
// Umí:
// - délky po profilech
// - ověřenou nebo teoretickou kg/m pro JEKL/RHS/SHS
// - hmotnost
// - materiál Kč/m nebo Kč/kg
// - práce, zinek, lak, hardware, doprava, ostatní
// - marži a výslednou cenu
//
// Teoretická kg/m je vždy výslovně označena jako calculated_theoretical.
// ============================================================

const STEEL_DENSITY_KG_M3 = 7850;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, digits = 2) {
  if (!finite(value)) return null;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function parsePositive(value) {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return finite(n) && n >= 0 ? n : null;
}

export function parseRectangularHollowProfile(profileName) {
  const text = String(profileName || "").trim();
  if (!/\b(jekl|rhs|shs)\b/i.test(text)) return null;

  const match = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;

  const widthMm = Number(match[1].replace(",", "."));
  const heightMm = Number(match[2].replace(",", "."));
  const wallMm = Number(match[3].replace(",", "."));

  if (![widthMm, heightMm, wallMm].every(v => finite(v) && v > 0)) return null;
  if (wallMm * 2 >= Math.min(widthMm, heightMm)) return null;

  return { widthMm, heightMm, wallMm, type: "rectangular_hollow" };
}

export function theoreticalWeightPerMeter(profileName) {
  const parsed = parseRectangularHollowProfile(profileName);
  if (!parsed) return null;

  const { widthMm, heightMm, wallMm } = parsed;
  const outerAreaMm2 = widthMm * heightMm;
  const innerAreaMm2 = (widthMm - 2 * wallMm) * (heightMm - 2 * wallMm);
  const steelAreaMm2 = outerAreaMm2 - innerAreaMm2;

  // 1 mm² × 1 m = 1e-6 m³.
  const kgPerMeter = steelAreaMm2 * 1e-6 * STEEL_DENSITY_KG_M3;

  return {
    kgPerMeter: round(kgPerMeter, 3),
    source: "calculated_theoretical",
    note: "Teoretická hmotnost z vnějších rozměrů a tloušťky stěny; nezohledňuje rádiusy rohů a výrobní tolerance."
  };
}

export function resolveWeightPerMeter(element) {
  const profile = element?.profile || {};

  if (finite(profile.weightPerMeter) && profile.weightPerMeter > 0) {
    return {
      kgPerMeter: profile.weightPerMeter,
      source: profile.weightSource || "provided"
    };
  }

  return theoreticalWeightPerMeter(profile.name);
}

export function elementMassKg(element) {
  if (!finite(element?.lengthMm) || element.lengthMm <= 0) return null;
  const weight = resolveWeightPerMeter(element);
  if (!weight) return null;

  return {
    massKg: round((element.lengthMm / 1000) * weight.kgPerMeter, 3),
    kgPerMeter: weight.kgPerMeter,
    weightSource: weight.source,
    note: weight.note || null
  };
}

function elementOuterSurfaceM2(element) {
  const parsed = parseRectangularHollowProfile(element?.profile?.name);
  if (!parsed || !finite(element?.lengthMm)) return null;

  const perimeterM = 2 * (parsed.widthMm + parsed.heightMm) / 1000;
  const lengthM = element.lengthMm / 1000;
  return round(perimeterM * lengthM, 4);
}

function resolveElementMaterialCost(element, settings) {
  const lengthM = finite(element?.lengthMm) ? element.lengthMm / 1000 : null;
  if (!finite(lengthM)) return null;

  const profile = element?.profile || {};

  if (finite(profile.pricePerMeter) && profile.pricePerMeter >= 0) {
    return {
      cost: round(lengthM * profile.pricePerMeter, 2),
      source: profile.priceSource || "profile_price_per_meter"
    };
  }

  const mass = elementMassKg(element);

  if (mass && finite(profile.pricePerKg) && profile.pricePerKg >= 0) {
    return {
      cost: round(mass.massKg * profile.pricePerKg, 2),
      source: profile.priceSource || "profile_price_per_kg"
    };
  }

  if (mass && finite(settings.steelPricePerKg) && settings.steelPricePerKg >= 0) {
    return {
      cost: round(mass.massKg * settings.steelPricePerKg, 2),
      source: "global_steel_price_per_kg"
    };
  }

  return null;
}

function groupProfiles(elements) {
  const map = new Map();

  for (const element of elements) {
    const profileName = element?.profile?.name || "Neznámý profil";
    const current = map.get(profileName) || {
      profileName,
      count: 0,
      totalLengthMm: 0,
      massKg: 0,
      massKnownCount: 0,
      theoreticalCount: 0,
      materialCost: 0,
      priceKnownCount: 0
    };

    current.count += 1;
    if (finite(element?.lengthMm)) current.totalLengthMm += element.lengthMm;

    const mass = elementMassKg(element);
    if (mass) {
      current.massKg += mass.massKg;
      current.massKnownCount += 1;
      if (mass.weightSource === "calculated_theoretical") current.theoreticalCount += 1;
    }

    map.set(profileName, current);
  }

  return [...map.values()].map(group => ({
    ...group,
    totalLengthM: round(group.totalLengthMm / 1000, 3),
    massKg: round(group.massKg, 3)
  }));
}

export function normalizeCostSettings(raw = {}) {
  const fields = [
    "steelPricePerKg",
    "hourlyRate",
    "laborHours",
    "zincPricePerKg",
    "powderPricePerM2",
    "hardwareCost",
    "transportCost",
    "otherCost",
    "marginPercent"
  ];

  const result = {};
  for (const field of fields) {
    result[field] = parsePositive(raw?.[field]);
  }
  return result;
}

export function calculateUniversalCost(construction, rawSettings = null) {
  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const settings = normalizeCostSettings(rawSettings || construction?.costSettings || {});

  let totalMassKg = 0;
  let massKnownCount = 0;
  let theoreticalMassCount = 0;
  let totalSurfaceM2 = 0;
  let surfaceKnownCount = 0;
  let materialCost = 0;
  let materialPriceKnownCount = 0;

  for (const element of elements) {
    const mass = elementMassKg(element);
    if (mass) {
      totalMassKg += mass.massKg;
      massKnownCount += 1;
      if (mass.weightSource === "calculated_theoretical") theoreticalMassCount += 1;
    }

    const surface = elementOuterSurfaceM2(element);
    if (surface != null) {
      totalSurfaceM2 += surface;
      surfaceKnownCount += 1;
    }

    const material = resolveElementMaterialCost(element, settings);
    if (material) {
      materialCost += material.cost;
      materialPriceKnownCount += 1;
    }
  }

  const laborCost =
    finite(settings.hourlyRate) && finite(settings.laborHours)
      ? round(settings.hourlyRate * settings.laborHours, 2)
      : null;

  const zincCost =
    finite(settings.zincPricePerKg) && massKnownCount === elements.length && elements.length > 0
      ? round(totalMassKg * settings.zincPricePerKg, 2)
      : settings.zincPricePerKg == null ? 0 : null;

  const powderCost =
    finite(settings.powderPricePerM2) && surfaceKnownCount === elements.length && elements.length > 0
      ? round(totalSurfaceM2 * settings.powderPricePerM2, 2)
      : settings.powderPricePerM2 == null ? 0 : null;

  const fixedCosts = ["hardwareCost", "transportCost", "otherCost"].reduce(
    (sum, key) => sum + (finite(settings[key]) ? settings[key] : 0),
    0
  );

  const missing = [];
  if (elements.length && materialPriceKnownCount !== elements.length) {
    missing.push("Cena materiálu není známá pro všechny prvky. Zadej Kč/kg nebo Kč/m.");
  }
  if ((settings.hourlyRate != null) !== (settings.laborHours != null)) {
    missing.push("Pro cenu práce musí být zadaná hodinová sazba i počet hodin.");
  }
  if (settings.zincPricePerKg != null && zincCost == null) {
    missing.push("Zinek nelze dopočítat, protože není známá hmotnost všech prvků.");
  }
  if (settings.powderPricePerM2 != null && powderCost == null) {
    missing.push("Lak nelze dopočítat, protože není známá plocha všech profilů.");
  }

  const materialComplete = elements.length === 0 || materialPriceKnownCount === elements.length;
  const laborComplete = !((settings.hourlyRate != null) !== (settings.laborHours != null));
  const zincComplete = settings.zincPricePerKg == null || zincCost != null;
  const powderComplete = settings.powderPricePerM2 == null || powderCost != null;
  const complete = materialComplete && laborComplete && zincComplete && powderComplete;

  const subtotal = complete
    ? round(
        materialCost +
        (laborCost || 0) +
        (zincCost || 0) +
        (powderCost || 0) +
        fixedCosts,
        2
      )
    : null;

  const marginAmount =
    subtotal != null && finite(settings.marginPercent)
      ? round(subtotal * settings.marginPercent / 100, 2)
      : subtotal != null ? 0 : null;

  const salePrice = subtotal != null
    ? round(subtotal + (marginAmount || 0), 2)
    : null;

  return {
    complete,
    missing,
    settings,
    totals: {
      elements: elements.length,
      totalLengthM: round(elements.reduce((sum, el) => sum + (finite(el?.lengthMm) ? el.lengthMm : 0), 0) / 1000, 3),
      totalMassKg: massKnownCount ? round(totalMassKg, 3) : null,
      massKnownCount,
      theoreticalMassCount,
      totalSurfaceM2: surfaceKnownCount ? round(totalSurfaceM2, 3) : null,
      surfaceKnownCount,
      materialCost: materialPriceKnownCount ? round(materialCost, 2) : null,
      materialPriceKnownCount,
      laborCost,
      zincCost,
      powderCost,
      hardwareCost: settings.hardwareCost || 0,
      transportCost: settings.transportCost || 0,
      otherCost: settings.otherCost || 0,
      subtotal,
      marginAmount,
      salePrice
    },
    profileGroups: groupProfiles(elements)
  };
}

export const AIFORGE_UNIVERSAL_COST_ENGINE_VERSION = "0.1";
