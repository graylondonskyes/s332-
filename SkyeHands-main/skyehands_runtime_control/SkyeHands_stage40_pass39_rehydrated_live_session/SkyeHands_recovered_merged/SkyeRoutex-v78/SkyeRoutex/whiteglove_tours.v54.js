/* V54 Routex resolution + saturation guide coverage */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V54__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V54__ = true;
  function step(title, body, action){ return { title, body, action }; }
  function runGuide(steps){
    if(!steps || !steps.length) return;
    let i = 0;
    const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;z-index:100021;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:24px;';
    const card = document.createElement('div'); card.style.cssText = 'max-width:820px;width:100%;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.45);'; overlay.appendChild(card); document.body.appendChild(overlay);
    const render = ()=> { const s = steps[i]; try{ if(typeof s.action === 'function') s.action(); }catch(_){ } card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div style="font:700 20px system-ui">'+s.title+'</div><div style="font:13px system-ui;opacity:.82;line-height:1.6;margin-top:8px">'+s.body+'</div></div><button id="wgv54x" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center"><div style="font:12px system-ui;opacity:.72">Step '+(i+1)+' of '+steps.length+'</div><div><button id="wgv54prev" style="margin-right:8px">Back</button><button id="wgv54next">'+(i === steps.length-1 ? 'Finish' : 'Next')+'</button></div></div>'; card.querySelector('#wgv54x').onclick = ()=> overlay.remove(); card.querySelector('#wgv54prev').onclick = ()=> { if(i > 0){ i -= 1; render(); } }; card.querySelector('#wgv54next').onclick = ()=> { if(i < steps.length-1){ i += 1; render(); } else overlay.remove(); }; }; render();
  }
  window.startWhiteGloveV54Tour = function(){
    runGuide([
      step('Open the resolution center', 'This guide opens the newest white-glove resolution center so operators can preview safe duplicate merges, orphan reattach suggestions, and visibility saturation from one place.', ()=> window.openWhiteGloveResolutionCenterV54 && window.openWhiteGloveResolutionCenterV54()),
      step('Preview collision resolution', 'Run the preview before any merge or restore-heavy work. It proposes safe service-profile merges and only flags booking duplicates for review, rather than auto-deleting premium ride chains.', ()=> { const btn = document.getElementById('wg-v54-preview'); if(btn) btn.click(); }),
      step('Apply the safe plan', 'Apply only the safe plan. The app repoints bookings and memberships to the survivor profile and marks absorbed rows inactive, preserving auditability instead of pretending the duplicates never existed.', ()=> {}),
      step('Build surface saturation', 'Build the saturation row to prove that the newest value, proof, conflict, backend, and resolution surfaces are all loaded, visible, and teachable.', ()=> { const btn = document.getElementById('wg-v54-build-saturation'); if(btn) btn.click(); }),
      step('Export the newest hardening state', 'The newest resolution and saturation rows export directly, so operators and stakeholders can review the final hardening state without digging through storage internals.', ()=> {})
    ]);
  };
})();
