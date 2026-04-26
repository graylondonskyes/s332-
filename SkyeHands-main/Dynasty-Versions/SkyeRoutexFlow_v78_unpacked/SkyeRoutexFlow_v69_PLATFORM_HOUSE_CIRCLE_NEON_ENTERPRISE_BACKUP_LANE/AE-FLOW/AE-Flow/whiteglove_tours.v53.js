/* V53 AE FLOW hardening visibility guide */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_TOURS_V53__) return;
  window.__AEFLOW_WHITEGLOVE_TOURS_V53__ = true;
  function step(title, body, action){ return { title, body, action }; }
  function runGuide(steps){
    if(!steps || !steps.length) return;
    let i = 0;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:24px;';
    const card = document.createElement('div');
    card.style.cssText = 'max-width:820px;width:100%;background:#12081f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.45);';
    overlay.appendChild(card); document.body.appendChild(overlay);
    const render = ()=> {
      const s = steps[i];
      try{ if(typeof s.action === 'function') s.action(); }catch(_){ }
      card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div style="font:700 20px system-ui">'+s.title+'</div><div style="font:13px system-ui;opacity:.82;line-height:1.6;margin-top:8px">'+s.body+'</div></div><button id="aewgv53x" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center"><div style="font:12px system-ui;opacity:.72">Step '+(i+1)+' of '+steps.length+'</div><div><button id="aewgv53prev" style="margin-right:8px">Back</button><button id="aewgv53next">'+(i === steps.length-1 ? 'Finish' : 'Next')+'</button></div></div>';
      card.querySelector('#aewgv53x').onclick = ()=> overlay.remove();
      card.querySelector('#aewgv53prev').onclick = ()=> { if(i > 0){ i -= 1; render(); } };
      card.querySelector('#aewgv53next').onclick = ()=> { if(i < steps.length-1){ i += 1; render(); } else overlay.remove(); };
    };
    render();
  }
  window.startAEWhiteGloveV53Tour = function(){
    runGuide([
      step('Hardening visibility', 'This guide opens the AE FLOW hardening visibility panel so the continuity side can see collision, edge, and operator-surface state too.', ()=> window.openAEWhiteGloveHardeningVisibilityV53 && window.openAEWhiteGloveHardeningVisibilityV53()),
      step('Collision inbox', 'Sync the collision inbox after imports or merges so AE FLOW knows when duplicated identities or broken record links threaten service continuity.', ()=> { const btn = document.getElementById('ae-wg-v53-sync-collision'); if(btn) btn.click(); }),
      step('Edge inbox', 'Sync the materialization edge inbox when a premium booking has tricky multi-stop, standby, or return-leg behavior that the operator should review before service day.', ()=> { const btn = document.getElementById('ae-wg-v53-sync-edge'); if(btn) btn.click(); }),
      step('Surface bundle inbox', 'Sync the operator surface bundle to see the newest combined value/proof/backend state directly from AE FLOW.', ()=> { const btn = document.getElementById('ae-wg-v53-sync-surface'); if(btn) btn.click(); }),
      step('Teach the newest lanes', 'This coverage exists so the latest backend and hardening surfaces are taught in-app instead of becoming hidden power-user only controls.', ()=> {})
    ]);
  };
})();
