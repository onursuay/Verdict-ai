"use client";

import { useState } from "react";
import { DecisionResult, DecisionStatus } from "@/types/decision";

interface ActionButtonsProps {
  result: DecisionResult;
  status: DecisionStatus;
  onStatusChange: (status: DecisionStatus) => void;
}

export default function ActionButtons({ result, status, onStatusChange }: ActionButtonsProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DecisionStatus | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.promptOutput.promptBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const persistStatus = async (next: DecisionStatus) => {
    onStatusChange(next);
    setUpdateError(null);
    if (!result.recordId) return; // local-only fallback
    setPendingStatus(next);
    try {
      const res = await fetch(`/api/decision-records/${result.recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUpdateError("Durum güncellenemedi.");
    } finally {
      setPendingStatus(null);
    }
  };

  const isPending = (s: DecisionStatus) => pendingStatus === s;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => persistStatus("approved")}
          disabled={pendingStatus !== null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            status === "approved"
              ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-100"
              : "bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400"
          }`}
        >
          <span>✓</span>
          {isPending("approved") ? "Kaydediliyor..." : "ONAYLA"}
        </button>

        <button
          onClick={() => persistStatus("rejected")}
          disabled={pendingStatus !== null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            status === "rejected"
              ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-100"
              : "bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400"
          }`}
        >
          <span>✕</span>
          {isPending("rejected") ? "Kaydediliyor..." : "REDDET"}
        </button>

        <button
          onClick={() => persistStatus("observation")}
          disabled={pendingStatus !== null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            status === "observation"
              ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100"
              : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
          }`}
        >
          <span>◎</span>
          {isPending("observation") ? "Kaydediliyor..." : "GÖZLEM"}
        </button>

        <button
          onClick={() => {
            const next = !showPrompt;
            setShowPrompt(next);
            if (next) persistStatus("prompt_generated");
          }}
          disabled={pendingStatus !== null}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span>⚡</span>
          {isPending("prompt_generated") ? "Kaydediliyor..." : "PROMPT ÜRET"}
        </button>
      </div>

      {updateError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {updateError}
        </p>
      )}

      {showPrompt && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-indigo-600 flex-shrink-0">⚡</span>
              <span className="text-sm font-semibold text-indigo-800 truncate">
                {result.promptOutput.promptTitle}
              </span>
              <span className="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {result.promptOutput.targetTool}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer font-medium flex-shrink-0 ml-3"
            >
              {copied ? "Kopyalandı ✓" : "Kopyala"}
            </button>
          </div>
          <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-[520px] overflow-y-auto">
            {result.promptOutput.promptBody}
          </pre>
        </div>
      )}
    </div>
  );
}
