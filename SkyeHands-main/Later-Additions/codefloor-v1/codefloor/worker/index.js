// worker/index.js
// Cloudflare Worker — serves public share pages + report data at the edge
// Deploy: wrangler deploy
// Routes: reports.codefloor.io/*  OR  codefloor.io/share/*

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const token = url.pathname.split("/").filter(Boolean).pop();

    if (!token || token.length < 10) {
      return new Response("Not found", { status: 404 });
    }

    // Fetch report data from Netlify Function (cached at edge for 60s)
    const cacheKey = new Request(`${env.API_BASE}/report?token=${token}`, request);
    const cache = caches.default;
    let cached = await cache.match(cacheKey);

    if (!cached) {
      const apiRes = await fetch(`${env.API_BASE}/.netlify/functions/report?token=${token}`, {
        headers: { "User-Agent": "CodeFloor-Worker/1.0" },
      });

      if (!apiRes.ok) {
        return new Response(
          renderNotFound(),
          { status: 404, headers: { "Content-Type": "text/html" } }
        );
      }

      const data = await apiRes.json();

      const html = renderReport(data);
      cached = new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-CodeFloor-Token": token.slice(0, 8) + "...",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, cached.clone()));
    }

    return cached;
  },
};

function fmt(n) {
  const m = parseFloat(n) || 0;
  return m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m.toFixed(2)}M`;
}

function renderReport({ project, sections, gaps, comps, floor }) {
  const STATUS = { proven: "#0d9e75", aspirational: "#ef9f27", open: "#e24b4a" };
  const by_cat = {};
  (sections || []).forEach(s => { (by_cat[s.category] = by_cat[s.category] || []).push(s); });

  const provenFloor = parseFloat(project.base_floor) +
    (sections || []).filter(s => s.status === "proven").reduce((a, s) => a + parseFloat(s.value_m), 0);
  const provenPct = floor > 0 ? Math.round((provenFloor / floor) * 100) : 0;
  const raiseBase = (floor * 1.75).toFixed(2);
  const raiseHigh = (floor * 2.5).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${project.name} — Platform Valuation | CodeFloor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#09090b;--bg1:#111113;--bg2:#18181b;--card:#1c1c1f;--b:rgba(255,255,255,.07);--gold:#f5c842;--green:#0d9e75;--amber:#ef9f27;--red:#e24b4a;--v:#7c6bff;--w:#fafafa;--m:#a1a1aa;--f:#52525b;--mono:'JetBrains Mono',monospace;--serif:'Instrument Serif',serif;--sans:'Geist',system-ui;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--w);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;}
.nav{border-bottom:1px solid var(--b);padding:16px 36px;display:flex;align-items:center;justify-content:space-between;}
.logo{font-family:var(--mono);font-size:13px;color:var(--gold);letter-spacing:.08em;}
.wrap{max-width:860px;margin:0 auto;padding:48px 24px 80px;}
.eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--f);text-transform:uppercase;margin-bottom:10px;}
h1{font-family:var(--serif);font-size:clamp(32px,5vw,52px);line-height:1.08;margin-bottom:8px;}
h1 em{font-style:italic;color:var(--gold);}
.desc{font-size:15px;color:var(--m);line-height:1.7;margin-bottom:36px;}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:36px;}
.met{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:20px;}
.met-n{font-family:var(--mono);font-size:24px;font-weight:500;margin-bottom:6px;}
.met-l{font-size:11px;color:var(--m);line-height:1.5;}
.bar-wrap{height:4px;background:rgba(255,255,255,.06);border-radius:2px;margin-top:12px;overflow:hidden;}
.bar{height:100%;border-radius:2px;background:var(--green);}
.cat-label{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--f);text-transform:uppercase;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--b);}
.sec-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.sec-name{flex:1;font-size:13px;}
.badge{padding:2px 9px;border-radius:100px;font-size:10px;font-weight:500;}
.sec-val{font-family:var(--mono);font-size:13px;min-width:72px;text-align:right;}
.total-row{display:flex;justify-content:space-between;padding:16px 0;border-top:1px solid rgba(255,255,255,.15);margin-top:4px;}
.raise-card{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:24px;margin:28px 0;}
.raise-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.raise-row:last-child{border-bottom:none;}
.gap-dot{width:6px;height:6px;border-radius:50%;background:var(--red);flex-shrink:0;margin-top:7px;}
.gap-row{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;}
.method{background:rgba(245,200,66,.04);border:1px solid rgba(245,200,66,.12);border-radius:10px;padding:18px 20px;margin:28px 0;font-size:13px;color:var(--m);line-height:1.7;}
.cta{display:inline-flex;align-items:center;gap:8px;margin-top:32px;padding:13px 22px;background:var(--gold);color:#09090b;font-weight:600;font-size:13px;border-radius:8px;text-decoration:none;}
footer{text-align:center;padding:28px;font-size:11px;color:var(--f);border-top:1px solid var(--b);margin-top:48px;}
@media(max-width:600px){.metrics{grid-template-columns:1fr 1fr;} h1{font-size:28px;}}
</style>
</head>
<body>
<nav class="nav">
  <div class="logo">CODEFLOOR</div>
  <a href="https://codefloor.io" style="font-size:12px;color:var(--m);text-decoration:none;">Create your own report →</a>
</nav>
<div class="wrap">
  <div class="eyebrow">Platform Valuation · ${new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
  <h1>${project.name.includes(" ") ? project.name.split(" ").slice(0,-1).join(" ") + " <em>" + project.name.split(" ").slice(-1) + "</em>" : `<em>${project.name}</em>`}</h1>
  ${project.description ? `<div class="desc">${project.description}${project.pass_name ? ` <span style="font-family:var(--mono);font-size:11px;color:var(--f);">· ${project.pass_name}</span>` : ""}</div>` : ""}

  <div class="metrics">
    <div class="met" style="border-color:rgba(13,158,117,.3);">
      <div class="met-n" style="color:var(--green);">${fmt(floor)}</div>
      <div class="met-l">Devil's-advocate code-floor</div>
      <div class="bar-wrap"><div class="bar" style="width:${provenPct}%"></div></div>
      <div style="font-size:10px;color:var(--f);margin-top:4px;">${provenPct}% proven</div>
    </div>
    <div class="met">
      <div class="met-n">${fmt(raiseBase)}–${fmt(raiseHigh)}</div>
      <div class="met-l">Pre-money raise posture (1.75–2.5× floor)</div>
    </div>
    <div class="met">
      <div class="met-n">${sections.length}</div>
      <div class="met-l">${sections.filter(s=>s.status==="proven").length} proven · ${sections.filter(s=>s.status==="aspirational").length} aspirational · ${sections.filter(s=>s.status==="open").length} open</div>
    </div>
  </div>

  <div style="font-size:13px;font-weight:500;color:var(--w);margin-bottom:2px;">Floor breakdown</div>
  <div style="font-size:12px;color:var(--m);margin-bottom:16px;">Base platform + ${Object.keys(by_cat).length} capability categories</div>

  <div class="sec-row" style="opacity:.6;">
    <span class="sec-name">Base platform (shell · runtime · IDE · governance)</span>
    <span class="sec-val">${fmt(project.base_floor)}</span>
  </div>

  ${Object.entries(by_cat).map(([cat, secs]) => `
    <div class="cat-label">${cat}</div>
    ${secs.map(s => `<div class="sec-row">
      <span class="sec-name" style="color:${s.status==="proven"?"var(--w)":"var(--m)"};">${s.name}</span>
      <span class="badge" style="background:${STATUS[s.status] || "#52525b"}1a;color:${STATUS[s.status] || "#a1a1aa"};">${s.status}</span>
      <span class="sec-val">${parseFloat(s.value_m) > 0 ? fmt(s.value_m) : "—"}</span>
    </div>`).join("")}
  `).join("")}

  <div class="total-row">
    <span style="font-size:15px;font-weight:500;">Total code-floor</span>
    <span style="font-family:var(--mono);font-size:18px;color:var(--green);font-weight:500;">${fmt(floor)}</span>
  </div>

  <div class="raise-card">
    <div style="font-size:13px;font-weight:500;margin-bottom:14px;">Raise posture</div>
    ${[["Conservative","1.2×",floor*1.2],["Base case","1.75×",floor*1.75],["Upside","2.5×",floor*2.5]].map(([s,m,v])=>`
    <div class="raise-row">
      <div><span style="font-size:13px;">${s}</span> <span style="font-family:var(--mono);font-size:11px;color:var(--f);">${m}</span></div>
      <span style="font-family:var(--mono);font-size:14px;">${fmt(v)}</span>
    </div>`).join("")}
  </div>

  ${gaps.length > 0 ? `
  <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--red);">Honest gaps</div>
  <div style="margin-bottom:20px;">
  ${gaps.map(g => `<div class="gap-row">
    <div class="gap-dot"></div>
    <div><strong style="font-size:13px;">${g.title}</strong>${g.detail ? `<div style="font-size:12px;color:var(--m);margin-top:2px;">${g.detail}</div>` : ""}</div>
  </div>`).join("")}
  </div>` : ""}

  ${comps.length > 0 ? `
  <div style="font-size:13px;font-weight:500;margin-bottom:8px;">Market validation</div>
  ${comps.map(c => `<div class="sec-row">
    <span class="sec-name">${c.name}${c.dimension ? ` <span style="font-size:11px;color:var(--m);">· ${c.dimension}</span>` : ""}</span>
    <span style="font-family:var(--mono);font-size:13px;">${fmt(c.valuation_m)}</span>
  </div>`).join("")}` : ""}

  <div class="method">
    <strong style="color:var(--w);">Methodology:</strong> Devil's-advocate code-floor. No ARR multiple, no customer multiple, no acquisition-control premium, no speculative hype premium. A section earns its value only when code exists, the runtime path exists, the hostile/failure path exists, and a proof artifact passes. Open items are listed, not hidden.
  </div>

  <a href="https://codefloor.io" class="cta">Build your own valuation report →</a>
</div>
<footer>CodeFloor · Platform Valuation · Not financial advice · For qualified investors only</footer>
</body></html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html><html><head><title>Not found</title></head><body style="background:#09090b;color:#a1a1aa;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;"><div><p style="font-size:14px;">Report not found or sharing is disabled.</p><a href="https://codefloor.io" style="color:#f5c842;font-size:13px;">Go to CodeFloor →</a></div></body></html>`;
}
