import React, { useMemo, useState } from "react";
import {
  buildUniversalDimensions,
  getProjectionBounds
} from "./Aiforge_Universal_Dimension_Engine_v0.1.js";
import {
  calculateUniversalCost,
  elementMassKg
} from "./Aiforge_Universal_Cost_Engine_v0.1.js";

// ============================================================
// AIFORGE v6 — UNIVERSAL WORKSPACE v0.2
// Geometry + výrobní kóty + řezný list + kalkulace + JSON.
// ============================================================

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function projectPoint(point, plane) {
  const x = finite(point?.x) ? point.x : 0;
  const y = finite(point?.y) ? point.y : 0;
  const z = finite(point?.z) ? point.z : 0;
  if (plane === "XZ") return { x, y: z };
  if (plane === "YZ") return { x: y, y: z };
  return { x, y };
}

function fmt(value, digits = 0) {
  return finite(value)
    ? value.toLocaleString("cs-CZ", { maximumFractionDigits: digits })
    : "—";
}

function DimensionCard({ label, value, suffix = "mm" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{label}</div>
      <div className="text-lg font-bold text-white">
        {fmt(value)} <span className="text-xs font-normal text-slate-500">{suffix}</span>
      </div>
    </div>
  );
}

function CostInput({ label, value, unit, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <div className="flex rounded-lg border border-slate-700 bg-slate-950 overflow-hidden focus-within:border-orange-500">
        <input
          type="number"
          min="0"
          step="any"
          value={value ?? ""}
          placeholder={placeholder || "0"}
          onChange={event => onChange(event.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm outline-none min-w-0"
        />
        <span className="px-2 py-2 text-xs text-slate-500 bg-slate-900 whitespace-nowrap">{unit}</span>
      </div>
    </label>
  );
}

function DimensionLayer({ dimensionData, fontSize }) {
  const dimensions = dimensionData?.dimensions || [];
  if (!dimensions.length) return null;

  const arrowSize = Math.max(25, fontSize * 0.8);

  return (
    <>
      <defs>
        <marker id="aiforge-dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
        </marker>
      </defs>

      <g transform="scale(1,-1)" fill="none" stroke="#f97316" strokeWidth={Math.max(4, fontSize / 10)}>
        {dimensions.map(dim => {
          if (dim.kind === "horizontal") {
            return (
              <g key={dim.id}>
                <line x1={dim.x1} y1={dim.extensionY1} x2={dim.x1} y2={dim.y} strokeDasharray={`${arrowSize} ${arrowSize * 0.55}`} />
                <line x1={dim.x2} y1={dim.extensionY1} x2={dim.x2} y2={dim.y} strokeDasharray={`${arrowSize} ${arrowSize * 0.55}`} />
                <line x1={dim.x1} y1={dim.y} x2={dim.x2} y2={dim.y} markerStart="url(#aiforge-dim-arrow)" markerEnd="url(#aiforge-dim-arrow)" />
              </g>
            );
          }
          return (
            <g key={dim.id}>
              <line x1={dim.extensionX1} y1={dim.y1} x2={dim.x} y2={dim.y1} strokeDasharray={`${arrowSize} ${arrowSize * 0.55}`} />
              <line x1={dim.extensionX1} y1={dim.y2} x2={dim.x} y2={dim.y2} strokeDasharray={`${arrowSize} ${arrowSize * 0.55}`} />
              <line x1={dim.x} y1={dim.y1} x2={dim.x} y2={dim.y2} markerStart="url(#aiforge-dim-arrow)" markerEnd="url(#aiforge-dim-arrow)" />
            </g>
          );
        })}
      </g>

      {dimensions.map(dim => {
        if (dim.kind === "horizontal") {
          return (
            <text
              key={`text-${dim.id}`}
              x={(dim.x1 + dim.x2) / 2}
              y={-dim.y - fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight="700"
              fill="#c2410c"
              stroke="white"
              strokeWidth={fontSize / 6}
              paintOrder="stroke"
            >
              {dim.label}
            </text>
          );
        }

        const tx = dim.x - fontSize * 0.65;
        const ty = -((dim.y1 + dim.y2) / 2);
        return (
          <text
            key={`text-${dim.id}`}
            x={tx}
            y={ty}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight="700"
            fill="#c2410c"
            stroke="white"
            strokeWidth={fontSize / 6}
            paintOrder="stroke"
            transform={`rotate(-90 ${tx} ${ty})`}
          >
            {dim.label}
          </text>
        );
      })}
    </>
  );
}

export default function AiforgeUniversalWorkspace({ construction, onConstructionChange }) {
  const [tab, setTab] = useState("geometry");
  const [plane, setPlane] = useState("XY");

  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const bounds = useMemo(() => getProjectionBounds(elements, plane), [elements, plane]);
  const dimensionData = useMemo(
    () => buildUniversalDimensions(construction, plane),
    [construction, plane]
  );
  const cost = useMemo(
    () => calculateUniversalCost(construction),
    [construction]
  );

  const overall = construction?.bounds || {};
  const span = Math.max(bounds.width, bounds.height, 1000);
  const vbPad = dimensionData?.drawingPadding || span * 0.2 + 180;
  const viewBox = [
    bounds.minX - vbPad,
    -(bounds.maxY + vbPad),
    Math.max(1, bounds.width) + vbPad * 2,
    Math.max(1, bounds.height) + vbPad * 2
  ].join(" ");

  const updateCostSetting = (field, rawValue) => {
    if (!onConstructionChange) return;
    const next = JSON.parse(JSON.stringify(construction));
    next.costSettings = next.costSettings || {};
    const parsed = rawValue === "" ? null : Number(String(rawValue).replace(",", "."));
    next.costSettings[field] = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    onConstructionChange(next);
  };

  const displayLabels = elements.filter(element => {
    const params = element?.parameters || {};
    if (params.generatedPattern !== "repeatLinear") return true;
    return params.patternIndex === 1;
  });

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 pb-12 text-slate-100">
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-orange-400">Universal Construction Engine v0.2</div>
              <h2 className="text-xl font-bold text-white">{construction?.productLabel || "Obecná konstrukce"}</h2>
              <div className="text-xs text-slate-500">{elements.length} výrobních prvků · souřadnice a kóty v mm</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["geometry", "cut", "cost", "json"].map(key => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${tab === key ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                >
                  {key === "geometry" ? "Geometrie" : key === "cut" ? "Řezný list" : key === "cost" ? "Kalkulace" : "JSON"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <DimensionCard label="Celková šířka" value={overall.width ?? construction?.globalDimensions?.overallWidth} />
            <DimensionCard label="Celková výška" value={overall.height ?? construction?.globalDimensions?.overallHeight} />
            <DimensionCard label="Celková hloubka" value={overall.depth ?? construction?.globalDimensions?.overallDepth} />
            <DimensionCard label="Počet prvků" value={elements.length} suffix="ks" />
          </div>
        </div>

        {tab === "geometry" && (
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold">Výrobní nákres s kótami</div>
                <div className="text-[11px] text-slate-500">Kóty počítá Dimension Engine přímo z geometrie. Nejsou generované odhadem AI.</div>
              </div>
              <div className="flex gap-1">
                {["XY", "XZ", "YZ"].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlane(p)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs ${plane === p ? "border-orange-500 text-orange-300 bg-orange-500/10" : "border-slate-700 text-slate-500"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-white overflow-hidden min-h-[360px]">
              {elements.length ? (
                <svg viewBox={viewBox} className="w-full h-[60vh] min-h-[360px]" preserveAspectRatio="xMidYMid meet">
                  <DimensionLayer dimensionData={dimensionData} fontSize={Math.max(34, span / 85)} />

                  <g transform="scale(1,-1)">
                    {elements.map(el => {
                      const a = projectPoint(el.start, plane);
                      const b = projectPoint(el.end, plane);
                      const stroke = Math.max(8, span / 350);
                      return (
                        <g key={el.id}>
                          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111827" strokeWidth={stroke} strokeLinecap="square" />
                          <circle cx={a.x} cy={a.y} r={stroke * 0.4} fill="#f97316" />
                          <circle cx={b.x} cy={b.y} r={stroke * 0.4} fill="#f97316" />
                        </g>
                      );
                    })}
                  </g>

                  {displayLabels.map(el => {
                    const a = projectPoint(el.start, plane);
                    const b = projectPoint(el.end, plane);
                    const tx = (a.x + b.x) / 2;
                    const ty = -((a.y + b.y) / 2);
                    const fontSize = Math.max(28, span / 105);
                    const isPattern = el?.parameters?.generatedPattern === "repeatLinear";
                    return (
                      <text key={`label-${el.id}`} x={tx} y={ty} textAnchor="middle" fontSize={fontSize} fill="#0f172a" stroke="white" strokeWidth={fontSize / 7} paintOrder="stroke">
                        {isPattern ? `${el.id}… · ${el.profile?.name || "výplň"}` : `${el.id} · ${fmt(el.lengthMm)} mm`}
                      </text>
                    );
                  })}
                </svg>
              ) : (
                <div className="h-[360px] flex items-center justify-center text-slate-500">Zatím nejsou vytvořené žádné prvky.</div>
              )}
            </div>
          </div>
        )}

        {tab === "cut" && (
          <div className="p-3 sm:p-4 overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-left py-2 pr-3">Prvek</th>
                  <th className="text-left py-2 pr-3">Profil</th>
                  <th className="text-right py-2 pr-3">Délka</th>
                  <th className="text-right py-2 pr-3">Hmotnost</th>
                  <th className="text-left py-2">Zdroj kg/m</th>
                </tr>
              </thead>
              <tbody>
                {elements.map(el => {
                  const mass = elementMassKg(el);
                  return (
                    <tr key={el.id} className="border-b border-slate-900">
                      <td className="py-2.5 pr-3 font-mono text-orange-300">{el.id}</td>
                      <td className="py-2.5 pr-3">{el.name || el.role}</td>
                      <td className="py-2.5 pr-3">{el.profile?.name || "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{fmt(el.lengthMm)} mm</td>
                      <td className="py-2.5 pr-3 text-right">{mass ? `${fmt(mass.massKg, 3)} kg` : "neznámá"}</td>
                      <td className="py-2.5 text-slate-500">{mass?.weightSource === "calculated_theoretical" ? "výpočet*" : mass?.weightSource || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 text-[11px] text-slate-500">* Teoretická kg/m u rozpoznaných JEKL/RHS/SHS profilů je vypočtená z rozměrů a hustoty oceli. Katalogová hodnota má vždy přednost, pokud je zadaná.</div>
          </div>
        )}

        {tab === "cost" && (
          <div className="p-3 sm:p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold">Universal Cost Engine v0.1</div>
              <div className="text-[11px] text-slate-500">Ceny zadáváš ty. AI je nevymýšlí. Nastavení se ukládá spolu s projektem.</div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <CostInput label="Ocel" unit="Kč/kg" value={construction?.costSettings?.steelPricePerKg} onChange={v => updateCostSetting("steelPricePerKg", v)} />
              <CostInput label="Hodinová sazba" unit="Kč/h" value={construction?.costSettings?.hourlyRate} onChange={v => updateCostSetting("hourlyRate", v)} />
              <CostInput label="Práce" unit="h" value={construction?.costSettings?.laborHours} onChange={v => updateCostSetting("laborHours", v)} />
              <CostInput label="Žárový zinek" unit="Kč/kg" value={construction?.costSettings?.zincPricePerKg} onChange={v => updateCostSetting("zincPricePerKg", v)} />
              <CostInput label="Lak / komaxit" unit="Kč/m²" value={construction?.costSettings?.powderPricePerM2} onChange={v => updateCostSetting("powderPricePerM2", v)} />
              <CostInput label="Kování / hardware" unit="Kč" value={construction?.costSettings?.hardwareCost} onChange={v => updateCostSetting("hardwareCost", v)} />
              <CostInput label="Doprava" unit="Kč" value={construction?.costSettings?.transportCost} onChange={v => updateCostSetting("transportCost", v)} />
              <CostInput label="Ostatní" unit="Kč" value={construction?.costSettings?.otherCost} onChange={v => updateCostSetting("otherCost", v)} />
              <CostInput label="Marže" unit="%" value={construction?.costSettings?.marginPercent} onChange={v => updateCostSetting("marginPercent", v)} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <DimensionCard label="Celkem profilů" value={cost.totals.totalLengthM} suffix="m" />
              <DimensionCard label="Hmotnost" value={cost.totals.totalMassKg} suffix="kg" />
              <DimensionCard label="Plocha profilů" value={cost.totals.totalSurfaceM2} suffix="m²" />
              <DimensionCard label="Materiál" value={cost.totals.materialCost} suffix="Kč" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs min-w-[620px]">
                <thead className="bg-slate-900 text-slate-500">
                  <tr>
                    <th className="text-left p-2">Profil</th>
                    <th className="text-right p-2">Ks</th>
                    <th className="text-right p-2">bm</th>
                    <th className="text-right p-2">kg</th>
                    <th className="text-left p-2">Poznámka</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.profileGroups.map(group => (
                    <tr key={group.profileName} className="border-t border-slate-800">
                      <td className="p-2">{group.profileName}</td>
                      <td className="p-2 text-right">{group.count}</td>
                      <td className="p-2 text-right">{fmt(group.totalLengthM, 3)}</td>
                      <td className="p-2 text-right">{group.massKnownCount ? fmt(group.massKg, 3) : "—"}</td>
                      <td className="p-2 text-slate-500">{group.theoreticalCount ? `${group.theoreticalCount}× teoretická kg/m` : "katalog / zadaná data"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ["Materiál", cost.totals.materialCost],
                ["Práce", cost.totals.laborCost],
                ["Zinek", cost.totals.zincCost],
                ["Lak / komaxit", cost.totals.powderCost],
                ["Kování", cost.totals.hardwareCost],
                ["Doprava", cost.totals.transportCost],
                ["Ostatní", cost.totals.otherCost],
                ["Mezisoučet", cost.totals.subtotal],
                ["Marže", cost.totals.marginAmount],
                ["PRODEJNÍ CENA", cost.totals.salePrice]
              ].map(([label, value]) => (
                <div key={label} className={`flex items-center justify-between rounded-xl border p-3 ${label === "PRODEJNÍ CENA" ? "border-orange-500 bg-orange-500/10 text-orange-200" : "border-slate-800 bg-slate-900"}`}>
                  <span className="text-sm">{label}</span>
                  <b className="font-mono">{value == null ? "—" : `${fmt(value, 2)} Kč`}</b>
                </div>
              ))}
            </div>

            {!cost.complete && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 p-3 text-xs">
                <b>Kalkulace zatím není kompletní.</b>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {cost.missing.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            )}

            {cost.totals.theoreticalMassCount > 0 && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 text-sky-200 p-3 text-xs">
                Hmotnost obsahuje {cost.totals.theoreticalMassCount} prvků s teoreticky vypočtenou kg/m. Pro finální výrobní kalkulaci lze později doplnit katalogové hmotnosti profilů.
              </div>
            )}
          </div>
        )}

        {tab === "json" && (
          <div className="p-3 sm:p-4">
            <pre className="text-[11px] leading-5 overflow-auto rounded-xl border border-slate-800 bg-black p-3 max-h-[70vh]">{JSON.stringify(construction, null, 2)}</pre>
          </div>
        )}
      </div>
    </section>
  );
}

export const AIFORGE_UNIVERSAL_WORKSPACE_VERSION = "0.2";
