
/* SOLE Nexus • Valuation Studio
   - Client-side ZIP scan (JSZip)
   - Deterministic single-number proof-asset appraisal (no sales)
   - Branded PDF export (jsPDF + AutoTable)
*/

const DEFAULT_LOGO_URL = "https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png";

const KAIXU_MODEL_MAP = {
  gemini: "skAIxU-Pro2",
  openai: "kAIxU-Prime6.7",
  anthropic: "skAIxU Flow3.9"
};

const KAIXU_APP = "sole-nexus-valuation-studio";
const KAIXU_BUILD = "spectacle-ai+diag-1";




const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const clientErrorBuffer = [];
function pushClientError(entry){
  clientErrorBuffer.push(entry);
  while(clientErrorBuffer.length > 30) clientErrorBuffer.shift();
}

function kaixuBaseHeaders(){
  return {
    "x-kaixu-app": KAIXU_APP,
    "x-kaixu-build": KAIXU_BUILD
  };
}

async function reportClientError(type, err, context = {}){
  const entry = {
    type,
    message: String(err?.message || err || ""),
    stack: String(err?.stack || ""),
    context,
    time: new Date().toISOString(),
    app: KAIXU_APP,
    build: KAIXU_BUILD,
    ua: navigator.userAgent
  };
  pushClientError(entry);

  // Best-effort report. Never throw from here.
  try{
    await fetch("/.netlify/functions/client-error-report", {
      method: "POST",
      headers: { "Content-Type":"application/json", ...kaixuBaseHeaders() },
      body: JSON.stringify(entry)
    });
  }catch(_){ /* ignore */ }
}

window.addEventListener("error", (e) => {
  reportClientError("window.error", e?.error || e?.message || "error", { file: e?.filename, line: e?.lineno, col: e?.colno });
});
window.addEventListener("unhandledrejection", (e) => {
  reportClientError("unhandledrejection", e?.reason || "promise_rejection", {});
});


function setStep(step){
  $$(".step[data-step]").forEach(el=>{
    const s = Number(el.dataset.step||0);
    el.classList.toggle("step--active", s <= step);
  });
}

function computeQualityScore(scan){
  if(!scan) return 0;
  const m = scan.metaStats || {};
  const pages = m.pages || Math.max(scan.htmlPages||1, 1);
  const canonicalPct = (m.canonical||0)/pages;
  const jsonldPct = (m.jsonld||0)/pages;
  const metaDescPct = (m.metaDesc||0)/pages;
  const rel = scan.relStats || { total:0, noref:0 };
  const norefPct = rel.total ? (rel.noref/rel.total) : 1;

  let score = 70
    + canonicalPct*10
    + jsonldPct*8
    + metaDescPct*6;

  const issues = (scan.issues||[]).length;
  score -= issues * 3;
  if(norefPct < 0.80) score -= 2;

  score = clamp(score, 0, 100);
  return Math.round(score);
}

function updateHeroKPI(){
  const v = Number(String($("valuationNumber")?.value||"").replace(/[^\d]/g,"")) || 0;
  const display = document.getElementById("kpiBigDisplay");
  const sub = document.getElementById("kpiSubDisplay");
  if(display){
    display.textContent = v ? fmtMoney(v) : "$—";
  }
  // meter from score
  const score = computeQualityScore(state.scan);
  const meterFill = document.getElementById("meterFill");
  const meterLabel = document.getElementById("meterLabel");
  if(meterFill) meterFill.style.width = (v ? score : 0) + "%";
  if(meterLabel) meterLabel.textContent = v ? `Quality score: ${score}/100` : "Quality score: —/100";

  if(sub){
    if(!state.scan) sub.textContent = "Upload a ZIP to calibrate valuation.";
    else sub.textContent = (v ? "Breakdown must equal total to unlock PDF export." : "Auto-calc or enter a valuation to proceed.");
  }
}

const $ = (id) => document.getElementById(id);

const state = {
  zipName: null,
  logoDataUrl: null,
  scan: null,
  report: null,
  evidence: [
    { label: "Homepage", url: "https://sole-nexus.netlify.app/" },
    { label: "Blog index", url: "https://sole-nexus.netlify.app/blog/" },
    { label: "Phoenix series hub", url: "https://sole-nexus.netlify.app/series/phoenix/" },
    { label: "JSON feed", url: "https://sole-nexus.netlify.app/feed.json" },
    { label: "Robots", url: "https://sole-nexus.netlify.app/robots.txt" },
    { label: "Sitemap", url: "https://sole-nexus.netlify.app/sitemap.xml" },
  ],
  breakdown: [
    { name: "Core site system (pages + design + routing)", amt: 0 },
    { name: "Content engine (blog + series hub)", amt: 0 },
    { name: "SEO/index pack (feeds, sitemaps, meta)", amt: 0 },
    { name: "Security + edge pack (_headers, fallback, 404)", amt: 0 },
    { name: "Intake funnel (Netlify Forms plumbing)", amt: 0 },
    { name: "QA + release readiness", amt: 0 },
  ]
  ,
  ai: {
    preset: "local",
    provider: 'SKYES OVER LONDON',
    model: "skAIxU-Pro2",
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
    apply: true,
    instruction: "",
    last_text: "",
    last_json: null,
    last_usage: null,
    last_month: null
  }

};

function fmtInt(n){ return (Number(n)||0).toLocaleString("en-US"); }
function fmtMoney(n){ return "$" + (Number(n)||0).toLocaleString("en-US", {maximumFractionDigits:0}); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }


/* ─────────────────────────────────────────────────────────────
   kAIxuGateway13 client (MANDATORY)
   - ALL AI calls must go through /api/.netlify/functions/* which Netlify redirects
     to <same-origin-runtime-gateway>/:splat via netlify.toml.
   - No direct provider SDKs. No provider keys.
───────────────────────────────────────────────────────────── */

function kaixuGetKey(){
  const el = document.getElementById("kaixuKey");
  const v = (el?.value || sessionStorage.getItem("kAIxU Server Lane") || "").trim();
  return v;
}
function kaixuSetKey(v){
  try{ sessionStorage.setItem("kAIxU Server Lane", (v||"").trim()); }catch{}
}

function kaixuFmtCents(c){
  const n = Number(c||0);
  return "$" + (n/100).toFixed(2);
}

function kaixuSetUsage(usage, month){
  const usageBadge = document.getElementById("usageBadge");
  const budgetBadge = document.getElementById("budgetBadge");
  if(usageBadge){
    if(usage){
      const inTok = usage.input_tokens ?? usage.prompt_tokens ?? 0;
      const outTok = usage.output_tokens ?? usage.completion_tokens ?? 0;
      const cost = usage.cost_cents ?? 0;
      usageBadge.textContent = `Usage: in ${inTok} • out ${outTok} • ${kaixuFmtCents(cost)}`;
    } else usageBadge.textContent = "Usage: —";
  }
  if(budgetBadge){
    if(month){
      const cap = Number(month.cap_cents||0);
      const spent = Number(month.spent_cents||0);
      const remain = cap - spent;
      budgetBadge.textContent = `Budget: ${kaixuFmtCents(remain)} remaining (${month.month})`;
    } else budgetBadge.textContent = "Budget: —";
  }
}

function kaixuSetAIStatus(text, kind){
  const el = document.getElementById("aiStatus");
  if(!el) return;
  el.textContent = text;
  el.classList.remove("aiStatus--ok","aiStatus--warn","aiStatus--bad");
  if(kind) el.classList.add(`aiStatus--${kind}`);
}

