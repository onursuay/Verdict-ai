import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { isEncryptionConfigured } from "@/lib/credentials/encryption";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getRedirectUri(): string {
  return process.env.SUPABASE_OAUTH_REDIRECT_URI ?? `${getAppUrl()}/api/auth/supabase/callback`;
}

function ensureUserKey(req: NextRequest): { userKey: string; isNew: boolean } {
  const existing = req.cookies.get("verdict_user_key")?.value;
  if (existing) return { userKey: existing, isNew: false };
  return { userKey: randomBytes(24).toString("hex"), isNew: true };
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(req: NextRequest) {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const appUrl = getAppUrl();

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/?supabase_error=not_configured`);
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.redirect(`${appUrl}/?supabase_error=encryption_missing`);
  }

  const state = randomBytes(16).toString("hex");
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash("sha256").update(codeVerifier).digest());

  const { userKey, isNew } = ensureUserKey(req);

  const url = new URL("https://api.supabase.com/v1/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  response.cookies.set("supabase_oauth_state", state, { ...cookieOpts, maxAge: 600 });
  response.cookies.set("supabase_oauth_verifier", codeVerifier, { ...cookieOpts, maxAge: 600 });
  if (isNew) {
    response.cookies.set("verdict_user_key", userKey, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}

export async function DELETE() {
  // Tek bağlantı kesme: /api/supabase/connection üzerinden yapılır.
  // Bu route geriye dönük uyumluluk için tutuldu.
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("supabase_access_token");
  return response;
}
