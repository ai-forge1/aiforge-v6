import assert from "node:assert/strict";
import {
  routeConstructionPrompt,
  createUniversalConstructionBase,
  buildUniversalBrainPrompt
} from "../src/Aiforge_Product_Router_v0.1.js";
import {
  applyUniversalApprovedActions,
  expandUniversalPatternActions
} from "../src/Aiforge_Universal_Action_Adapter_v0.2.js";
import {
  buildUniversalDimensions
} from "../src/Aiforge_Universal_Dimension_Engine_v0.1.js";
import {
  theoreticalWeightPerMeter,
  calculateUniversalCost
} from "../src/Aiforge_Universal_Cost_Engine_v0.1.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS — ${name}`);
  } catch (error) {
    console.error(`FAIL — ${name}`);
    throw error;
  }
}

const gate = {
  globalDimensions: { openingWidth: 5900, frameHeight: 1600, counterweightLength: 2500, totalLength: 8400 },
  elements: [{ id: "P01" }]
};

function makeRailing() {
  const base = createUniversalConstructionBase("railing", "Zábradlí");
  const frame = { name: "Jekl 40x40x2" };
  const infill = { name: "Jekl 20x20x2" };
  const actions = [
    { type: "add_element", element: { role: "bottom_rail", profile: frame, start: { x: 0, y: 0 }, end: { x: 3200, y: 0 } } },
    { type: "add_element", element: { role: "top_rail", profile: frame, start: { x: 0, y: 1000 }, end: { x: 3200, y: 1000 } } },
    { type: "add_element", element: { role: "left_post", profile: frame, start: { x: 0, y: 0 }, end: { x: 0, y: 1000 } } },
    { type: "add_element", element: { role: "right_post", profile: frame, start: { x: 3200, y: 0 }, end: { x: 3200, y: 1000 } } },
    {
      type: "add_element",
      temporaryId: "PATTERN01",
      element: {
        role: "vertical_infill",
        profile: infill,
        start: { x: 110, y: 40 },
        end: { x: 110, y: 960 },
        parameters: { repeatLinear: { axis: "x", spacingMm: 110, fromMm: 110, toMm: 3090 } }
      }
    }
  ];
  return applyUniversalApprovedActions(base, actions);
}

test("router sends railing to universal engine", () => {
  const r = routeConstructionPrompt("Udělej zábradlí 3200 x 1000 mm", gate);
  assert.equal(r.mode, "universal");
  assert.equal(r.productType, "railing");
  assert.equal(r.isNewConstruction, true);
});

test("router keeps sliding gate on specialized engine", () => {
  const r = routeConstructionPrompt("Udělej samonosnou bránu 5900 x 1600", gate);
  assert.equal(r.mode, "gate");
  assert.equal(r.productType, "sliding_gate");
});

test("unknown new construction uses safe universal fallback", () => {
  const r = routeConstructionPrompt("Vytvoř držák motoru z jeklu", gate);
  assert.equal(r.mode, "universal");
  assert.equal(r.productType, "generic");
});

test("Universal Brain prompt requires compact repeatLinear", () => {
  const route = routeConstructionPrompt("Udělej zábradlí", gate);
  const p = buildUniversalBrainPrompt("Udělej zábradlí", route);
  assert.match(p, /repeatLinear/);
  assert.match(p, /Maximálně 12 AI actions/);
  assert.match(p, /Vrať VÝHRADNĚ jeden validní JSON objekt/);
});

test("universal frame creates exact bounds", () => {
  const base = createUniversalConstructionBase("railing", "Zábradlí");
  const profile = { name: "Jekl 40x40x2" };
  const actions = [
    { type: "add_element", element: { role: "bottom_rail", profile, start: { x: 0, y: 0 }, end: { x: 3200, y: 0 } } },
    { type: "add_element", element: { role: "top_rail", profile, start: { x: 0, y: 1000 }, end: { x: 3200, y: 1000 } } },
    { type: "add_element", element: { role: "left_post", profile, start: { x: 0, y: 0 }, end: { x: 0, y: 1000 } } },
    { type: "add_element", element: { role: "right_post", profile, start: { x: 3200, y: 0 }, end: { x: 3200, y: 1000 } } }
  ];
  const result = applyUniversalApprovedActions(base, actions);
  assert.equal(result.ok, true);
  assert.equal(result.construction.bounds.width, 3200);
  assert.equal(result.construction.bounds.height, 1000);
  assert.equal(result.construction.elements[0].lengthMm, 3200);
  assert.equal(result.construction.elements[2].lengthMm, 1000);
});

test("repeatLinear expands one AI action deterministically", () => {
  const actions = [{
    type: "add_element",
    temporaryId: "PATTERN01",
    element: {
      role: "vertical_infill",
      name: "Svislá výplň",
      profile: { name: "Jekl 20x20x2" },
      start: { x: 110, y: 40 },
      end: { x: 110, y: 960 },
      parameters: {
        repeatLinear: { axis: "x", spacingMm: 110, fromMm: 110, toMm: 3090 }
      }
    }
  }];

  const expanded = expandUniversalPatternActions(actions);
  assert.equal(expanded.length, 28);
  assert.equal(expanded[0].element.start.x, 110);
  assert.equal(expanded.at(-1).element.start.x, 3080);
  assert.equal(expanded[0].element.end.y, 960);
  assert.equal(expanded[0].element.parameters.repeatLinear, undefined);
});

