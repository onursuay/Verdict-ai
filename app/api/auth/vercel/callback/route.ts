import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?vercel_error=missing_code`);
  }

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?vercel_error=not_configured`);
  }

  try {
    const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/auth/vercel/callback`,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/?vercel_error=token_failed`);
    }

    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = (await userRes.json()) as { user?: { username?: string; name?: string } };
    const username = userData.user?.username ?? userData.user?.name ?? "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
  var data = { type: "vercel_connected", username: ${JSON.stringify(username)} };
  if (window.opener) {
    window.opener.postMessage(data, ${JSON.stringify(appUrl)});
    window.close();
  } else {
    window.location.href = ${JSON.stringify(`${appUrl}/?vercel_connected=1&vercel_username=${encodeURIComponent(username)}`)};
  }
<\/script>
</body></html>`;

    const response = new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
    response.cookies.set("vercel_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    response.cookies.delete("vercel_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(`${appUrl}/?vercel_error=network`);
  }
}
