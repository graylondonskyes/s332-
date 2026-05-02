const { htmlResponse, redirectResponse, authenticateRequest, escapeHtml } = require("./_helpers");

exports.handler = async (event) => {
  if ((event.httpMethod || "GET").toUpperCase() !== "GET") {
    return htmlResponse(405, "Method not allowed", { Allow: "GET" });
  }

  const auth = await authenticateRequest(event).catch((err) => ({ ok: false, error: err.message || "Auth error" }));
  if (!auth.ok) {
    return redirectResponse("/index.html?next=/app");
  }

  const userJson = escapeHtml(JSON.stringify({
    user_id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
    email_verified_at: auth.user.email_verified_at || null,
    created_at: auth.user.created_at,
    last_login_at: auth.user.last_login_at,
    password_changed_at: auth.user.password_changed_at,
    session_expires_at: auth.session.expires_at
  }, null, 2));

  const verifiedLabel = auth.user.email_verified_at ? "Verified" : "Not verified";

  return htmlResponse(200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>SOLE Sheets Login Portal — Private App</title>
  <style>
    :root{--text:rgba(255,255,255,.94);--muted:rgba(255,255,255,.68);--gold:#ffcf5a;--purple:#7c3aed;--blue:#3b82f6}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:radial-gradient(1100px 700px at 18% 12%, rgba(124,58,237,.25), transparent 60%),radial-gradient(900px 600px at 82% 18%, rgba(59,130,246,.18), transparent 60%),radial-gradient(900px 700px at 50% 88%, rgba(255,207,90,.14), transparent 60%),linear-gradient(180deg, #060712, #05060a 55%, #04040a);padding:24px}
    .wrap{max-width:1080px;margin:0 auto;display:grid;gap:18px}.card{background:linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.055));border:1px solid rgba(255,255,255,.14);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.65);padding:18px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.title{font-size:24px;font-weight:820}.sub{margin-top:6px;color:var(--muted);line-height:1.65;max-width:760px}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}@media (max-width:920px){.grid{grid-template-columns:1fr}}.kicker{font-size:12px;color:rgba(255,207,90,.86);letter-spacing:.4px;text-transform:uppercase}.big{font-size:19px;font-weight:800;margin-top:8px}.note{margin-top:10px;color:var(--muted);line-height:1.7}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}pre{margin:0;padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.24);overflow:auto;white-space:pre-wrap;word-break:break-word}.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}button,a{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);text-decoration:none;border-radius:14px;padding:11px 13px;font-weight:760;cursor:pointer}button.primary,a.primary{border-color:rgba(255,207,90,.35);background:linear-gradient(135deg, rgba(255,207,90,.22), rgba(124,58,237,.14))}.status{font-size:12px;color:var(--muted);margin-top:10px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card top">
      <div>
        <div class="title">Private App Surface 🔐</div>
        <div class="sub">This route is rendered by a Netlify Function after the JWT cookie and Neon session record both validate. It now also exposes account verification state so you can use this package as a reusable base across projects.</div>
      </div>
      <a class="primary" href="/index.html">Back to portal</a>
    </div>
    <div class="grid">
      <div class="card">
        <div class="kicker">Authenticated identity</div>
        <div class="big">Signed in as ${escapeHtml(auth.user.email)}</div>
        <div class="note">Role: <span class="mono">${escapeHtml(auth.user.role)}</span> • Email status: <span class="mono">${escapeHtml(verifiedLabel)}</span></div>
        <div class="btns">
          <button class="primary" id="logoutBtn">Logout</button>
          <a href="/protected.html">Open shell demo</a>
        </div>
        <div class="status" id="status">Session is active.</div>
      </div>
      <div class="card">
        <div class="kicker">Server-verified payload</div>
        <div class="big">Current account snapshot</div>
        <div class="note">This payload is server-rendered after auth checks pass, so it is safe to use as your protected project shell starter.</div>
      </div>
    </div>
    <div class="card">
      <pre class="mono">${userJson}</pre>
    </div>
  </div>
  <script>
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const status = document.getElementById("status");
      status.textContent = "Logging out…";
      const res = await fetch("/.netlify/functions/logout", {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type":"application/json"},
        body: "{}"
      });
      if (res.ok) {
        location.href = "/index.html";
        return;
      }
      status.textContent = "Logout failed. Refresh and try again.";
    });
  </script>
</body>
</html>`);
};