function kaixuMapHTTPError(status){
  if(status === 401) return "401: Invalid / missing Kaixu Key (Authorization).";
  if(status === 402) return "402: Monthly cap reached. Top-up/upgrade required.";
  if(status === 429) return "429: Rate limited. Retry shortly.";
  if(status >= 500) return `${status}: Gateway/provider error. Retry or switch model.`;
  return `${status}: Request failed.`;
}

async function kaixuChat(payload){
  const key = kaixuGetKey();
  const PROXY_HINT = "AI proxy not found (404). Ensure your Netlify deploy includes _redirects with: /api/* <same-origin-runtime-gateway>/:splat 200!";

  const t0 = performance.now();
  const res = await fetch("/api/.netlify/functions/gateway-chat", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization": `Bearer ${key}`,
      ...kaixuBaseHeaders()
    },
    body: JSON.stringify(payload)
  });
  markLastRun("STREAM", performance.now()-t0, "stream");
  if(!res.ok){
    const msg = kaixuMapHTTPError(res.status);
    markLastRun("FAIL", performance.now()-t0, msg);
    reportClientError("kaixu.chat.http", msg, { status: res.status });
    throw new Error(msg);
  }
  const data = await res.json();
  markLastRun("OK", performance.now()-t0, "chat");
  return data; // { output_text, usage, month }
}

