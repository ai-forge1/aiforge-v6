import React, { useState } from "react";
import AiforgeAIChangeReview from "./Aiforge_AI_Change_Review_v1.1.jsx";
import { applyApprovedActions } from "./Aiforge_Action_Adapter_v0.2.js";

// ============================================================
// AIFORGE v6.0 — REVIEW + ADAPTER CONTROLLER v0.2
//
// Tento modul NEMĚNÍ CORE source.
// Přijme aktuální construction stav a AI proposal.
// Až po ručním schválení spustí Adapter.
// ============================================================

export default function AiforgeAIApprovalController({
  currentConstruction,
  proposal,
  onConstructionChange,
  onClose,
  onApplied
}) {
  const [applyError, setApplyError] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  if (!proposal) return null;

  const handleReject = () => {
    setApplyError(null);
    onClose?.();
  };

  const handleApprove = (actions) => {
    setApplyError(null);
    setIsApplying(true);

    const result = applyApprovedActions(
      currentConstruction,
      actions
    );

    setIsApplying(false);

    if (!result.ok) {
      setApplyError(result.errors || ["Neznámá chyba Adapteru."]);
      return;
    }

    // Jediný okamžik, kdy se nový stav předá nadřazené v6 aplikaci.
    // Frozen CORE source se tímto neupravuje.
    onConstructionChange?.(result.construction);
    onApplied?.(result);
    onClose?.();
  };

  return (
    <div>
      {applyError && (
        <div className="fixed top-3 left-3 right-3 z-[100] max-w-3xl mx-auto bg-red-950 border border-red-500/50 text-red-200 rounded-xl p-3 text-xs font-mono shadow-xl">
          <b>Adapter změny odmítl:</b>
          <ul className="mt-2 list-disc pl-5">
            {applyError.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <AiforgeAIChangeReview
        proposal={proposal}
        disabled={isApplying}
        onReject={handleReject}
        onApprove={handleApprove}
      />
    </div>
  );
}
