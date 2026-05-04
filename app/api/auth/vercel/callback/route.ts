import { NextRequest, NextResponse } from "next/server";

// Vercel marketplace install akışı bir popup veya yeni sekme içinde çalışabiliyor.
// Callback 302 ile yönlendirdiğinde popup içinde kalan kullanıcı manuel olarak
// "Website" düğmesine basmak zorunda kalıyordu. Bunun yerine HTML bridge
// dönüyoruz: popup ise opener'ı (aynı origin Verdict AI sekmesi) yeniden
// yönlendiriyoruz ve popup'ı kapatıyoruz; opener yoksa aynı pencereyi
// hedefe yönlendiriyoruz.

const KNOWN_VERCEL_ERRORS = [
  "missing_code",
  "not_configured",
  "token_failed",
  "network",
  "user_failed",
] as const;
type VercelErrorCode = (typeof KNOWN_VERCEL_ERRORS)[number];

function safeAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function bridgeHtml(targetUrl: string, isError: boolean) {
  // JSON.stringify → güvenli JS string literal (XSS-safe escape).
  const safeUrl = JSON.stringify(targetUrl);
  const headline = isError ? "Vercel bağlantısı tamamlanamadı" : "Vercel bağlantısı kuruldu";
  const body = isError
    ? "Yönlendiriliyorsun…"
    : "Verdict AI uygulamasına yönlendiriliyorsun…";
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headline}</title>
<style>html,body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,sans-serif}body{display:grid;place-items:center;height:100vh}.box{text-align:center;padding:1.25rem 1.75rem;border-radius:.85rem;border:1px solid rgba(148,163,184,.3);background:rgba(30,41,59,.6);max-width:24rem}.h{font-size:.95rem;font-weight:600;margin:0 0 .35rem}.p{font-size:.8rem;color:#94a3b8;margin:0}</style>
</head><body>
<div class="box"><p class="h">${headline}</p><p class="p">${body}</p></div>
<script>
(function(){
  var t=${safeUrl};
  function navSelf(){ try{ window.location.replace(t); }catch(_){ window.location.href=t; } }
  try{
    if (window.opener && !window.opener.closed) {
      var opened = false;
      try { window.opener.location.href = t; opened = true; } catch(_) { /* cross-origin opener */ }
      if (!opened) {
        try { window.opener.postMessage({ type: "verdict-vercel-connected", target: t }, "*"); } catch(_){}
      }
      try { window.close(); } catch(_) {}
      // close engellendiyse aynı pencereyi yönlendir
      setTimeout(navSelf, 300);
    } else {
      navSelf();
    }
  } catch(_) { navSelf(); }
})();
</script>
</body></html>`;
}

function htmlResponse(html: string) {
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(code: VercelErrorCode, extra?: { reason?: string }) {
  const appUrl = safeAppUrl();
  const params = new URLSearchParams({ vercel_error: code });
  if (extra?.reason) params.set("reason", extra.reason);
  const target = `${appUrl}/?${params.toString()}`;
  const res = htmlResponse(bridgeHtml(target, true));
  // start cookie'sini her durumda temizle
  res.cookies.delete("vercel_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const appUrl = safeAppUrl();

  if (!code) {
    return errorResponse("missing_code");
  }

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorResponse("not_configured");
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
      return errorResponse("token_failed", { reason });
    }

    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = (await userRes.json()) as { user?: { username?: string; name?: string } };
    const username = userData.user?.username ?? userData.user?.name ?? "";

    // Sadece kendi origin'imize dön — open redirect'e karşı `next` parametresi okumuyoruz.
    const params = new URLSearchParams({ vercel_connected: "1" });
    if (username) params.set("vercel_username", username);
    const destination = `${appUrl}/?${params.toString()}`;

    const response = htmlResponse(bridgeHtml(destination, false));
    response.cookies.set("vercel_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    // Non-httpOnly: client JS opener tarafında localStorage senkronu için kullanıyor.
    // Token DEĞİL, sadece username label'ı.
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
    return errorResponse("network");
  }
}
