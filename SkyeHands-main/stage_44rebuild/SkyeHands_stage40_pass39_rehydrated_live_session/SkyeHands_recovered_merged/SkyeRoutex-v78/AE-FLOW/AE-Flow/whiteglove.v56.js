
/* V56 AE FLOW conservative duplicate review + saturation visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V56__) return;
  window.__AEFLOW_WHITEGLOVE_V56__ = true;
  const ROUTEX_KEYS = {
    guardRows:'skye_whiteglove_guardrail_rows_v56',
    guardOutbox:'skye_whiteglove_guardrail_outbox_v56',
    spreadRows:'skye_whiteglove_spread_rows_v56',
    spreadOutbox:'skye_whiteglove_spread_outbox_v56'
  };
  const KEYS = {
    guardInbox:'ae_whiteglove_guardrail_inbox_v56',
    spreadInbox:'ae_whiteglove_spread_inbox_v56'
  };
  const readJSON = (k, f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k, v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const pushInbox = (key, row)=> { const list = readJSON(KEYS[key], []); list.unshift(row); writeJSON(KEYS[key], list.slice(0, 240)); return row; };
  const latest = (k)=> readJSON(KEYS[k], [])[0] || null;
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function syncGuard(){ const row = readJSON(ROUTEX_KEYS.guardRows, [])[0] || null; if(!row) return null; return pushInbox('guardInbox', { importedAt:new Date().toISOString(), sourceId:row.id, row }); }
  function syncSpread(){ const row = readJSON(ROUTEX_KEYS.spreadRows, [])[0] || null; if(!row) return null; return pushInbox('spreadInbox', { importedAt:new Date().toISOString(), sourceId:row.id, row }); }
  function render(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing synced yet.'; }
  function ensure(){
    if(document.getElementById('ae-wg-v56-launcher')) return;
    const btn = document.createElement('button'); btn.id='ae-wg-v56-launcher'; btn.textContent='WG Review Sync+'; btn.style.cssText='position:fixed;right:18px;bottom:176px;z-index:100015;border:1px solid rgba(255,255,255,.18);background:#184630;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;cursor:pointer;';
    const modal = document.createElement('div'); modal.id='ae-wg-v56-modal'; modal.style.cssText='display:none;position:fixed;inset:0;z-index:100016;background:rgba(0,0,0,.74);padding:24px;overflow:auto;';
    modal.innerHTML='<div style="max-width:1180px;margin:0 auto;background:#09131b;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div><div style="font:700 20px system-ui">AE FLOW white-glove final visibility</div><div style="font:12px system-ui;opacity:.72">Imports the newest conservative duplicate-booking guardrails and saturation spread from Routex.</div></div><button id="ae-wg-v56-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Guardrail inbox</h3><button id="ae-wg-v56-sync-guard">Sync</button></div><pre id="ae-wg-v56-guard" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Saturation inbox</h3><button id="ae-wg-v56-sync-spread">Sync</button></div><pre id="ae-wg-v56-spread" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(btn); document.body.appendChild(modal);
    const guardPre = modal.querySelector('#ae-wg-v56-guard'); const spreadPre = modal.querySelector('#ae-wg-v56-spread');
    const refresh = ()=> { render(guardPre, latest('guardInbox')); render(spreadPre, latest('spreadInbox')); };
    btn.onclick=()=>{ modal.style.display='block'; refresh(); };
    modal.querySelector('#ae-wg-v56-close').onclick=()=>{ modal.style.display='none'; };
    modal.querySelector('#ae-wg-v56-sync-guard').onclick=()=>{ const row = syncGuard(); toast(row ? 'Guardrail inbox synced.' : 'No Routex guardrail pack found.'); refresh(); };
    modal.querySelector('#ae-wg-v56-sync-spread').onclick=()=>{ const row = syncSpread(); toast(row ? 'Saturation inbox synced.' : 'No Routex saturation row found.'); refresh(); };
    const host = document.querySelector('#app') || document.body;
    if(!document.getElementById('aeWhiteGloveV56Card')){
      const card = document.createElement('div');
      card.id='aeWhiteGloveV56Card'; card.className='card';
      card.innerHTML='<h2 style="margin:0 0 10px">White-glove final visibility</h2><div style="font-size:13px;line-height:1.6">Use <strong>WG Review Sync+</strong> to import the newest conservative duplicate-review and saturation spread outputs from Routex.</div>';
      host.appendChild(card);
    }
  }
  window.syncWhiteGloveGuardrailInboxV56 = syncGuard;
  window.syncWhiteGloveSaturationInboxV56 = syncSpread;
  window.openWhiteGloveV56Visibility = function(){ ensure(); const btn = document.getElementById('ae-wg-v56-launcher'); if(btn) btn.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
})();
