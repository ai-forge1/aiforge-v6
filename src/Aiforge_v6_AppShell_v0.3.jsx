import React, { useState } from "react";
import { Brain, Send, ShieldCheck, CheckCircle2, Save } from "lucide-react";

import AiforgeCoreBridgeV01 from "./Aiforge_Core_Bridge_v0.1.jsx";
import AiforgeAIApprovalController from "./Aiforge_AI_Approval_Controller_v0.2.jsx";
import {
  loadSavedConstruction,
  saveConstruction
} from "./Aiforge_Project_Persistence_v0.1.js";

const DEFAULT_WORKER_URL =
  "https://aiforge-construction-brain.ds42m59vkn.workers.dev";

const initialSavedConstruction = loadSavedConstruction();

export default function AiforgeV6AppShell() {
  const [construction, setConstructionState] = useState(initialSavedConstruction);
  const [proposal, setProposal] = useState(null);

  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [testToken, setTestToken] = useState("");
  const [prompt, setPrompt] = useState("Změň P01 na C profil 100x90x6.");

  const [brainStatus, setBrainStatus] = useState({
    mode: "idle",
    message: "Mozek připraven."
  });

  const [persistenceStatus, setPersistenceStatus] = useState(
    initialSavedConstruction
      ? "Uložený projekt načten z tohoto zařízení."
      : "Projekt se automaticky uloží po první změně."
  );

  const [lastApplied, setLastApplied] = useState(null);

  const setConstruction = (nextConstruction) => {
    if (!nextConstruction) return;

    setConstructionState(nextConstruction);

    const result = saveConstruction(nextConstruction);
    setPersistenceStatus(
      result.ok
        ? "Projekt automaticky uložen v tomto zařízení."
        : `Uložení se nepodařilo: ${result.error || "neznámá chyba"}`
    );
  };

  const sendToBrain = async () => {
    if (!construction) {
      setBrainStatus({
        mode: "error",
        message: "CORE ještě nepředal construction stav."
      });
      return;
    }

    if (!workerUrl.trim() || !testToken || !prompt.trim()) {
      setBrainStatus({
        mode: "error",
        message: "Vyplň Worker URL, test token a příkaz."
      });
      return;
    }

    setBrainStatus({
      mode: "loading",
      message: "Volám Aiforge Brain → NVIDIA…"
    });
    setProposal(null);
    setLastApplied(null);

    try {
      const base = workerUrl.trim().replace(/\/+$/, "");

      const response = await fetch(
        `${base}/api/construction-command`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-aiforge-test-token": testToken
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            currentConstruction: construction
          })
        }
      );

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Worker nevrátil JSON: ${text.slice(0, 300)}`);
      }

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
          data?.errors?.join(" | ") ||
          `Worker HTTP ${response.status}`
        );
      }

      if (!data?.proposal) {
        throw new Error("Worker nevrátil proposal.");
      }

      setProposal(data.proposal);

      const actionCount = Array.isArray(data.proposal.actions)
        ? data.proposal.actions.length
        : 0;

      const questionCount = Array.isArray(data.proposal.questions)
        ? data.proposal.questions.length
        : 0;

      setBrainStatus({
        mode: questionCount > 0 ? "question" : "success",
        message:
          questionCount > 0
            ? `AI potřebuje doplnit ${questionCount} údajů.`
            : `AI navrhla ${actionCount} změn. Zkontroluj je před použitím.`
      });

    } catch (error) {
      setBrainStatus({
        mode: "error",
        message: error instanceof Error
          ? error.message
          : String(error)
      });
    }
  };

  const statusClass = {
    idle: "border-slate-700 bg-slate-950 text-slate-400",
    loading: "border-sky-500/40 bg-sky-950/30 text-sky-300",
    success: "border-emerald-500/40 bg-emerald-950/30 text-emerald-300",
    question: "border-amber-500/40 bg-amber-950/30 text-amber-300",
    error: "border-red-500/40 bg-red-950/30 text-red-300"
  }[brainStatus.mode] || "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800 bg-slate-900 p-3 sm:p-4 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-orange-600 p-2.5 rounded-xl shadow-lg shadow-orange-600/20">
                <Brain className="w-5 h-5 text-white" />
              </div>

              <div>
                <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                  Aiforge v6.0 · Persistence v0.1
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    MOZEK NASAZEN
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  NVIDIA Brain → Review → Adapter → Geometry → CORE v1.0 FREEZE
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                CORE source se nemění
              </span>
              <span className="flex items-center gap-2 text-emerald-400">
                <Save className="w-3.5 h-3.5" />
                AUTO SAVE
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Worker URL
              </label>
              <input
                value={workerUrl}
                onChange={e => setWorkerUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                AIFORGE_TEST_TOKEN — pouze vývoj
              </label>
              <input
                type="password"
                autoComplete="off"
                value={testToken}
                onChange={e => setTestToken(e.target.value)}
                placeholder="Token se neukládá do Project Persistence"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={2}
              className="w-full resize-y bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
              placeholder="Napiš změnu konstrukce…"
            />

            <button
              onClick={sendToBrain}
              disabled={brainStatus.mode === "loading"}
              className="sm:w-44 bg-orange-600 disabled:bg-slate-700 hover:bg-orange-500 rounded-lg px-4 py-3 font-bold text-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {brainStatus.mode === "loading" ? "Pracuji…" : "Odeslat AI"}
            </button>
          </div>

          <div className={`border rounded-lg px-3 py-2 text-xs ${statusClass}`}>
            {brainStatus.message}
          </div>

          <div className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
            <Save className="w-4 h-4 shrink-0" />
            {persistenceStatus}
          </div>

          {lastApplied && (
            <div className="border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Změny schváleny, Adapter vytvořil nový construction a projekt byl uložen.
            </div>
          )}
        </div>
      </section>

      <AiforgeCoreBridgeV01
        externalConstruction={construction}
        onConstructionReady={(initial) => {
          if (!construction) setConstruction(initial);
        }}
        onConstructionChange={setConstruction}
        initialTab="preview"
      />

      {proposal && construction && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950">
          <AiforgeAIApprovalController
            currentConstruction={construction}
            proposal={proposal}
            onConstructionChange={setConstruction}
            onApplied={(result) => {
              setLastApplied(result);
              setBrainStatus({
                mode: "success",
                message: `${result.applied?.length || 0} schválených změn aplikováno přes Adapter.`
              });
            }}
            onClose={() => setProposal(null)}
          />
        </div>
      )}
    </div>
  );
}
