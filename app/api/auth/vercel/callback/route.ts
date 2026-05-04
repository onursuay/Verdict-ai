import { NextRequest, NextResponse } from "next/server";

// Vercel marketplace install akışı callback URL'sini bir popup içinde açıyor.
// Sade 302 redirect yaparsak Verdict AI popup içinde yüklenir, ana sekme
// hâlâ Vercel'de kalır. Bunun yerine HTML bridge dönüyoruz:
//   - window.opener varsa → opener'ı hedef URL'ye yönlendir + popup'ı kapat
//   - opener yoksa (aynı sekme akışı) → aynı pencerede yönlendir
//   - close() engellenmişse → kullanıcıya fallback butonu göster

function safeAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function bridgeResponse(
  targetUrl: string,
  applyExtra?: (res: NextResponse) => void,
): NextResponse {
  const safeUrl = JSON.stringify(targetUrl); // XSS-safe JS string literal
  const isError = targetUrl.includes("vercel_error");
  const headline = isError ? "Vercel bağlantısı tamamlanamadı" : "Vercel bağlantısı kuruldu";

  const html = `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${headline}</title>
<style>
html,body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;
  font-family:system-ui,-apple-system,Segoe UI,sans-serif}
body{display:grid;place-items:center;height:100vh}
.box{text-align:center;padding:1.5rem 2rem;border-radius:.875rem;
  border:1px solid rgba(148,163,184,.25);background:rgba(30,41,59,.7);max-width:22rem}
.h{font-size:.95rem;font-weight:600;margin:0 0 .4rem}
.p{font-size:.8rem;color:#94a3b8;margin:0 0 1rem}
.btn{display:inline-block;padding:.45rem 1.25rem;border-radius:.5rem;
  background:#34d399;color:#0f172a;font-weight:700;font-size:.8rem;
  text-decoration:none;cursor:pointer}
#fb{display:none}
</style>
</head><body>
<div class="box">
  <p class="h">${headline}</p>
  <p class="p" id="msg">Yönlendiriliyorsun…</p>
  <div id="fb">
    <a class="btn" id="fb-btn" href="#">Ana pencereye dön</a>
  </div>
</div>
<script>
(function(){
  var t=${safeUrl};
  var fb=document.getElementById('fb');
  var msg=document.getElementById('msg');
  var fbBtn=document.getElementById('fb-btn');
  if(fbBtn) fbBtn.href=t;

  function showFallback(){
    if(msg) msg.textContent='Pencere otomatik kapanmadı. Aşağıdaki butona tıklayın.';
    if(fb) fb.style.display='block';
  }
  function navSelf(){
    try{ window.location.replace(t); }catch(_){ window.location.href=t; }
  }

  if(window.opener && !window.opener.closed){
    // opener.location.href setter cross-origin yazma izni var (HTML spec §browsing context navigation)
    try{ window.opener.location.href=t; }catch(_){}
    setTimeout(function(){
      try{ window.close(); }catch(_){}
      // close() engellendi mi? 400ms sonra kontrol et
      setTimeout(function(){
        try{ if(!window.closed){ showFallback(); } }catch(_){ showFallback(); }
      },400);
    },150);
  } else {
    // Popup değil veya opener erişilemiyor — aynı pencerede yönlendir
    navSelf();
  }
})();
</script>
</body></html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
  if (applyExtra) applyExtra(res);
  res.cookies.delete("vercel_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const appUrl = safeAppUrl();

  if (!code) {
    return bridgeResponse(`${appUrl}/?vercel_error=missing_code`);
  }

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return bridgeResponse(`${appUrl}/?vercel_error=not_configured`);
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
      return bridgeResponse(`${appUrl}/?vercel_error=token_failed&reason=${reason}`);
    }
    const accessToken = tokenData.access_token;

    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = (await userRes.json()) as { user?: { username?: string; name?: string } };
    const username = userData.user?.username ?? userData.user?.name ?? "";

    // Sadece kendi origin'imize dön — open redirect'e karşı `next` param okumuyoruz.
    const params = new URLSearchParams({ vercel_connected: "1" });
    if (username) params.set("vercel_username", username);
    const destination = `${appUrl}/?${params.toString()}`;

    return bridgeResponse(destination, (res) => {
      res.cookies.set("vercel_access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      // Non-httpOnly: client JS username'i localStorage'a yazmak için (token değil).
      res.cookies.set("vercel_pending_user", username, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 5,
        path: "/",
      });
    });
  } catch {
    return bridgeResponse(`${appUrl}/?vercel_error=network`);
  }
}
