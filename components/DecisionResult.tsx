"use client";

import { useState } from "react";
import {
  DecisionFollowUp,
  DecisionRequest,
  DecisionResult as DecisionResultType,
  DecisionStatus,
  ImplementationTaskInfo,
} from "@/types/decision";
import DecisionCard from "./DecisionCard";
import ActionButtons from "./ActionButtons";

interface DecisionResultProps {
  request: DecisionRequest;
  result: DecisionResultType;
  onReset: () => void;
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  Kritik: { label: "KRİTİK", className: "bg-red-400/10 text-red-200 border border-red-300/25" },
  Orta: { label: "ORTA", className: "bg-amber-400/10 text-amber-200 border border-amber-300/25" },
  Düşük: { label: "DÜŞÜK", className: "bg-emerald-400/10 text-emerald-200 border border-emerald-300/25" },
};

function splitExecutionPlan(plan: string[]): string[] {
  if (plan.length === 1 && plan[0].includes("→")) {
    return plan[0].split("→").map(s => s.trim()).filter(Boolean);
  }
  return plan;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? "bg-emerald-400/10 text-emerald-200 border border-emerald-300/20" :
    score >= 70 ? "bg-amber-400/10 text-amber-200 border border-amber-300/20" :
    "bg-red-400/10 text-red-200 border border-red-300/20";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      Güven %{score}
    </span>
  );
}

const IMPL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  queued:           { label: "Kuyruğa alındı",                  color: "bg-cyan-400/10 text-cyan-200 border-cyan-300/20" },
  sent:             { label: "Claude Code'a gönderildi",         color: "bg-sky-400/10 text-sky-200 border-sky-300/20" },
  running:          { label: "Çalışıyor",                        color: "bg-amber-400/10 text-amber-200 border-amber-300/20" },
  completed:        { label: "Tamamlandı ✓",                     color: "bg-emerald-400/10 text-emerald-200 border-emerald-300/20" },
  failed:           { label: "Hata aldı",                        color: "bg-red-400/10 text-red-200 border-red-300/20" },
  review_required:  { label: "Review gerekiyor",                 color: "bg-amber-400/10 text-amber-200 border-amber-300/20" },
};

