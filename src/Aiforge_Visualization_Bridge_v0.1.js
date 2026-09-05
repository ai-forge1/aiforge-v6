// ============================================================
// AIFORGE — VISUALIZATION BRIDGE v0.1
//
// Builds a presentation-only image brief from approved construction data.
// It never changes construction geometry and never invents missing finish data.
// ============================================================

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function findFinish(construction) {
  const candidates = [
    construction?.visualization?.finish,
    construction?.visualization?.ral,
    construction?.metadata?.finish,
    construction?.metadata?.ral,
    construction?.parameters?.finish,
    construction?.parameters?.ral
  ].filter(Boolean);

  for (const element of construction?.elements || []) {
    candidates.push(
      element?.parameters?.finish,
      element?.parameters?.ral,
      element?.material?.finish,
      element?.material?.ral
    );
  }

  const cleaned = uniq(candidates.map(value => String(value).trim()).filter(Boolean));
  return cleaned.length ? cleaned.join(", ") : null;
}

function deriveBounds(construction) {
  if (construction?.bounds && ["width", "height", "depth"].some(key => finite(construction.bounds[key]))) {
    return {
      width: finite(construction.bounds.width) ? construction.bounds.width : null,
      height: finite(construction.bounds.height) ? construction.bounds.height : null,
      depth: finite(construction.bounds.depth) ? construction.bounds.depth : null,
      source: "construction.bounds"
    };
  }

  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  if (!elements.length) {
    return { width: null, height: null, depth: null, source: "unknown" };
  }

  const points = elements.flatMap(element => [element?.start, element?.end]).filter(Boolean);
  const xs = points.map(point => point?.x).filter(finite);
  const ys = points.map(point => point?.y).filter(finite);
  const zs = points.map(point => point?.z).filter(finite);

  return {
    width: xs.length ? Math.max(...xs) - Math.min(...xs) : null,
    height: ys.length ? Math.max(...ys) - Math.min(...ys) : null,
    depth: zs.length ? Math.max(...zs) - Math.min(...zs) : 0,
    source: "derived_from_elements"
  };
}

function summarizeProfiles(elements) {
  const map = new Map();

  for (const element of elements) {
    const name = element?.profile?.name || "profil neuveden";
    map.set(name, (map.get(name) || 0) + 1);
  }

  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function summarizePatterns(elements) {
  const seen = new Set();
  const result = [];

  for (const element of elements) {
    const params = element?.parameters || {};
    if (params.generatedPattern !== "repeatLinear") continue;
    if (!finite(params.patternSpacingMm)) continue;

    const key = `${element.role || "pattern"}|${params.patternAxis || "?"}|${params.patternSpacingMm}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      role: element.role || "repeated_element",
      axis: params.patternAxis || null,
      spacingMm: params.patternSpacingMm,
      count: finite(params.patternCount) ? params.patternCount : null,
      profile: element?.profile?.name || null
    });
  }

  return result;
}

export function createVisualizationBrief(construction) {
  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const bounds = deriveBounds(construction);
  const finish = findFinish(construction);

  return {
    schema: "aiforge.visualization.brief.v1",
    presentationOnly: true,
    productType: construction?.productType || "generic",
    productLabel: construction?.productLabel || construction?.projectName || "Zámečnická konstrukce",
    dimensionsMm: {
      width: bounds.width,
      height: bounds.height,
      depth: bounds.depth,
      source: bounds.source
    },
    elementCount: elements.length,
    profiles: summarizeProfiles(elements),
    repeatedPatterns: summarizePatterns(elements),
    finish: finish || "UNSPECIFIED",
    geometrySource: "construction.elements[]",
    rules: [
      "Preserve exact overall proportions from dimensionsMm.",
      "Preserve the count and spacing of repeated structural elements.",
      "Do not add structural members that are not present in construction.elements[].",
      "Do not remove structural members that are present in construction.elements[].",
      "Do not invent a RAL color or finish when finish is UNSPECIFIED.",
      "Environment, lighting and landscaping may be visually interpreted but must not alter the product geometry.",
      "This image is presentation-only and must never be used as a source for manufacturing dimensions."
    ]
  };
}

export function buildVisualizationPrompt(construction) {
  const brief = createVisualizationBrief(construction);
  const d = brief.dimensionsMm;
  const dimensionText = [
    finite(d.width) ? `width ${Math.round(d.width)} mm` : null,
    finite(d.height) ? `height ${Math.round(d.height)} mm` : null,
    finite(d.depth) && d.depth > 0 ? `depth ${Math.round(d.depth)} mm` : null
  ].filter(Boolean).join(", ");

  const profiles = brief.profiles
    .map(item => `${item.count}× ${item.name}`)
    .join("; ");

  const patterns = brief.repeatedPatterns
    .map(item => `${item.role}: ${item.profile || "profile"}, spacing ${item.spacingMm} mm${item.count ? `, count ${item.count}` : ""}`)
    .join("; ");

  const finishLine = brief.finish === "UNSPECIFIED"
    ? "Surface finish/color is not specified. Keep a neutral unfinished steel appearance and do not invent a RAL color."
    : `Use exactly this specified finish/color: ${brief.finish}.`;

  return [
    `Create a photorealistic architectural visualization of this exact metalwork product: ${brief.productLabel}.`,
    dimensionText ? `Manufacturing proportions: ${dimensionText}.` : "Use the exact proportions encoded in the supplied construction JSON.",
    profiles ? `Structural profiles/elements: ${profiles}.` : null,
    patterns ? `Repeated elements: ${patterns}.` : null,
    finishLine,
    "Preserve exact structural geometry, member count, spacing and proportions from the approved Aiforge construction model.",
    "Do not invent posts, rails, braces, infill or dimensions.",
    "Show a realistic finished installation in a clean contemporary environment, professional daylight, believable materials and shadows, premium architectural photography, three-quarter view.",
    "The environment is illustrative only. The metal product geometry must remain faithful to the approved model.",
    "This visualization is presentation-only and is never a source for manufacturing measurements."
  ].filter(Boolean).join("\n");
}

export function buildGeminiVisualizationPayload(construction) {
  return {
    brief: createVisualizationBrief(construction),
    prompt: buildVisualizationPrompt(construction),
    construction: {
      productType: construction?.productType || "generic",
      productLabel: construction?.productLabel || null,
      bounds: construction?.bounds || null,
      globalDimensions: construction?.globalDimensions || {},
      elements: Array.isArray(construction?.elements)
        ? construction.elements.map(element => ({
            id: element.id,
            role: element.role,
            name: element.name,
            profile: element.profile?.name || null,
            start: element.start,
            end: element.end,
            lengthMm: element.lengthMm,
            parameters: element.parameters || {}
          }))
        : []
    }
  };
}

export const AIFORGE_VISUALIZATION_BRIDGE_VERSION = "0.1";
