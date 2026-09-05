// ============================================================
// AIFORGE v6.0 — CANTILEVER GATE GEOMETRY ENGINE v0.1
//
// Deterministická vazba:
// globalDimensions -> canonical gate elements[].start/end
//
// CORE source se NEMĚNÍ.
// Engine nikdy nevymýšlí profily, hmotnosti ani ceny.
// ============================================================

const CANONICAL_ROLES = new Set([
  "bottom_c_profile",
  "opening_upper_rail",
  "leading_post",
  "main_dividing_post",
  "counterweight_end_post",
  "counterweight_upper_diagonal",
  "main_diagonal_brace"
]);

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function finiteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function calculateLengthMm(start, end) {
  return Math.round(Math.hypot(end.x - start.x, end.y - start.y));
}

function findByRole(construction, role) {
  return construction.elements.find(el => el?.role === role) || null;
}

function inferCounterweightSource(construction) {
  const explicit = construction?.globalDimensions?.counterweightGeometry?.source;
  if (explicit === "userProvided" || explicit === "default_estimate") {
    return explicit;
  }

  const g = construction?.globalDimensions || {};
  if (finiteNumber(g.openingWidth) && finiteNumber(g.counterweightLength)) {
    const estimated = Math.round(g.openingWidth * 0.4);
    return g.counterweightLength === estimated ? "default_estimate" : "userProvided";
  }

  return "unknown";
}

function ensureNoUnsupportedGeometry(construction) {
  const unsupported = (construction.elements || []).filter(el => {
    if (!el?.role) return true;
    if (CANONICAL_ROLES.has(el.role)) return false;
    return true;
  });

  if (unsupported.length) {
    const ids = unsupported.map(el => `${el?.id || "?"}:${el?.role || "?"}`).join(", ");
    throw new Error(
      `Změna hlavních rozměrů je zablokována: konstrukce obsahuje prvky mimo základní gate geometry (${ids}). Je potřeba jejich vlastní geometry modul.`
    );
  }
}

function normalizeAllLengths(construction) {
  for (const el of construction.elements || []) {
    if (
      isPlainObject(el.start) &&
      isPlainObject(el.end) &&
      finiteNumber(el.start.x) &&
      finiteNumber(el.start.y) &&
      finiteNumber(el.end.x) &&
      finiteNumber(el.end.y)
    ) {
      const length = calculateLengthMm(el.start, el.end);
      if (length <= 0) {
        throw new Error(`Prvek ${el.id}: po přepočtu vznikla nulová/neplatná délka.`);
      }
      el.lengthMm = length;
    }
  }
}

function setPoint(element, point, x, y) {
  if (!element) return;
  element[point] = { x, y };
}

function updateMetadata(construction, source) {
  const g = construction.globalDimensions;
  const rearPostHeight = Math.round(g.frameHeight * 0.6);

  g.totalLength = g.openingWidth + g.counterweightLength;

  g.counterweightGeometry = {
    ...(isPlainObject(g.counterweightGeometry) ? g.counterweightGeometry : {}),
    length: g.counterweightLength,
    rearPostHeight,
    upperConnectionPoint: {
      x: g.counterweightLength,
      y: g.frameHeight
    },
    source
  };

  g.counterweightGeometry.rearPostHeightSource = "default_estimate";

  construction.projectName =
    `Samonosná brána ${g.openingWidth}×${g.frameHeight}`;
}

function rebuildCanonicalGeometry(construction, counterweightSource) {
  const g = construction.globalDimensions;

  if (
    !finiteNumber(g.openingWidth) ||
    !finiteNumber(g.frameHeight) ||
    !finiteNumber(g.counterweightLength) ||
    g.openingWidth <= 0 ||
    g.frameHeight <= 0 ||
    g.counterweightLength <= 0
  ) {
    throw new Error("Gate geometry: neplatné hlavní rozměry.");
  }

  const cw = g.counterweightLength;
  const h = g.frameHeight;
  const total = g.openingWidth + cw;
  const rearH = Math.round(h * 0.6);

  const p01 = findByRole(construction, "bottom_c_profile");
  const p02 = findByRole(construction, "opening_upper_rail");
  const p03 = findByRole(construction, "leading_post");
  const p04 = findByRole(construction, "main_dividing_post");
  const p05 = findByRole(construction, "counterweight_end_post");
  const p06 = findByRole(construction, "counterweight_upper_diagonal");
  const p07 = findByRole(construction, "main_diagonal_brace");

  setPoint(p01, "start", 0, 0);
  setPoint(p01, "end", total, 0);

  setPoint(p02, "start", cw, h);
  setPoint(p02, "end", total, h);

  setPoint(p03, "start", total, 0);
  setPoint(p03, "end", total, h);

  setPoint(p04, "start", cw, 0);
  setPoint(p04, "end", cw, h);

  setPoint(p05, "start", 0, 0);
  setPoint(p05, "end", 0, rearH);

  setPoint(p06, "start", 0, rearH);
  setPoint(p06, "end", cw, h);

  setPoint(p07, "start", 0, 0);
  setPoint(p07, "end", cw, h);

  for (const el of [p05, p06, p07]) {
    if (!el) continue;
    el.parameters = {
      ...(isPlainObject(el.parameters) ? el.parameters : {}),
      counterweightGeometrySource: counterweightSource
    };
  }

  updateMetadata(construction, counterweightSource);
  normalizeAllLengths(construction);
}

export function applyGateDimensionChange(construction, field, value) {
  if (!isPlainObject(construction)) {
    throw new Error("Gate geometry: construction musí být objekt.");
  }

  ensureNoUnsupportedGeometry(construction);

  const g = construction.globalDimensions;
  if (!isPlainObject(g)) {
    throw new Error("Gate geometry: globalDimensions chybí.");
  }

  if (!finiteNumber(value) || value <= 0) {
    throw new Error(`Gate geometry ${field}: hodnota musí být > 0.`);
  }

  if (field === "totalLength") {
    throw new Error(
      "totalLength je odvozená hodnota. Změň openingWidth nebo counterweightLength."
    );
  }

  let cwSource = inferCounterweightSource(construction);

  switch (field) {
    case "openingWidth":
      g.openingWidth = value;

      if (cwSource === "default_estimate") {
        g.counterweightLength = Math.round(value * 0.4);
      } else if (!finiteNumber(g.counterweightLength) || g.counterweightLength <= 0) {
        throw new Error(
          "Nelze změnit openingWidth: protiváha nemá platnou délku ani bezpečně rozpoznaný default."
        );
      }
      break;

    case "frameHeight":
      g.frameHeight = value;
      break;

    case "counterweightLength":
      g.counterweightLength = value;
      cwSource = "userProvided";
      break;

    default:
      throw new Error(`Gate geometry: nepodporované dimension pole "${field}".`);
  }

  rebuildCanonicalGeometry(construction, cwSource);

  return {
    openingWidth: g.openingWidth,
    frameHeight: g.frameHeight,
    counterweightLength: g.counterweightLength,
    totalLength: g.totalLength,
    counterweightSource: cwSource
  };
}

export const AIFORGE_GATE_GEOMETRY_ENGINE_VERSION = "0.1";
