/* V53 Routex hardening guide coverage */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_TOURS_V53__) return;
  window.__ROUTEX_WHITEGLOVE_TOURS_V53__ = true;
  function step(title, body, action){ return { title, body, action }; }
  function runGuide(steps){
    if(!steps || !steps.length) return;
    let i = 0;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:24px;';
    const card = document.createElement('div');
    card.style.cssText = 'max-width:820px;width:100%;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.45);';
    overlay.appendChild(card); document.body.appendChild(overlay);
    const render = ()=> {
      const s = steps[i];
      try{ if(typeof s.action === 'function') s.action(); }catch(_){ }
      card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div style="font:700 20px system-ui">'+s.title+'</div><div style="font:13px system-ui;opacity:.82;line-height:1.6;margin-top:8px">'+s.body+'</div></div><button id="wgv53x" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center"><div style="font:12px system-ui;opacity:.72">Step '+(i+1)+' of '+steps.length+'</div><div><button id="wgv53prev" style="margin-right:8px">Back</button><button id="wgv53next">'+(i === steps.length-1 ? 'Finish' : 'Next')+'</button></div></div>';
      card.querySelector('#wgv53x').onclick = ()=> overlay.remove();
      card.querySelector('#wgv53prev').onclick = ()=> { if(i > 0){ i -= 1; render(); } };
      card.querySelector('#wgv53next').onclick = ()=> { if(i < steps.length-1){ i += 1; render(); } else overlay.remove(); };
    };
    render();
  }
  window.startWhiteGloveV53Tour = function(){
    runGuide([
      step('Hardening center', 'This walkthrough opens the white-glove hardening center so users can see collisions, materialization edge risk, and the operator surface bundle from one place.', ()=> window.openWhiteGloveHardeningCenterV53 && window.openWhiteGloveHardeningCenterV53()),
      step('Collision audit', 'Run the collision audit whenever the operator imports records, merges backups, or suspects duplicate riders, drivers, or booking chains. It scores the record graph and lists blockers that still need cleanup.', ()=> { const btn = document.getElementById('wg-v53-run-collision'); if(btn) btn.click(); }),
      step('Materialization edge report', 'Choose a booking and generate an edge report to catch blind spots in multi-stop, standby, return-leg, and airport chains before the service is actually run.', ()=> {}),
      step('Operator surface bundle', 'Build the surface bundle to combine the latest valuation, proof, conflict, chain, and collision state into one executive-facing snapshot.', ()=> { const btn = document.getElementById('wg-v53-run-surface'); if(btn) btn.click(); }),
      step('Export and visibility', 'Each hardening surface exports directly, so operators, users, and client-facing stakeholders can review the newest state without digging through storage rows.', ()=> {})
    ]);
  };
})();
