import { NextRequest, NextResponse } from "next/server";
import { listSupabaseProjects } from "@/lib/supabase-management/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userKey = req.cookies.get("verdict_user_key")?.value;
  if (!userKey) {
    return NextResponse.json({ connected: false, projects: [] });
  }

  const result = await listSupabaseProjects(userKey);
  if (!result.ok) {
    if (result.error === "no_connection") {
      return NextResponse.json({ connected: false, projects: [] });
    }
    return NextResponse.json(
      { connected: true, projects: [], error: result.error },
      { status: 200 }
    );
  }

  return NextResponse.json({ connected: true, projects: result.data ?? [] });
}
