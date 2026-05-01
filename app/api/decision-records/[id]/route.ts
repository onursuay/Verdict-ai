import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const ALLOWED_STATUSES = [
  "approved", "rejected", "observation", "prompt_generated",
  "implementation_queued", "implementation_running",
  "implementation_completed", "implementation_failed", "review_required",
] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const { error } = await supabase
    .from("decision_records")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Silme başarısız" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: "Geçersiz status değeri" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const { error } = await supabase
    .from("decision_records")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.warn("[verdict-ai] status update error:", error.message);
    return NextResponse.json({ error: "Durum güncellenemedi" }, { status: 500 });
  }

  return NextResponse.json({ success: true, status });
}
