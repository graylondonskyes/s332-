(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V61__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V61__ = true;

  const openModalFn = (typeof openModal === 'function') ? openModal : function(){};
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function openGuide(){
    openModalFn('Platform House V61 guide', '<div class="hint">V61 is the first pass where Platform House and Routex talk through actual operating logic. Use it in this order.</div><div class="sep"></div><ol><li>Open <strong>Automation rules</strong> to see what signals now trigger work automatically.</li><li>Open <strong>Service cases</strong> to review the cross-domain recovery and hospitality queue.</li><li>Open <strong>Playbooks</strong> to run repeatable motions manually when you want deterministic operator control.</li><li>Export the <strong>v61 bundle</strong> when you want the full local state with cases, rules, runs, and Routex task spillover.</li></ol><div class="sep"></div><div class="hint">The strongest live proof in this pass is that packet redemptions, POS tickets, and stop syncs can now spawn cases and Routex tasks through rules instead of remaining isolated records.</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Done</button>');
  }

  function inject(){
    const host = document.getElementById('hc_v61_command_deck');
    if(!host || document.getElementById('hc61_guide_btn')) return;
    const row = host.querySelector('.row');
    if(!row) return;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'hc61_guide_btn';
    btn.textContent = 'V61 guide';
    btn.onclick = openGuide;
    row.appendChild(btn);
  }

  function init(){
    const prev = typeof render === 'function' ? render : null;
    if(prev && !window.__ROUTEX_HOUSECIRCLE_TOURS_V61_RENDER__){
      window.__ROUTEX_HOUSECIRCLE_TOURS_V61_RENDER__ = true;
      render = async function(){
        const out = await prev.apply(this, arguments);
        raf(function(){ try{ inject(); }catch(_){ } });
        return out;
      };
    }
    raf(function(){ try{ inject(); }catch(_){ } });
    window.RoutexPlatformHouseCircleToursV61 = { openGuide: openGuide };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
