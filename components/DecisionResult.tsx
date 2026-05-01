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

function splitExecutionPlan(plan: string[]): string[] {
  if (plan.length === 1 && plan[0].includes("→")) {
    return plan[0].split("→").map(s => s.trim()).filter(Boolean);
  }
  return plan;
}

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
            {result.saved === true ? (
              <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                Kayıt alındı
              </span>
            ) : (
              <span className="text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                Kayıt yapılmadı
              </span>
            )}
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
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer whitespace-nowrap"
          >
            ← Yeni Talep
          </button>
          {result.recordId && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
              title="Raporu sil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {deleteError && (
            <span className="text-xs text-red-500">{deleteError}</span>
          )}
        </div>
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
            {splitExecutionPlan(result.finalVerdict.executionPlan).map((step, i) => (
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
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs text-gray-500 italic">{codex.title}</p>
              <div className="flex items-center gap-1.5">
                {result.codexSource === "live" ? (
                  <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                    Canlı Denetçi
                  </span>
                ) : (
                  <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Mock Denetçi
                  </span>
                )}
                <ConfidenceBadge score={codex.confidenceScore} />
              </div>
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

      {/* Nihai Rapor */}
      <div id="verdict-report" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-2">
            <span className="text-base">📄</span>
            <h3 className="font-semibold text-gray-800 text-sm">Nihai Rapor</h3>
          </div>
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF İndir
          </button>
        </div>
        <div className="p-5 space-y-5 text-sm text-gray-700">
          {/* Talep Özeti */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Talep Özeti</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div><span className="text-gray-400">Proje:</span> <span className="font-medium">{request.projectName}</span></div>
              <div><span className="text-gray-400">Tip:</span> {request.requestType}</div>
              <div><span className="text-gray-400">Öncelik:</span> {request.priority}</div>
              <div><span className="text-gray-400">Çıktı:</span> {request.expectedOutput}</div>
            </div>
            <p className="mt-2 text-gray-600 leading-relaxed">{request.problem}</p>
          </section>

          <div className="border-t border-gray-100" />

          {/* AI Süreç Özeti */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Süreç Özeti</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Claude Code", source: result.claudeSource },
                { label: "Codex Denetçi", source: result.codexSource },
                { label: "ChatGPT Hakem", source: result.judgeSource },
              ].map((ai) => (
                <span key={ai.label} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${ai.source === "live" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                  {ai.label} — {ai.source === "live" ? "Canlı" : "Mock"}
                </span>
              ))}
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Claude Mühendis */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Claude Code / Ana Mühendis Görüşü</h4>
            <p className="leading-relaxed">{claude.summary}</p>
            <p className="mt-1.5 text-indigo-700 font-medium">{claude.recommendation}</p>
          </section>

          <div className="border-t border-gray-100" />

          {/* Codex */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Codex / Denetçi Görüşü</h4>
            <p className="leading-relaxed">{codex.summary}</p>
            <p className="mt-1.5 text-violet-700 font-medium">{codex.recommendation}</p>
          </section>

          <div className="border-t border-gray-100" />

          {/* ChatGPT Hakem */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">ChatGPT / Hakem Kararı</h4>
            <p className="font-semibold text-gray-900 leading-relaxed">{result.finalVerdict.verdict}</p>
          </section>

          <div className="border-t border-gray-100" />

          {/* Uygulanacak Yol */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Uygulanacak Yol</h4>
            <ol className="space-y-1.5 list-none">
              {splitExecutionPlan(result.finalVerdict.executionPlan).map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{i+1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="border-t border-gray-100" />

          {/* Riskler */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Riskler</h4>
            <ul className="space-y-1">
              {result.finalVerdict.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-amber-500 flex-shrink-0">•</span>{r}</li>
              ))}
            </ul>
          </section>

          <div className="border-t border-gray-100" />

          {/* Sonraki Aksiyon */}
          <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sonraki Aksiyon</h4>
            <p className="font-medium text-gray-800 bg-green-50 rounded-lg px-4 py-3 border border-green-100">{result.finalVerdict.nextAction}</p>
          </section>

          {/* Referans Dosyalar */}
          {request.attachments && request.attachments.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Eklenen Referans Dosyalar</h4>
                <ul className="space-y-2">
                  {request.attachments.map((att) => (
                    <li key={att.id} className="text-xs text-gray-600 border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">📎</span>
                        <span className="font-medium text-gray-800">{att.name}</span>
                        <span className="text-gray-400">{att.type.split("/")[1]?.toUpperCase()} · {(att.size/1024).toFixed(0)} KB</span>
                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${
                          att.analysisStatus === "content_extracted"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : att.analysisStatus === "metadata_only"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : att.analysisStatus === "error"
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}>
                          {att.analysisStatus === "content_extracted" ? "İçerik analiz edildi"
                            : att.analysisStatus === "metadata_only" ? "Sadece metadata"
                            : att.analysisStatus === "too_large" ? "Çok büyük"
                            : att.analysisStatus === "unsupported" ? "Desteklenmiyor"
                            : att.analysisStatus === "error" ? "Hata"
                            : "Metadata"}
                        </span>
                      </div>
                      {att.analysisStatus === "content_extracted" && att.contentText && (
                        <p className="mt-2 text-gray-500 bg-gray-50 rounded p-2 font-mono text-[11px] leading-relaxed break-all">
                          {att.contentText.slice(0, 300)}{att.contentText.length > 300 ? "…" : ""}
                        </p>
                      )}
                      {att.analysisStatus === "metadata_only" && (
                        <p className="mt-1.5 text-gray-400 italic">
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
