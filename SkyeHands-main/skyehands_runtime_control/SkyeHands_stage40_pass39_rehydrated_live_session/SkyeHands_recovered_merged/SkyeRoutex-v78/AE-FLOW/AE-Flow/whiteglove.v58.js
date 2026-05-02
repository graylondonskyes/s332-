
(function(){
  const APP = "AE FLOW";
  const VALUATION = "$6,850,000";
  const HTML_LINK = "../../WHITE_GLOVE_V58/SkyeRoutexFlow_2026_Deep_Investor_Valuation_v58.html";
  const PDF_LINK = "../../WHITE_GLOVE_V58/SkyeRoutexFlow_2026_Deep_Investor_Valuation_v58.pdf";
  const METRICS_LINK = "../../WHITE_GLOVE_V58/deep_scan_metrics_v58.json";
  const SUMMARY = [
    "Software/platform valuation only. Excludes vehicles, signed contracts, and live revenue.",
    "Deep scan basis: 74 HTML+JS artifacts, 52,513 HTML+JS lines, 5 backend modules, 60 backend routes.",
    "Platform scope: white-glove booking, dispatch, pricing, memberships, proof, payouts, sync, restore, conflict, transparency, and academy surfaces.",
    "Investor-style locked opinion: $6.85M USD as of April 4, 2026."
  ];
  function qs(sel, root=document){ try{ return root.querySelector(sel); }catch(e){ return null; } }
  function make(tag, attrs={}, html=''){
    const el=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{ if(k==='style') Object.assign(el.style,v); else if(k==='className') el.className=v; else el.setAttribute(k,v); });
    if(html) el.innerHTML=html;
    return el;
  }
  function ensureStyles(){
    if(document.getElementById('wg-v58-style')) return;
    const style=make('style',{id:'wg-v58-style'},`
      .wg-v58-fab{position:fixed;right:18px;bottom:18px;z-index:99999;background:linear-gradient(135deg,#1f163f,#4c1d95);color:#fff;border:1px solid rgba(255,255,255,.18);padding:12px 16px;border-radius:999px;font:600 13px/1.2 Arial,sans-serif;box-shadow:0 16px 36px rgba(0,0,0,.35);cursor:pointer}
      .wg-v58-fab:hover{transform:translateY(-1px)}
      .wg-v58-modal{position:fixed;inset:0;background:rgba(9,12,24,.74);backdrop-filter:blur(4px);z-index:100000;display:none;align-items:center;justify-content:center;padding:22px}
      .wg-v58-card{max-width:880px;width:min(100%,880px);max-height:88vh;overflow:auto;background:#0f172a;color:#eef2ff;border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.45);font-family:Arial,sans-serif}
      .wg-v58-card h2{margin:0 0 8px;font-size:32px;line-height:1.05}
      .wg-v58-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px}
      .wg-v58-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
      .wg-v58-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px}
      .wg-v58-money{font-size:44px;font-weight:800;letter-spacing:-.04em;margin:8px 0 6px}
      .wg-v58-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}
      .wg-v58-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border-radius:14px;background:#ede9fe;color:#2e1065;text-decoration:none;font-weight:700;font-size:13px;border:none;cursor:pointer}
      .wg-v58-btn.alt{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15)}
      .wg-v58-list{margin:0;padding-left:18px} .wg-v58-list li{margin:0 0 8px;line-height:1.45}
      .wg-v58-note{font-size:12px;color:#cbd5e1;line-height:1.45}
      .wg-v58-close{float:right;background:transparent;color:#cbd5e1;border:none;font-size:18px;cursor:pointer}
      .wg-v58-strip{margin:18px 0 0;background:linear-gradient(135deg,#251a4d,#3b2471);color:#fff;padding:16px 18px;border-radius:20px;border:1px solid rgba(255,255,255,.12)}
      @media (max-width:760px){.wg-v58-grid{grid-template-columns:1fr} .wg-v58-card h2{font-size:26px} .wg-v58-money{font-size:36px} }
    `);
    document.head.appendChild(style);
  }
  function buildModal(){
    if(document.getElementById('wg-v58-modal')) return document.getElementById('wg-v58-modal');
    const modal=make('div',{id:'wg-v58-modal',className:'wg-v58-modal'});
    modal.innerHTML=`<div class="wg-v58-card">
      <button class="wg-v58-close" aria-label="Close">✕</button>
      <div class="wg-v58-kicker">2026 deep investor valuation</div>
      <h2>${APP} valuation center</h2>
      <div class="wg-v58-grid">
        <div class="wg-v58-box">
          <div class="wg-v58-note">Locked software/platform valuation</div>
          <div class="wg-v58-money">${VALUATION}</div>
          <div class="wg-v58-note">As of April 4, 2026. This is the software/platform opinion of value, not the fleet-asset or contract layer.</div>
        </div>
        <div class="wg-v58-box">
          <div class="wg-v58-note">Deep scan basis</div>
          <ul class="wg-v58-list">${SUMMARY.map(x=>`<li>${x}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="wg-v58-strip"><strong>Investor position:</strong> this product has moved beyond a routing utility into a premium white-glove operating system with canonical booking, membership, dispatch, proof, payout, sync, restore, and operator-education layers.</div>
      <div class="wg-v58-actions">
        <a class="wg-v58-btn" href="${HTML_LINK}" target="_blank" rel="noopener">Open valuation report</a>
        <a class="wg-v58-btn" href="${PDF_LINK}" target="_blank" rel="noopener">Open valuation PDF</a>
        <a class="wg-v58-btn alt" href="${METRICS_LINK}" target="_blank" rel="noopener">Open deep-scan metrics</a>
        <button class="wg-v58-btn alt" id="wg-v58-copy">Copy valuation</button>
      </div>
      <p class="wg-v58-note" style="margin-top:16px">This surface exists so clients, users, operators, and investors can see the valuation stance directly inside the shipped app.</p>
    </div>`;
    modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.style.display='none'; });
    modal.querySelector('.wg-v58-close').addEventListener('click', ()=> modal.style.display='none');
    modal.querySelector('#wg-v58-copy').addEventListener('click', async ()=>{
      const text=`${APP} 2026 software/platform valuation: ${VALUATION} USD.`;
      try{ await navigator.clipboard.writeText(text); }catch(_e){}
    });
    document.body.appendChild(modal);
    return modal;
  }
  function openModal(){ buildModal().style.display='flex'; }
  function injectFab(){
    if(document.getElementById('wg-v58-fab')) return;
    const btn=make('button',{id:'wg-v58-fab',className:'wg-v58-fab',type:'button'},'2026 Valuation');
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }
  function injectInlineCard(){
    if(document.getElementById('wg-v58-inline')) return;
    const target = qs('main') || qs('#app') || qs('.page.active') || qs('body');
    if(!target) return;
    const card=make('section',{id:'wg-v58-inline', style:{margin:'16px',padding:'16px 18px',borderRadius:'18px',background:'linear-gradient(135deg,#18122f,#32215f)',color:'#fff',border:'1px solid rgba(255,255,255,.12)',fontFamily:'Arial,sans-serif'}},
      `<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c4b5fd">Investor visibility</div>
       <div style="font-size:24px;font-weight:800;margin:6px 0 4px">2026 valuation: $6,850,000 USD</div>
       <div style="font-size:13px;line-height:1.45;color:#e9e4ff;max-width:780px">Deep scan valuation now bundled into the product. Open the valuation center for the full investor memo, PDF, and metrics.</div>
       <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap"><button type="button" id="wg-v58-inline-open" style="padding:10px 12px;border:none;border-radius:12px;background:#ede9fe;color:#2e1065;font-weight:700;cursor:pointer">Open valuation center</button></div>`);
    const opener=card.querySelector('#wg-v58-inline-open'); if(opener) opener.addEventListener('click', openModal);
    target.insertBefore(card, target.firstChild);
  }
  function init(){ ensureStyles(); injectFab(); injectInlineCard(); buildModal(); window.__WHITEGLOVE_V58_VALUATION__={app:APP,valueUSD:6850000,html:HTML_LINK,pdf:PDF_LINK,metrics:METRICS_LINK}; }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
