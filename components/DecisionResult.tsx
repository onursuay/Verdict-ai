"use client";

import { useState } from "react";
import { DecisionRequest, DecisionResult as DecisionResultType, DecisionStatus } from "@/types/decision";
import DecisionCard from "./DecisionCard";
import ActionButtons from "./ActionButtons";

interface DecisionResultProps {
  request: DecisionRequest;
  result: DecisionResultType;
  onReset: () => void;
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  Kritik: { label: "KRİTİK", className: "bg-red-100 text-red-700 border border-red-200" },
  Orta: { label: "ORTA", className: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  Düşük: { label: "DÜŞÜK", className: "bg-green-100 text-green-700 border border-green-200" },
};

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-green-100 text-green-700" :
    score >= 70 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      Güven %{score}
    </span>
  );
}

export default function DecisionResult({ request, result, onReset }: DecisionResultProps) {
  const [status, setStatus] = useState<DecisionStatus>(request.status);

  const claude = result.analyses.find((a) => a.role === "claude_engineer")!;
  const codex = result.analyses.find((a) => a.role === "codex_reviewer")!;

  const badge = PRIORITY_BADGE[request.priority];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{request.projectName}</h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {request.requestType}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {request.createdAt.toLocaleString("tr-TR", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer whitespace-nowrap"
        >
          ← Yeni Talep
        </button>
      </div>

      {/* Nihai Karar — Öne Çıkan Kart */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-semibold opacity-90">ChatGPT Hakem Kararı</span>
            {result.judgeSource === "live" ? (
              <span className="text-xs font-semibold bg-green-400/30 text-green-100 border border-green-300/30 px-2 py-0.5 rounded-full">
                Canlı Hakem
              </span>
            ) : (
              <span className="text-xs font-semibold bg-white/15 text-white/70 px-2 py-0.5 rounded-full">
                Mock Hakem
              </span>
            )}
          </div>
          <span className="text-xs font-semibold bg-white/20 text-white px-2.5 py-1 rounded-full">
            Güven %{result.finalVerdict.confidenceScore}
          </span>
        </div>
        <p className="text-base font-medium leading-relaxed">
          {result.finalVerdict.verdict}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Uygulanacak Yol */}
        <DecisionCard title="Uygulanacak Yol" icon="🗺️" badge="Onaylı" badgeColor="green">
          <ol className="space-y-2">
            {result.finalVerdict.executionPlan.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Sonraki Aksiyon
            </p>
            <p className="text-sm text-gray-700 bg-green-50 rounded-lg p-3 border border-green-100">
              {result.finalVerdict.nextAction}
            </p>
          </div>
        </DecisionCard>

        {/* Riskler */}
        <DecisionCard title="Riskler & Dikkat Noktaları" icon="⚠️" badge="İncelenmeli" badgeColor="amber">
          <ul className="space-y-2">
            {result.finalVerdict.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                {risk}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Reddedilen Öneriler
            </p>
            <ul className="space-y-1.5">
              {result.finalVerdict.rejectedSuggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500 line-through">
                  <span className="text-red-400 no-underline">✕</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </DecisionCard>
      </div>

      {/* AI Görüşleri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claude Analizi */}
        <DecisionCard title="Claude Code Analizi" icon="🤖" badge="Ana Mühendis" badgeColor="indigo">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 italic">{claude.title}</p>
              <ConfidenceBadge score={claude.confidenceScore} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Özet
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">{claude.summary}</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Öneri
              </p>
              <p className="text-sm text-gray-700 font-medium">{claude.recommendation}</p>
            </div>
            {claude.objections.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  İtirazlar
                </p>
                <ul className="space-y-1">
                  {claude.objections.map((obj, i) => (
                    <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                      <span className="text-orange-400 flex-shrink-0">!</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DecisionCard>

        {/* Codex Denetimi */}
        <DecisionCard title="Codex Denetimi" icon="🔍" badge="Kod Denetçisi" badgeColor="violet">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 italic">{codex.title}</p>
              <ConfidenceBadge score={codex.confidenceScore} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Özet
              </p>
              <p className="text-sm text-gray-600">{codex.summary}</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Riskler
              </p>
              <ul className="space-y-1.5">
                {codex.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-amber-400 flex-shrink-0">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Alternatif Öneri
              </p>
              <p className="text-sm text-gray-700 bg-violet-50 rounded-lg p-3 border border-violet-100">
                {codex.recommendation}
              </p>
            </div>
          </div>
        </DecisionCard>
      </div>

      {/* Aksiyon Butonları */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <span>⚡</span> Aksiyonlar
        </h3>
        <ActionButtons result={result} status={status} onStatusChange={setStatus} />
      </div>
    </div>
  );
}
