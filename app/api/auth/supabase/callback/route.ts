import { NextRequest, NextResponse } from "next/server";
import { saveSupabaseConnection } from "@/lib/supabase-management/connection-store";
import { fetchSupabaseAccountInfo } from "@/lib/supabase-management/client";
import { isEncryptionConfigured } from "@/lib/credentials/encryption";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getRedirectUri(): string {
  return process.env.SUPABASE_OAUTH_REDIRECT_URI ?? `${getAppUrl()}/api/auth/supabase/callback`;
}

function safeRedirect(appUrl: string, qs: string): NextResponse {
  // Açık redirect koruması: sadece kendi origin'imize döneriz.
  return NextResponse.redirect(`${appUrl}/${qs}`);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = req.cookies.get("supabase_oauth_state")?.value;
  const codeVerifier = req.cookies.get("supabase_oauth_verifier")?.value;
  const userKey = req.cookies.get("verdict_user_key")?.value;
  const appUrl = getAppUrl();

  if (!code || !state || state !== savedState) {
    return safeRedirect(appUrl, "?supabase_error=state_mismatch");
  }
  if (!codeVerifier) {
    return safeRedirect(appUrl, "?supabase_error=missing_verifier");
  }
  if (!userKey) {
    return safeRedirect(appUrl, "?supabase_error=missing_session");
  }
  if (!isEncryptionConfigured()) {
    return safeRedirect(appUrl, "?supabase_error=encryption_missing");
  }

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return safeRedirect(appUrl, "?supabase_error=not_configured");
  }

  let tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  try {
    const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: codeVerifier,
      }).toString(),
    });
    tokenData = await tokenRes.json();
  } catch {
    return safeRedirect(appUrl, "?supabase_error=network");
  }

  if (!tokenData.access_token) {
    return safeRedirect(appUrl, "?supabase_error=token_failed");
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  const account = await fetchSupabaseAccountInfo(tokenData.access_token);

  const saved = await saveSupabaseConnection({
    userKey,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresAt,
    scope: tokenData.scope ?? null,
    accountLabel: account.orgName ?? account.orgSlug ?? null,
    organizationSlug: account.orgSlug ?? null,
  });

  if (!saved.ok) {
    return safeRedirect(appUrl, `?supabase_error=storage_failed`);
  }

  const orgLabel = encodeURIComponent(account.orgName ?? account.orgSlug ?? "");
  const response = safeRedirect(appUrl, `?supabase_connected=1&supabase_org=${orgLabel}`);
  response.cookies.delete("supabase_oauth_state");
  response.cookies.delete("supabase_oauth_verifier");
  return response;
}