async function kaixuStreamChat(payload, { onMeta, onDelta, onDone, onError }){
  const key = kaixuGetKey();
  const t0 = performance.now();
  const res = await fetch("/api/.netlify/functions/gateway-stream", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization": `Bearer ${key}`,
      ...kaixuBaseHeaders()
    },
    body: JSON.stringify(payload)
  });

  markLastRun("STREAM", performance.now()-t0, "stream");
  if(!res.ok){
    const msg = kaixuMapHTTPError(res.status);
    markLastRun("FAIL", performance.now()-t0, msg);
    reportClientError("kaixu.stream.http", msg, { status: res.status });
    onError?.({ error: msg });
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8");
  let buf = "";

  function dispatchEventBlock(block){
    // SSE block can contain multiple lines:
    // event: meta|delta|done|error
    // data: {json}
    let event = "delta";
    let dataLines = [];
    const lines = block.split("\n");
    for(const line of lines){
      if(line.startsWith("event:")) event = line.slice(6).trim();
      else if(line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const dataStr = dataLines.join("\n").trim();
    let obj = null;
    try{ obj = dataStr ? JSON.parse(dataStr) : null; }catch{ obj = { text: dataStr }; }

    if(event === "meta") onMeta?.(obj);
    else if(event === "delta") onDelta?.(obj);
    else if(event === "done") onDone?.(obj);
    else if(event === "error") onError?.(obj);
  }

  while(true){
    const { value, done } = await reader.read();
    if(done) break;
    buf += dec.decode(value, { stream:true });

    // Split SSE events by blank line
    let idx;
    while((idx = buf.indexOf("\n\n")) !== -1){
      const block = buf.slice(0, idx).trim();
      buf = buf.slice(idx+2);
      if(block) dispatchEventBlock(block);
    }
  }
}


function initSkyFX(){
  const c = document.getElementById("skyCanvas");
  if(!c) return;
  const ctx = c.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let w=0,h=0,stars=[];
  const STAR_COUNT = 220;

  function resize(){
    w = Math.floor(window.innerWidth * DPR);
    h = Math.floor(window.innerHeight * DPR);
    c.width = w; c.height = h;
    c.style.width = "100%";
    c.style.height = "100%";
    stars = Array.from({length: STAR_COUNT}, () => ({
      x: Math.random()*w,
      y: Math.random()*h,
      r: (Math.random()*1.4 + 0.2)*DPR,
      s: (Math.random()*0.65 + 0.15)*DPR,
      a: Math.random()*0.7 + 0.15,
      tw: Math.random()*Math.PI*2
    }));
  }
  resize();
  window.addEventListener("resize", resize);

  function frame(t){
    ctx.clearRect(0,0,w,h);
    // subtle gradient fog
    const g = ctx.createRadialGradient(w*0.25,h*0.20, 0, w*0.25,h*0.20, Math.max(w,h)*0.9);
    g.addColorStop(0, "rgba(109,42,168,0.14)");
    g.addColorStop(0.55, "rgba(12,6,18,0.0)");
    g.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    for(const st of stars){
      st.y += st.s;
      if(st.y > h){ st.y = -10; st.x = Math.random()*w; }
      const tw = (Math.sin((t/1000)+st.tw)+1)/2;
      const alpha = st.a*(0.5 + tw*0.5);
      ctx.beginPath();
      ctx.fillStyle = `rgba(246,243,255,${alpha})`;
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function setEnabled(enabled){
  $("btnAuto").disabled = !enabled;
  $("valuationNumber").disabled = !enabled;
  $("btnExportPDF").disabled = !enabled;
  const b2 = document.getElementById("btnExportPDF2"); if(b2) b2.disabled = !enabled;
  $("btnFillBreakdown").disabled = !enabled;
  $("btnAddEvidence").disabled = !enabled;
  $("btnExportJSON").disabled = !enabled;
  $("btnFillBreakdown").disabled = !enabled;

  const aiBtn = document.getElementById("btnAIEvaluate"); if(aiBtn && !enabled) aiBtn.disabled = true;
  if(enabled) setTimeout(()=>{ try{ updateAIControls(); }catch{} }, 0);
}

function setBrandLogo(src){
  const img = $("brandLogo");
  img.src = src;
  img.onerror = () => { img.src = DEFAULT_LOGO_URL; };
}

async function fileToDataURL(file){
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = file.type || "image/png";
  return `data:${mime};base64,${b64}`;
}

async function urlToDataURL(url){
  const res = await fetch(url, { mode: "cors" });
  if(!res.ok) throw new Error("Logo fetch failed");
  const blob = await res.blob();
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stripHtmlToText(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach(n => n.remove());
  const text = (doc.body?.textContent || "").replace(/\s+/g," ").trim();
  return text;
}

function parseISODate(s){
  try{
    const d = new Date(s.replace("Z",""));
    if(isNaN(d.getTime())) return null;
    return d;
  }catch{ return null; }
}

function scanLinksForRel(html){
  // returns counts for target=_blank and rel compliance
  const doc = new DOMParser().parseFromString(html, "text/html");
  const as = [...doc.querySelectorAll("a[target='_blank']")];
  let total = as.length;
  let noop = 0, noref = 0, missingRel = 0;
  for(const a of as){
    const rel = (a.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
    if(rel.length === 0) missingRel++;
    if(rel.includes("noopener")) noop++;
    if(rel.includes("noreferrer")) noref++;
  }
  return { total, noop, noref, missingRel };
}

function scanMetaCoverage(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const head = doc.head;
  const has = (sel) => !!head?.querySelector(sel);
  return {
    metaDesc: has(`meta[name="description"][content]`),
    canonical: has(`link[rel="canonical"][href]`),
    ogTitle: has(`meta[property="og:title"][content]`),
    ogDesc: has(`meta[property="og:description"][content]`),
    ogUrl: has(`meta[property="og:url"][content]`),
    twitterCard: has(`meta[name="twitter:card"][content]`),
    jsonld: has(`script[type="application/ld+json"]`)
  };
}

async function scanZip(file){
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  zip.forEach((path, zobj) => { if(!zobj.dir) entries.push(path); });

  const htmlFiles = entries.filter(p => p.toLowerCase().endsWith(".html"));
  const jsFiles = entries.filter(p => p.toLowerCase().endsWith(".js"));
  const cssFiles = entries.filter(p => p.toLowerCase().endsWith(".css"));

  const blogPosts = htmlFiles.filter(p => p.startsWith("blog/") && p !== "blog/index.html");
  const hasRobots = entries.includes("robots.txt");
  const hasSitemap = entries.includes("sitemap.xml");
  const hasSitemapIndex = entries.includes("sitemap_index.xml");
  const hasRedirects = entries.includes("_redirects");
  const hasHeaders = entries.includes("_headers");
  const hasFeed = entries.includes("feed.json");
  const hasRss = entries.includes("rss.xml");

  // Word counts + link hygiene + meta coverage
  let totalWords = 0;
  let blogWords = 0;
  let relStats = { total:0, noop:0, noref:0, missingRel:0 };
  let metaStats = { metaDesc:0, canonical:0, ogTitle:0, ogDesc:0, ogUrl:0, twitterCard:0, jsonld:0, pages:0 };

  for(const p of htmlFiles){
    const txt = await zip.file(p).async("string");
    const words = stripHtmlToText(txt).split(/\s+/).filter(Boolean).length;
    totalWords += words;
    if(p.startsWith("blog/") && p !== "blog/index.html") blogWords += words;

    const rel = scanLinksForRel(txt);
    relStats.total += rel.total;
    relStats.noop += rel.noop;
    relStats.noref += rel.noref;
    relStats.missingRel += rel.missingRel;

    const mc = scanMetaCoverage(txt);
    metaStats.pages += 1;
    metaStats.metaDesc += mc.metaDesc ? 1 : 0;
    metaStats.canonical += mc.canonical ? 1 : 0;
    metaStats.ogTitle += mc.ogTitle ? 1 : 0;
    metaStats.ogDesc += mc.ogDesc ? 1 : 0;
    metaStats.ogUrl += mc.ogUrl ? 1 : 0;
    metaStats.twitterCard += mc.twitterCard ? 1 : 0;
    metaStats.jsonld += mc.jsonld ? 1 : 0;
  }

  // Publish window from feed.json (if present)
  let window = null;
  let cutoffIssues = [];
  if(hasFeed){
    try{
      const feedStr = await zip.file("feed.json").async("string");
      const feed = JSON.parse(feedStr);
      const dates = (feed.items || [])
        .map(it => parseISODate(it.date_published))
        .filter(Boolean)
        .map(d => d.toISOString().slice(0,10))
        .sort();
      if(dates.length){
        window = { min: dates[0], max: dates[dates.length-1], count: dates.length };
      }
      // enforce user's rule: no posts after 2026-02-11
      const cutoff = "2026-02-11";
      if(dates.some(d => d > cutoff)){
        cutoffIssues.push(`Feed has dates after ${cutoff} (violates cap).`);
      }
    }catch(e){
      cutoffIssues.push("feed.json present but failed to parse (invalid JSON).");
    }
  }

  // Edge rule check
  let redirectsRule = null;
  if(hasRedirects){
    try{
      const r = await zip.file("_redirects").async("string");
      redirectsRule = r.trim();
    }catch{}
  }

  // Notes & issues
  const notes = [];
  const issues = [];

  notes.push(`ZIP entries: ${entries.length} files`);
  notes.push(`HTML pages: ${htmlFiles.length} • Blog posts: ${blogPosts.length}`);
  notes.push(`Words: ${totalWords.toLocaleString()} total • ${blogWords.toLocaleString()} blog`);
  if(window) notes.push(`Publish window (feed): ${window.min} → ${window.max} (${window.count} items)`);

  const indexPackParts = [
    hasRobots ? "robots.txt" : null,
    hasSitemap ? "sitemap.xml" : null,
    hasSitemapIndex ? "sitemap_index.xml" : null,
    hasFeed ? "feed.json" : null,
    hasRss ? "rss.xml" : null
  ].filter(Boolean);
  if(indexPackParts.length) notes.push(`Index pack present: ${indexPackParts.join(", ")}`);

  if(!hasSitemap) issues.push("Missing sitemap.xml (indexing pack incomplete).");
  if(!hasRobots) issues.push("Missing robots.txt (indexing pack incomplete).");
  if(!hasFeed) issues.push("Missing feed.json (optional but useful for content proof).");
  if(!hasHeaders) issues.push("Missing _headers (security posture not declared).");
  if(!hasRedirects) issues.push("Missing _redirects (404→home fallback not enforced).");
  if(hasRedirects && !redirectsRule.includes("/*")) issues.push("_redirects present but no /* fallback rule detected.");

  // Rel hygiene
  if(relStats.total > 0){
    const norefPct = relStats.noref / relStats.total;
    if(norefPct < 0.80){
      issues.push(`External link hygiene: ${relStats.total} target=_blank links; only ${Math.round(norefPct*100)}% include noreferrer.`);
    } else {
      notes.push(`External links: ${relStats.total} target=_blank • noreferrer coverage ${Math.round(norefPct*100)}%`);
    }
  }

  // Meta coverage
  if(metaStats.pages){
    const pct = (x) => Math.round((x/metaStats.pages)*100);
    notes.push(`Meta coverage: desc ${pct(metaStats.metaDesc)}% • canonical ${pct(metaStats.canonical)}% • OG ${pct(metaStats.ogTitle)}% • JSON-LD ${pct(metaStats.jsonld)}%`);
    if(pct(metaStats.canonical) < 80) issues.push("Canonical coverage < 80% (risk of duplicate URLs if .html and extensionless both index).");
  }

  for(const i of cutoffIssues) issues.push(i);

  return {
    entriesCount: entries.length,
    htmlPages: htmlFiles.length,
    blogPosts: blogPosts.length,
    totalWords,
    blogWords,
    window,
    indexPack: { hasRobots, hasSitemap, hasSitemapIndex, hasFeed, hasRss },
    hasHeaders,
    hasRedirects,
    redirectsRule,
    relStats,
    metaStats,
    notes,
    issues
  };
}

// Deterministic appraisal model (no sales)
function autoAppraise(scan, mode){
  // Base model: maps measured scope -> single-number valuation and breakdown.
  // Outputs a single number, rounded to nearest $100.

  // Inputs
  const pages = scan.htmlPages || 0;
  const posts = scan.blogPosts || 0;
  const words = scan.totalWords || 0;

  // Coverage metrics
  const m = scan.metaStats || {};
  const pagesCount = m.pages || Math.max(pages, 1);
  const canonicalPct = (m.canonical || 0) / pagesCount;
  const jsonldPct = (m.jsonld || 0) / pagesCount;
  const metaDescPct = (m.metaDesc || 0) / pagesCount;

  // Feature presence
  const hasIndexPack = scan.indexPack?.hasRobots && scan.indexPack?.hasSitemap;
  const hasSecurityPack = !!scan.hasHeaders;
  const hasEdgePack = !!scan.hasRedirects;
  const hasFeed = !!scan.indexPack?.hasFeed;

  // Link hygiene
  const rel = scan.relStats || { total:0, noref:0 };
  const norefPct = rel.total ? (rel.noref / rel.total) : 1;

  // Core valuation units (deterministic)
  // These constants are tuned to produce agency deliverable valuation in the same ballpark as your previous appraisal.
  let value =
    9500 +                             // base
    pages * 240 +                      // page system value
    posts * 420 +                      // content engine value
    Math.round(words * 0.22);          // copy mass value

  // Quality premiums
  value += Math.round(2200 * canonicalPct);
  value += Math.round(1600 * jsonldPct);
  value += Math.round(1000 * metaDescPct);

  if(hasIndexPack) value += 1200;
  if(hasFeed) value += 450;
  if(hasSecurityPack) value += 1100;
  if(hasEdgePack) value += 650;

  // Penalties
  if(!scan.indexPack?.hasSitemap) value -= 2200;
  if(!scan.indexPack?.hasRobots) value -= 1100;
  if(canonicalPct < 0.8) value -= 900;
  if(norefPct < 0.8) value -= 500;

  // Mode adjustment (agency vs replacement normalization)
  // Agency mode values the packaged deliverable; replacement mode compresses to production normalization.
  if(mode === "replacement"){
    value = Math.round(value * 0.72);
  } else {
    value = Math.round(value * 1.00);
  }

  // Round to nearest $100 and floor minimum
  value = Math.max(7500, Math.round(value / 100) * 100);

  // Breakdown allocation (percent weights)
  const weights = [
    0.44, // core system
    0.26, // content engine
    0.10, // SEO/index
    0.08, // security/edge
    0.06, // intake
    0.06  // QA
  ];
  const alloc = weights.map(w => Math.round(value*w/100)*100);
  // Fix rounding drift by adjusting last line
  const drift = value - alloc.reduce((a,b)=>a+b,0);
  alloc[alloc.length-1] += drift;

  return { value, alloc };
}


/* ─────────────────────────────────────────────────────────────
   AI valuation (via kAIxuGateway13)
───────────────────────────────────────────────────────────── */

function aiPresetToProviderModel(preset){
  if(preset === "kaixu") return { provider: 'SKYES OVER LONDON', model: KAIXU_MODEL_MAP.gemini };
  if(preset === "chatgpt") return { provider:"openai", model: KAIXU_MODEL_MAP.openai };
  if(preset === "claude") return { provider:"anthropic", model: KAIXU_MODEL_MAP.anthropic };
  return { provider: 'SKYES OVER LONDON', model: KAIXU_MODEL_MAP.gemini };
}

function updateAIControls(){
  const preset = document.getElementById("aiPreset")?.value || "local";
  const key = kaixuGetKey();
  const hasScan = !!state.scan;

  const providerSel = document.getElementById("aiProvider");
  const modelInp = document.getElementById("aiModel");
  const btn = document.getElementById("btnAIEvaluate");

  const isCustom = preset === "custom";
  const isLocal = preset === "local";

  if(providerSel) providerSel.disabled = !isCustom;
  if(modelInp) modelInp.disabled = !isCustom;

  // Set defaults when switching away from custom
  if(!isCustom && !isLocal){
    const pm = aiPresetToProviderModel(preset);
    if(providerSel) providerSel.value = pm.provider;
    if(modelInp) modelInp.value = pm.model;
  }

  // Enable the AI button only when: scan exists + non-local preset + key present
  if(btn) btn.disabled = !(hasScan && !isLocal && key.length > 8);

  // Persist AI state
  state.ai.preset = preset;
  state.ai.provider = providerSel?.value || state.ai.provider;
  state.ai.model = modelInp?.value || state.ai.model;
  state.ai.stream = !!document.getElementById("aiStream")?.checked;
  state.ai.apply = !!document.getElementById("aiApply")?.checked;
  state.ai.temperature = Number(document.getElementById("aiTemp")?.value || 0.7);
  state.ai.max_tokens = Number(document.getElementById("aiMaxTokens")?.value || 2048);
  state.ai.instruction = (document.getElementById("aiInstruction")?.value || "").trim();
}

function extractJSONObject(text){
  if(!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if(first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last+1);
  try{ return JSON.parse(slice); }catch{ return null; }
}

function applyAIResult(obj){
  if(!obj) return false;

  // Expected keys: valuation_total, breakdown[ {name, amount} ], notes/issues optional
  const total = Number(obj.valuation_total || obj.total || obj.valuation || 0);
  const breakdown = obj.breakdown || obj.components || null;

  if(total && document.getElementById("valuationNumber")){
    document.getElementById("valuationNumber").value = String(Math.round(total));
  }

  if(Array.isArray(breakdown) && breakdown.length){
    state.breakdown = breakdown.slice(0, 12).map((r, i) => ({
      name: String(r.name || r.component || r.title || `Component ${i+1}`),
      amt: Number(r.amount ?? r.amt ?? r.value ?? 0)
    }));
  }

  // Optional: evidence overwrite
  if(Array.isArray(obj.evidence) && obj.evidence.length){
    state.evidence = obj.evidence.slice(0, 12).map(e => ({
      label: String(e.label || e.item || "Evidence"),
      url: String(e.url || "")
    }));
    renderEvidence();
  }

  renderBreakdown();
  updateHeroKPI();
  return true;
}

async function runAIValuation(){
  updateAIControls();

  const preset = state.ai.preset;
  if(preset === "local") return;

  const key = kaixuGetKey();
  if(!key){
    kaixuSetAIStatus("Missing Kaixu Key", "bad");
    return;
  }
  if(!state.scan){
    kaixuSetAIStatus("Upload a ZIP first", "warn");
    return;
  }

  const provider = document.getElementById("aiProvider")?.value || state.ai.provider;
  const model = document.getElementById("aiModel")?.value || state.ai.model;
  const temp = clamp(Number(document.getElementById("aiTemp")?.value || 0.7), 0, 2);
  const maxTokens = clamp(Number(document.getElementById("aiMaxTokens")?.value || 2048), 256, 8192);

  const instruction = (document.getElementById("aiInstruction")?.value || "").trim();
  const apply = !!document.getElementById("aiApply")?.checked;
  const stream = !!document.getElementById("aiStream")?.checked;

  // Persist key for session
  kaixuSetKey(key);

  const aiText = document.getElementById("aiText");
  if(aiText) aiText.textContent = "";

  kaixuSetAIStatus("Thinking…", "warn");
  kaixuSetUsage(null, null);

  const systemPrompt = [
    "You are the valuation analyst for Skyes Over London LC.",
    "You will receive a JSON object named SCAN containing measured metrics from a static-site ZIP scan.",
    "Return ONE JSON object ONLY. No markdown. No commentary outside JSON.",
    "Do NOT use revenue, traffic, rankings, close rate, or sales metrics. This is a proof-asset appraisal only.",
    "Required output fields:",
    "  valuation_total: integer USD (single-number appraisal)",
    "  breakdown: array of 6 items: {name, amount} integers; amounts MUST sum exactly to valuation_total",
    "  notes: short bullet strings (optional)",
    "  issues: short bullet strings (optional)",
    "  quality_score: 0-100 integer (optional)",
    "  evidence: optional array of {label, url} (optional)",
    "If you include a narrative, put it in notes (short).",
    "Keep names aligned to agency appraisal language."
  ].join("\n");

  const userPayload = {
    prepared_for: document.getElementById("preparedFor")?.value || "",
    prepared_by: document.getElementById("preparedBy")?.value || "",
    site_url: document.getElementById("siteUrl")?.value || "",
    valuation_date: document.getElementById("valuationDate")?.value || "",
    mode: document.getElementById("mode")?.value || "agency",
    instruction: instruction || null,
    SCAN: state.scan
  };

  const payload = {
    provider,
    model,
    messages: [
      { role:"system", content: systemPrompt },
      { role:"user", content: JSON.stringify(userPayload) }
    ],
    max_tokens: maxTokens,
    temperature: temp
  };

  // Track engine used for PDF
  state.ai.provider = provider;
  state.ai.model = model;

  try{
    if(stream){
      await kaixuStreamChat(payload, {
        onMeta: (m) => {
          if(m?.month) kaixuSetUsage(null, m.month);
          kaixuSetAIStatus(`Streaming… (${provider}/${model})`, "warn");
        },
        onDelta: (d) => {
          const t = d?.text ?? d?.delta ?? "";
          if(!t) return;
          if(aiText) aiText.textContent += t;
        },
        onDone: (d) => {
          if(d?.usage || d?.month) kaixuSetUsage(d.usage, d.month);
          kaixuSetAIStatus("Complete", "ok");
          const out = aiText ? aiText.textContent : "";
          state.ai.last_text = out;
          const obj = extractJSONObject(out);
          state.ai.last_json = obj;
          if(apply && obj){
            const ok = applyAIResult(obj);
            if(!ok) kaixuSetAIStatus("Complete (could not apply JSON)", "warn");
          } else if(apply && !obj){
            kaixuSetAIStatus("Complete (AI did not return valid JSON)", "warn");
          }
        },
        onError: (e) => {
          const msg = e?.error || "AI error";
          kaixuSetAIStatus(msg, "bad");
        }
      });
    } else {
      const data = await kaixuChat(payload);
      const out = data?.output_text || "";
      if(aiText) aiText.textContent = out;
      state.ai.last_text = out;
      state.ai.last_usage = data?.usage || null;
      state.ai.last_month = data?.month || null;
      kaixuSetUsage(state.ai.last_usage, state.ai.last_month);
      const obj = extractJSONObject(out);
      state.ai.last_json = obj;
      kaixuSetAIStatus("Complete", "ok");
      if(apply && obj) applyAIResult(obj);
      else if(apply && !obj) kaixuSetAIStatus("Complete (AI did not return valid JSON)", "warn");
    }
  }catch(err){
    kaixuSetAIStatus(err.message || "AI request failed", "bad");
  }
}


function renderBreakdown(){
  const tbody = $("breakdownTable").querySelector("tbody");
  tbody.innerHTML = "";
  const total = Number($("valuationNumber").value || 0);
  let sum = 0;

  state.breakdown.forEach((row, idx) => {
    sum += Number(row.amt||0);
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.value = row.name;
    nameInput.addEventListener("input", () => { row.name = nameInput.value; });
    tdName.appendChild(nameInput);

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    const amtInput = document.createElement("input");
    amtInput.inputMode = "numeric";
    amtInput.value = row.amt ? String(row.amt) : "";
    amtInput.addEventListener("input", () => {
      const v = Number(String(amtInput.value).replace(/[^\d]/g,""));
      row.amt = isFinite(v) ? v : 0;
      renderBreakdown();
    });
    tdAmt.appendChild(amtInput);

    const tdPct = document.createElement("td");
    tdPct.className = "num";
    const pct = total ? (row.amt/total)*100 : 0;
    tdPct.textContent = total ? (pct.toFixed(1) + "%") : "—";

    const tdDel = document.createElement("td");
    tdDel.className = "del";
    const delBtn = document.createElement("button");
    delBtn.innerHTML = "✕";
    delBtn.title = "Remove row";
    delBtn.addEventListener("click", () => {
      state.breakdown.splice(idx,1);
      renderBreakdown();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdAmt);
    tr.appendChild(tdPct);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });

  $("bdTotal").textContent = total ? fmtMoney(sum) : "—";

  const ok = total && sum === total;
  $("valuationHint").textContent = total
    ? (ok ? "Breakdown matches total." : `Breakdown must equal total. Current sum: ${fmtMoney(sum)} (${sum-total >=0 ? "+" : ""}${fmtMoney(sum-total)})`)
    : "Upload a ZIP, then auto-calc or set a total.";
  $("valuationHint").style.color = ok ? "var(--ok)" : "var(--danger)";
  $("btnExportPDF").disabled = !ok;
  const b2 = document.getElementById("btnExportPDF2"); if(b2) b2.disabled = !ok;
  updateHeroKPI();
}

function renderEvidence(){
  const box = $("evidenceList");
  box.innerHTML = "";
  state.evidence.forEach((e, idx) => {
    const d = document.createElement("div");
    d.className = "evi";

    const l1 = document.createElement("label");
    l1.textContent = "Label";
    const in1 = document.createElement("input");
    in1.className="input";
    in1.value = e.label;
    in1.addEventListener("input", () => e.label = in1.value);

    const l2 = document.createElement("label");
    l2.textContent = "URL";
    const in2 = document.createElement("input");
    in2.className="input";
    in2.value = e.url;
    in2.addEventListener("input", () => e.url = in2.value);

    const row = document.createElement("div");
    row.className="row";
    const del = document.createElement("button");
    del.className="btn btn--ghost";
    del.textContent="Remove";
    del.addEventListener("click", () => { state.evidence.splice(idx,1); renderEvidence(); });

    d.appendChild(l1); d.appendChild(in1);
    d.appendChild(l2); d.appendChild(in2);
    d.appendChild(row); row.appendChild(del);

    box.appendChild(d);
  });
}

function fillBreakdownFromTotal(){
  const total = Number($("valuationNumber").value||0);
  if(!total) return;
  // If user has a different number of rows, allocate proportionally by default weights across existing rows.
  const weights = [
    0.44, 0.26, 0.10, 0.08, 0.06, 0.06
  ];
  for(let i=0;i<state.breakdown.length;i++){
    const w = weights[i] ?? (1/state.breakdown.length);
    state.breakdown[i].amt = Math.round((total*w)/100)*100;
  }
  // fix drift on last row
  const sum = state.breakdown.reduce((a,b)=>a+(b.amt||0),0);
  const drift = total - sum;
  state.breakdown[state.breakdown.length-1].amt += drift;
  renderBreakdown();
}

function getReportJSON(){
  const report = {
    siteUrl: $("siteUrl").value.trim(),
    artifactName: $("artifactName").value.trim(),
    preparedFor: $("preparedFor").value.trim(),
    preparedBy: $("preparedBy").value.trim(),
    valuationDate: $("valuationDate").value.trim(),
    mode: $("mode").value,
    valuationNumber: Number($("valuationNumber").value||0),
    breakdown: state.breakdown.map(x => ({...x})),
    evidence: state.evidence.map(x => ({...x})),
    scan: state.scan,
    ai: {
      preset: state.ai?.preset || "local",
      provider: state.ai?.provider || "",
      model: state.ai?.model || "",
      temperature: state.ai?.temperature ?? 0.7,
      max_tokens: state.ai?.max_tokens ?? 2048,
      stream: !!state.ai?.stream,
      applied: !!state.ai?.apply,
      instruction: state.ai?.instruction || "",
      last_text: state.ai?.last_text || "",
      last_usage: state.ai?.last_usage || null,
      last_month: state.ai?.last_month || null
    },
    logoDataUrl: state.logoDataUrl,
    version: "SOLE-Nexus-Valuation-Studio-1.1 (AI via kAIxuGateway13)"
  };
  return report;
}

function download(filename, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
}

async function exportPDF(){
  const report = getReportJSON();
  const { jsPDF } = window.jspdf;

  const PURPLE = [43,10,61];
  const GOLD = [212,175,55];
  const OFF = [246,243,255];

  const doc = new jsPDF({ unit:"pt", format:"letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 54;

  // Visual state
  setStep(3);

  function addWatermark(){
    try{
      const gs = new doc.GState({opacity: 0.07});
      doc.setGState(gs);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica","bold");
      doc.setFontSize(54);
      doc.text("SKYES OVER LONDON", W/2, H/2, { align:"center", angle: -18 });
      doc.setGState(new doc.GState({opacity: 1}));
    }catch(e){
      // If GState unsupported, skip watermark.
    }
  }

  function drawBreakdownBars(x, y, w, h){
    const rows = report.breakdown || [];
    const max = Math.max(...rows.map(r=>Number(r.amt||0)), 1);
    const barH = Math.max(10, Math.floor((h - 10) / rows.length) - 6);
    let cy = y;
    rows.forEach((r, i)=>{
      const amt = Number(r.amt||0);
      const bw = (amt/max) * w;
      // background
      doc.setFillColor(240, 236, 250);
      doc.rect(x, cy, w, barH, "F");
      // bar
      if(i===0) doc.setFillColor(...GOLD);
      else doc.setFillColor(109, 42, 168);
      doc.rect(x, cy, bw, barH, "F");
      doc.setTextColor(60,60,60);
      doc.setFontSize(9);
      doc.text(String(r.name).slice(0,38), x, cy-2);
      doc.setTextColor(26,26,26);
      doc.text(money(amt), x+w, cy+barH-2, {align:"right"});
      cy += barH + 16;
    });
  }

  async function addHeader(pageNum){
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, W, 70, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 70, W, 3, "F");

    // logo
    if(report.logoDataUrl){
      try{
        doc.addImage(report.logoDataUrl, "PNG", W - margin - 52, 12, 52, 52);
      }catch{}
    }

    doc.setTextColor(...OFF);
    doc.setFont("helvetica","bold");
    doc.setFontSize(16);
    doc.text("SOLE Nexus", margin, 38);
    doc.setFont("helvetica","normal");
    doc.setFontSize(11);
    doc.text("Proof-Asset Valuation Report (2026)", margin, 56);

    // footer
    doc.setDrawColor(230,230,230);
    doc.setLineWidth(1);
    doc.line(margin, H-46, W-margin, H-46);
    doc.setTextColor(90,90,90);
    doc.setFontSize(9);
    doc.text("Confidential • Internal appraisal • Excludes revenue/traffic valuation", margin, H-26);
    doc.text(`Page ${pageNum}`, W-margin, H-26, { align:"right" });
  }

  function money(n){ return "$" + Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0}); }

  // Page 1
  await addHeader(1);
  addWatermark();
  doc.setTextColor(26,26,26);
  doc.setFont("helvetica","bold"); doc.setFontSize(18);
  doc.text("Valuation Summary", margin, 110);

  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  doc.setTextColor(60,60,60);
  doc.text("This report appraises the website as a transferable proof asset (structure + content + readiness).", margin, 132);
  doc.text("It explicitly excludes traffic, revenue, and any sales-based valuation.", margin, 148);

  // Big number
  doc.setTextColor(43,10,61);
  doc.setFont("helvetica","bold"); doc.setFontSize(34);
  doc.text(money(report.valuationNumber), margin, 196);

  doc.setTextColor(60,60,60);
  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  doc.text("2026 Proof-Asset Valuation (single-number appraisal)", margin, 216);

  // Snapshot table
  const engineLabel = (report.ai && report.ai.preset && report.ai.preset !== "local")
    ? `${report.ai.preset} • ${report.ai.provider}/${report.ai.model} via kAIxuGateway13`
    : "Local deterministic (no AI)";
  const snap = [
    ["Site URL", report.siteUrl],
    ["Artifact", report.artifactName || "site-build.zip"],
    ["Valuation date", report.valuationDate],
    ["Prepared for", report.preparedFor],
    ["Prepared by", report.preparedBy],
    ["Valuation engine", engineLabel],
    ["Files (total)", String(report.scan?.entriesCount ?? "—")],
    ["HTML pages", String(report.scan?.htmlPages ?? "—")],
    ["Blog posts", String(report.scan?.blogPosts ?? "—")],
    ["Total visible copy (words)", String(report.scan?.totalWords?.toLocaleString?.() ?? "—")],
    ["Publish window", report.scan?.window ? `${report.scan.window.min} to ${report.scan.window.max}` : "—"],
    ["Edge fallback", report.scan?.redirectsRule ? report.scan.redirectsRule.replace(/\s+/g," ") : "—"],
  ];

  doc.autoTable({
    startY: 240,
    head: [["Field","Value"]],
    body: snap,
    theme: "grid",
    styles: { font:"helvetica", fontSize:9, cellPadding:6 },
    headStyles: { fillColor:[27,7,40], textColor:[246,243,255] },
    columnStyles: { 0:{cellWidth:160}, 1:{cellWidth: W - margin*2 - 160 } },
    margin: { left: margin, right: margin }
  });

  // Breakdown table
  const bd = report.breakdown.map(r => [r.name, money(r.amt)]);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 14,
    head: [["Component","Amount (USD)"]],
    body: [...bd, ["Total", money(report.valuationNumber)]],
    theme: "grid",
    styles: { font:"helvetica", fontSize:9, cellPadding:6 },
    headStyles: { fillColor:[27,7,40], textColor:[246,243,255] },
    columnStyles: { 0:{cellWidth: W - margin*2 - 140}, 1:{cellWidth:140, halign:"right"} },
    margin: { left: margin, right: margin }
  });

  // Page 2
  doc.addPage();
  await addHeader(2);
  addWatermark();
  doc.setTextColor(26,26,26);
  doc.setFont("helvetica","bold"); doc.setFontSize(18);
  doc.text("Evidence URLs", margin, 110);

  const ev = (report.evidence||[]).filter(e => (e.url||"").trim()).map(e => [e.label||"", e.url||""]);
  doc.autoTable({
    startY: 130,
    head: [["Item","URL"]],
    body: ev.length ? ev : [["—","—"]],
    theme: "grid",
    styles: { font:"helvetica", fontSize:9, cellPadding:6 },
    headStyles: { fillColor:[27,7,40], textColor:[246,243,255] },
    columnStyles: { 0:{cellWidth:140}, 1:{cellWidth: W - margin*2 - 140 } },
    margin: { left: margin, right: margin }
  });

  

  // Breakdown bars + issues
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.setTextColor(26,26,26);
  doc.text("Breakdown allocation", margin, doc.lastAutoTable.finalY + 24);

  drawBreakdownBars(margin, doc.lastAutoTable.finalY + 46, W - margin*2, 140);

  const issues = (report.scan?.issues || []).slice(0, 10);
  doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text("Detected issues (scan)", margin, doc.lastAutoTable.finalY + 210);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.setTextColor(70,70,70);
  if(issues.length===0){
    doc.text("No blocking issues detected.", margin, doc.lastAutoTable.finalY + 228);
  }else{
    let y = doc.lastAutoTable.finalY + 228;
    for(const it of issues){
      doc.text("• " + String(it).slice(0, 120), margin, y);
      y += 14;
      if(y > H-70) break;
    }
  }

// Page 3: scope
  doc.addPage();
  await addHeader(3);
  addWatermark();
  doc.setTextColor(26,26,26);
  doc.setFont("helvetica","bold"); doc.setFontSize(18);
  doc.text("Scope and Exclusions", margin, 110);

  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  doc.setTextColor(60,60,60);
  doc.text("Included: pages, content library, indexing artifacts, edge behavior, security headers, and intake plumbing.", margin, 135);
  doc.text("Excluded: traffic, rankings, conversion performance, revenue, pipeline, and sales-based valuation.", margin, 152);

  // Appendix snapshot
  const app = [
    ["Files", String(report.scan?.entriesCount ?? "—")],
    ["HTML pages", String(report.scan?.htmlPages ?? "—")],
    ["Blog posts", String(report.scan?.blogPosts ?? "—")],
    ["Total words", String(report.scan?.totalWords?.toLocaleString?.() ?? "—")],
    ["Blog words", String(report.scan?.blogWords?.toLocaleString?.() ?? "—")],
    ["Index pack", report.scan?.indexPack ? Object.entries(report.scan.indexPack).filter(([k,v])=>v).map(([k])=>k).join(", ") : "—"],
  ];
  doc.autoTable({
    startY: 180,
    head: [["Measured stat","Value"]],
    body: app,
    theme: "grid",
    styles: { font:"helvetica", fontSize:9, cellPadding:6 },
    headStyles: { fillColor:[27,7,40], textColor:[246,243,255] },
    columnStyles: { 0:{cellWidth:180}, 1:{cellWidth: W - margin*2 - 180 } },
    margin: { left: margin, right: margin }
  });

  // Save
  const fname = `SOLE-Nexus_Valuation_${report.valuationDate.replaceAll("-","")}.pdf`;
  doc.save(fname);
}

function onNew(){
  document.body.classList.remove("is-scanning");
  setStep(1);

  state.zipName = null;
  state.scan = null;
  $("zipInput").value = "";
  $("artifactName").value = "site-build.zip";
  $("valuationNumber").value = "";
  $("statFiles").textContent="—";
  $("statPages").textContent="—";
  $("statPosts").textContent="—";
  $("statWords").textContent="—";
  $("statWindow").textContent="—";
  $("statIndexPack").textContent="—";
  $("scanNotes").innerHTML="";
  $("scanIssues").innerHTML="";
  setEnabled(false);
  // reset breakdown amounts
  state.breakdown.forEach(r => r.amt = 0);
  renderBreakdown();
  renderEvidence();
}

function exportReportJSON(){
  const report = getReportJSON();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type:"application/json" });
  download(`SOLE-Nexus_Valuation_Report_${report.valuationDate}.json`, blob);
}

async function importReportJSON(file){
  const txt = await file.text();
  const r = JSON.parse(txt);
  $("siteUrl").value = r.siteUrl || $("siteUrl").value;
  $("artifactName").value = r.artifactName || "site-build.zip";
  $("preparedFor").value = r.preparedFor || $("preparedFor").value;
  $("preparedBy").value = r.preparedBy || $("preparedBy").value;
  $("valuationDate").value = r.valuationDate || $("valuationDate").value;
  $("mode").value = r.mode || "agency";
  // AI fields (optional)
  if(r.ai){
    const preset = r.ai.preset || "local";
    const pEl = document.getElementById("aiPreset"); if(pEl) pEl.value = preset;
    const provEl = document.getElementById("aiProvider"); if(provEl && r.ai.provider) provEl.value = r.ai.provider;
    const modelEl = document.getElementById("aiModel"); if(modelEl && r.ai.model) modelEl.value = r.ai.model;
    const tEl = document.getElementById("aiTemp"); if(tEl && r.ai.temperature != null) tEl.value = String(r.ai.temperature);
    const mEl = document.getElementById("aiMaxTokens"); if(mEl && r.ai.max_tokens != null) mEl.value = String(r.ai.max_tokens);
    const sEl = document.getElementById("aiStream"); if(sEl) sEl.checked = !!r.ai.stream;
    const aEl = document.getElementById("aiApply"); if(aEl) aEl.checked = !!r.ai.applied;
    const iEl = document.getElementById("aiInstruction"); if(iEl) iEl.value = r.ai.instruction || "";
    const outEl = document.getElementById("aiText"); if(outEl) outEl.textContent = r.ai.last_text || "";
    state.ai = Object.assign(state.ai || {}, r.ai);
    try{ updateAIControls(); }catch{}
  }
  state.breakdown = (r.breakdown || state.breakdown).map(x => ({ name:x.name, amt:Number(x.amt||0) }));
  state.evidence = (r.evidence || state.evidence).map(x => ({ label:x.label||"", url:x.url||"" }));
  state.scan = r.scan || null;
  if(r.logoDataUrl){ state.logoDataUrl = r.logoDataUrl; setBrandLogo(r.logoDataUrl); }
  $("valuationNumber").value = r.valuationNumber ? String(r.valuationNumber) : "";
  setEnabled(true);
  renderEvidence();
  renderBreakdown();
  updateHeroKPI();
}

function fillStats(scan){
  $("statFiles").textContent = scan.entriesCount.toLocaleString();
  $("statPages").textContent = scan.htmlPages.toLocaleString();
  $("statPosts").textContent = scan.blogPosts.toLocaleString();
  $("statWords").textContent = scan.totalWords.toLocaleString();
  $("statWindow").textContent = scan.window ? `${scan.window.min} → ${scan.window.max}` : "—";
  const idxParts = [];
  if(scan.indexPack?.hasRobots) idxParts.push("robots");
  if(scan.indexPack?.hasSitemap) idxParts.push("sitemap");
  if(scan.indexPack?.hasSitemapIndex) idxParts.push("sitemap_index");
  if(scan.indexPack?.hasFeed) idxParts.push("feed");
  if(scan.indexPack?.hasRss) idxParts.push("rss");
  $("statIndexPack").textContent = idxParts.length ? idxParts.join(" + ") : "—";

  const notesUL = $("scanNotes");
  notesUL.innerHTML = "";
  for(const n of scan.notes){
    const li=document.createElement("li"); li.textContent=n; notesUL.appendChild(li);
  }
  const issuesUL = $("scanIssues");
  issuesUL.innerHTML = "";
  if(scan.issues.length===0){
    const li=document.createElement("li"); li.textContent="No blocking issues detected."; issuesUL.appendChild(li);
  } else {
    for(const n of scan.issues){
      const li=document.createElement("li"); li.textContent=n; issuesUL.appendChild(li);
    }
  }
}

async function init(){
  // default date
  setStep(1);
  initSkyFX();

  const d = new Date();
  $("valuationDate").value = d.toISOString().slice(0,10);

  // logo default
  $("logoUrl").value = DEFAULT_LOGO_URL;
  state.logoDataUrl = await urlToDataURL(DEFAULT_LOGO_URL).catch(()=>null);
  setBrandLogo(DEFAULT_LOGO_URL);

  renderEvidence();
  renderBreakdown();
  updateHeroKPI();

  $("btnNew").addEventListener("click", onNew);
  $("btnDiagnostics")?.addEventListener("click", openDiagnostics);
  $("btnDiagClose")?.addEventListener("click", closeDiagnostics);
  $("diagOverlay")?.addEventListener("click", (e)=>{ if(e.target?.id==="diagOverlay") closeDiagnostics(); });
  $("btnDiagRun")?.addEventListener("click", runDiagnostics);
  $("btnDiagCopy")?.addEventListener("click", copyDiagnosticsJSON);
  $("btnDiagTestErr")?.addEventListener("click", sendTestClientError);


  $("logoFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    state.logoDataUrl = await fileToDataURL(f);
    setBrandLogo(state.logoDataUrl);
  });

  $("logoUrl").addEventListener("change", async () => {
    const url = $("logoUrl").value.trim() || DEFAULT_LOGO_URL;
    try{
      state.logoDataUrl = await urlToDataURL(url);
      setBrandLogo(url);
    }catch{
      state.logoDataUrl = await urlToDataURL(DEFAULT_LOGO_URL).catch(()=>null);
      setBrandLogo(DEFAULT_LOGO_URL);
    }
  });

  $("zipInput").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    $("artifactName").value = f.name;
    state.zipName = f.name;

    document.body.classList.add("is-scanning");
    setStep(1);
    setEnabled(false);
    $("scanNotes").innerHTML = `<li>Scanning…</li>`;
    $("scanIssues").innerHTML = "";

    const scan = await scanZip(f);
    state.scan = scan;

    document.body.classList.remove("is-scanning");
    setStep(2);
    fillStats(scan);
    setEnabled(true);
    updateHeroKPI();

    // Set a suggested valuation immediately
    const mode = $("mode").value;
    const { value, alloc } = autoAppraise(scan, mode);
    $("valuationNumber").value = String(value);
    for(let i=0;i<state.breakdown.length;i++){
      state.breakdown[i].amt = alloc[i] ?? 0;
    }
    renderBreakdown();

    $("btnFillBreakdown").disabled = false;
    $("btnAuto").disabled = false;
    $("btnExportPDF").disabled = false;
    $("btnExportJSON").disabled = false;
  });

  $("mode").addEventListener("change", () => {
    if(!state.scan) return;
    const { value, alloc } = autoAppraise(state.scan, $("mode").value);
    $("valuationNumber").value = String(value);
    for(let i=0;i<state.breakdown.length;i++){
      state.breakdown[i].amt = alloc[i] ?? 0;
    }
    renderBreakdown();
  });

  $("btnAuto").addEventListener("click", () => {
    if(!state.scan) return;
    const { value, alloc } = autoAppraise(state.scan, $("mode").value);
    $("valuationNumber").value = String(value);
    for(let i=0;i<state.breakdown.length;i++){
      state.breakdown[i].amt = alloc[i] ?? 0;
    }
    renderBreakdown();
  });

  $("valuationNumber").addEventListener("input", () => {
    // sanitize to digits
    const v = Number(String($("valuationNumber").value).replace(/[^\d]/g,""));
    $("valuationNumber").value = isFinite(v) ? String(v) : "";
    renderBreakdown();
  });

  $("btnFillBreakdown").addEventListener("click", fillBreakdownFromTotal);

  $("btnAddEvidence").addEventListener("click", () => {
    state.evidence.push({ label: "Evidence", url: "" });
    renderEvidence();
  });

  $("btnExportPDF").addEventListener("click", exportPDF);
  const b2 = document.getElementById("btnExportPDF2"); if(b2) b2.addEventListener("click", exportPDF);
  $("btnExportJSON").addEventListener("click", exportReportJSON);

  $("importJSON").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    await importReportJSON(f);
  });


  /* AI valuation UI wiring (kAIxuGateway13) */
  const keyEl = document.getElementById("kaixuKey");
  if(keyEl){
    const saved = sessionStorage.getItem("kAIxU Server Lane") || "";
    if(saved && !keyEl.value) keyEl.value = saved;
    keyEl.addEventListener("input", () => {
      kaixuSetKey(keyEl.value);
      updateAIControls();
    });
  }
  const presetEl = document.getElementById("aiPreset");
  const providerEl = document.getElementById("aiProvider");
  const modelEl = document.getElementById("aiModel");
  const tempEl = document.getElementById("aiTemp");
  const maxEl = document.getElementById("aiMaxTokens");
  const instrEl = document.getElementById("aiInstruction");
  const streamEl = document.getElementById("aiStream");
  const applyEl = document.getElementById("aiApply");
  const runEl = document.getElementById("btnAIEvaluate");

  const bump = () => { try{ updateAIControls(); }catch{} };

  presetEl?.addEventListener("change", () => {
    const preset = presetEl.value;
    if(preset !== "custom" && preset !== "local"){
      const pm = aiPresetToProviderModel(preset);
      if(providerEl) providerEl.value = pm.provider;
      if(modelEl) modelEl.value = pm.model;
    }
    bump();
  });
  providerEl?.addEventListener("change", bump);
  modelEl?.addEventListener("input", bump);
  tempEl?.addEventListener("input", bump);
  maxEl?.addEventListener("input", bump);
  instrEl?.addEventListener("input", bump);
  streamEl?.addEventListener("change", bump);
  applyEl?.addEventListener("change", bump);

  runEl?.addEventListener("click", runAIValuation);

  bump();

}



