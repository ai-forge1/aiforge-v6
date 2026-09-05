// ============================================================
// AIFORGE v6 — PROJECT PERSISTENCE v0.2
//
// Ukládá pouze construction data do localStorage.
// Neukládá Worker token, NVIDIA klíč ani jiné credentials.
// Navíc drží poslední gate construction jako bezpečný základ
// pro přepnutí z univerzálního výrobku zpět na bránu.
// ============================================================

const PROJECT_KEY = "aiforge:v6:construction:v1";
const GATE_TEMPLATE_KEY = "aiforge:v6:gate-template:v1";
const SCHEMA_VERSION = 1;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidConstruction(construction) {
  return (
    isPlainObject(construction) &&
    isPlainObject(construction.globalDimensions) &&
    Array.isArray(construction.elements)
  );
}

function storageAvailable() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readEnvelope(key) {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (
      !isPlainObject(envelope) ||
      envelope.schemaVersion !== SCHEMA_VERSION ||
      !isValidConstruction(envelope.construction)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return envelope.construction;
  } catch {
    try { window.localStorage.removeItem(key); } catch {}
    return null;
  }
}

function writeEnvelope(key, construction) {
  if (!storageAvailable()) {
    return { ok: false, error: "localStorage není dostupný." };
  }
  if (!isValidConstruction(construction)) {
    return { ok: false, error: "construction nemá platný základní tvar." };
  }
  try {
    const savedAt = new Date().toISOString();
    window.localStorage.setItem(
      key,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt, construction })
    );
    return { ok: true, savedAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function loadSavedConstruction() {
  return readEnvelope(PROJECT_KEY);
}

export function saveConstruction(construction) {
  return writeEnvelope(PROJECT_KEY, construction);
}

export function loadSavedGateTemplate() {
  const construction = readEnvelope(GATE_TEMPLATE_KEY);
  if (construction?.engine === "universal") return null;
  return construction;
}

export function saveGateTemplate(construction) {
  if (!isValidConstruction(construction) || construction?.engine === "universal") {
    return { ok: false, error: "Gate template musí být gate construction." };
  }
  return writeEnvelope(GATE_TEMPLATE_KEY, construction);
}

export function clearSavedConstruction() {
  if (!storageAvailable()) return { ok: false };
  try {
    window.localStorage.removeItem(PROJECT_KEY);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function hasSavedConstruction() {
  if (!storageAvailable()) return false;
  try {
    return !!window.localStorage.getItem(PROJECT_KEY);
  } catch {
    return false;
  }
}

export const AIFORGE_PROJECT_PERSISTENCE_VERSION = "0.2";
