import { NextRequest, NextResponse } from "next/server";

function safeAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function errorRedirect(appUrl: string, code: string, extra?: { reason?: string }) {
  const params = new URLSearchParams({ vercel_error: code });
  if (extra?.reason) params.set("reason", extra.reason);
  const res = NextResponse.redirect(`${appUrl}/?${params.toString()}`);
  res.cookies.delete("vercel_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const appUrl = safeAppUrl();

  if (!code) {
    return errorRedirect(appUrl, "missing_code");
  }

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect(appUrl, "not_configured");
  }

  try {
    const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      const reason = (tokenData.error ?? "unknown").slice(0, 64).replace(/[^a-z0-9_.-]/gi, "");
      return errorRedirect(appUrl, "token_failed", { reason });
    }

    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = (await userRes.json()) as { user?: { username?: string; name?: string } };
    const username = userData.user?.username ?? userData.user?.name ?? "";

    // Sadece kendi origin'imize dön — open redirect'e karşı `next` param'ı okumuyoruz.
    const params = new URLSearchParams({ vercel_connected: "1" });
    if (username) params.set("vercel_username", username);
    const destination = `${appUrl}/?${params.toString()}`;

    const response = NextResponse.redirect(destination);
    response.cookies.set("vercel_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    // Non-httpOnly: client JS'in username'i localStorage'a yazması için (token değil).
    response.cookies.set("vercel_pending_user", username, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
      path: "/",
    });
    response.cookies.delete("vercel_oauth_state");
    return response;
  } catch {
    return errorRedirect(appUrl, "network");
  }
}
