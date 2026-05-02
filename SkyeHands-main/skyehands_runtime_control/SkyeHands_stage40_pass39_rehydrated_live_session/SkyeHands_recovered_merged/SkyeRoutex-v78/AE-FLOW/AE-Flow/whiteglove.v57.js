
/* V57 AE FLOW client packet and member statement visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V57__) return;
  window.__AEFLOW_WHITEGLOVE_V57__ = true;
  const ROUTEX = {
    packets:'skye_whiteglove_client_packets_v57',
    packetOutbox:'skye_whiteglove_client_packet_outbox_v57',
    statements:'skye_whiteglove_member_statements_v57',
    statementOutbox:'skye_whiteglove_member_statement_outbox_v57'
  };
  const KEYS = {
    packetInbox:'ae_whiteglove_client_packet_inbox_v57',
    statementInbox:'ae_whiteglove_member_statement_inbox_v57'
  };
  const readJSON = (k, f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k, v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const pushInbox = (key, row)=> { const list = readJSON(KEYS[key], []); list.unshift(row); writeJSON(KEYS[key], list.slice(0, 240)); return row; };
  const latest = (key)=> readJSON(KEYS[key], [])[0] || null;
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  function syncPacket(){ const row = readJSON(ROUTEX.packets, [])[0] || null; if(!row) return null; return pushInbox('packetInbox', { importedAt:new Date().toISOString(), sourceId:row.id, row }); }
  function syncStatement(){ const row = readJSON(ROUTEX.statements, [])[0] || null; if(!row) return null; return pushInbox('statementInbox', { importedAt:new Date().toISOString(), sourceId:row.id, row }); }
  function render(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing synced yet.'; }
  function ensure(){
    if(document.getElementById('ae-wg-v57-launcher')) return;
    const btn = document.createElement('button'); btn.id='ae-wg-v57-launcher'; btn.textContent='WG Client Sync'; btn.style.cssText='position:fixed;right:18px;bottom:248px;z-index:100021;border:1px solid rgba(255,255,255,.18);background:#3f2a12;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;cursor:pointer;';
    const modal = document.createElement('div'); modal.id='ae-wg-v57-modal'; modal.style.cssText='display:none;position:fixed;inset:0;z-index:100022;background:rgba(0,0,0,.74);padding:24px;overflow:auto;';
    modal.innerHTML='<div style="max-width:1180px;margin:0 auto;background:#13100b;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div><div style="font:700 20px system-ui">AE FLOW client transparency visibility</div><div style="font:12px system-ui;opacity:.72">Imports the latest client transparency packets and member statements created in Routex.</div></div><button id="ae-wg-v57-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Client packet inbox</h3><button id="ae-wg-v57-sync-packet">Sync</button></div><pre id="ae-wg-v57-packet" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Member statement inbox</h3><button id="ae-wg-v57-sync-statement">Sync</button></div><pre id="ae-wg-v57-statement" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(btn); document.body.appendChild(modal);
    const packetPre = modal.querySelector('#ae-wg-v57-packet'); const statementPre = modal.querySelector('#ae-wg-v57-statement');
    const refresh = ()=> { render(packetPre, latest('packetInbox')); render(statementPre, latest('statementInbox')); };
    btn.onclick=()=>{ modal.style.display='block'; refresh(); };
    modal.querySelector('#ae-wg-v57-close').onclick=()=>{ modal.style.display='none'; };
    modal.querySelector('#ae-wg-v57-sync-packet').onclick=()=>{ const row = syncPacket(); toast(row ? 'Client packet inbox synced.' : 'No Routex client packet found.'); refresh(); };
    modal.querySelector('#ae-wg-v57-sync-statement').onclick=()=>{ const row = syncStatement(); toast(row ? 'Member statement inbox synced.' : 'No Routex member statement found.'); refresh(); };
    const host = document.querySelector('#app') || document.body;
    if(!document.getElementById('aeWhiteGloveV57Card')){
      const card = document.createElement('div');
      card.id='aeWhiteGloveV57Card'; card.className='card';
      card.innerHTML='<h2 style="margin:0 0 10px">Client transparency visibility</h2><div style="font-size:13px;line-height:1.6">Use <strong>WG Client Sync</strong> to import the latest client packets and member statements from Routex into AE FLOW continuity view.</div>';
      host.appendChild(card);
    }
  }
  window.syncWhiteGloveClientPacketInboxV57 = syncPacket;
  window.syncWhiteGloveMemberStatementInboxV57 = syncStatement;
  window.openWhiteGloveV57Visibility = function(){ ensure(); const btn = document.getElementById('ae-wg-v57-launcher'); if(btn) btn.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
})();