test("railing frame plus pattern builds many elements from compact actions", () => {
  const result = makeRailing();
  assert.equal(result.ok, true);
  assert.equal(result.inputActionCount, 5);
  assert.equal(result.expandedActionCount, 32);
  assert.equal(result.construction.elements.length, 32);
  assert.equal(result.construction.bounds.width, 3200);
  assert.equal(result.construction.bounds.height, 1000);
  assert.equal(result.construction.elements[4].lengthMm, 920);
});

test("dimension engine creates overall width and height", () => {
  const result = makeRailing();
  const dimensions = buildUniversalDimensions(result.construction, "XY");
  const width = dimensions.dimensions.find(d => d.id === "overall-horizontal");
  const height = dimensions.dimensions.find(d => d.id === "overall-vertical");
  assert.equal(width.valueMm, 3200);
  assert.equal(height.valueMm, 1000);
});

test("dimension engine finds repeated 110 mm spacing", () => {
  const result = makeRailing();
  const dimensions = buildUniversalDimensions(result.construction, "XY");
  const spacing = dimensions.dimensions.find(d => d.source === "generated_pattern");
  assert.equal(spacing.valueMm, 110);
  assert.match(spacing.label, /110 mm/);
});

test("JEKL theoretical kg/m is deterministic and labeled", () => {
  const weight = theoreticalWeightPerMeter("Jekl 40x40x2");
  assert.equal(weight.kgPerMeter, 2.386);
  assert.equal(weight.source, "calculated_theoretical");
  assert.equal(theoreticalWeightPerMeter("C profil 80x80x5"), null);
});

test("cost engine calculates material labor and margin from user settings", () => {
  const base = createUniversalConstructionBase("frame", "Rám");
  const built = applyUniversalApprovedActions(base, [{
    type: "add_element",
    element: {
      role: "rail",
      profile: { name: "Jekl 40x40x2" },
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 }
    }
  }]);
  const cost = calculateUniversalCost(built.construction, {
    steelPricePerKg: 30,
    hourlyRate: 500,
    laborHours: 2,
    marginPercent: 10
  });
  assert.equal(cost.complete, true);
  assert.equal(cost.totals.materialCost, 71.58);
  assert.equal(cost.totals.laborCost, 1000);
  assert.equal(cost.totals.salePrice, 1178.74);
});

test("3D length is deterministic", () => {
  const base = createUniversalConstructionBase("generic", "3D test");
  const result = applyUniversalApprovedActions(base, [{
    type: "add_element",
    element: {
      role: "brace",
      profile: { name: "Jekl 40x40x2" },
      start: { x: 0, y: 0, z: 0 },
      end: { x: 3000, y: 4000, z: 12000 }
    }
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.construction.elements[0].lengthMm, 13000);
  assert.equal(result.construction.bounds.depth, 12000);
});

test("profile change clears stale weight and price", () => {
  const base = createUniversalConstructionBase("frame", "Rám");
  let result = applyUniversalApprovedActions(base, [{
    type: "add_element",
    element: {
      role: "rail",
      profile: {
        name: "Jekl 40x20x2",
        weightPerMeter: 1.727,
        weightSource: "catalog_verified",
        pricePerMeter: 100,
        priceSource: "userProvided"
      },
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 }
    }
  }]);
  assert.equal(result.ok, true);

  result = applyUniversalApprovedActions(result.construction, [{
    type: "update_element",
    id: "P01",
    changes: {
      "profile.name": { before: "Jekl 40x20x2", after: "Jekl 60x40x2" }
    }
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.construction.elements[0].profile.weightPerMeter, null);
  assert.equal(result.construction.elements[0].profile.pricePerMeter, null);
  assert.equal(result.construction.elements[0].profile.weightSource, "unknown");
});

test("invalid action is atomic", () => {
  const base = createUniversalConstructionBase("frame", "Rám");
  const good = {
    type: "add_element",
    element: { role: "rail", profile: { name: "Jekl" }, start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }
  };
  const bad = { type: "explode_everything" };
  const result = applyUniversalApprovedActions(base, [good, bad]);
  assert.equal(result.ok, false);
  assert.equal(base.elements.length, 0);
  assert.equal(result.construction, base);
});

test("generic dimensions accept safe named mm fields", () => {
  const base = createUniversalConstructionBase("stairs", "Schody");
  const result = applyUniversalApprovedActions(base, [
    { type: "update_dimension", field: "rise", value: 180, unit: "mm" },
    { type: "add_element", element: { role: "stringer", profile: { name: "Jekl" }, start: { x: 0, y: 0 }, end: { x: 1000, y: 1000 } } }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.construction.globalDimensions.rise, 180);
});

console.log(`\n${passed}/15 Universal Engine tests PASS`);
