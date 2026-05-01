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
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">
              Verdict AI
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              MVP v0.1
            </span>
            {claudeSource === "live" ? (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                Claude Canlı
              </span>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                Mock Mod
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          <button
            onClick={() => handleTabClick("new")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
              view === "new"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Yeni Talep
          </button>
          <button
            onClick={() => handleTabClick("history")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
              view === "history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Geçmiş Raporlar
          </button>
        </div>

        {view === "new" && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3 pt-2 pb-2">
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span>🤖</span>
                Çoklu AI · Hakem Sistemi
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Verdict AI
              </h1>
              <p className="text-gray-500 text-base max-w-md mx-auto">
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
                  color: "bg-indigo-50 border-indigo-100 text-indigo-700",
                  desc: "Teknik analiz & uygulanabilirlik",
                },
                {
                  name: "Codex",
                  role: "Kod Denetçisi",
                  icon: "🔍",
                  color: "bg-violet-50 border-violet-100 text-violet-700",
                  desc: "Kod & test risk değerlendirmesi",
                },
                {
                  name: "ChatGPT",
                  role: "Hakem",
                  icon: "🏆",
                  color: "bg-green-50 border-green-100 text-green-700",
                  desc: "Final karar & yol haritası",
                },
              ].map((ai) => (
                <div
                  key={ai.name}
                  className={`rounded-xl border p-3 text-center ${ai.color}`}
                >
                  <div className="text-xl mb-1">{ai.icon}</div>
                  <div className="font-semibold text-xs">{ai.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{ai.role}</div>
                  <div className="text-xs opacity-60 mt-1 hidden sm:block">{ai.desc}</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
              <h2 className="text-base font-semibold text-gray-800 mb-6 flex items-center gap-2">
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
