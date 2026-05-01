import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

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
