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
  Kritik: "bg-red-50 text-red-700 border-red-200",
  Orta: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Düşük: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  approved: { label: "Onaylandı", className: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Reddedildi", className: "bg-red-50 text-red-700 border-red-200" },
  observation: { label: "Gözlem", className: "bg-amber-50 text-amber-700 border-amber-200" },
  prompt_generated: { label: "Prompt Üretildi", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  completed: { label: "Tamamlandı", className: "bg-gray-50 text-gray-600 border-gray-200" },
  analyzing: { label: "Analiz Ediliyor", className: "bg-gray-50 text-gray-500 border-gray-200" },
  draft: { label: "Taslak", className: "bg-gray-50 text-gray-500 border-gray-200" },
};

function SourceBadge({ label, source }: { label: string; source: AnalysisSource | null | undefined }) {
  const live = source === "live";
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
        live
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-gray-50 text-gray-500 border-gray-200"
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
    const result: DecisionResult = {
      ...record.result_json,
      createdAt: new Date(record.result_json.createdAt),
      recordId: record.id,
      saved: true,
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-500">Raporlar yükleniyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="text-3xl mb-2">📂</div>
        <p className="text-sm text-gray-500">Henüz kayıtlı rapor yok.</p>
        <p className="text-xs text-gray-400 mt-1">Yeni bir karar talebi oluşturun; analiz sonrası burada listelenecek.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-gray-800">Geçmiş Raporlar</h2>
        <span className="text-xs text-gray-400">{records.length} kayıt</span>
      </div>

      {deleteError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {records.map((rec) => {
        const statusInfo = STATUS_LABEL[rec.status] ?? STATUS_LABEL.completed;
        const priorityClass = PRIORITY_BADGE[rec.priority] ?? "bg-gray-50 text-gray-600 border-gray-200";
        const date = new Date(rec.created_at);
        return (
          <div
            key={rec.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{rec.project_name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityClass}`}>
                    {rec.priority?.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                    {rec.request_type}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
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
                  className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                >
                  Raporu Aç
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  disabled={deletingId === rec.id}
                  title="Raporu sil"
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer disabled:opacity-50"
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
