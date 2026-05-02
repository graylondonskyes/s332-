/**
 * SKYEHAWK — Sovereign Navigation Terminal
 * Kaixu System · v1.0.0
 *
 * Activation: hold 6 + 7 simultaneously, then triple-click any .kaixu-logo
 * or the SKYEHAWK trigger node injected into the page.
 *
 * Drop-in: <script src="/skyehawk.js"></script>  (one line in any app)
 *
 * Modes:
 *   MENU — always available: app directory grid + search
 *   CHAT — unlocked when the same-origin server AI lane is available:
 *           full Kaixu chat with navigation intent routing
 */
(function () {
  'use strict';

  if (window.__SKYEHAWK_LOADED__) return;
  window.__SKYEHAWK_LOADED__ = true;

  /* ─────────────────────────────────────────────────────
     APP DIRECTORY  (name → relative URL from site root)
  ───────────────────────────────────────────────────── */
  const APPS = [
    { name: 'skAIxuide',        icon: '🧠', url: '/skAIxuide/',              keywords: ['ide', 'main', 'home', 'launcher', 'skaixuide'] },
    { name: 'Neural Space Pro', icon: '🔬', url: '/Neural-Space-Pro/',        keywords: ['neural', 'space', 'research', 'nsp'] },
    { name: 'WebPile Pro',      icon: '🗂️', url: '/WebPilePro/',              keywords: ['webpile', 'sandbox', 'editor', 'preview'] },
    { name: 'KaiPrompt',        icon: '💬', url: '/KaiPrompt/',               keywords: ['kaiprompt', 'prompt', 'chat', 'kai'] },
    { name: 'GodCode',          icon: '⚡', url: '/GodCode/',                 keywords: ['godcode', 'god', 'code'] },
    { name: 'GodKode',          icon: '🔥', url: '/GodKode/',                 keywords: ['godkode', 'kode'] },
    { name: 'GodNodes',         icon: '🕸️', url: '/GodNodes/GodN0dePro2/',   keywords: ['godnode', 'nodes', 'node'] },
    { name: 'SkriptX',          icon: '📜', url: '/skriptx/',                 keywords: ['skriptx', 'script'] },
    { name: 'SkriptX Alchemist',icon: '⚗️', url: '/skriptxdataalchemist/',    keywords: ['alchemist', 'data alchemist'] },
    { name: 'SkyeVault',        icon: '🔐', url: '/SkyeVault/',               keywords: ['skyevault', 'vault', 'secure'] },
    { name: 'SkyeDocx',         icon: '📄', url: '/SkyeDocx/',               keywords: ['skyedocx', 'docs', 'document'] },
    { name: 'SkyeKnife',        icon: '🔪', url: '/SkyeKnife/',               keywords: ['skyeknife', 'knife', 'utility'] },
    { name: 'SkyeBox',          icon: '📦', url: '/SkyeBox/',                 keywords: ['skyebox', 'box', 'storage'] },
    { name: 'SkyePortal',       icon: '🌐', url: '/skyeportal/',              keywords: ['skyeportal', 'portal'] },
    { name: 'SkyeUI Pro',       icon: '🎨', url: '/skyeuipro/',               keywords: ['skyeui', 'ui', 'design'] },
    { name: 'SkyeOfferForge',   icon: '🎯', url: '/skyeofferforge/',          keywords: ['offerforge', 'offer', 'forge'] },
    { name: 'DataForge',        icon: '🏗️', url: '/Data%20Forge/',            keywords: ['dataforge', 'data', 'forge'] },
    { name: 'DebugPro',         icon: '🐛', url: '/DebugPro/',                keywords: ['debugpro', 'debug'] },
    { name: 'CodeGenie',        icon: '🧞', url: '/Code%20Genie/',            keywords: ['codegenie', 'genie'] },
    { name: 'RegexGen',         icon: '🔣', url: '/RegexGen/',                keywords: ['regex', 'regexgen', 'pattern'] },
    { name: 'PlanItPro',        icon: '📅', url: '/PlanItPro/',               keywords: ['planit', 'plan', 'project'] },
    { name: 'Nexus Pro',        icon: '🌀', url: '/Nexus-Pro/',               keywords: ['nexuspro', 'nexus'] },
    { name: 'Nexus Forge',      icon: '🔧', url: '/Nexus%20Forge%20Studio/',  keywords: ['nexusforge', 'forge studio'] },
    { name: 'NexusDB Explorer', icon: '🗃️', url: '/NexusDBExplorer/',        keywords: ['nexusdb', 'database', 'db explorer'] },
    { name: 'ReactForge',       icon: '⚛️', url: '/reactforge/',              keywords: ['reactforge', 'react'] },
    { name: 'PWA Factory',      icon: '📱', url: '/PWA%20Factory/',           keywords: ['pwa', 'factory', 'pwa factory'] },
    { name: 'KaixuMagic',       icon: '✨', url: '/kaixumagic/',              keywords: ['kaixumagic', 'magic'] },
    { name: 'ProjectAegis',     icon: '🛡️', url: '/projectaegis-skyex/',     keywords: ['aegis', 'skyex'] },
    { name: 'Webby',            icon: '🌍', url: '/Webby/',                   keywords: ['webby'] },
    { name: 'ALLAI',            icon: '🤖', url: '/ALLAI.html',               keywords: ['allai', 'all ai'] },
    { name: 'Home / Launcher',  icon: '🏠', url: '/',                         keywords: ['home', 'root', 'launcher', 'main'] },
    { name: 'Sole Network',     icon: '👟', url: '/THE%20SOLE%20NETWORK/',    keywords: ['sole', 'network', 'the sole'] },
    { name: 'Skaixu Editorials',icon: '📰', url: '/skAIxu%20Editorials/',    keywords: ['editorial', 'blog', 'articles'] },
    { name: 'NexusConnect',     icon: '🔗', url: '/NexusConnectHomepage/',    keywords: ['nexusconnect', 'connect'] },
    { name: 'DevProof Lab',     icon: '🏅', url: '/DevProof%20Lab/',           keywords: ['devproof', 'valuation', 'appraisal', 'sole nexus', 'pdf'] },
  ];

  /* ─────────────────────────────────────────────────────
     KAIXU GATEWAY CONFIG  (matches other apps in repo)
  ───────────────────────────────────────────────────── */
  const GATEWAY_URL = '/.netlify/functions/gateway-chat';
  const GATEWAY_ALT = '';
  const KEY_STORAGE = null; // browser credential storage removed
  const SYS_STORAGE  = 'kaixu_sys';

  /* ─────────────────────────────────────────────────────
     GESTURE STATE
  ───────────────────────────────────────────────────── */
  const keysHeld = new Set();
  let clickCount  = 0;
  let clickTimer  = null;

  document.addEventListener('keydown', e => keysHeld.add(e.key));
  document.addEventListener('keyup',   e => keysHeld.delete(e.key));

  function onLogoClick() {
    // Must have BOTH 6 and 7 held
    if (!keysHeld.has('6') || !keysHeld.has('7')) return;
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 600);
    if (clickCount >= 3) {
      clickCount = 0;
      clearTimeout(clickTimer);
      openSkyehawk();
    }
  }

  // Attach to existing logo elements after DOM ready, and re-check periodically
  function bindLogos() {
    document.querySelectorAll(
      '.kaixu-logo, .sigil, [id*="logo"], [class*="logo"], [id*="sigil"]'
    ).forEach(el => {
      if (!el.__shBound) {
        el.__shBound = true;
        el.addEventListener('click', onLogoClick);
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     CSS   (all prefixed  __sh__  to avoid collisions)
  ───────────────────────────────────────────────────── */
  const STYLE = `
  .__sh__overlay {
    all: initial;
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483646 !important;
    background: rgba(2,0,6,.82) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
    animation: __shFadeIn .18s ease !important;
  }
  @keyframes __shFadeIn { from { opacity:0 } to { opacity:1 } }

  .__sh__terminal {
    all: initial;
    display: flex !important;
    flex-direction: column !important;
    width: min(860px, 94vw) !important;
    height: min(680px, 90vh) !important;
    background: linear-gradient(160deg, #0a0018 0%, #040010 100%) !important;
    border: 1px solid rgba(255,215,0,.30) !important;
    border-radius: 20px !important;
    box-shadow:
      0 0 0 1px rgba(157,0,255,.25) inset,
      0 0 60px rgba(157,0,255,.25),
      0 0 120px rgba(157,0,255,.10),
      0 30px 80px rgba(0,0,0,.75) !important;
    overflow: hidden !important;
    font-family: inherit !important;
    animation: __shSlideIn .22s cubic-bezier(.15,.9,.35,1) !important;
  }
  @keyframes __shSlideIn {
    from { transform: translateY(28px) scale(.97); opacity:0 }
    to   { transform: translateY(0)    scale(1);   opacity:1 }
  }

  .__sh__titlebar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 12px 16px !important;
    background: linear-gradient(90deg, rgba(20,0,45,.95), rgba(10,0,25,.90)) !important;
    border-bottom: 1px solid rgba(255,215,0,.20) !important;
    flex-shrink: 0 !important;
  }
  .__sh__brand {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
  }
  .__sh__logo-img {
    height: 32px !important;
    width: auto !important;
    filter: drop-shadow(0 0 8px rgba(255,215,0,.70)) drop-shadow(0 0 3px rgba(157,0,255,.50)) !important;
    animation: __shLogoGlow 2.6s ease-in-out infinite !important;
  }
  @keyframes __shLogoGlow {
    0%,100% { filter: drop-shadow(0 0 5px rgba(255,215,0,.55)) drop-shadow(0 0 2px rgba(157,0,255,.30)); }
    50%     { filter: drop-shadow(0 0 18px rgba(255,215,0,.95)) drop-shadow(0 0 10px rgba(191,0,255,.70)); }
  }
  .__sh__title {
    font-size: 13px !important;
    font-weight: 800 !important;
    letter-spacing: .14em !important;
    text-transform: uppercase !important;
    background: linear-gradient(90deg,#ffd700 0%,#fff 45%,#bf00ff 75%,#ffd700 100%) !important;
    background-size: 300% auto !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    animation: __shShimmer 4s linear infinite !important;
  }
  @keyframes __shShimmer {
    0%   { background-position: -200% center }
    100% { background-position:  200% center }
  }
  .__sh__subtitle {
    font-size: 11px !important;
    color: rgba(200,180,255,.60) !important;
    letter-spacing: .08em !important;
  }
  .__sh__controls {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  }
  .__sh__pill {
    font-size: 11px !important;
    padding: 4px 10px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255,215,0,.25) !important;
    background: rgba(255,215,0,.08) !important;
    color: rgba(255,226,160,.85) !important;
    cursor: default !important;
  }
  .__sh__pill.__sh__chat-pill {
    border-color: rgba(157,0,255,.45) !important;
    background: rgba(157,0,255,.15) !important;
    color: rgba(220,180,255,.90) !important;
  }
  .__sh__btn-close {
    all: unset !important;
    width: 28px !important;
    height: 28px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255,77,109,.30) !important;
    background: rgba(255,77,109,.12) !important;
    color: rgba(255,120,140,.90) !important;
    font-size: 14px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    transition: background .15s !important;
    line-height: 1 !important;
  }
  .__sh__btn-close:hover { background: rgba(255,77,109,.30) !important; }

  .__sh__tabs {
    display: flex !important;
    gap: 0 !important;
    padding: 0 16px !important;
    border-bottom: 1px solid rgba(255,215,0,.12) !important;
    background: rgba(6,0,16,.55) !important;
    flex-shrink: 0 !important;
  }
  .__sh__tab {
    all: unset !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    letter-spacing: .10em !important;
    text-transform: uppercase !important;
    color: rgba(200,180,255,.55) !important;
    padding: 10px 16px !important;
    cursor: pointer !important;
    border-bottom: 2px solid transparent !important;
    transition: color .15s, border-color .15s !important;
  }
  .__sh__tab:hover { color: rgba(255,215,0,.80) !important; }
  .__sh__tab.__sh__active {
    color: rgba(255,215,0,.95) !important;
    border-bottom-color: rgba(255,215,0,.70) !important;
  }
  .__sh__tab.__sh__disabled {
    opacity: .35 !important;
    cursor: not-allowed !important;
    position: relative !important;
  }

  .__sh__body {
    flex: 1 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* ── MENU PANEL ── */
  .__sh__menu-panel {
    flex: 1 !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 14px 16px !important;
    gap: 12px !important;
    overflow: hidden !important;
  }
  .__sh__search-wrap {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    background: rgba(255,255,255,.04) !important;
    border: 1px solid rgba(255,215,0,.20) !important;
    border-radius: 999px !important;
    padding: 8px 14px !important;
  }
  .__sh__search-ico { font-size: 14px !important; flex-shrink: 0 !important; }
  .__sh__search {
    all: unset !important;
    flex: 1 !important;
    font-size: 13px !important;
    color: #fff !important;
    caret-color: rgba(255,215,0,.85) !important;
  }
  .__sh__search::placeholder { color: rgba(200,180,255,.40) !important; }

  .__sh__grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
    gap: 8px !important;
    overflow-y: auto !important;
    flex: 1 !important;
    padding-right: 4px !important;
  }
  .__sh__grid::-webkit-scrollbar { width: 5px !important; background: transparent !important; }
  .__sh__grid::-webkit-scrollbar-thumb { background: rgba(255,215,0,.25) !important; border-radius: 999px !important; }

  .__sh__app-card {
    all: unset !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 12px 8px !important;
    border-radius: 14px !important;
    border: 1px solid rgba(255,215,0,.12) !important;
    background: rgba(255,255,255,.03) !important;
    cursor: pointer !important;
    transition: border-color .18s, background .18s, box-shadow .18s, transform .10s !important;
    text-align: center !important;
  }
  .__sh__app-card:hover {
    border-color: rgba(255,215,0,.45) !important;
    background: rgba(255,215,0,.07) !important;
    box-shadow: 0 0 20px rgba(157,0,255,.22), 0 0 6px rgba(255,215,0,.15) !important;
    transform: translateY(-2px) !important;
  }
  .__sh__app-card:active { transform: translateY(0) !important; }
  .__sh__app-icon { font-size: 22px !important; line-height: 1 !important; }
  .__sh__app-name {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: rgba(255,255,255,.85) !important;
    letter-spacing: .04em !important;
    line-height: 1.3 !important;
  }

  /* ── CHAT PANEL ── */
  .__sh__chat-panel {
    flex: 1 !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .__sh__chat-log {
    flex: 1 !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    padding: 14px 16px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }
  .__sh__chat-log::-webkit-scrollbar { width: 5px !important; }
  .__sh__chat-log::-webkit-scrollbar-thumb { background: rgba(255,215,0,.25) !important; border-radius: 999px !important; }

  .__sh__msg {
    display: flex !important;
    flex-direction: column !important;
    max-width: 80% !important;
    gap: 3px !important;
    animation: __shMsgIn .15s ease !important;
  }
  @keyframes __shMsgIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  .__sh__msg.__sh__user { align-self: flex-end !important; align-items: flex-end !important; }
  .__sh__msg.__sh__bot  { align-self: flex-start !important; align-items: flex-start !important; }
  .__sh__msg-meta {
    font-size: 10px !important;
    color: rgba(200,180,255,.45) !important;
    letter-spacing: .06em !important;
  }
  .__sh__msg-bubble {
    padding: 9px 13px !important;
    border-radius: 14px !important;
    font-size: 13px !important;
    line-height: 1.55 !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }
  .__sh__msg.__sh__user .__sh__msg-bubble {
    background: linear-gradient(135deg, rgba(157,0,255,.35), rgba(100,0,200,.25)) !important;
    border: 1px solid rgba(157,0,255,.40) !important;
    color: #fff !important;
    border-bottom-right-radius: 4px !important;
  }
  .__sh__msg.__sh__bot .__sh__msg-bubble {
    background: rgba(255,215,0,.07) !important;
    border: 1px solid rgba(255,215,0,.20) !important;
    color: rgba(255,240,200,.92) !important;
    border-bottom-left-radius: 4px !important;
  }
  .__sh__msg.__sh__sys .__sh__msg-bubble {
    background: rgba(39,180,255,.08) !important;
    border: 1px solid rgba(39,180,255,.22) !important;
    color: rgba(180,230,255,.85) !important;
    font-style: italic !important;
    font-size: 12px !important;
  }
  .__sh__typing {
    display: flex !important;
    gap: 4px !important;
    align-items: center !important;
    padding: 9px 13px !important;
    background: rgba(255,215,0,.07) !important;
    border: 1px solid rgba(255,215,0,.20) !important;
    border-radius: 14px !important;
    border-bottom-left-radius: 4px !important;
    align-self: flex-start !important;
  }
  .__sh__dot {
    width: 6px !important; height: 6px !important; border-radius: 999px !important;
    background: rgba(255,215,0,.75) !important;
    animation: __shDotPulse 1.2s ease-in-out infinite !important;
  }
  .__sh__dot:nth-child(2) { animation-delay: .2s !important; }
  .__sh__dot:nth-child(3) { animation-delay: .4s !important; }
  @keyframes __shDotPulse { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }

  .__sh__input-bar {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 10px 14px !important;
    border-top: 1px solid rgba(255,215,0,.14) !important;
    background: rgba(6,0,16,.70) !important;
    flex-shrink: 0 !important;
  }
  .__sh__prompt-icon {
    font-size: 14px !important;
    color: rgba(255,215,0,.60) !important;
    flex-shrink: 0 !important;
    font-family: monospace !important;
  }
  .__sh__input {
    all: unset !important;
    flex: 1 !important;
    font-size: 13px !important;
    color: #fff !important;
    caret-color: rgba(255,215,0,.85) !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
  }
  .__sh__input::placeholder { color: rgba(200,180,255,.35) !important; }
  .__sh__send {
    all: unset !important;
    padding: 7px 14px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255,215,0,.38) !important;
    background: linear-gradient(135deg, rgba(255,215,0,.20), rgba(157,0,255,.15)) !important;
    color: rgba(255,226,160,.95) !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    letter-spacing: .06em !important;
    cursor: pointer !important;
    transition: border-color .15s, box-shadow .15s !important;
    flex-shrink: 0 !important;
  }
  .__sh__send:hover {
    border-color: rgba(255,215,0,.70) !important;
    box-shadow: 0 0 16px rgba(255,215,0,.28), 0 0 6px rgba(157,0,255,.30) !important;
  }

  /* ── TRIGGER NODE ── */
  .__sh__trigger {
    position: fixed !important;
    bottom: 18px !important;
    right: 18px !important;
    width: 44px !important;
    height: 44px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255,215,0,.35) !important;
    background: linear-gradient(135deg, rgba(20,0,45,.92), rgba(8,0,20,.88)) !important;
    box-shadow: 0 0 18px rgba(157,0,255,.35), 0 0 6px rgba(255,215,0,.20) !important;
    z-index: 2147483645 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    animation: __shTriggerPulse 3s ease-in-out infinite !important;
    transition: transform .12s !important;
  }
  .__sh__trigger:hover { transform: scale(1.08) !important; }
  .__sh__trigger:active { transform: scale(.95) !important; }
  @keyframes __shTriggerPulse {
    0%,100% { box-shadow: 0 0 18px rgba(157,0,255,.35), 0 0 6px rgba(255,215,0,.20); }
    50%     { box-shadow: 0 0 30px rgba(157,0,255,.65), 0 0 14px rgba(255,215,0,.50), 0 0 50px rgba(157,0,255,.20); }
  }
  .__sh__trigger img { height: 26px !important; width: auto !important; }
  .__sh__trigger-tooltip {
    position: fixed !important;
    bottom: 70px !important;
    right: 18px !important;
    background: rgba(10,0,22,.92) !important;
    border: 1px solid rgba(255,215,0,.25) !important;
    border-radius: 10px !important;
    padding: 6px 12px !important;
    font-size: 11px !important;
    color: rgba(255,226,160,.85) !important;
    pointer-events: none !important;
    opacity: 0 !important;
    transition: opacity .2s !important;
    z-index: 2147483645 !important;
    white-space: nowrap !important;
  }
  .__sh__trigger:hover + .__sh__trigger-tooltip { opacity: 1 !important; }
  `;

  /* ─────────────────────────────────────────────────────
     INTENT ROUTING  (nav with fuzzy name match)
  ───────────────────────────────────────────────────── */
  const NAV_PATTERNS = [
    /(?:take me to|open|go to|navigate to|launch|show|load|switch to)\s+(.+)/i,
    /^(?:open|launch)\s+(.+)/i,
    /^(.+?)\s+(?:please|now)$/i,
  ];

  function resolveNavIntent(text) {
    for (const rx of NAV_PATTERNS) {
      const m = text.match(rx);
      if (m) {
        const query = m[1].trim().toLowerCase();
        return findApp(query);
      }
    }
    // bare app name?
    return findApp(text.trim().toLowerCase());
  }

  function findApp(query) {
    // exact keyword match first
    for (const app of APPS) {
      if (app.keywords.some(k => k === query)) return app;
    }
    // partial match
    for (const app of APPS) {
      if (
        app.name.toLowerCase().includes(query) ||
        app.keywords.some(k => k.includes(query) || query.includes(k))
      ) return app;
    }
    // fuzzy: check every word of query against every keyword
    const words = query.split(/\s+/);
    for (const app of APPS) {
      if (words.some(w => w.length > 2 && app.keywords.some(k => k.includes(w)))) return app;
    }
    return null;
  }

  /* ─────────────────────────────────────────────────────
     KAIXU CHAT  (streaming SSE, mirrors repo pattern)
  ───────────────────────────────────────────────────── */
  let chatAbort = null;

  async function kaixuStream(messages, onDelta, onDone, onError) {
    const sys = localStorage.getItem(SYS_STORAGE) || 'You are SKYEHAWK, the sovereign navigator of the Kaixu system. When users ask to navigate to an app, confirm and navigate. Otherwise assist with concise, expert answers.';

    if (chatAbort) { try { chatAbort.abort(); } catch(_) {} }
    chatAbort = new AbortController();

    const payload = {
      model: 'gpt-4o',
      stream: true,
      messages: [{ role: 'system', content: sys }, ...messages] };

    const headers = {
      'Content-Type': 'application/json' };

    const tryFetch = async (url) => {
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: chatAbort.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    };

    let resp;
      try {
        resp = await tryFetch(GATEWAY_URL);
      } catch(e1) {
      try {
        if (!GATEWAY_ALT || GATEWAY_ALT === GATEWAY_URL) throw e1;
        resp = await tryFetch(GATEWAY_ALT);
      } catch(e2) {
        onError(e2.message || 'Gateway unreachable'); return;
      }
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n');
      buf = parts.pop();
      for (const line of parts) {
        const t = line.trim();
        if (!t || !t.startsWith('data:')) continue;
        const raw = t.slice(5).trim();
        if (raw === '[DONE]') { onDone(full); return; }
        try {
          const j = JSON.parse(raw);
          const delta = j?.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onDelta(delta); }
        } catch(_) {}
      }
    }
    onDone(full);
  }

  /* ─────────────────────────────────────────────────────
     DOM FACTORY
  ───────────────────────────────────────────────────── */
  let overlayEl = null;
  let activeTab  = 'menu';
  const chatHistory = [];

  function buildUI() {
    const hasKey = true;

    // ── STYLE TAG ──
    if (!document.getElementById('__sh__style')) {
      const s = document.createElement('style');
      s.id = '__sh__style';
      s.textContent = STYLE;
      document.head.appendChild(s);
    }

    // ── OVERLAY ──
    const overlay = document.createElement('div');
    overlay.className = '__sh__overlay';
    overlay.id = '__sh__overlay';

    // ── TERMINAL ──
    const term = document.createElement('div');
    term.className = '__sh__terminal';

    // ── TITLEBAR ──
    const tb = document.createElement('div');
    tb.className = '__sh__titlebar';

    const brand = document.createElement('div');
    brand.className = '__sh__brand';

    const logoImg = document.createElement('img');
    logoImg.className = '__sh__logo-img';
    logoImg.src = 'https://cdn1.sharemyimage.com/2026/02/17/Logo-2-1.png';
    logoImg.alt = 'Kaixu';
    brand.appendChild(logoImg);

    const brandText = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = '__sh__title';
    titleEl.textContent = 'SKYEHAWK';
    const subEl = document.createElement('div');
    subEl.className = '__sh__subtitle';
    subEl.textContent = 'Sovereign Navigation Terminal';
    brandText.appendChild(titleEl);
    brandText.appendChild(subEl);
    brand.appendChild(brandText);

    const controls = document.createElement('div');
    controls.className = '__sh__controls';

    const modePill = document.createElement('div');
    modePill.className = '__sh__pill' + (hasKey ? ' __sh__chat-pill' : '');
    modePill.textContent = hasKey ? '⚡ Chat Enabled' : '🔒 Menu Mode';
    controls.appendChild(modePill);

    const closeBtn = document.createElement('button');
    closeBtn.className = '__sh__btn-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close SKYEHAWK (Esc)';
    closeBtn.addEventListener('click', closeSkyehawk);
    controls.appendChild(closeBtn);

    tb.appendChild(brand);
    tb.appendChild(controls);

    // ── TABS ──
    const tabsEl = document.createElement('div');
    tabsEl.className = '__sh__tabs';

    const tabMenu = document.createElement('button');
    tabMenu.className = '__sh__tab __sh__active';
    tabMenu.textContent = '⬡ Apps';
    tabMenu.dataset.tab = 'menu';

    const tabChat = document.createElement('button');
    tabChat.className = '__sh__tab' + (hasKey ? '' : ' __sh__disabled');
    tabChat.textContent = '💬 Chat';
    tabChat.dataset.tab = 'chat';
    tabChat.title = 'kAIxU Chat';

    // Customer-facing system diagnostics tab
    const tabDiag = document.createElement('button');
    tabDiag.className = '__sh__tab';
    tabDiag.textContent = '🩺 Diagnostics';
    tabDiag.dataset.tab = 'diag';
    tabDiag.title = 'System & gateway diagnostics';

    // Admin tab — spawns a floating, draggable, detachable iframe window over the page
    const tabAdmin = document.createElement('button');
    tabAdmin.className = '__sh__tab';
    tabAdmin.textContent = '⚙️ Admin';
    tabAdmin.title = 'Open skAIxuide Diagnostics Panel';
    tabAdmin.style.cssText = 'color:rgba(255,215,0,.9)!important;border-bottom:2px solid rgba(255,215,0,.3)!important;';
    tabAdmin.addEventListener('mouseenter', () => { tabAdmin.style.textShadow = '0 0 8px rgba(255,215,0,.6)'; });
    tabAdmin.addEventListener('mouseleave', () => { tabAdmin.style.textShadow = ''; });
    tabAdmin.addEventListener('click', () => {
      closeSkyehawk();
      spawnAdminDiagWindow();
    });

    function spawnAdminDiagWindow() {
      // Only one instance at a time
      if (document.getElementById('__sh__admin-diag-win')) {
        document.getElementById('__sh__admin-diag-win').style.display = 'flex';
        return;
      }

      const DIAG_URL = window.location.origin + '/skAIxuide/diagnostics.html';

      // Outer window shell
      const win = document.createElement('div');
      win.id = '__sh__admin-diag-win';
      win.style.cssText = [
        'position:fixed',
        'top:60px',
        'left:50%',
        'transform:translateX(-50%)',
        'width:min(1200px,calc(100vw - 40px))',
        'height:min(800px,calc(100vh - 80px))',
        'background:#0d0d12',
        'border:1px solid rgba(255,215,0,.35)',
        'border-radius:10px',
        'box-shadow:0 8px 64px rgba(0,0,0,.85),0 0 0 1px rgba(255,215,0,.08)',
        'display:flex',
        'flex-direction:column',
        'z-index:2147483646',
        'overflow:hidden',
        'resize:both',
        'font-family:JetBrains Mono,monospace',
      ].join(';');

      // Title bar (drag handle)
      const titleBar = document.createElement('div');
      titleBar.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:0 12px',
        'height:38px',
        'flex-shrink:0',
        'background:rgba(255,215,0,.06)',
        'border-bottom:1px solid rgba(255,215,0,.2)',
        'cursor:grab',
        'user-select:none',
      ].join(';');

      const titleText = document.createElement('span');
      titleText.style.cssText = 'font-size:12px;color:rgba(255,215,0,.85);letter-spacing:.08em;font-weight:700;';
      titleText.textContent = '⚙️  skAIxuide — Admin Diagnostics';

      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex;gap:8px;align-items:center;';

      function mkBtn(label, color, title) {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.style.cssText = [
          'background:' + color,
          'border:none',
          'color:#fff',
          'font-size:11px',
          'font-weight:700',
          'padding:3px 9px',
          'border-radius:5px',
          'cursor:pointer',
          'line-height:1.4',
          'font-family:inherit',
        ].join(';');
        b.addEventListener('mouseenter', () => { b.style.opacity = '.8'; });
        b.addEventListener('mouseleave', () => { b.style.opacity = '1'; });
        return b;
      }

      // Pop-out button — opens in a real browser window
      const popBtn = mkBtn('⤢ Pop Out', 'rgba(100,120,200,.7)', 'Open in separate browser window');
      popBtn.addEventListener('click', () => {
        window.open(DIAG_URL, 'skaixuide-diagnostics', 'width=1200,height=800,resizable=yes,scrollbars=yes,menubar=no,toolbar=no');
      });

      // Minimise button
      const minBtn = mkBtn('—', 'rgba(255,255,255,.12)', 'Minimise');
      let minimised = false;
      minBtn.addEventListener('click', () => {
        minimised = !minimised;
        iframeEl.style.display  = minimised ? 'none' : (iframeEl.srcdoc ? 'block' : 'none');
        contentEl.style.display = minimised ? 'none' : (!iframeEl.srcdoc ? 'flex' : 'none');
        win.style.height = minimised ? '38px' : 'min(800px,calc(100vh - 80px))';
        win.style.resize = minimised ? 'none' : 'both';
        minBtn.textContent = minimised ? '▢' : '—';
      });

      // Close button
      const closeBtn = mkBtn('✕', 'rgba(200,50,50,.7)', 'Close');
      closeBtn.addEventListener('click', () => { win.remove(); });

      btnGroup.appendChild(popBtn);
      btnGroup.appendChild(minBtn);
      btnGroup.appendChild(closeBtn);
      titleBar.appendChild(titleText);
      titleBar.appendChild(btnGroup);

      // content area — shows loading state while fetch runs
      const contentEl = document.createElement('div');
      contentEl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;background:#050505;color:rgba(255,215,0,.6);font-size:13px;font-family:JetBrains Mono,monospace;letter-spacing:.08em;';
      contentEl.textContent = 'Loading diagnostics…';

      const iframeEl = document.createElement('iframe');
      iframeEl.style.cssText = 'flex:1;border:none;width:100%;display:none;background:#050505;';
      iframeEl.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals';

      win.appendChild(titleBar);
      win.appendChild(contentEl);
      win.appendChild(iframeEl);
      document.body.appendChild(win);

      // fetch the file content and inject as srcdoc — bypasses all iframe src/CSP/X-Frame issues
      fetch(DIAG_URL)
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(html => {
          // rewrite relative asset paths so they resolve correctly inside srcdoc
          const base = window.location.origin + '/skAIxuide/';
          const patched = html.replace(/<head>/i, '<head><base href="' + base + '">');
          iframeEl.srcdoc = patched;
          iframeEl.style.display = 'block';
          contentEl.style.display = 'none';
        })
        .catch(err => {
          contentEl.textContent = '⚠ Failed to load diagnostics: ' + err.message;
          contentEl.style.color = 'rgba(255,80,80,.8)';
        });

      // Drag logic
      let dragging = false, ox = 0, oy = 0;
      titleBar.addEventListener('mousedown', e => {
        if (e.target === popBtn || e.target === minBtn || e.target === closeBtn) return;
        dragging = true;
        // Switch from transform to explicit left/top so drag math is simple
        const rect = win.getBoundingClientRect();
        win.style.transform = 'none';
        win.style.left = rect.left + 'px';
        win.style.top = rect.top + 'px';
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        titleBar.style.cursor = 'grabbing';
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        win.style.left = (e.clientX - ox) + 'px';
        win.style.top  = (e.clientY - oy) + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        titleBar.style.cursor = 'grab';
      });
    }

    function switchTab(name) {
      if (!hasKey && name === 'chat') return;
      activeTab = name;
      tabMenu.classList.toggle('__sh__active', activeTab === 'menu');
      tabChat.classList.toggle('__sh__active', activeTab === 'chat');
      tabDiag.classList.toggle('__sh__active', activeTab === 'diag');
      menuPanel.style.display  = activeTab === 'menu' ? 'flex' : 'none';
      chatPanel.style.display  = activeTab === 'chat' ? 'flex' : 'none';
      diagPanel.style.display  = activeTab === 'diag' ? 'flex' : 'none';
      if (activeTab === 'chat') inputEl.focus();
      if (activeTab === 'menu') searchEl.focus();
      if (activeTab === 'diag') runDiagnostics();
    }

    [tabMenu, tabChat, tabDiag].forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    tabsEl.appendChild(tabMenu);
    tabsEl.appendChild(tabChat);
    tabsEl.appendChild(tabDiag);
    tabsEl.appendChild(tabAdmin);

    // ── BODY ──
    const body = document.createElement('div');
    body.className = '__sh__body';

    // ── MENU PANEL ──
    const menuPanel = document.createElement('div');
    menuPanel.className = '__sh__menu-panel';

    const searchWrap = document.createElement('div');
    searchWrap.className = '__sh__search-wrap';
    const searchIco = document.createElement('span');
    searchIco.className = '__sh__search-ico';
    searchIco.textContent = '🔍';
    const searchEl = document.createElement('input');
    searchEl.className = '__sh__search';
    searchEl.placeholder = 'Search apps… or type a name';
    searchEl.type = 'text';
    searchWrap.appendChild(searchIco);
    searchWrap.appendChild(searchEl);

    const grid = document.createElement('div');
    grid.className = '__sh__grid';

    function renderGrid(filter = '') {
      grid.innerHTML = '';
      const q = filter.toLowerCase().trim();
      const filtered = q
        ? APPS.filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.keywords.some(k => k.includes(q))
          )
        : APPS;
      filtered.forEach(app => {
        const card = document.createElement('button');
        card.className = '__sh__app-card';

        const icon = document.createElement('div');
        icon.className = '__sh__app-icon';
        icon.textContent = app.icon;

        const name = document.createElement('div');
        name.className = '__sh__app-name';
        name.textContent = app.name;

        card.appendChild(icon);
        card.appendChild(name);
        card.addEventListener('click', () => navigateTo(app));
        grid.appendChild(card);
      });
      if (!filtered.length) {
        const msg = document.createElement('div');
        msg.style.cssText = 'color:rgba(200,180,255,.45);font-size:12px;padding:16px;grid-column:1/-1;';
        msg.textContent = 'No apps match "' + filter + '"';
        grid.appendChild(msg);
      }
    }

    renderGrid();

    searchEl.addEventListener('input', () => renderGrid(searchEl.value));
    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = grid.querySelector('.__sh__app-card');
        if (first) first.click();
      }
    });

    menuPanel.appendChild(searchWrap);
    menuPanel.appendChild(grid);

    // ── CHAT PANEL ──
    const chatPanel = document.createElement('div');
    chatPanel.className = '__sh__chat-panel';
    chatPanel.style.display = 'none';

    const chatLog = document.createElement('div');
    chatLog.className = '__sh__chat-log';

    // welcome message
    if (chatHistory.length === 0) {
      appendMsg(chatLog, 'bot', 'SKYEHAWK online. I\'m your Kaixu navigator.\n\nTell me where to go — "take me to Neural Pro" — or ask me anything.\nType "apps" to list all destinations.');
      chatHistory.push({ role: 'assistant', content: 'SKYEHAWK online.' });
    }

    const inputBar = document.createElement('div');
    inputBar.className = '__sh__input-bar';
    const promptIcon = document.createElement('span');
    promptIcon.className = '__sh__prompt-icon';
    promptIcon.textContent = '❯';
    const inputEl = document.createElement('input');
    inputEl.className = '__sh__input';
    inputEl.placeholder = 'Command or message…';
    inputEl.type = 'text';
    const sendBtn = document.createElement('button');
    sendBtn.className = '__sh__send';
    sendBtn.textContent = 'Send';

    const handleSend = async () => {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      inputEl.disabled = true;
      sendBtn.disabled = true;

      appendMsg(chatLog, 'user', text);
      chatHistory.push({ role: 'user', content: text });

      // built-in commands
      if (/^apps?$/i.test(text)) {
        const list = APPS.map(a => `${a.icon} ${a.name}`).join('\n');
        appendMsg(chatLog, 'bot', 'All apps:\n\n' + list);
        chatHistory.push({ role: 'assistant', content: list });
        inputEl.disabled = false; sendBtn.disabled = false;
        inputEl.focus();
        return;
      }

      // navigation intent
      const navApp = resolveNavIntent(text);
      if (navApp) {
        appendMsg(chatLog, 'sys', `Navigating to ${navApp.name}…`);
        await delay(1200);
        navigateTo(navApp);
        return;
      }

      // AI chat
      const typing = appendTyping(chatLog);
      let botBubble = null;

      await kaixuStream(
        chatHistory.slice(-20),
        (delta) => {
          if (!botBubble) {
            typing.remove();
            botBubble = appendMsg(chatLog, 'bot', '');
          }
          botBubble.querySelector('.__sh__msg-bubble').textContent += delta;
          chatLog.scrollTop = chatLog.scrollHeight;
        },
        (full) => {
          if (!botBubble) { typing.remove(); appendMsg(chatLog, 'bot', full || '…'); }
          chatHistory.push({ role: 'assistant', content: full });
          inputEl.disabled = false; sendBtn.disabled = false;
          inputEl.focus();
          // re-check for nav intent in response (fallthrough)
          const na2 = resolveNavIntent(full);
          if (na2 && /navigat|go to|taking you to/i.test(full)) {
            setTimeout(() => navigateTo(na2), 1600);
          }
        },
        (err) => {
          typing.remove();
          appendMsg(chatLog, 'sys', 'Error: ' + err);
          inputEl.disabled = false; sendBtn.disabled = false;
        }
      );
    };

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });

    inputBar.appendChild(promptIcon);
    inputBar.appendChild(inputEl);
    inputBar.appendChild(sendBtn);
    chatPanel.appendChild(chatLog);
    chatPanel.appendChild(inputBar);

    // ── DIAGNOSTICS PANEL ──
    const diagPanel = document.createElement('div');
    diagPanel.className = '__sh__diag-panel';
    diagPanel.style.display = 'none';
    diagPanel.style.flexDirection = 'column';
    diagPanel.style.gap = '10px';
    diagPanel.style.padding = '16px';
    diagPanel.style.overflowY = 'auto';
    diagPanel.style.flex = '1';

    function diagRow(label, valueHtml, badge) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,215,0,.10);';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:12px;color:rgba(255,255,255,.55);flex-shrink:0;';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.style.cssText = 'font-size:12px;text-align:right;word-break:break-all;color:#fff;font-family:monospace;';
      val.innerHTML = valueHtml;
      row.appendChild(lbl); row.appendChild(val);
      if (badge) {
        badge.style.cssText = 'margin-left:8px;font-size:10px;padding:2px 6px;border-radius:4px;flex-shrink:0;font-weight:700;';
        row.appendChild(badge);
      }
      return { row, val, badge };
    }

    // Static rows (built immediately)
    const keyBadge = document.createElement('span');
    keyBadge.textContent = 'LOCKED';
    keyBadge.style.background = '#14532d';
    keyBadge.style.color = '#86efac';
    const { row: keyRow } = diagRow('Browser Key Flow', 'disabled', keyBadge);
    diagPanel.appendChild(keyRow);

    const { row: pageRow } = diagRow('Current Page', window.location.pathname);
    diagPanel.appendChild(pageRow);

    const { row: appsRow } = diagRow('Registered Apps', APPS.length + ' apps');
    diagPanel.appendChild(appsRow);

    const { row: uaRow } = diagRow('User-Agent', navigator.userAgent.slice(0, 60) + '…');
    diagPanel.appendChild(uaRow);

    // Gateway connectivity rows (populated on runDiagnostics)
    const gw1Badge = document.createElement('span'); gw1Badge.textContent = '…';
    gw1Badge.style.background = '#1e293b'; gw1Badge.style.color = '#94a3b8';
    const { row: gw1Row, val: gw1Val } = diagRow('Gateway', GATEWAY_URL, gw1Badge);
    diagPanel.appendChild(gw1Row);

    const gw2Badge = document.createElement('span'); gw2Badge.textContent = '…';
    gw2Badge.style.background = '#1e293b'; gw2Badge.style.color = '#94a3b8';
    const { row: gw2Row, val: gw2Val } = diagRow('Server AI Lane', '/.netlify/functions/gateway-chat', gw2Badge);
    diagPanel.appendChild(gw2Row);

    const diagLink = document.createElement('a');
    diagLink.href = '';
    diagLink.target = '_blank';
    diagLink.rel = 'noopener noreferrer';
    diagLink.style.cssText = 'display:block;text-align:center;font-size:11px;color:rgba(255,215,0,.6);text-decoration:none;padding:8px;border-radius:8px;border:1px dashed rgba(255,215,0,.2);margin-top:4px;transition:color .2s;';
    diagLink.textContent = '↗ Open kAIxU Server Lane';
    diagLink.addEventListener('mouseenter', () => { diagLink.style.color = 'rgba(255,215,0,1)'; });
    diagLink.addEventListener('mouseleave', () => { diagLink.style.color = 'rgba(255,215,0,.6)'; });
    diagPanel.appendChild(diagLink);

    async function pingGateway(url, badge, valEl) {
      const t0 = Date.now();
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        const ms = Date.now() - t0;
        const ok = res.ok || res.status < 500;
        badge.textContent = ok ? `${ms}ms` : res.status;
        badge.style.background = ok ? '#14532d' : '#7f1d1d';
        badge.style.color = ok ? '#86efac' : '#fca5a5';
      } catch(e) {
        badge.textContent = e.name === 'TimeoutError' ? 'timeout' : 'unreachable';
        badge.style.background = '#7f1d1d'; badge.style.color = '#fca5a5';
      }
    }

    let diagRan = false;
    function runDiagnostics() {
      if (diagRan) return; diagRan = true;
      gw1Badge.textContent = '⏳'; gw2Badge.textContent = '⏳';
      pingGateway(GATEWAY_URL, gw1Badge, gw1Val);
      pingGateway('/.netlify/functions/gateway-chat', gw2Badge, gw2Val);
    }

    // ── ASSEMBLE ──
    body.appendChild(menuPanel);
    body.appendChild(chatPanel);
    body.appendChild(diagPanel);
    term.appendChild(tb);
    term.appendChild(tabsEl);
    term.appendChild(body);
    overlay.appendChild(term);

    // close on overlay click (outside terminal)
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSkyehawk(); });

    // keyboard: Esc closes
    overlay.__shKey = (e) => { if (e.key === 'Escape') closeSkyehawk(); };
    document.addEventListener('keydown', overlay.__shKey);

    // auto-focus
    requestAnimationFrame(() => {
      if (activeTab === 'menu') searchEl.focus();
      else inputEl.focus();
    });

    return overlay;
  }

  /* ─────────────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────────────── */
  function appendMsg(log, type, text) {
    const wrap = document.createElement('div');
    wrap.className = `__sh__msg __sh__${type}`;
    const meta = document.createElement('div');
    meta.className = '__sh__msg-meta';
    meta.textContent = type === 'user' ? 'You' : type === 'sys' ? 'System' : 'SKYEHAWK';
    const bubble = document.createElement('div');
    bubble.className = '__sh__msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  function appendTyping(log) {
    const wrap = document.createElement('div');
    wrap.className = '__sh__typing';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = '__sh__dot';
      wrap.appendChild(d);
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function navigateTo(app) {
    closeSkyehawk();
    // Resolve URL relative to site root
    const origin = window.location.origin;
    const url = new URL(app.url, origin).href;
    window.location.href = url;
  }

  /* ─────────────────────────────────────────────────────
     OPEN / CLOSE
  ───────────────────────────────────────────────────── */
  function openSkyehawk() {
    if (overlayEl) return; // already open
    overlayEl = buildUI();
    document.body.appendChild(overlayEl);
  }

  function closeSkyehawk() {
    if (!overlayEl) return;
    document.removeEventListener('keydown', overlayEl.__shKey);
    overlayEl.style.animation = '__shFadeOut .15s ease forwards';
    const el = overlayEl;
    el.style.opacity = '0';
    el.style.transition = 'opacity .15s';
    setTimeout(() => { try { el.remove(); } catch(_) {} }, 160);
    overlayEl = null;
    if (chatAbort) { try { chatAbort.abort(); } catch(_) {} chatAbort = null; }
  }

  /* ─────────────────────────────────────────────────────
     FLOATING TRIGGER NODE
  ───────────────────────────────────────────────────── */
  function injectTrigger() {
    if (document.getElementById('__sh__trigger')) return;

    const trigger = document.createElement('div');
    trigger.className = '__sh__trigger';
    trigger.id = '__sh__trigger';
    trigger.title = 'SKYEHAWK — hold 6+7 and triple-click, or click here';

    const img = document.createElement('img');
    img.src = 'https://cdn1.sharemyimage.com/2026/02/17/Logo-2-1.png';
    img.alt = 'SKYEHAWK';
    trigger.appendChild(img);

    const tooltip = document.createElement('div');
    tooltip.className = '__sh__trigger-tooltip';
    tooltip.textContent = 'SKYEHAWK Navigator';

    // single-click on trigger always opens (no gesture needed)
    trigger.addEventListener('click', openSkyehawk);

    document.body.appendChild(trigger);
    document.body.appendChild(tooltip);
  }

  /* ─────────────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────────────── */
  function boot() {
    injectTrigger();
    bindLogos();

    // re-bind logos after any SPA mutations
    new MutationObserver(() => bindLogos()).observe(document.body, {
      childList: true, subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
