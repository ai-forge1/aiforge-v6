// ============================================================
// AIFORGE v6 — PROJECT PERSISTENCE v0.1
//
// Ukládá pouze construction stav do localStorage prohlížeče.
// Neukládá API klíče, test token ani Worker credentials.
// ============================================================

const STORAGE_KEY = "aiforge:v6:construction:v1";
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

export function loadSavedConstruction() {
  if (!storageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const envelope = JSON.parse(raw);

    if (
      !isPlainObject(envelope) ||
      envelope.schemaVersion !== SCHEMA_VERSION ||
      !isValidConstruction(envelope.construction)
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return envelope.construction;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

export function saveConstruction(construction) {
  if (!storageAvailable()) {
    return { ok: false, error: "localStorage není dostupný." };
  }

  if (!isValidConstruction(construction)) {
    return { ok: false, error: "construction nemá platný základní tvar." };
  }

  try {
    const savedAt = new Date().toISOString();

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        savedAt,
        construction
      })
    );

    return { ok: true, savedAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function clearSavedConstruction() {
  if (!storageAvailable()) return { ok: false };

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function hasSavedConstruction() {
  if (!storageAvailable()) return false;

  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export const AIFORGE_PROJECT_PERSISTENCE_VERSION = "0.1";
