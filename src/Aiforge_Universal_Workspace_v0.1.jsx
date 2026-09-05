import React, { useMemo, useState } from "react";

// ============================================================
// AIFORGE v6 — UNIVERSAL WORKSPACE v0.1
//
// Produktově neutrální renderer nad construction.elements[].
// Umí projekce XY / XZ / YZ, řezný list a JSON.
// Neodhaduje hmotnost ani cenu.
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

function getProjectionBounds(elements, plane) {
  const points = [];
  for (const el of elements || []) {
    points.push(projectPoint(el.start, plane));
    points.push(projectPoint(el.end, plane));
  }
  if (!points.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function fmt(value, digits = 0) {
  return finite(value) ? value.toLocaleString("cs-CZ", { maximumFractionDigits: digits }) : "—";
}

function calcMass(element) {
  const kgm = element?.profile?.weightPerMeter;
  if (!finite(kgm) || !finite(element?.lengthMm)) return null;
  return (element.lengthMm / 1000) * kgm;
}

function calcMaterialPrice(element) {
  const meters = finite(element?.lengthMm) ? element.lengthMm / 1000 : null;
  if (!finite(meters)) return null;
  const ppm = element?.profile?.pricePerMeter;
  if (finite(ppm)) return meters * ppm;
  const mass = calcMass(element);
  const ppk = element?.profile?.pricePerKg;
  if (finite(mass) && finite(ppk)) return mass * ppk;
  return null;
}

function DimensionCard({ label, value, suffix = "mm" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{label}</div>
      <div className="text-lg font-bold text-white">{fmt(value)} <span className="text-xs font-normal text-slate-500">{suffix}</span></div>
    </div>
  );
}

export default function AiforgeUniversalWorkspace({ construction }) {
  const [tab, setTab] = useState("geometry");
  const [plane, setPlane] = useState("XY");
  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const bounds = useMemo(() => getProjectionBounds(elements, plane), [elements, plane]);

  const overall = construction?.bounds || {};
  const totalMass = elements.reduce((sum, el) => sum + (calcMass(el) || 0), 0);
  const knownMassCount = elements.filter(el => calcMass(el) != null).length;
  const totalPrice = elements.reduce((sum, el) => sum + (calcMaterialPrice(el) || 0), 0);
  const knownPriceCount = elements.filter(el => calcMaterialPrice(el) != null).length;

  const vbPad = Math.max(bounds.width, bounds.height) * 0.08 + 80;
  const viewBox = [
    bounds.minX - vbPad,
    -(bounds.maxY + vbPad),
    bounds.width + vbPad * 2,
    bounds.height + vbPad * 2
  ].join(" ");

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 pb-12 text-slate-100">
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest text-orange-400">Universal Construction Engine v0.1</div>
              <h2 className="text-xl font-bold text-white">{construction?.productLabel || "Obecná konstrukce"}</h2>
              <div className="text-xs text-slate-500">{elements.length} výrobních prvků · souřadnice v mm</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["geometry", "cut", "json"].map(key => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${tab === key ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                >
                  {key === "geometry" ? "Geometrie" : key === "cut" ? "Řezný list" : "JSON"}
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
              <div className="text-sm font-semibold">Technický náhled</div>
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

            <div className="rounded-xl border border-slate-800 bg-white overflow-hidden min-h-[320px]">
              {elements.length ? (
                <svg viewBox={viewBox} className="w-full h-[55vh] min-h-[320px]" preserveAspectRatio="xMidYMid meet">
                  <g transform="scale(1,-1)">
                    {elements.map(el => {
                      const a = projectPoint(el.start, plane);
                      const b = projectPoint(el.end, plane);
                      const stroke = Math.max(8, Math.max(bounds.width, bounds.height) / 350);
                      return (
                        <g key={el.id}>
                          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111827" strokeWidth={stroke} strokeLinecap="square" />
                          <circle cx={a.x} cy={a.y} r={stroke * 0.45} fill="#f97316" />
                          <circle cx={b.x} cy={b.y} r={stroke * 0.45} fill="#f97316" />
                        </g>
                      );
                    })}
                  </g>
                  {elements.map(el => {
                    const a = projectPoint(el.start, plane);
                    const b = projectPoint(el.end, plane);
                    const tx = (a.x + b.x) / 2;
                    const ty = -((a.y + b.y) / 2);
                    const fontSize = Math.max(32, Math.max(bounds.width, bounds.height) / 90);
                    return (
                      <text key={`label-${el.id}`} x={tx} y={ty} textAnchor="middle" fontSize={fontSize} fill="#0f172a" stroke="white" strokeWidth={fontSize / 7} paintOrder="stroke">
                        {el.id} · {fmt(el.lengthMm)}
                      </text>
                    );
                  })}
                </svg>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-slate-500">Zatím nejsou vytvořené žádné prvky.</div>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Projekce {plane}. Délky prvků se počítají z plných start/end souřadnic; pokud prvek obsahuje Z, délka je 3D.</div>
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
                  <th className="text-right py-2">Materiál</th>
                </tr>
              </thead>
              <tbody>
                {elements.map(el => {
                  const mass = calcMass(el);
                  const price = calcMaterialPrice(el);
                  return (
                    <tr key={el.id} className="border-b border-slate-900">
                      <td className="py-2.5 pr-3 font-mono text-orange-300">{el.id}</td>
                      <td className="py-2.5 pr-3">{el.name || el.role}</td>
                      <td className="py-2.5 pr-3">{el.profile?.name || "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{fmt(el.lengthMm)} mm</td>
                      <td className="py-2.5 pr-3 text-right">{mass == null ? "neznámá" : `${fmt(mass, 2)} kg`}</td>
                      <td className="py-2.5 text-right">{price == null ? "neznámá" : `${fmt(price, 2)} Kč`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
                Hmotnost: <b>{knownMassCount === elements.length && elements.length ? `${fmt(totalMass, 2)} kg` : `${knownMassCount}/${elements.length} prvků má ověřenou kg/m`}</b>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
                Materiálová cena: <b>{knownPriceCount === elements.length && elements.length ? `${fmt(totalPrice, 2)} Kč` : `${knownPriceCount}/${elements.length} prvků má cenu`}</b>
              </div>
            </div>
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

export const AIFORGE_UNIVERSAL_WORKSPACE_VERSION = "0.1";
