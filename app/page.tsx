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
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#03111f_0%,#030712_42%,#020617_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-emerald-300/10 bg-[#030712]/85 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-400 flex items-center justify-center shadow-[0_0_28px_rgba(45,212,191,0.28)]">
              <span className="text-slate-950 text-xs font-black">AI</span>
            </div>
            <span className="font-bold text-slate-50 text-sm tracking-tight">
              Verdict AI
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-full">
              MVP v0.1
            </span>
            {claudeSource === "live" ? (
              <span className="text-xs text-emerald-100 bg-emerald-400/10 border border-emerald-300/25 px-2.5 py-1 rounded-full shadow-[0_0_22px_rgba(16,185,129,0.12)]">
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

      <main className="relative z-[1] max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/10">
          <button
            onClick={() => handleTabClick("new")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
              view === "new"
                ? "border-emerald-300 text-emerald-200"
                : "border-transparent text-slate-500 hover:text-slate-200"
            }`}
          >
            Yeni Talep
          </button>
          <button
            onClick={() => handleTabClick("history")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
              view === "history"
                ? "border-emerald-300 text-emerald-200"
                : "border-transparent text-slate-500 hover:text-slate-200"
            }`}
          >
            Geçmiş Raporlar
          </button>
        </div>

        {view === "new" && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3 pt-2 pb-2">
              <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-300/20 text-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-full shadow-[0_0_26px_rgba(45,212,191,0.12)]">
                <span>🤖</span>
                Çoklu AI · Hakem Sistemi
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 tracking-tight">
                Verdict AI
              </h1>
              <p className="text-slate-400 text-base max-w-md mx-auto">
                Tek input. Çoklu yapay zekâ analizi. Tek nihai karar.
                <br />
                Claude · Codex · ChatGPT bir arada.
              </p>
            </div>

            {/* AI Rolleri */}
            <div className="grid grid-cols-3 gap-3">
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
                  className={`rounded-xl border p-3 text-center shadow-[0_18px_40px_rgba(0,0,0,0.20)] backdrop-blur ${ai.color}`}
                >
                  <div className="text-xl mb-1">{ai.icon}</div>
                  <div className="font-semibold text-xs">{ai.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{ai.role}</div>
                  <div className="text-xs opacity-60 mt-1 hidden sm:block">{ai.desc}</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-[#08111f]/90 rounded-2xl border border-emerald-300/10 shadow-[0_24px_70px_rgba(0,0,0,0.34)] p-6 sm:p-8">
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
