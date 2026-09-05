import React, { useMemo, useState } from 'react';
import {
  GitCommit, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Plus, Edit3, Trash2, Move, Code,
  ChevronDown, ChevronUp, ShieldCheck, Database, HelpCircle
} from 'lucide-react';

function isUnverifiedSource(source) {
  return [
    "unknown",
    "unverified",
    "pending_user_specification",
    "default_estimate",
    "ai_proposal"
  ].includes(source);
}

function collectAutomaticWarnings(action) {
  const warnings = [];

  if (action?.warning) warnings.push(action.warning);

  if (action?.changes) {
    Object.entries(action.changes).forEach(([field, diff]) => {
      if (isUnverifiedSource(diff?.source)) {
        warnings.push(`Neověřená hodnota: ${field} (${diff.source}).`);
      }
    });
  }

  const profile = action?.element?.profile;
  if (profile) {
    if (isUnverifiedSource(profile.source)) {
      warnings.push(`Neověřený profil: ${profile.name || "bez názvu"}.`);
    }
    if (isUnverifiedSource(profile.weightSource)) {
      warnings.push(`Neověřená hmotnost profilu: ${profile.name || "bez názvu"}.`);
    }
    if (isUnverifiedSource(profile.priceSource)) {
      warnings.push(`Neověřená cena profilu: ${profile.name || "bez názvu"}.`);
    }
  }

  return [...new Set(warnings)];
}

function inferUnit(field, diff) {
  if (diff?.unit) return diff.unit;

  const f = String(field || "").toLowerCase();

  if (
    f.includes(".x") ||
    f.includes(".y") ||
    f.includes("length") ||
    f.includes("width") ||
    f.includes("height") ||
    f.includes("offset")
  ) return "mm";

  if (f.includes("weightpermeter")) return "kg/m";
  if (f.includes("pricepermeter")) return "Kč/m";
  if (f.includes("priceperkg")) return "Kč/kg";

  return null;
}

function formatValue(field, value, diff = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const unit = inferUnit(field, diff);

  if (typeof value === "number") {
    return unit ? `${value} ${unit}` : `${value}`;
  }

  return String(value);
}

