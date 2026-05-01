import { NextRequest, NextResponse } from "next/server";
import { DecisionAttachment, DecisionRequest, DecisionResult } from "@/types/decision";
import { generatePromptOutput } from "@/lib/prompt-builder";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    decisionRecordId?: string;
    request?: DecisionRequest;
    result?: DecisionResult;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const { decisionRecordId, request, result } = body;
  if (!request || !result) {
    return NextResponse.json({ error: "request ve result zorunlu" }, { status: 400 });
  }

  const claude = result.analyses.find(a => a.role === "claude_engineer");
  const codex = result.analyses.find(a => a.role === "codex_reviewer");
  if (!claude || !codex) {
    return NextResponse.json({ error: "Analiz verisi eksik" }, { status: 400 });
  }

  const attachments: DecisionAttachment[] = result.enrichedAttachments ?? request.attachments ?? [];
  const promptOutput = generatePromptOutput(request, claude, codex, result.finalVerdict, attachments);

  const supabase = getSupabaseServer();
  let taskId: string = crypto.randomUUID();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("implementation_tasks")
        .insert({
          decision_record_id: decisionRecordId ?? null,
          target_tool: promptOutput.targetTool,
          status: "queued",
          prompt_title: promptOutput.promptTitle,
          prompt_body: promptOutput.promptBody,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("[verdict-ai] implementation_tasks insert error:", error.message);
      } else {
        taskId = (data as { id: string }).id;
      }

      if (decisionRecordId) {
        const { error: statusErr } = await supabase
          .from("decision_records")
          .update({ status: "implementation_queued" })
          .eq("id", decisionRecordId);
        if (statusErr) {
          console.warn("[verdict-ai] decision record status update error:", statusErr.message);
        }
      }
    } catch (err) {
      console.warn("[verdict-ai] Supabase error:", err instanceof Error ? err.message : "unknown");
    }
  }

  return NextResponse.json({
    taskId,
    status: "queued",
    promptTitle: promptOutput.promptTitle,
    promptBody: promptOutput.promptBody,
  });
}
