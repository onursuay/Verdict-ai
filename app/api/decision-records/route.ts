import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("decision_records")
    .select(
      "id, project_name, request_type, priority, status, claude_source, codex_source, judge_source, request_json, result_json, attachments_json, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[verdict-ai] history fetch error:", error.message);
    return NextResponse.json({ error: "Geçmiş raporlar alınamadı" }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}
