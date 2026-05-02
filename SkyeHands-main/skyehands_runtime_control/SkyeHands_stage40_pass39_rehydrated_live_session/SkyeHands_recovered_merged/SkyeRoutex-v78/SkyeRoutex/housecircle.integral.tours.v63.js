(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V63__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V63__ = true;

  var openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function showGuide(){
    openModalFn('V63 Live Ops Guide', '<div class="hint">V63 closes more of the remaining local-control gap. You now have four new working lanes inside Routex: live QR scanning, vendor POS adapters, local webhook/job execution, and realtime local sync frames for peer tabs and replica deltas.</div><div class="sep"></div><ul><li>Use <strong>Live QR scanner</strong> when a venue is checking guests in from printed packets.</li><li>Use <strong>POS adapters</strong> to normalize Square, Toast, Clover, CSV, or JSON sale rows.</li><li>Use <strong>Jobs & webhooks</strong> to stage inbound events, replay dead letters, and process queued integration work.</li><li>Use <strong>Realtime mesh</strong> to push or apply replica frames between active peers without leaving the shell.</li></ul>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
  }

  function inject(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host || document.getElementById('hc_v63_guide_card')) return;
    var card = document.createElement('div');
    card.id = 'hc_v63_guide_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">V63 Guide</h2><div class="hint">Need the walkthrough for live scanning, adapters, jobs, and sync?</div><div class="sep"></div><button class="btn" id="hc_v63_guide_btn">Open V63 guide</button>';
    host.appendChild(card);
    var btn = document.getElementById('hc_v63_guide_btn');
    if(btn) btn.onclick = showGuide;
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V63_TOUR_RENDER__) return;
    window.__ROUTEX_HC_V63_TOUR_RENDER__ = true;
    var prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      var out = await prev.apply(this, arguments);
      raf(function(){ try{ inject(); }catch(_){ } });
      return out;
    };
  }

  function init(){
    patchRender();
    raf(function(){ try{ inject(); }catch(_){ } });
    window.showHouseCircleV63Guide = showGuide;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
