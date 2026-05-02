"use client";

import { useState } from "react";
import DecisionRequestForm from "@/components/DecisionRequestForm";
import DecisionResult from "@/components/DecisionResult";
import DecisionHistory from "@/components/DecisionHistory";
import { generateMockDecision } from "@/lib/mock-decision";
import { AnalysisSource, DecisionRequest, DecisionResult as DecisionResultType } from "@/types/decision";

type ViewState = "new" | "history" | "result";

export default function Home() {
  const [view, setView] = useState<ViewState>("new");
  const [isLoading, setIsLoading] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<DecisionRequest | null>(null);
  const [currentResult, setCurrentResult] = useState<DecisionResultType | null>(null);
  const [claudeSource, setClaudeSource] = useState<AnalysisSource>("mock");

  const handleSubmit = async (request: DecisionRequest) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) throw new Error("API hatası");

      const data: DecisionResultType = await res.json();
      setCurrentResult(data);
      setClaudeSource((data.claudeSource as AnalysisSource) ?? "mock");
      setCurrentRequest(
        data.enrichedAttachments?.length
          ? { ...request, attachments: data.enrichedAttachments }
          : request
      );
    } catch {
      const fallback = generateMockDecision(request);
      setCurrentResult(fallback);
      setClaudeSource("mock");
      setCurrentRequest(request);
    } finally {
      setIsLoading(false);
      setView("result");
    }
  };

  const handleReset = () => {
    setView("new");
    setCurrentRequest(null);
    setCurrentResult(null);
    setClaudeSource("mock");
  };

  const handleOpenFromHistory = (request: DecisionRequest, result: DecisionResultType) => {
    setCurrentRequest(request);
    setCurrentResult(result);
    setClaudeSource((result.claudeSource as AnalysisSource) ?? "mock");
    setView("result");
  };

  const handleTabClick = (tab: "new" | "history") => {
    setCurrentRequest(null);
    setCurrentResult(null);
    if (tab === "new") setClaudeSource("mock");
    setView(tab);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1b2638] text-slate-100">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.07),transparent_32%),linear-gradient(180deg,#223149_0%,#1b2638_48%,#202d42_100%)]" />
      <div className="algorithm-layer" aria-hidden="true">
        <svg className="network-field" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <g className="network-cluster network-left-top">
            <line x1="52" y1="64" x2="168" y2="84" />
            <line x1="168" y1="84" x2="258" y2="146" />
            <line x1="258" y1="146" x2="362" y2="132" />
            <line x1="362" y1="132" x2="468" y2="212" />
            <line x1="468" y1="212" x2="590" y2="210" />
            <line x1="168" y1="84" x2="228" y2="218" />
            <line x1="228" y1="218" x2="362" y2="132" />
            <line x1="362" y1="132" x2="408" y2="314" />
            <line x1="408" y1="314" x2="590" y2="210" />
            <line x1="120" y1="348" x2="228" y2="218" />
            <line x1="228" y1="218" x2="408" y2="314" />
            <line x1="408" y1="314" x2="316" y2="446" />
            <line x1="316" y1="446" x2="178" y2="474" />
            <line x1="178" y1="474" x2="120" y2="348" />
            <circle cx="52" cy="64" r="4" />
            <circle cx="168" cy="84" r="5" className="node-hot" />
            <circle cx="258" cy="146" r="4" />
            <circle cx="362" cy="132" r="5" />
            <circle cx="468" cy="212" r="4" className="node-hot" />
            <circle cx="590" cy="210" r="5" />
            <circle cx="228" cy="218" r="4" />
            <circle cx="408" cy="314" r="5" />
            <circle cx="120" cy="348" r="5" />
            <circle cx="316" cy="446" r="4" className="node-hot" />
            <circle cx="178" cy="474" r="4" />
          </g>
          <g className="network-cluster network-left-bottom">
            <line x1="94" y1="616" x2="188" y2="548" />
            <line x1="188" y1="548" x2="292" y2="624" />
            <line x1="292" y1="624" x2="354" y2="734" />
            <line x1="354" y1="734" x2="262" y2="812" />
            <line x1="262" y1="812" x2="112" y2="768" />
            <line x1="112" y1="768" x2="94" y2="616" />
            <line x1="188" y1="548" x2="354" y2="734" />
            <line x1="354" y1="734" x2="482" y2="642" />
            <line x1="482" y1="642" x2="568" y2="716" />
            <line x1="568" y1="716" x2="594" y2="826" />
            <line x1="292" y1="624" x2="482" y2="642" />
            <line x1="482" y1="642" x2="514" y2="524" />
            <circle cx="94" cy="616" r="5" />
            <circle cx="188" cy="548" r="4" />
            <circle cx="292" cy="624" r="5" />
            <circle cx="354" cy="734" r="4" />
            <circle cx="262" cy="812" r="5" className="node-hot" />
            <circle cx="112" cy="768" r="4" />
            <circle cx="482" cy="642" r="5" />
            <circle cx="568" cy="716" r="4" className="node-hot" />
            <circle cx="594" cy="826" r="4" />
            <circle cx="514" cy="524" r="4" />
          </g>
          <g className="network-cluster network-right-top">
            <line x1="974" y1="92" x2="1088" y2="142" />
            <line x1="1088" y1="142" x2="1198" y2="88" />
            <line x1="1198" y1="88" x2="1292" y2="164" />
            <line x1="1292" y1="164" x2="1364" y2="132" />
            <line x1="1088" y1="142" x2="1138" y2="286" />
            <line x1="1138" y1="286" x2="1292" y2="164" />
            <line x1="1292" y1="164" x2="1344" y2="302" />
            <line x1="1344" y1="302" x2="1240" y2="396" />
            <line x1="1240" y1="396" x2="1138" y2="286" />
            <line x1="974" y1="92" x2="1014" y2="246" />
            <line x1="1014" y1="246" x2="1138" y2="286" />
            <circle cx="974" cy="92" r="4" />
            <circle cx="1088" cy="142" r="5" />
            <circle cx="1198" cy="88" r="5" />
            <circle cx="1292" cy="164" r="4" className="node-hot" />
            <circle cx="1364" cy="132" r="5" />
            <circle cx="1138" cy="286" r="5" />
            <circle cx="1344" cy="302" r="4" />
            <circle cx="1240" cy="396" r="5" className="node-hot" />
            <circle cx="1014" cy="246" r="4" />
          </g>
          <g className="network-cluster network-right-bottom">
            <line x1="920" y1="620" x2="1014" y2="698" />
            <line x1="1014" y1="698" x2="1134" y2="642" />
            <line x1="1134" y1="642" x2="1268" y2="722" />
            <line x1="1268" y1="722" x2="1382" y2="664" />
            <line x1="1014" y1="698" x2="1052" y2="826" />
            <line x1="1052" y1="826" x2="1198" y2="782" />
            <line x1="1198" y1="782" x2="1268" y2="722" />
            <line x1="920" y1="620" x2="1052" y2="826" />
            <line x1="1052" y1="826" x2="1198" y2="782" />
            <circle cx="920" cy="620" r="5" />
            <circle cx="1014" cy="698" r="4" className="node-hot" />
            <circle cx="1134" cy="642" r="5" />
            <circle cx="1268" cy="722" r="4" />
            <circle cx="1382" cy="664" r="5" className="node-hot" />
            <circle cx="1052" cy="826" r="5" />
            <circle cx="1198" cy="782" r="4" />
          </g>
        </svg>
      </div>
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-slate-500/40 bg-[#223047]/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-[150px] items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-400 flex items-center justify-center shadow-sm">
              <span className="text-slate-950 text-xs font-black">AI</span>
            </div>
            <span className="font-bold text-slate-50 text-sm tracking-tight">
              Verdict AI
            </span>
          </div>
          <div className="order-3 flex w-full justify-center gap-1 rounded-full border border-slate-500/45 bg-slate-700/35 p-1 sm:order-none sm:w-auto">
            <button
              onClick={() => handleTabClick("new")}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition cursor-pointer ${
                view === "new"
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-slate-50"
              }`}
            >
              Yeni Talep
            </button>
            <button
              onClick={() => handleTabClick("history")}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition cursor-pointer ${
                view === "history"
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-slate-50"
              }`}
            >
              Geçmiş Raporlar
            </button>
          </div>
          <div className="flex min-w-[150px] items-center justify-end gap-2">
            <span className="text-xs text-slate-300 bg-white/[0.05] border border-slate-500/40 px-2.5 py-1 rounded-full">
              MVP v0.1
            </span>
            {claudeSource === "live" ? (
              <span className="text-xs text-emerald-100 bg-emerald-400/10 border border-emerald-300/30 px-2.5 py-1 rounded-full">
                Claude Canlı
              </span>
            ) : (
              <span className="text-xs text-amber-200 bg-amber-400/10 border border-amber-300/20 px-2.5 py-1 rounded-full">
                Mock Mod
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-[1] max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view === "new" && (
          <div className="space-y-5">
            {/* AI Rolleri */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  name: "Claude Code",
                  role: "Ana Mühendis",
                  icon: "🤖",
                  color: "bg-cyan-400/10 border-cyan-300/15 text-cyan-100",
                  desc: "Teknik analiz & uygulanabilirlik",
                },
                {
                  name: "Codex",
                  role: "Kod Denetçisi",
                  icon: "🔍",
                  color: "bg-violet-400/10 border-violet-300/15 text-violet-100",
                  desc: "Kod & test risk değerlendirmesi",
                },
                {
                  name: "ChatGPT",
                  role: "Hakem",
                  icon: "🏆",
                  color: "bg-emerald-400/10 border-emerald-300/15 text-emerald-100",
                  desc: "Final karar & yol haritası",
                },
              ].map((ai) => (
                <div
                  key={ai.name}
                  className={`rounded-xl border px-2.5 py-2.5 text-center shadow-sm backdrop-blur ${ai.color}`}
                >
                  <div className="text-lg mb-0.5">{ai.icon}</div>
                  <div className="font-semibold text-xs">{ai.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{ai.role}</div>
                  <div className="text-[11px] opacity-60 mt-1 hidden sm:block">{ai.desc}</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-[#24324a]/92 rounded-2xl border border-slate-500/40 shadow-sm p-6 sm:p-8">
              <h2 className="text-base font-semibold text-slate-100 mb-6 flex items-center gap-2">
                <span>📋</span>
                Yeni Karar Talebi
              </h2>
              <DecisionRequestForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        )}

        {view === "history" && (
          <DecisionHistory onOpen={handleOpenFromHistory} />
        )}

        {view === "result" && currentRequest && currentResult && (
          <DecisionResult
            request={currentRequest}
            result={currentResult}
            onReset={handleReset}
          />
        )}
      </main>

      <div className="pb-8" />
    </div>
  );
}
