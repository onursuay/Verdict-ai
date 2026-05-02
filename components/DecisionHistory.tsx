"use client";

import { useEffect, useState } from "react";
import {
  AnalysisSource,
  DecisionAttachment,
  DecisionRequest,
  DecisionResult,
} from "@/types/decision";

interface HistoryRecord {
  id: string;
  project_name: string;
  request_type: string;
  priority: string;
  status: string;
  claude_source: AnalysisSource | null;
  codex_source: AnalysisSource | null;
  judge_source: AnalysisSource | null;
  request_json: DecisionRequest;
  result_json: DecisionResult;
  attachments_json: DecisionAttachment[] | null;
  created_at: string;
}

interface DecisionHistoryProps {
  onOpen: (request: DecisionRequest, result: DecisionResult) => void;
}

const PRIORITY_BADGE: Record<string, string> = {
  Kritik: "bg-red-400/10 text-red-200 border-red-300/25",
  Orta: "bg-amber-400/10 text-amber-200 border-amber-300/25",
  Düşük: "bg-emerald-400/10 text-emerald-200 border-emerald-300/25",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  approved: { label: "Onaylandı", className: "bg-emerald-400/10 text-emerald-200 border-emerald-300/25" },
  rejected: { label: "Reddedildi", className: "bg-red-400/10 text-red-200 border-red-300/25" },
  observation: { label: "Gözlem", className: "bg-amber-400/10 text-amber-200 border-amber-300/25" },
  prompt_generated: { label: "Prompt Üretildi", className: "bg-cyan-400/10 text-cyan-200 border-cyan-300/25" },
  completed: { label: "Tamamlandı", className: "bg-slate-800/70 text-slate-300 border-slate-600/45" },
  analyzing: { label: "Analiz Ediliyor", className: "bg-slate-800/70 text-slate-300 border-slate-600/45" },
  draft: { label: "Taslak", className: "bg-slate-800/70 text-slate-400 border-slate-600/45" },
};

function SourceBadge({ label, source }: { label: string; source: AnalysisSource | null | undefined }) {
  const live = source === "live";
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
        live
          ? "bg-emerald-400/10 text-emerald-200 border-emerald-300/25"
          : "bg-slate-800/70 text-slate-400 border-slate-600/45"
      }`}
    >
      {label} · {live ? "Canlı" : "Mock"}
    </span>
  );
}

function hydrateAttachments(atts: DecisionAttachment[] | null | undefined): DecisionAttachment[] {
  if (!atts) return [];
  return atts.map(a => ({
    ...a,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
  }));
}

export default function DecisionHistory({ onOpen }: DecisionHistoryProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/decision-records");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setRecords(data.records ?? []);
      } catch {
        if (!cancelled) setError("Geçmiş raporlar alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = (record: HistoryRecord) => {
    const request: DecisionRequest = {
      ...record.request_json,
      createdAt: new Date(record.request_json.createdAt),
      attachments: hydrateAttachments(record.attachments_json ?? record.request_json.attachments),
    };
    type RawFollowUp = { id: string; question: string; answer: string; createdAt: string };
    const rawFollowUps = (record.result_json.followUps ?? []) as unknown as RawFollowUp[];
    const followUps = rawFollowUps.map((fu) => ({
      ...fu,
      createdAt: new Date(fu.createdAt),
    }));
    const result: DecisionResult = {
      ...record.result_json,
      createdAt: new Date(record.result_json.createdAt),
      recordId: record.id,
      saved: true,
      followUps,
    };
    onOpen(request, result);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/decision-records/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      setDeleteError("Rapor silinemedi.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#182235]/92 rounded-2xl border border-slate-600/40 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-400">Raporlar yükleniyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#182235]/92 rounded-2xl border border-red-300/20 shadow-sm p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-[#182235]/92 rounded-2xl border border-slate-600/40 shadow-sm p-12 text-center">
        <div className="text-3xl mb-2">📂</div>
        <p className="text-sm text-slate-300">Henüz kayıtlı rapor yok.</p>
        <p className="text-xs text-slate-500 mt-1">Yeni bir karar talebi oluşturun; analiz sonrası burada listelenecek.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-slate-100">Geçmiş Raporlar</h2>
        <span className="text-xs text-slate-500">{records.length} kayıt</span>
      </div>

      {deleteError && (
        <p className="text-xs text-red-200 bg-red-400/10 border border-red-300/20 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {records.map((rec) => {
        const statusInfo = STATUS_LABEL[rec.status] ?? STATUS_LABEL.completed;
        const priorityClass = PRIORITY_BADGE[rec.priority] ?? "bg-slate-800/70 text-slate-300 border-slate-600/45";
        const date = new Date(rec.created_at);
        return (
          <div
            key={rec.id}
            className="bg-[#182235]/92 rounded-xl border border-slate-600/40 shadow-sm p-4 hover:border-emerald-300/25 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-100 text-sm truncate">{rec.project_name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityClass}`}>
                    {rec.priority?.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800/70 border border-slate-600/45 px-2 py-0.5 rounded-full">
                    {rec.request_type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {date.toLocaleString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <SourceBadge label="Claude" source={rec.claude_source} />
                  <SourceBadge label="Codex" source={rec.codex_source} />
                  <SourceBadge label="Hakem" source={rec.judge_source} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleOpen(rec)}
                  className="text-xs font-medium text-emerald-100 bg-emerald-400/10 hover:bg-emerald-400/15 border border-emerald-300/20 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  Raporu Aç
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  disabled={deletingId === rec.id}
                  title="Raporu sil"
                  className="text-slate-500 hover:text-red-300 hover:bg-red-400/10 p-1.5 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
