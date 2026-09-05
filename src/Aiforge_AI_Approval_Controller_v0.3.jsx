import React, { useState } from "react";
import AiforgeAIChangeReview from "./Aiforge_AI_Change_Review_v1.1.jsx";
import { applyApprovedActions as applyGateActions } from "./Aiforge_Action_Adapter_v0.2.js";
import { applyUniversalApprovedActions } from "./Aiforge_Universal_Action_Adapter_v0.2.js";

// ============================================================
// AIFORGE v6.0 — REVIEW + ADAPTER CONTROLLER v0.3
//
// Gate construction -> ověřený Gate Adapter v0.2
// Universal construction -> Universal Adapter v0.2
// Frozen CORE source se nemění.
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

    const isUniversal = currentConstruction?.engine === "universal";
    const result = isUniversal
      ? applyUniversalApprovedActions(currentConstruction, actions)
      : applyGateActions(currentConstruction, actions);

    setIsApplying(false);

    if (!result.ok) {
      setApplyError(result.errors || ["Neznámá chyba Adapteru."]);
      return;
    }

    onConstructionChange?.(result.construction);
    onApplied?.({ ...result, adapterMode: isUniversal ? "universal" : "gate" });
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
