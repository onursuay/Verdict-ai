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
        <span className="algo-item algo-item-1">if risk &gt; 70</span>
        <span className="algo-item algo-item-2">score++</span>
        <span className="algo-item algo-item-3">0101</span>
        <span className="algo-item algo-item-4">route()</span>
        <span className="algo-item algo-item-5">AI</span>
        <span className="algo-item algo-item-6">{"{ verdict }"}</span>
        <span className="algo-item algo-item-7">confidence</span>
        <span className="algo-line algo-line-1" />
        <span className="algo-line algo-line-2" />
        <span className="algo-line algo-line-3" />
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
