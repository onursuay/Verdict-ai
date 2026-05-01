import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED_STATUSES = ["running", "completed", "failed", "review_required"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

const DECISION_STATUS_MAP: Record<string, string> = {
  running: "implementation_running",
  completed: "implementation_completed",
  failed: "implementation_failed",
  review_required: "review_required",
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let body: {
    status?: string;
    resultSummary?: string;
    resultJson?: object;
    errorMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { status, resultSummary, resultJson, errorMessage } = body;
  if (!status || !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: "Geçersiz status değeri" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const { data: task, error: taskErr } = await supabase
    .from("implementation_tasks")
    .update({
      status,
      result_summary: resultSummary ?? null,
      result_json: resultJson ?? null,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("decision_record_id")
    .single();

  if (taskErr) {
    console.warn("[verdict-ai] implementation task update error:", taskErr.message);
    return NextResponse.json({ error: "Görev güncellenemedi" }, { status: 500 });
  }

  const decisionRecordId = (task as { decision_record_id: string | null } | null)?.decision_record_id;
  if (decisionRecordId) {
    const decisionStatus = DECISION_STATUS_MAP[status];
    const { error: recordErr } = await supabase
      .from("decision_records")
      .update({ status: decisionStatus })
      .eq("id", decisionRecordId);
    if (recordErr) {
      console.warn("[verdict-ai] decision record status update error:", recordErr.message);
    }
  }

  return NextResponse.json({ success: true, status });
}
