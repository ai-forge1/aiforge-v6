// ============================================================
// AIFORGE v6 — UNIVERSAL TEMPLATE GENERATOR v0.1
//
// Deterministicky převádí ověřený sémantický template spec
// na kanonické Universal add_element actions.
// AI smí určit záměr a parametry; přesné souřadnice vytváří kód.
//
// v0.1 podporuje rack_frame (ocelový regál / stojan):
// - 4 svislé stojky
// - N vodorovných úrovní
// - každá úroveň: přední + zadní podélník + levý + pravý příčník
// - bez plechů/panelů
// ============================================================

const TEMPLATE_VERSION = "rack_frame_v0.1";
const MAX_LEVELS = 50;

function finitePositive(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} musí být číslo > 0.`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} je povinné.`);
  }
  return value.trim();
}

function profile(name) {
  return { name: nonEmptyString(name, "profile.name") };
}

function point(x, y, z) {
  return { x, y, z };
}

function addElement(temporaryId, element) {
  return {
    type: "add_element",
    temporaryId,
    element: {
      ...element,
      source: "template_generator"
    }
  };
}

function repeatedLevelElement({ temporaryId, role, name, profileName, start, end, levelCount, levelSpacingMm, side }) {
  return addElement(temporaryId, {
    role,
    name,
    profile: profile(profileName),
    start,
    end,
    parameters: {
      templateId: TEMPLATE_VERSION,
      templateRole: role,
      templateSide: side,
      repeatLinear: {
        axis: "y",
        spacingMm: levelSpacingMm,
        fromMm: 0,
        count: levelCount
      }
    }
  });
}

export function validateRackFrameSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("rack_frame spec musí být objekt.");
  }

  const widthMm = finitePositive(spec.widthMm, "widthMm");
  const depthMm = finitePositive(spec.depthMm, "depthMm");
  const heightMm = finitePositive(spec.heightMm, "heightMm");

  if (!Number.isInteger(spec.levelCount) || spec.levelCount < 1 || spec.levelCount > MAX_LEVELS) {
    throw new Error(`levelCount musí být celé číslo 1–${MAX_LEVELS}.`);
  }

  const uprightProfileName = nonEmptyString(spec.uprightProfileName, "uprightProfileName");
  const levelProfileName = nonEmptyString(spec.levelProfileName, "levelProfileName");

  return {
    template: "rack_frame",
    widthMm,
    depthMm,
    heightMm,
    levelCount: spec.levelCount,
    uprightProfileName,
    levelProfileName
  };
}

export function generateRackFrameProposal(rawSpec) {
  const spec = validateRackFrameSpec(rawSpec);
  const W = spec.widthMm;
  const D = spec.depthMm;
  const H = spec.heightMm;
  const levelSpacingMm = H / spec.levelCount;

  const actions = [
    addElement("RACK_UPRIGHT_FL", {
      role: "upright",
      name: "Stojka přední levá",
      profile: profile(spec.uprightProfileName),
      start: point(0, 0, 0),
      end: point(0, H, 0),
      parameters: { templateId: TEMPLATE_VERSION, templateRole: "upright", templateCorner: "front_left" }
    }),
    addElement("RACK_UPRIGHT_FR", {
      role: "upright",
      name: "Stojka přední pravá",
      profile: profile(spec.uprightProfileName),
      start: point(W, 0, 0),
      end: point(W, H, 0),
      parameters: { templateId: TEMPLATE_VERSION, templateRole: "upright", templateCorner: "front_right" }
    }),
    addElement("RACK_UPRIGHT_RL", {
      role: "upright",
      name: "Stojka zadní levá",
      profile: profile(spec.uprightProfileName),
      start: point(0, 0, D),
      end: point(0, H, D),
      parameters: { templateId: TEMPLATE_VERSION, templateRole: "upright", templateCorner: "rear_left" }
    }),
    addElement("RACK_UPRIGHT_RR", {
      role: "upright",
      name: "Stojka zadní pravá",
      profile: profile(spec.uprightProfileName),
      start: point(W, 0, D),
      end: point(W, H, D),
      parameters: { templateId: TEMPLATE_VERSION, templateRole: "upright", templateCorner: "rear_right" }
    }),
    repeatedLevelElement({
      temporaryId: "RACK_LEVEL_FRONT",
      role: "front_longitudinal",
      name: "Přední podélník úrovně",
      profileName: spec.levelProfileName,
      start: point(0, 0, 0),
      end: point(W, 0, 0),
      levelCount: spec.levelCount,
      levelSpacingMm,
      side: "front"
    }),
    repeatedLevelElement({
      temporaryId: "RACK_LEVEL_REAR",
      role: "rear_longitudinal",
      name: "Zadní podélník úrovně",
      profileName: spec.levelProfileName,
      start: point(0, 0, D),
      end: point(W, 0, D),
      levelCount: spec.levelCount,
      levelSpacingMm,
      side: "rear"
    }),
    repeatedLevelElement({
      temporaryId: "RACK_LEVEL_LEFT",
      role: "side_crossmember",
      name: "Levý boční příčník úrovně",
      profileName: spec.levelProfileName,
      start: point(0, 0, 0),
      end: point(0, 0, D),
      levelCount: spec.levelCount,
      levelSpacingMm,
      side: "left"
    }),
    repeatedLevelElement({
      temporaryId: "RACK_LEVEL_RIGHT",
      role: "side_crossmember",
      name: "Pravý boční příčník úrovně",
      profileName: spec.levelProfileName,
      start: point(W, 0, 0),
      end: point(W, 0, D),
      levelCount: spec.levelCount,
      levelSpacingMm,
      side: "right"
    })
  ];

  return {
    intent: "modify_construction",
    actions,
    warnings: [],
    questions: [],
    template: {
      id: TEMPLATE_VERSION,
      productType: "rack",
      dimensions: {
        overallWidth: W,
        overallHeight: H,
        overallDepth: D
      },
      levelCount: spec.levelCount,
      levelSpacingMm,
      expectedExpandedElementCount: 4 + spec.levelCount * 4
    }
  };
}

export function generateUniversalTemplateProposal(templateName, spec) {
  if (templateName === "rack_frame") {
    return generateRackFrameProposal(spec);
  }
  throw new Error(`Nepodporovaný Universal template: ${String(templateName || "")}`);
}

export const AIFORGE_UNIVERSAL_TEMPLATE_GENERATOR_VERSION = "0.1";
