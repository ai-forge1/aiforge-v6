import React, { useMemo, useState } from "react";
import AiforgeTechnicalDrawing from "./Aiforge_Technical_Drawing_v0.1.jsx";
import AiforgeRealisticPreview from "./Aiforge_Realistic_Preview_v0.1.jsx";
import {
  calculateUniversalCost,
  elementMassKg
} from "./Aiforge_Universal_Cost_Engine_v0.1.js";

// ============================================================
// AIFORGE v6 — UNIVERSAL WORKSPACE v0.3
// Technical drawing + cut list + cost + visualization bridge + JSON.
// ============================================================

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
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

export default function AiforgeUniversalWorkspace({ construction, onConstructionChange }) {
  const [tab, setTab] = useState("drawing");
  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const overall = construction?.bounds || {};

  const cost = useMemo(
    () => calculateUniversalCost(construction),
    [construction]
  );

  const updateCostSetting = (field, rawValue) => {
    if (!onConstructionChange) return;

    const next = JSON.parse(JSON.stringify(construction));
    next.costSettings = next.costSettings || {};
    const parsed = rawValue === "" ? null : Number(String(rawValue).replace(",", "."));
    next.costSettings[field] = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    onConstructionChange(next);
  };

  const tabs = [
    ["drawing", "Výkres"],
    ["cut", "Řezný list"],
    ["cost", "Kalkulace"],
    ["visual", "Vizualizace"],
    ["json", "JSON"]
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 pb-12 text-slate-100">
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-orange-400">Universal Production Engine v0.3</div>
              <h2 className="text-xl font-bold text-white">{construction?.productLabel || "Obecná konstrukce"}</h2>
              <div className="text-xs text-slate-500">
                {elements.length} výrobních prvků · technický výkres · řezný list · kalkulace · vizualizační bridge
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${tab === key ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                >
                  {label}
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

        {tab === "drawing" && (
          <div className="p-3 sm:p-4">
            <AiforgeTechnicalDrawing construction={construction} />
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
                {elements.map(element => {
                  const mass = elementMassKg(element);
                  return (
                    <tr key={element.id} className="border-b border-slate-900">
                      <td className="py-2.5 pr-3 font-mono text-orange-300">{element.id}</td>
                      <td className="py-2.5 pr-3">{element.name || element.role}</td>
                      <td className="py-2.5 pr-3">{element.profile?.name || "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{fmt(element.lengthMm)} mm</td>
                      <td className="py-2.5 pr-3 text-right">{mass ? `${fmt(mass.massKg, 3)} kg` : "neznámá"}</td>
                      <td className="py-2.5 text-slate-500">
                        {mass?.weightSource === "calculated_theoretical" ? "výpočet*" : mass?.weightSource || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-[11px] text-slate-500">
              * Teoretická kg/m u rozpoznaných JEKL/RHS/SHS profilů je vypočtená z rozměrů a hustoty oceli. Katalogová hodnota má přednost, pokud je zadaná.
            </div>
          </div>
        )}

        {tab === "cost" && (
          <div className="p-3 sm:p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold">Universal Cost Engine v0.1</div>
              <div className="text-[11px] text-slate-500">
                Ceny zadáváš ty. AI je nevymýšlí. Nastavení se ukládá spolu s projektem.
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <CostInput label="Ocel" unit="Kč/kg" value={construction?.costSettings?.steelPricePerKg} onChange={value => updateCostSetting("steelPricePerKg", value)} />
              <CostInput label="Hodinová sazba" unit="Kč/h" value={construction?.costSettings?.hourlyRate} onChange={value => updateCostSetting("hourlyRate", value)} />
              <CostInput label="Práce" unit="h" value={construction?.costSettings?.laborHours} onChange={value => updateCostSetting("laborHours", value)} />
              <CostInput label="Žárový zinek" unit="Kč/kg" value={construction?.costSettings?.zincPricePerKg} onChange={value => updateCostSetting("zincPricePerKg", value)} />
              <CostInput label="Lak / komaxit" unit="Kč/m²" value={construction?.costSettings?.powderPricePerM2} onChange={value => updateCostSetting("powderPricePerM2", value)} />
              <CostInput label="Kování / hardware" unit="Kč" value={construction?.costSettings?.hardwareCost} onChange={value => updateCostSetting("hardwareCost", value)} />
              <CostInput label="Doprava" unit="Kč" value={construction?.costSettings?.transportCost} onChange={value => updateCostSetting("transportCost", value)} />
              <CostInput label="Ostatní" unit="Kč" value={construction?.costSettings?.otherCost} onChange={value => updateCostSetting("otherCost", value)} />
              <CostInput label="Marže" unit="%" value={construction?.costSettings?.marginPercent} onChange={value => updateCostSetting("marginPercent", value)} />
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
                      <td className="p-2 text-slate-500">
                        {group.theoreticalCount ? `${group.theoreticalCount}× teoretická kg/m` : "katalog / zadaná data"}
                      </td>
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
                <div
                  key={label}
                  className={`flex items-center justify-between rounded-xl border p-3 ${label === "PRODEJNÍ CENA" ? "border-orange-500 bg-orange-500/10 text-orange-200" : "border-slate-800 bg-slate-900"}`}
                >
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
                Hmotnost obsahuje {cost.totals.theoreticalMassCount} prvků s teoreticky vypočtenou kg/m. Pro finální výrobní kalkulaci lze doplnit katalogové hmotnosti profilů.
              </div>
            )}
          </div>
        )}

        {tab === "visual" && (
          <div className="p-3 sm:p-4">
            <AiforgeRealisticPreview construction={construction} />
          </div>
        )}

        {tab === "json" && (
          <div className="p-3 sm:p-4">
            <pre className="text-[11px] leading-5 overflow-auto rounded-xl border border-slate-800 bg-black p-3 max-h-[70vh]">
              {JSON.stringify(construction, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

export const AIFORGE_UNIVERSAL_WORKSPACE_VERSION = "0.3";
