import { NextRequest, NextResponse } from "next/server";
import {
  getActiveSupabaseConnection,
  revokeSupabaseConnection,
} from "@/lib/supabase-management/connection-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userKey = req.cookies.get("verdict_user_key")?.value;
  if (!userKey) {
    return NextResponse.json({ connected: false });
  }
  const conn = await getActiveSupabaseConnection(userKey);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }
  const tokenStillValid = !conn.expiresAt || conn.expiresAt.getTime() > Date.now();
  return NextResponse.json({
    connected: true,
    accountLabel: conn.accountLabel,
    organizationSlug: conn.organizationSlug,
    tokenValid: tokenStillValid,
    expiresAt: conn.expiresAt ? conn.expiresAt.toISOString() : null,
  });
}

export async function DELETE(req: NextRequest) {
  const userKey = req.cookies.get("verdict_user_key")?.value;
  if (!userKey) {
    return NextResponse.json({ ok: true });
  }
  await revokeSupabaseConnection(userKey);
  return NextResponse.json({ ok: true });
}