// Diagnostics UI
function openDiagnostics(){
  const o = document.getElementById("diagOverlay");
  o.setAttribute("aria-hidden","false");
  renderDiagnostics();
}
function closeDiagnostics(){
  const o = document.getElementById("diagOverlay");
  o.setAttribute("aria-hidden","true");
}
function diagSet(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val ?? "—";
}

function currentModelLabel(){
  try{
    const sel = document.getElementById("aiProvider")?.value || "gemini";
    const model = KAIXU_MODEL_MAP[sel] || KAIXU_MODEL_MAP.gemini;
    return model;
  }catch{ return "—"; }
}

const lastRun = { ts:null, status:null, latency:null, msg:null };

function markLastRun(status, latencyMs, msg){
  lastRun.ts = new Date().toISOString();
  lastRun.status = status;
  lastRun.latency = latencyMs != null ? `${Math.round(latencyMs)} ms` : "—";
  lastRun.msg = msg || "";
}

async function runDiagnostics(){
  diagSet("diagProxy","checking…");
  diagSet("diagChat","checking…");
  diagSet("diagCER","checking…");

  // proxy test: OPTIONS to gateway-chat via /api proxy
  try{
    const t0 = performance.now();
    const t0 = performance.now();
  const res = await fetch("/api/.netlify/functions/gateway-chat", { method:"OPTIONS", headers: { ...kaixuBaseHeaders() } });
    const dt = performance.now() - t0;
    diagSet("diagChat", `${res.status} (${Math.round(dt)} ms)`);
    diagSet("diagProxy", res.status === 404 ? "FAIL (missing /api proxy)" : "OK");
  }catch(e){
    diagSet("diagChat", "FAIL");
    diagSet("diagProxy", "FAIL");
  }

  // client error report function health
  try{
    const res = await fetch("/.netlify/functions/client-error-report", { method:"GET", headers: { ...kaixuBaseHeaders() } });
    diagSet("diagCER", res.ok ? `OK (${res.status})` : `FAIL (${res.status})`);
  }catch{
    diagSet("diagCER","FAIL");
  }

  renderDiagnostics();
}

