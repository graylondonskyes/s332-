/* V54 AE FLOW resolution visibility guide */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_TOURS_V54__) return;
  window.__AEFLOW_WHITEGLOVE_TOURS_V54__ = true;
  function step(title, body, action){ return { title, body, action }; }
  function runGuide(steps){
    if(!steps || !steps.length) return;
    let i = 0;
    const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;z-index:100021;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:24px;';
    const card = document.createElement('div'); card.style.cssText = 'max-width:820px;width:100%;background:#12081f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.45);'; overlay.appendChild(card); document.body.appendChild(overlay);
    const render = ()=> { const s = steps[i]; try{ if(typeof s.action === 'function') s.action(); }catch(_){ } card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div style="font:700 20px system-ui">'+s.title+'</div><div style="font:13px system-ui;opacity:.82;line-height:1.6;margin-top:8px">'+s.body+'</div></div><button id="aewgv54x" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center"><div style="font:12px system-ui;opacity:.72">Step '+(i+1)+' of '+steps.length+'</div><div><button id="aewgv54prev" style="margin-right:8px">Back</button><button id="aewgv54next">'+(i === steps.length-1 ? 'Finish' : 'Next')+'</button></div></div>'; card.querySelector('#aewgv54x').onclick = ()=> overlay.remove(); card.querySelector('#aewgv54prev').onclick = ()=> { if(i > 0){ i -= 1; render(); } }; card.querySelector('#aewgv54next').onclick = ()=> { if(i < steps.length-1){ i += 1; render(); } else overlay.remove(); }; }; render();
  }
  window.startAEWhiteGloveV54Tour = function(){
    runGuide([
      step('Open the resolution visibility panel', 'This guide opens the newest AE FLOW visibility panel so the continuity side can see safe collision-resolution plans and saturation rows too.', ()=> window.openAEWhiteGloveResolutionVisibilityV54 && window.openAEWhiteGloveResolutionVisibilityV54()),
      step('Sync the resolution inbox', 'Sync the resolution inbox after imports or merges so AE FLOW knows when Routex has prepared a safe plan for duplicate profile collisions and orphan booking reattach.', ()=> { const btn = document.getElementById('ae-wg-v54-sync-resolution'); if(btn) btn.click(); }),
      step('Sync the saturation inbox', 'Sync the saturation inbox to see whether the newest operator surfaces are fully visible and teachable across the premium stack.', ()=> { const btn = document.getElementById('ae-wg-v54-sync-saturation'); if(btn) btn.click(); }),
      step('Review the blockers', 'The latest summary highlights whether any visibility or proof blockers still remain on the newest hardening surfaces.', ()=> {}),
      step('Export for operator review', 'Both the resolution and saturation inboxes export directly so operators can review the latest state without leaving AE FLOW.', ()=> {})
    ]);
  };
})();
