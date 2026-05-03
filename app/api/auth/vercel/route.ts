import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET() {
  const clientId = process.env.VERCEL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "VERCEL_CLIENT_ID yapılandırılmamış." }, { status: 503 });
  }

  const state = randomBytes(16).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const url = new URL("https://vercel.com/integrations/verdictai/add");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("vercel_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("vercel_access_token");
  return response;
}