function renderDiagnostics(){
  diagSet("diagApp", KAIXU_APP);
  diagSet("diagBuild", KAIXU_BUILD);
  diagSet("diagModel", currentModelLabel());
  // key masked
  const k = (window.kaixuGetKey ? kaixuGetKey() : null);
  diagSet("diagKey", k ? `${k.slice(0,6)}…${k.slice(-4)}` : "missing");

  diagSet("diagLastTS", lastRun.ts || "—");
  diagSet("diagLastStatus", lastRun.status || "—");
  diagSet("diagLastLatency", lastRun.latency || "—");
  diagSet("diagLastMsg", lastRun.msg || "—");

  const buf = clientErrorBuffer.length ? JSON.stringify(clientErrorBuffer, null, 2) : "—";
  const out = document.getElementById("diagErrors");
  if(out) out.textContent = buf;
}

function copyDiagnosticsJSON(){
  const payload = {
    app: KAIXU_APP,
    build: KAIXU_BUILD,
    model: currentModelLabel(),
    lastRun,
    errors: clientErrorBuffer,
    ts: new Date().toISOString()
  };
  navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
}

async function sendTestClientError(){
  await reportClientError("diagnostic.test", new Error("Test client error report"), { note: "manual_test" });
  renderDiagnostics();
}

init().catch(err => {
  console.error(err);
  alert("Startup error: " + err.message);
});