export default function DecisionResult({ request, result, onReset }: DecisionResultProps) {
  const [status, setStatus] = useState<DecisionStatus>(request.status);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [implementationTask, setImplementationTask] = useState<ImplementationTaskInfo | null>(null);
  const [followUps, setFollowUps] = useState<DecisionFollowUp[]>(result.followUps ?? []);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    if (!result.recordId) { onReset(); return; }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/decision-records/${result.recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onReset();
    } catch {
      setDeleteError("Silme başarısız. Tekrar deneyin.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    const reportEl = document.getElementById("verdict-report");
    if (!reportEl) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Verdict AI Raporu — ${request.projectName}</title><style>
    *{box-sizing:border-box}
    body{font-family:system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111827;font-size:14px;line-height:1.6}
    h4{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;margin:0 0 10px}
    section{margin-bottom:24px;page-break-inside:avoid}
    p{color:#374151;margin:4px 0}
    li{color:#374151;margin:0}
    ol,ul{padding-left:0;list-style:none;margin:0}
    .flex{display:flex}.items-start{align-items:flex-start}.gap-2{gap:8px}.leading-relaxed{line-height:1.6}
    .step-num{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#e0e7ff;color:#4338ca;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:2px}
    .space-y-1-5>*+*{margin-top:6px}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;margin-right:6px}
    .live{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
    .mock{background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb}
    .border-t{border-top:1px solid #f3f4f6;margin:16px 0}
    .att-item{border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin:6px 0}
    .att-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
    .att-name{font-weight:600;color:#1f2937}
    .att-meta{color:#9ca3af}
    .att-badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;border:1px solid #e5e7eb;margin-left:auto}
    .att-note{color:#9ca3af;font-style:italic;font-size:12px;margin-top:6px}
    .att-content{background:#f9fafb;border-radius:4px;padding:8px;font-family:monospace;font-size:11px;color:#6b7280;margin-top:6px;word-break:break-word;white-space:pre-wrap}
    .no-print{display:none!important}
    @media print{body{margin:0;padding:0 12px}section{page-break-inside:avoid}.no-print{display:none!important}}
  </style></head><body>${reportEl.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const claude = result.analyses.find((a) => a.role === "claude_engineer")!;
  const codex = result.analyses.find((a) => a.role === "codex_reviewer")!;
  const gemini = result.analyses.find((a) => a.role === "gemini_context_reviewer");

  const badge = PRIORITY_BADGE[request.priority];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-50">{request.projectName}</h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            <span className="text-xs text-slate-200 bg-slate-700/80 border border-slate-500/45 px-2.5 py-1 rounded-full">
              {request.requestType}
            </span>
            {result.saved === true ? (
              <span className="text-xs font-medium text-emerald-200 bg-emerald-400/10 border border-emerald-300/25 px-2 py-0.5 rounded-full">
                Kayıt alındı
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-300 bg-slate-700/70 border border-slate-500/45 px-2 py-0.5 rounded-full">
                Kayıt yapılmadı
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {request.createdAt.toLocaleString("tr-TR", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="text-sm text-slate-400 hover:text-slate-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer whitespace-nowrap"
          >
            ← Yeni Talep
          </button>
          {result.recordId && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-sm text-slate-500 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition cursor-pointer disabled:opacity-50"
              title="Raporu sil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {deleteError && (
            <span className="text-xs text-red-300">{deleteError}</span>
          )}
        </div>
      </div>

      {/* Nihai Karar — Öne Çıkan Kart */}
      <div className="bg-gradient-to-r from-[#176b63] via-[#157a72] to-[#247f91] rounded-2xl border border-emerald-200/20 p-5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-semibold opacity-90">ChatGPT Hakem Kararı</span>
            {result.judgeSource === "live" ? (
              <span className="text-xs font-semibold bg-emerald-300/20 text-emerald-50 border border-emerald-100/30 px-2 py-0.5 rounded-full">
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
            {splitExecutionPlan(result.finalVerdict.executionPlan).map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-400/15 text-emerald-200 text-xs font-bold flex items-center justify-center mt-0.5 border border-emerald-300/20">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Sonraki Aksiyon
            </p>
            <p className="text-sm text-emerald-100 bg-emerald-400/10 rounded-lg p-3 border border-emerald-300/20">
              {result.finalVerdict.nextAction}
            </p>
          </div>
        </DecisionCard>

        {/* Riskler */}
        <DecisionCard title="Riskler & Dikkat Noktaları" icon="⚠️" badge="İncelenmeli" badgeColor="amber">
          <ul className="space-y-2">
            {result.finalVerdict.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                {risk}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-slate-600/35">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Reddedilen Öneriler
            </p>
            <ul className="space-y-1.5">
              {result.finalVerdict.rejectedSuggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500 line-through">
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
              <p className="text-xs text-slate-500 italic">{claude.title}</p>
              <ConfidenceBadge score={claude.confidenceScore} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Özet
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{claude.summary}</p>
            </div>
            <div className="pt-3 border-t border-slate-600/35">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Öneri
              </p>
              <p className="text-sm text-emerald-100 font-medium">{claude.recommendation}</p>
            </div>
            {claude.objections.length > 0 && (
              <div className="pt-3 border-t border-slate-600/35">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  İtirazlar
                </p>
                <ul className="space-y-1">
                  {claude.objections.map((obj, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
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
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs text-slate-500 italic">{codex.title}</p>
              <div className="flex items-center gap-1.5">
                {result.codexSource === "live" ? (
                  <span className="text-xs font-semibold bg-violet-400/10 text-violet-200 border border-violet-300/20 px-2 py-0.5 rounded-full">
                    Canlı Denetçi
                  </span>
                ) : (
                  <span className="text-xs font-semibold bg-slate-700/80 text-slate-300 border border-slate-500/40 px-2 py-0.5 rounded-full">
                    Mock Denetçi
                  </span>
                )}
                <ConfidenceBadge score={codex.confidenceScore} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Özet
              </p>
              <p className="text-sm text-slate-300">{codex.summary}</p>
            </div>
            <div className="pt-3 border-t border-slate-600/35">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Riskler
              </p>
              <ul className="space-y-1.5">
                {codex.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-amber-400 flex-shrink-0">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-600/35">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Alternatif Öneri
              </p>
              <p className="text-sm text-violet-100 bg-violet-400/10 rounded-lg p-3 border border-violet-300/20">
                {codex.recommendation}
              </p>
            </div>
          </div>
        </DecisionCard>
      </div>

      {/* Gemini Bağlam Denetimi */}
      {gemini && (
        <DecisionCard title="Gemini Bağlam Denetimi" icon="🧭" badge="Bağlam Denetçisi" badgeColor="amber">
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs text-slate-500 italic">{gemini.title}</p>
              <div className="flex items-center gap-1.5">
                {result.geminiSource === "live" ? (
                  <span className="text-xs font-semibold bg-amber-400/10 text-amber-200 border border-amber-300/20 px-2 py-0.5 rounded-full">
                    Canlı Bağlam
                  </span>
                ) : (
                  <span className="text-xs font-semibold bg-slate-700/80 text-slate-300 border border-slate-500/40 px-2 py-0.5 rounded-full">
                    Mock Bağlam
                  </span>
                )}
                <ConfidenceBadge score={gemini.confidenceScore} />
              </div>
            </div>
            {result.geminiSource !== "live" && result.geminiError && (
              <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 leading-relaxed">
                <span className="font-semibold">Gemini canlı çalışmadı:</span>{" "}
                <span className="break-all">{result.geminiError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Özet
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">{gemini.summary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Bağlam Riskleri
                </p>
                <ul className="space-y-1.5">
                  {gemini.risks.map((r, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <span className="text-amber-400 flex-shrink-0">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {gemini.objections.length > 0 && (
              <div className="pt-3 border-t border-slate-600/35">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Destek / İtiraz
                </p>
                <ul className="space-y-1">
                  {gemini.objections.map((o, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-amber-400 flex-shrink-0">!</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pt-3 border-t border-slate-600/35">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Öneri
              </p>
              <p className="text-sm text-amber-100 bg-amber-400/10 rounded-lg p-3 border border-amber-300/20">
                {gemini.recommendation}
              </p>
            </div>
          </div>
        </DecisionCard>
      )}

      {/* Nihai Rapor */}
      <div id="verdict-report" className="bg-[#24324a]/92 rounded-2xl border border-slate-500/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-500/35 bg-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-base">📄</span>
            <h3 className="font-semibold text-slate-100 text-sm">Nihai Rapor</h3>
          </div>
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-1.5 text-xs font-medium text-emerald-100 bg-emerald-400/10 hover:bg-emerald-400/15 border border-emerald-300/20 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF İndir
          </button>
        </div>
        <div className="p-5 space-y-5 text-sm text-slate-300">
          {/* Talep Özeti */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Talep Özeti</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div><span className="text-slate-500">Proje:</span> <span className="font-medium text-slate-100">{request.projectName}</span></div>
              <div><span className="text-slate-500">Tip:</span> {request.requestType}</div>
              <div><span className="text-slate-500">Öncelik:</span> {request.priority}</div>
              <div><span className="text-slate-500">Çıktı:</span> {request.expectedOutput}</div>
            </div>
            <p className="mt-2 text-slate-300 leading-relaxed">{request.problem}</p>
          </section>

          {/* Audit Context Pack — kaynak bazında tarama sonucu */}
          {result.auditContextPack && (() => {
            const pack = result.auditContextPack;
            const SOURCE_LABEL: Record<string, { code: string; title: string }> = {
              github: { code: "GH", title: "GitHub" },
              supabase: { code: "SB", title: "Supabase" },
              vercel: { code: "VC", title: "Vercel" },
              local: { code: "LP", title: "Lokal Yol" },
              worker: { code: "VPS", title: "VPS / Worker" },
            };
            const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "off" | "warn" | "err" }> = {
              not_selected: { label: "seçilmedi", tone: "off" },
              pending: { label: "bekliyor", tone: "warn" },
              scanning: { label: "taranıyor", tone: "warn" },
              completed: { label: "tamamlandı", tone: "ok" },
              error: { label: "hata", tone: "err" },
              unauthorized: { label: "yetki yok", tone: "err" },
              timeout: { label: "zaman aşımı", tone: "err" },
              not_configured: { label: "yapılandırılmadı", tone: "off" },
            };
            const tone = (t: "ok" | "warn" | "off" | "err") =>
              t === "ok" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" :
              t === "warn" ? "border-amber-300/30 bg-amber-400/10 text-amber-200" :
              t === "err" ? "border-red-300/30 bg-red-400/10 text-red-200" :
              "border-slate-500/45 bg-slate-800/55 text-slate-400";
            const confidenceColor =
              pack.confidence === "high" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" :
              pack.confidence === "medium" ? "border-amber-300/30 bg-amber-400/10 text-amber-200" :
              pack.confidence === "low" ? "border-red-300/30 bg-red-400/10 text-red-200" :
              "border-slate-500/45 bg-slate-800/55 text-slate-300";
            const order: Array<keyof typeof pack.reports> = ["github", "supabase", "vercel", "local", "worker"];
            return (
              <>
                <div className="border-t border-slate-600/35" />
                <section>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Audit Context Pack</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceColor}`}>
                        Güven: {pack.confidence}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${pack.finalDecisionAllowed ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-red-300/30 bg-red-400/10 text-red-200"}`}>
                        {pack.finalDecisionAllowed ? "Final patch için yeterli" : "Final patch için YETERSİZ"}
                      </span>
                      <span className="rounded-full border border-slate-500/45 bg-slate-800/55 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        Mod: {pack.mode}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Karakter: {pack.totals.contextChars.toLocaleString("tr-TR")} / {pack.totals.contextCharsLimit.toLocaleString("tr-TR")} • ~{pack.totals.approxTokens.toLocaleString("tr-TR")} token • Seçilen: {pack.totals.selectedSources}/5 • Tamamlanan: {pack.totals.completedSources} • Başarısız: {pack.totals.failedSources}
                  </p>
                  <ul className="space-y-2">
                    {order.map((k) => {
                      const r = pack.reports[k];
                      const lbl = SOURCE_LABEL[k];
                      const isSelected = pack.selection[k as keyof typeof pack.selection];
                      const status = r?.status ?? (isSelected ? "pending" : "not_selected");
                      const st = STATUS_LABEL[status] ?? STATUS_LABEL.not_selected;
                      return (
                        <li key={k} className={`rounded-lg border px-3 py-2 ${isSelected ? "border-slate-500/45 bg-slate-800/40" : "border-slate-500/30 bg-slate-800/20"}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex h-7 min-w-[2.25rem] items-center justify-center rounded border border-slate-500/45 bg-slate-900/45 px-1.5 text-[11px] font-black tracking-wide text-slate-200">
                              {lbl?.code}
                            </span>
                            <span className="text-sm font-semibold text-slate-100">{lbl?.title}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone(st.tone)}`}>
                              {st.label}
                            </span>
                            {r?.critical && (
                              <span className="rounded-full border border-red-300/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                                kritik
                              </span>
                            )}
                            {typeof r?.promptBlockChars === "number" && r.promptBlockChars > 0 && (
                              <span className="text-[10px] text-slate-500">
                                {r.promptBlockChars.toLocaleString("tr-TR")} char
                              </span>
                            )}
                          </div>
                          {r?.summary && (
                            <p className="mt-1.5 text-xs text-slate-300">{r.summary}</p>
                          )}
                          {r?.detail && r.detail.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-xs text-slate-400">
                              {r.detail.slice(0, 6).map((d, i) => <li key={i}>• {d}</li>)}
                            </ul>
                          )}
                          {r?.errorMessage && (
                            <p className="mt-1.5 text-xs text-red-200 bg-red-400/10 border border-red-300/25 rounded px-2 py-1">
                              {r.errorMessage}
                            </p>
                          )}
                          {r?.warnings && r.warnings.length > 0 && (
                            <ul className="mt-1 text-[11px] text-amber-200">
                              {r.warnings.slice(0, 3).map((w, i) => <li key={i}>! {w}</li>)}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {pack.confidenceReason.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Güven gerekçesi:</span> {pack.confidenceReason.join(" • ")}
                    </p>
                  )}
                  {pack.finalDecisionBlockers.length > 0 && (
                    <div className="mt-2 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                      <p className="font-semibold mb-0.5">Final patch engelleyiciler:</p>
                      <ul className="space-y-0.5">
                        {pack.finalDecisionBlockers.map((b, i) => <li key={i}>• {b}</li>)}
                      </ul>
                    </div>
                  )}
                  {pack.warnings.length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      <p className="font-semibold mb-0.5">Bütçe / pipeline uyarıları:</p>
                      <ul className="space-y-0.5">
                        {pack.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                      </ul>
                    </div>
                  )}
                </section>
              </>
            );
          })()}

          {/* Kod Bağlamı — GitHub repo okuma sonucu (geriye uyum) */}
          {result.repoContext && (() => {
            const rc = result.repoContext;
            const hasError = !!rc.errorMessage;
            return (
              <>
                <div className="border-t border-slate-600/35" />
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Kod Bağlamı</h4>
                  {hasError ? (
                    <p className="text-sm text-amber-200 bg-amber-400/10 border border-amber-300/25 rounded-lg px-3 py-2">
                      Kod bağlamı alınamadı. Analiz açıklama ve ek dosyalara göre yapılmıştır.
                      <span className="block mt-1 text-xs text-amber-200/80">{rc.errorMessage}</span>
                    </p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <div><span className="text-slate-500">GitHub Repo:</span> <span className="font-medium text-slate-100">{rc.owner}/{rc.repo}</span></div>
                        <div><span className="text-slate-500">Branch:</span> <span className="font-medium text-slate-100">{rc.branch}</span></div>
                        <div><span className="text-slate-500">Okunan dosya:</span> <span className="font-medium text-slate-100">{rc.selectedFiles.length}</span></div>
                        <div><span className="text-slate-500">Çekilme:</span> <span className="text-slate-300 text-xs">{new Date(rc.fetchedAt).toLocaleString("tr-TR")}</span></div>
                      </div>

                      {rc.selectedFiles.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-500 mb-1.5">Seçilen dosyalar:</p>
                          <ul className="space-y-1">
                            {rc.selectedFiles.map((f) => (
                              <li key={f.path} className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                                <span className="text-emerald-200/80">📄</span>
                                <span className="font-mono">{f.path}</span>
                                <span className="text-slate-500">{f.language} · {(f.size / 1024).toFixed(1)} KB</span>
                                {f.reason && <span className="text-slate-500 italic">({f.reason})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {rc.warnings.length > 0 && (
                        <div className="mt-2 text-xs text-amber-200 bg-amber-400/10 border border-amber-300/25 rounded-lg px-3 py-2">
                          <p className="font-semibold mb-0.5">Uyarılar:</p>
                          <ul className="space-y-0.5">
                            {rc.warnings.map((w, i) => (
                              <li key={i}>• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            );
          })()}

          {/* Proje Bağlamı — sadece dolu alanlar */}
          {request.projectContext && (() => {
            const ctx = request.projectContext;
            const rows: Array<[string, string]> = [];
            if (ctx.githubRepoUrl) rows.push(["GitHub Repo", ctx.githubRepoUrl]);
            if (ctx.localProjectPath) rows.push(["Lokal Yol", ctx.localProjectPath]);
            if (ctx.liveUrl) rows.push(["Canlı URL", ctx.liveUrl]);
            if (ctx.vercelProjectUrl) rows.push(["Vercel", ctx.vercelProjectUrl]);
            if (ctx.vpsHost) rows.push(["VPS / Worker", ctx.vpsHost]);
            if (ctx.supabaseProjectUrl) rows.push(["Supabase", ctx.supabaseProjectUrl]);
            if (ctx.notes) rows.push(["Not", ctx.notes]);
            if (!rows.length) return null;
            return (
              <>
                <div className="border-t border-slate-600/35" />
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Proje Bağlamı</h4>
                  <ul className="space-y-1.5 text-sm">
                    {rows.map(([label, value]) => (
                      <li key={label} className="flex flex-wrap gap-x-2">
                        <span className="text-slate-500 min-w-[110px]">{label}:</span>
                        {/^https?:\/\//.test(value) ? (
                          <a href={value} target="_blank" rel="noreferrer" className="text-emerald-200 hover:text-emerald-100 break-all underline-offset-2 hover:underline">
                            {value}
                          </a>
                        ) : (
                          <span className="text-slate-200 break-all">{value}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            );
          })()}

          <div className="border-t border-slate-600/35" />

          {/* AI Süreç Özeti */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">AI Süreç Özeti</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Claude Code", source: result.claudeSource },
                { label: "Codex Denetçi", source: result.codexSource },
                { label: "Gemini Bağlam", source: result.geminiSource },
                { label: "ChatGPT Hakem", source: result.judgeSource },
              ].map((ai) => (
                <span key={ai.label} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${ai.source === "live" ? "bg-emerald-400/10 text-emerald-200 border-emerald-300/20" : "bg-slate-700/70 text-slate-300 border-slate-500/40"}`}>
                  {ai.label} — {ai.source === "live" ? "Canlı" : "Mock"}
                </span>
              ))}
            </div>
          </section>

          <div className="border-t border-slate-600/35" />

          {/* Claude Mühendis */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Claude Code / Ana Mühendis Görüşü</h4>
            <p className="leading-relaxed">{claude.summary}</p>
            <p className="mt-1.5 text-emerald-100 font-medium">{claude.recommendation}</p>
          </section>

          <div className="border-t border-slate-600/35" />

          {/* Codex */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Codex / Denetçi Görüşü</h4>
            <p className="leading-relaxed">{codex.summary}</p>
            <p className="mt-1.5 text-cyan-100 font-medium">{codex.recommendation}</p>
          </section>

          {gemini && (
            <>
              <div className="border-t border-slate-600/35" />
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Gemini / Bağlam Denetimi</h4>
                <p className="leading-relaxed">{gemini.summary}</p>
                {gemini.risks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Bağlam Riskleri</p>
                    <ul className="space-y-1">
                      {gemini.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm"><span className="text-amber-400 flex-shrink-0">•</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {gemini.objections.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1">İtirazlar</p>
                    <ul className="space-y-1">
                      {gemini.objections.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm"><span className="text-orange-400 flex-shrink-0">!</span>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-1.5 text-amber-100 font-medium">{gemini.recommendation}</p>
              </section>
            </>
          )}

          <div className="border-t border-slate-600/35" />

          {/* ChatGPT Hakem */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ChatGPT / Hakem Kararı</h4>
            <p className="font-semibold text-slate-50 leading-relaxed">{result.finalVerdict.verdict}</p>
          </section>

          <div className="border-t border-slate-600/35" />

          {/* Uygulanacak Yol */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Uygulanacak Yol</h4>
            <ol className="space-y-1.5 list-none">
              {splitExecutionPlan(result.finalVerdict.executionPlan).map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-400/15 text-emerald-200 text-xs font-bold flex items-center justify-center mt-0.5 border border-emerald-300/20">{i+1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="border-t border-slate-600/35" />

          {/* Riskler */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Riskler</h4>
            <ul className="space-y-1">
              {result.finalVerdict.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-amber-500 flex-shrink-0">•</span>{r}</li>
              ))}
            </ul>
          </section>

          <div className="border-t border-slate-600/35" />

          {/* Sonraki Aksiyon */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Sonraki Aksiyon</h4>
            <p className="font-medium text-emerald-100 bg-emerald-400/10 rounded-lg px-4 py-3 border border-emerald-300/20">{result.finalVerdict.nextAction}</p>
          </section>

          {/* Bağlantı Kullanımı — debug özeti */}
          {result.connectionUsageSummary && (() => {
            const s = result.connectionUsageSummary;
            const githubContextValue = s.githubContextFetched
              ? `Okundu (${s.githubContextFileCount} dosya)`
              : s.githubContextError
                ? s.githubContextError
                : s.repoRequired && !s.hasGithubRepoUrl
                  ? "Repo URL eksik — çekilmedi"
                  : "Çekilmedi";
            const rows: Array<[string, string, "ok" | "warn" | "off"]> = [
              ["Kod analizi toggle", s.repoRequired ? "Açık" : "Kapalı", s.repoRequired ? "ok" : "off"],
              ["GitHub repo URL", s.hasGithubRepoUrl ? "Var" : "Yok", s.hasGithubRepoUrl ? "ok" : s.repoRequired ? "warn" : "off"],
              ["GitHub full name", s.githubRepoFullName || "Yok", s.githubRepoFullName ? "ok" : s.repoRequired && s.hasGithubRepoUrl ? "warn" : "off"],
              ["GitHub kod bağlamı", githubContextValue, s.githubContextFetched ? "ok" : s.repoRequired ? "warn" : "off"],
              ["Gemini API key", s.hasGeminiKey ? "Var" : "Yok", s.hasGeminiKey ? "ok" : "warn"],
              ["Gemini durumu", s.geminiSource === "live" ? "Canlı" : (s.geminiError ? `Mock — ${s.geminiError}` : "Mock"), s.geminiSource === "live" ? "ok" : "warn"],
              ["Supabase bağlamı", s.hasSupabaseContext ? "Var" : "Yok", s.hasSupabaseContext ? "ok" : "off"],
              ["Lokal yol", s.hasLocalPath ? "Var" : "Yok", s.hasLocalPath ? "ok" : "off"],
              ["Canlı URL", s.hasLiveUrl ? "Var" : "Yok", s.hasLiveUrl ? "ok" : "off"],
              ["Vercel", s.hasVercelUrl ? "Var" : "Yok", s.hasVercelUrl ? "ok" : "off"],
              ["VPS / Worker", s.hasVpsHost ? "Var" : "Yok", s.hasVpsHost ? "ok" : "off"],
            ];
            const tone = (t: "ok" | "warn" | "off") =>
              t === "ok" ? "text-emerald-200" : t === "warn" ? "text-amber-200" : "text-slate-500";
            const usedInAnalysis = s.repoRequired;
            return (
              <>
                <div className="border-t border-slate-600/35" />
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Bağlantı Kullanımı</h4>
                  <p className="text-xs text-slate-400 mb-2">
                    {usedInAnalysis
                      ? "Kod analizi açık. Aşağıdaki bağlı kaynaklar prompta dahil edildi."
                      : "Kod analizi kapalı. Bağlantılar kayıtlı ancak bu analizde kullanılmadı."}
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {rows.map(([label, value, t]) => (
                      <li key={label} className="flex flex-wrap gap-x-2">
                        <span className="text-slate-500 min-w-[170px]">{label}:</span>
                        <span className={`break-all ${tone(t)}`}>{value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            );
          })()}

          {/* Referans Dosyalar */}
          {request.attachments && request.attachments.length > 0 && (
            <>
              <div className="border-t border-slate-600/35" />
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Eklenen Referans Dosyalar</h4>
                <ul className="space-y-2">
                  {request.attachments.map((att) => (
                    <li key={att.id} className="text-xs text-slate-300 border border-slate-500/35 rounded-lg p-3 bg-slate-700/35">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-200/80">📎</span>
                        <span className="font-medium text-slate-100">{att.name}</span>
                        <span className="text-slate-500">{att.type.split("/")[1]?.toUpperCase()} · {(att.size/1024).toFixed(0)} KB</span>
                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${
                          att.analysisStatus === "content_extracted"
                            ? "bg-emerald-400/10 text-emerald-200 border-emerald-300/20"
                            : att.analysisStatus === "metadata_only"
                            ? "bg-amber-400/10 text-amber-200 border-amber-300/20"
                            : att.analysisStatus === "unsupported" && att.type === "application/pdf"
                            ? "bg-amber-400/10 text-amber-200 border-amber-300/20"
                            : att.analysisStatus === "error"
                            ? "bg-red-400/10 text-red-200 border-red-300/20"
                            : "bg-slate-700/70 text-slate-300 border-slate-500/40"
                        }`}>
                          {att.analysisStatus === "content_extracted"
                            ? att.visionStatus === "analyzed"
                              ? "Görsel içeriği analiz edildi"
                              : "İçerik analiz edildi"
                            : att.analysisStatus === "metadata_only" ? "Sadece dosya bilgisi kullanıldı"
                            : att.analysisStatus === "too_large" ? "Çok büyük"
                            : att.analysisStatus === "unsupported"
                              ? att.type === "application/pdf" ? "PDF analizi geçici desteklenmiyor" : "Desteklenmiyor"
                            : att.analysisStatus === "error" ? "İçerik okunamadı"
                            : "Metadata"}
                        </span>
                      </div>
                      {att.analysisStatus === "content_extracted" && att.visionStatus === "analyzed" && att.contentSummary && (
                        <p className="mt-2 text-slate-300 bg-cyan-400/10 rounded p-2 text-[12px] leading-relaxed border border-cyan-300/20">
                          <span className="font-medium text-cyan-100 block mb-0.5">Görsel analizi:</span>
                          {att.contentSummary.slice(0, 400)}{att.contentSummary.length > 400 ? "…" : ""}
                        </p>
                      )}
                      {att.analysisStatus === "content_extracted" && att.contentText && (
                        <p className="mt-2 text-slate-400 bg-slate-950/35 rounded p-2 font-mono text-[11px] leading-relaxed break-all">
                          {att.contentText.slice(0, 300)}{att.contentText.length > 300 ? "…" : ""}
                        </p>
                      )}
                      {att.analysisStatus === "unsupported" && att.type === "application/pdf" && (
                        <p className="mt-1.5 text-amber-200 bg-amber-400/10 border border-amber-300/20 rounded p-2 text-[12px] leading-relaxed">
                          PDF içeriğini analiz ettirmek için metni TXT veya Markdown olarak ekleyin.
                        </p>
                      )}
                      {att.analysisStatus === "metadata_only" && (
                        <p className="mt-1.5 text-slate-500 italic">
                          Bu dosyanın içeriği henüz okunmadı; sadece dosya bilgisi referans olarak kullanıldı.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Uygulama Durumu */}
      {implementationTask && (
        <div className="bg-[#24324a]/92 rounded-2xl border border-slate-500/40 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>⚡</span> Uygulama Durumu
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const s = IMPL_STATUS_LABEL[implementationTask.status] ?? IMPL_STATUS_LABEL.queued;
                return (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.color}`}>
                    {s.label}
                  </span>
                );
              })()}
              <span className="text-xs text-slate-500 font-mono">
                #{implementationTask.taskId.slice(0, 8)}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-200">{implementationTask.promptTitle}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(implementationTask.promptBody);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
                className="text-xs px-3 py-1.5 bg-emerald-400/10 text-emerald-100 border border-emerald-300/20 rounded-lg hover:bg-emerald-400/15 transition cursor-pointer font-medium"
              >
                {copiedPrompt ? "Kopyalandı ✓" : "Prompt'u Kopyala"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Takip Soruları */}
      {followUps.length > 0 && (
        <div className="bg-[#24324a]/92 rounded-2xl border border-slate-500/40 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>💬</span> Takip Soruları
          </h3>
          <div className="space-y-4">
            {followUps.map((fu) => (
              <div key={fu.id} className="border border-slate-600/40 rounded-xl overflow-hidden">
                <div className="bg-white/[0.04] px-4 py-2.5 border-b border-slate-500/35">
                  <p className="text-sm font-medium text-slate-100">{fu.question}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fu.createdAt.toLocaleString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{fu.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aksiyon Butonları */}
      <div className="bg-[#24324a]/92 rounded-2xl border border-slate-500/40 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <span>⚡</span> Aksiyonlar
        </h3>
        <ActionButtons
          request={request}
          result={result}
          status={status}
          onStatusChange={setStatus}
          onFollowUpAdded={(fu) => setFollowUps((prev) => [...prev, fu])}
          onTaskCreated={setImplementationTask}
        />
      </div>
    </div>
  );
}
