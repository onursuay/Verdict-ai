import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = req.cookies.get("supabase_oauth_state")?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/?supabase_error=state_mismatch`);
  }

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?supabase_error=not_configured`);
  }

  try {
    const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/auth/supabase/callback`,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/?supabase_error=token_failed`);
    }

    const orgsRes = await fetch("https://api.supabase.com/v1/organizations", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const orgs = (await orgsRes.json()) as Array<{ name?: string; slug?: string }>;
    const orgName = Array.isArray(orgs) ? (orgs[0]?.name ?? orgs[0]?.slug ?? "") : "";

    const response = NextResponse.redirect(
      `${appUrl}/?supabase_connected=1&supabase_org=${encodeURIComponent(orgName)}`
    );
    response.cookies.set("supabase_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    response.cookies.delete("supabase_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}/?supabase_error=network`);
  }
}
