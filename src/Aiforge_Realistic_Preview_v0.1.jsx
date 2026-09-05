import React, { useMemo, useState } from "react";
import { Clipboard, Image as ImageIcon, ShieldCheck } from "lucide-react";
import {
  buildGeminiVisualizationPayload,
  buildVisualizationPrompt,
  createVisualizationBrief
} from "./Aiforge_Visualization_Bridge_v0.1.js";

// ============================================================
// AIFORGE — REALISTIC PREVIEW v0.1
//
// Presentation-only bridge. It prepares exact approved data for
// an external image model. It does NOT generate or mutate geometry.
// ============================================================

function fmt(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("cs-CZ")
    : "—";
}

export default function AiforgeRealisticPreview({ construction }) {
  const [copyStatus, setCopyStatus] = useState("");

  const brief = useMemo(
    () => createVisualizationBrief(construction),
    [construction]
  );
  const prompt = useMemo(
    () => buildVisualizationPrompt(construction),
    [construction]
  );
  const payload = useMemo(
    () => buildGeminiVisualizationPayload(construction),
    [construction]
  );

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} zkopírován.`);
    } catch {
      setCopyStatus("Kopírování se nepodařilo. Text označ ručně.");
    }
  };

  const d = brief.dimensionsMm;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-orange-400" />
          Fotorealistická realizace — Gemini bridge
        </div>
        <div className="text-[11px] text-slate-500">
          Tato vrstva připravuje přesná schválená data pro image model. Výrobu zpětně neovlivňuje.
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] uppercase text-slate-500">Šířka</div>
          <div className="font-bold">{fmt(d.width)} mm</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] uppercase text-slate-500">Výška</div>
          <div className="font-bold">{fmt(d.height)} mm</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] uppercase text-slate-500">Hloubka</div>
          <div className="font-bold">{fmt(d.depth)} mm</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-[10px] uppercase text-slate-500">Povrch</div>
          <div className="font-bold text-sm break-words">{brief.finish === "UNSPECIFIED" ? "nezadaný" : brief.finish}</div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200 flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <div>
          Prompt používá rozměry z <b>{brief.dimensionsMm.source}</b>, skutečné profily a počet prvků. Pokud není RAL/povrch zadán, Bridge ho nevymyslí.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold">Prompt pro Gemini image</div>
            <button
              onClick={() => copy(prompt, "Prompt")}
              className="px-2 py-1 rounded border border-slate-700 text-[11px] flex items-center gap-1"
            >
              <Clipboard className="w-3 h-3" /> Kopírovat
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-[11px] leading-5 bg-black rounded-lg p-3 max-h-[360px] overflow-auto select-all">{prompt}</pre>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold">Přesný payload</div>
            <button
              onClick={() => copy(JSON.stringify(payload, null, 2), "Payload")}
              className="px-2 py-1 rounded border border-slate-700 text-[11px] flex items-center gap-1"
            >
              <Clipboard className="w-3 h-3" /> Kopírovat
            </button>
          </div>
          <pre className="text-[11px] leading-5 bg-black rounded-lg p-3 max-h-[360px] overflow-auto select-all">{JSON.stringify(payload, null, 2)}</pre>
        </div>
      </div>

      {copyStatus && <div className="text-[11px] text-slate-400">{copyStatus}</div>}

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
        Automatické generování obrázku uvnitř Aiforge ještě není zapojené. K tomu bude potřeba serverový Gemini image endpoint/API klíč. Klíč nikdy nebude uložen ve frontendu.
      </div>
    </div>
  );
}

export const AIFORGE_REALISTIC_PREVIEW_VERSION = "0.1";