function SourceBadge({ source }) {
  if (!source) return null;
  const unverified = isUnverifiedSource(source);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono ${
      unverified
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    }`}>
      <Database className="w-3 h-3" />
      {source}
    </span>
  );
}

export default function AiforgeAIChangeReview({
  proposal,
  onApprove,
  onReject,
  disabled = false
}) {
  const [showJson, setShowJson] = useState(false);

  const actions = Array.isArray(proposal?.actions)
    ? proposal.actions
    : [];

  const proposalWarnings = useMemo(() => {
    const fromBrain = Array.isArray(proposal?.warnings)
      ? proposal.warnings
      : [];

    const automatic = actions.flatMap(collectAutomaticWarnings);

    return [...new Set([...fromBrain, ...automatic])];
  }, [proposal, actions]);

  const questions = Array.isArray(proposal?.questions)
    ? proposal.questions
    : [];

  const getActionBadge = (type) => {
    switch (type) {
      case 'add_element':
        return {
          label: 'Přidání',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: <Plus className="w-4 h-4 text-emerald-400" />
        };

      case 'update_element':
        return {
          label: 'Změna',
          color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: <Edit3 className="w-4 h-4 text-amber-400" />
        };

      case 'delete_element':
        return {
          label: 'Smazání',
          color: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: <Trash2 className="w-4 h-4 text-red-400" />
        };

      case 'move_element':
        return {
          label: 'Přesun',
          color: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
          icon: <Move className="w-4 h-4 text-sky-400" />
        };

      case 'update_dimension':
        return {
          label: 'Rozměr',
          color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
          icon: <Edit3 className="w-4 h-4 text-violet-400" />
        };

      default:
        return {
          label: 'Úprava',
          color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
          icon: <GitCommit className="w-4 h-4 text-slate-400" />
        };
    }
  };

  const canApprove =
    !disabled &&
    actions.length > 0 &&
    questions.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 flex flex-col items-center font-sans antialiased">
      <div className="max-w-3xl w-full flex flex-col gap-6">

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-600/25">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  AI navrhuje změny
                </h1>
                <p className="text-xs text-slate-400">
                  Review vrstva nad Aiforge CORE v1.0 FREEZE
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-orange-400">
              {actions.length} změn
            </span>
          </div>

          {proposalWarnings.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-300">
              <div className="font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Upozornění před schválením
              </div>

              <div className="flex flex-col gap-1">
                {proposalWarnings.map((warning, index) => (
                  <div key={index}>• {warning}</div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-3 text-xs text-sky-300">
              <div className="font-semibold flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4" />
                AI potřebuje doplnit údaje
              </div>

              {questions.map((question, index) => (
                <div key={index}>• {question}</div>
              ))}

              <div className="mt-2 text-[11px] text-sky-400">
                Dokud jsou zde otázky, změny nelze aplikovat.
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {actions.map((act, index) => {
            const badge = getActionBadge(act.type);

            return (
              <div
                key={`${act.type}-${act.id || act.temporaryId || index}`}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-md flex flex-col gap-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                      {badge.icon}
                    </span>

                    <div>
                      <span className="font-mono font-bold text-orange-400 text-sm">
                        {act.id || act.temporaryId || act.field || `#${index + 1}`}
                      </span>

                      {(act.name || act.element?.name) && (
                        <span className="text-slate-200 font-medium text-sm ml-2">
                          {act.name || act.element?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                {act.type === 'update_dimension' ? (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                    <div className="text-slate-400 mb-2">{act.field}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">
                        {formatValue(act.field, act.value, { unit: act.unit })}
                      </span>
                      <SourceBadge source={act.source} />
                    </div>
                  </div>
                ) : act.type === 'add_element' ? (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs font-mono">
                    <div>Role: <span className="text-white">{act.element?.role || "—"}</span></div>
                    <div>Profil: <span className="text-emerald-400">{act.element?.profile?.name || "—"}</span></div>
                    <div>
                      Start: x {formatValue("start.x", act.element?.start?.x, { unit: "mm" })},
                      {" "}y {formatValue("start.y", act.element?.start?.y, { unit: "mm" })}
                    </div>
                    <div>
                      Konec: x {formatValue("end.x", act.element?.end?.x, { unit: "mm" })},
                      {" "}y {formatValue("end.y", act.element?.end?.y, { unit: "mm" })}
                    </div>
                  </div>
                ) : act.type === 'delete_element' ? (
                  <div className="text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-500/20 text-xs">
                    Prvek bude odstraněn z nové kopie konstrukce.
                  </div>
                ) : (
                  Object.entries(act.changes || {}).map(([field, diff], i) => (
                    <div
                      key={i}
                      className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs font-mono"
                    >
                      <div className="text-slate-400">{field}</div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 line-through">
                          {formatValue(field, diff?.before, diff)}
                        </span>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />

                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 font-semibold">
                          {formatValue(field, diff?.after, diff)}
                        </span>

                        <SourceBadge source={diff?.source} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowJson(!showJson)}
            className="w-full p-4 text-xs font-mono text-slate-400 hover:text-white flex items-center justify-between bg-slate-900"
          >
            <span className="flex items-center gap-2">
              <Code className="w-4 h-4 text-orange-500" />
              Technický JSON návrhu
            </span>

            {showJson
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />}
          </button>

          {showJson && (
            <div className="p-4 bg-slate-950 border-t border-slate-800 overflow-x-auto">
              <pre className="text-[11px] font-mono text-emerald-400">
                {JSON.stringify(proposal, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row gap-3">
          <button
            onClick={onReject}
            disabled={disabled}
            className="w-full sm:flex-1 bg-slate-800 disabled:opacity-50 text-slate-200 font-semibold py-3 px-4 rounded-xl border border-slate-700 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4 text-red-400" />
            Zrušit změny
          </button>

          <button
            onClick={() => onApprove(actions)}
            disabled={!canApprove}
            className="w-full sm:flex-1 bg-orange-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold py-3 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Použít změny
          </button>
        </div>

      </div>
    </div>
  );
}
