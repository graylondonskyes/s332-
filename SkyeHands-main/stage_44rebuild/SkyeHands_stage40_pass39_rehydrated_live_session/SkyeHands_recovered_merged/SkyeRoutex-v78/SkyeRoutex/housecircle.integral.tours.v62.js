(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V62__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V62__ = true;

  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function showGuide(){
    openModalFn('V62 Command Mesh Guide', '<div class="hint">V62 adds three operator lanes inside SkyeRoutexFlow: dispatch mesh for shift/assignment planning, readiness mesh for fail-closed venue and event checks, and replica mesh for manual cross-device merge preview/import. These are integral stack features, not sidecar patchwork.</div><div class="sep"></div><ul><li>Dispatch mesh turns open service cases into scheduled assignments.</li><li>Readiness mesh escalates required failures into service cases and Routex tasks.</li><li>Replica mesh previews and merges portable bundles so the stack can travel between devices.</li></ul>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
  }

  function inject(){
    const host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host || document.getElementById('hc_v62_guide_card')) return;
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    const card = document.createElement('div');
    card.id = 'hc_v62_guide_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">V62 Guide</h2><div class="hint">Need the operator walkthrough for the new command mesh lanes?</div><div class="sep"></div><button class="btn" id="hc_v62_guide_btn">Open V62 guide</button>';
    host.appendChild(card);
    const btn = document.getElementById('hc_v62_guide_btn');
    if(btn) btn.onclick = showGuide;
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V62_TOUR_RENDER__) return;
    window.__ROUTEX_HC_V62_TOUR_RENDER__ = true;
    const prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      const out = await prev.apply(this, arguments);
      raf(function(){ try{ inject(); }catch(_){ } });
      return out;
    };
  }

  function init(){
    patchRender();
    raf(function(){ try{ inject(); }catch(_){ } });
    window.showHouseCircleV62Guide = showGuide;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
