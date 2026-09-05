// ============================================================
// AIFORGE v6 — PROFILE CATALOG v0.1
//
// Lokální ceník profilů mimo Frozen CORE.
// Uživatel zadá cenu/hmotnost jednou; katalog ji pak může
// deterministicky doplnit do matching construction.elements[].
//
// Nic se nestahuje z internetu a žádná cena/hmotnost se nehádá.
// ============================================================

const STORAGE_KEY = "aiforge:v6:profile-catalog:v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeProfileCatalogKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[×✕]/g, "x")
    .replace(/\s+/g, " ")
    .replace(/\s*x\s*/g, "x");
}

export function loadProfileCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function saveProfileCatalog(catalog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog || {}));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function getProfileCatalogEntry(profileName) {
  const key = normalizeProfileCatalogKey(profileName);
  if (!key) return null;
  const catalog = loadProfileCatalog();
  return catalog[key] || null;
}

export function upsertProfileCatalogEntry(profileName, values = {}) {
  const name = String(profileName || "").trim();
  const key = normalizeProfileCatalogKey(name);
  if (!key) {
    return { ok: false, error: "Název profilu je povinný." };
  }

  const catalog = loadProfileCatalog();
  const previous = catalog[key] || {};

  const next = {
    ...previous,
    key,
    name,
    updatedAt: new Date().toISOString(),
    source: "userProvided"
  };

  if (values.pricePerMeter === null || finite(values.pricePerMeter)) {
    next.pricePerMeter = values.pricePerMeter;
  }
  if (values.pricePerKg === null || finite(values.pricePerKg)) {
    next.pricePerKg = values.pricePerKg;
  }
  if (values.weightPerMeter === null || finite(values.weightPerMeter)) {
    next.weightPerMeter = values.weightPerMeter;
  }

  catalog[key] = next;
  const saved = saveProfileCatalog(catalog);
  if (!saved.ok) return saved;

  return { ok: true, entry: next, catalog };
}

export function listConstructionProfileNames(construction) {
  const names = [];
  const seen = new Set();

  for (const element of construction?.elements || []) {
    const name = String(element?.profile?.name || "").trim();
    const key = normalizeProfileCatalogKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names.sort((a, b) => a.localeCompare(b, "cs"));
}

export function applyProfileCatalogToConstruction(construction, profileName = null) {
  if (!construction || typeof construction !== "object") {
    return { ok: false, error: "Construction chybí.", construction };
  }

  const draft = clone(construction);
  const catalog = loadProfileCatalog();
  const wantedKey = profileName ? normalizeProfileCatalogKey(profileName) : null;
  let updatedElements = 0;

  for (const element of draft.elements || []) {
    const name = String(element?.profile?.name || "").trim();
    const key = normalizeProfileCatalogKey(name);
    if (!key || (wantedKey && key !== wantedKey)) continue;

    const entry = catalog[key];
    if (!entry) continue;

    element.profile = element.profile && typeof element.profile === "object"
      ? element.profile
      : { name };

    let changed = false;

    if (finite(entry.weightPerMeter) && entry.weightPerMeter > 0) {
      element.profile.weightPerMeter = entry.weightPerMeter;
      element.profile.weightSource = "userProvided";
      changed = true;
    }

    if (finite(entry.pricePerMeter) && entry.pricePerMeter >= 0) {
      element.profile.pricePerMeter = entry.pricePerMeter;
      element.profile.priceSource = "userProvided";
      changed = true;
    }

    if (finite(entry.pricePerKg) && entry.pricePerKg >= 0) {
      element.profile.pricePerKg = entry.pricePerKg;
      element.profile.priceSource = "userProvided";
      changed = true;
    }

    if (changed) updatedElements += 1;
  }

  return { ok: true, construction: draft, updatedElements };
}

export const AIFORGE_PROFILE_CATALOG_VERSION = "0.1";
