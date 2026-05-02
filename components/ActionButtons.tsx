"use client";

import { useState } from "react";
import {
  DecisionFollowUp,
  DecisionRequest,
  DecisionResult,
  DecisionStatus,
  ImplementationTaskInfo,
} from "@/types/decision";

interface ActionButtonsProps {
  request: DecisionRequest;
  result: DecisionResult;
  status: DecisionStatus;
  onStatusChange: (status: DecisionStatus) => void;
  onFollowUpAdded: (followUp: DecisionFollowUp) => void;
  onTaskCreated: (task: ImplementationTaskInfo) => void;
}

export default function ActionButtons({
  request,
  result,
  status,
  onStatusChange,
  onFollowUpAdded,
  onTaskCreated,
}: ActionButtonsProps) {
  const [pendingStatus, setPendingStatus] = useState<DecisionStatus | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [sendingToCC, setSendingToCC] = useState(false);
  const [sendToCCError, setSendToCCError] = useState<string | null>(null);
  const [taskSent, setTaskSent] = useState(false);

  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const persistStatus = async (next: DecisionStatus) => {
    onStatusChange(next);
    setUpdateError(null);
    if (!result.recordId) return;
    setPendingStatus(next);
    try {
      const res = await fetch(`/api/decision-records/${result.recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUpdateError("Durum güncellenemedi.");
    } finally {
      setPendingStatus(null);
    }
  };

  const handleSendToClaudeCode = async () => {
    setSendingToCC(true);
    setSendToCCError(null);
    try {
      const res = await fetch("/api/implementation-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionRecordId: result.recordId,
          request,
          result,
        }),
      });
      if (!res.ok) throw new Error();
      const data: ImplementationTaskInfo & { status: string } = await res.json();
      onTaskCreated({
        taskId: data.taskId,
        status: data.status,
        promptTitle: data.promptTitle,
        promptBody: data.promptBody,
      });
      onStatusChange("implementation_queued");
      setTaskSent(true);
    } catch {
      setSendToCCError("Görev oluşturulamadı. Tekrar deneyin.");
    } finally {
      setSendingToCC(false);
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!followUpQuestion.trim()) return;
    setFollowUpLoading(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionRecordId: result.recordId,
          request,
          result,
          question: followUpQuestion,
        }),
      });
      if (!res.ok) throw new Error();
      const data: { followUp: DecisionFollowUp & { createdAt: string } } = await res.json();
      onFollowUpAdded({ ...data.followUp, createdAt: new Date(data.followUp.createdAt) });
      setFollowUpQuestion("");
      setShowFollowUp(false);
    } catch {
      setFollowUpError("Yanıt alınamadı. Tekrar deneyin.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const isRejected = status === "rejected";
  const isQueued =
    status === "implementation_queued" ||
    status === "implementation_running" ||
    status === "implementation_completed";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* CLAUDE CODE'A GÖNDER */}
        <button
          onClick={handleSendToClaudeCode}
          disabled={sendingToCC || taskSent || isQueued || pendingStatus !== null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            taskSent || isQueued
              ? "bg-gradient-to-r from-emerald-400 to-cyan-400 border-emerald-300 text-slate-950 shadow-sm"
              : "bg-emerald-400/10 border-emerald-300/25 text-emerald-100 hover:bg-emerald-400/15 hover:border-emerald-300/45"
          }`}
        >
          <span>⚡</span>
          {sendingToCC
            ? "Gönderiliyor..."
            : taskSent || isQueued
            ? "Kuyruğa alındı ✓"
            : "CLAUDE CODE'A GÖNDER"}
        </button>

        {/* REDDET */}
        <button
          onClick={() => persistStatus("rejected")}
          disabled={pendingStatus !== null}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            isRejected
              ? "bg-red-500 border-red-400 text-white shadow-sm"
              : "bg-red-400/10 border-red-300/25 text-red-200 hover:bg-red-400/15 hover:border-red-300/45"
          }`}
        >
          <span>✕</span>
          {pendingStatus === "rejected" ? "Kaydediliyor..." : "REDDET"}
        </button>

        {/* TEKRAR SOR */}
        <button
          onClick={() => setShowFollowUp((prev) => !prev)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ml-auto ${
            showFollowUp
              ? "bg-slate-700 border-slate-500 text-slate-100"
              : "bg-slate-900/45 border-slate-600/55 text-slate-300 hover:bg-white/[0.06] hover:border-slate-500"
          }`}
        >
          <span>💬</span>
          TEKRAR SOR
        </button>
      </div>

      {(updateError || sendToCCError) && (
        <p className="text-xs text-red-200 bg-red-400/10 border border-red-300/20 rounded-lg px-3 py-2">
          {updateError || sendToCCError}
        </p>
      )}

      {showFollowUp && (
        <div className="rounded-xl border border-slate-600/45 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-600/35 bg-white/[0.035] flex items-center gap-2">
            <span className="text-slate-400 text-sm">💬</span>
            <span className="text-sm font-semibold text-slate-100">Takip Sorusu</span>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={followUpQuestion}
              onChange={(e) => setFollowUpQuestion(e.target.value)}
              placeholder="Bu karar sonucuna göre ek sorunuzu yazın…"
              rows={3}
              className="w-full text-sm text-slate-100 placeholder-slate-500 bg-[#111a2b] border border-slate-600/55 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-300/60"
            />
            {followUpError && (
              <p className="text-xs text-red-300">{followUpError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFollowUp(false);
                  setFollowUpQuestion("");
                  setFollowUpError(null);
                }}
                className="text-xs px-3 py-1.5 text-slate-400 hover:text-slate-100 transition cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleFollowUpSubmit}
                disabled={followUpLoading || !followUpQuestion.trim()}
                className="text-xs px-4 py-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 rounded-lg hover:from-emerald-300 hover:to-cyan-300 transition cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {followUpLoading ? "Yanıtlanıyor…" : "Yanıtla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
