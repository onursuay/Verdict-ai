"use client";

import { useState } from "react";
import { ActionStatus, DecisionResult } from "@/types/decision";

interface ActionButtonsProps {
  result: DecisionResult;
  onStatusChange: (status: ActionStatus) => void;
}

export default function ActionButtons({ result, onStatusChange }: ActionButtonsProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onStatusChange("approved")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
            result.status === "approved"
              ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-100"
              : "bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400"
          }`}
        >
          <span>✓</span>
          ONAYLA
        </button>

        <button
          onClick={() => onStatusChange("rejected")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
            result.status === "rejected"
              ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-100"
              : "bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400"
          }`}
        >
          <span>✕</span>
          REDDET
        </button>

        <button
          onClick={() => onStatusChange("observed")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
            result.status === "observed"
              ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100"
              : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
          }`}
        >
          <span>◎</span>
          GÖZLEM
        </button>

        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer ml-auto"
        >
          <span>⚡</span>
          PROMPT ÜRET
        </button>
      </div>

      {showPrompt && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-50">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">⚡</span>
              <span className="text-sm font-semibold text-indigo-800">
                Üretilen Claude Code Promptu
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer font-medium"
            >
              {copied ? "Kopyalandı ✓" : "Kopyala"}
            </button>
          </div>
          <pre className="p-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {result.generatedPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
