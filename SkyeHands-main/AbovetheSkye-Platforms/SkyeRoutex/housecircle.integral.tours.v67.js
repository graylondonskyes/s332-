(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V67_TOURS__) return;
  window.__ROUTEX_HOUSECIRCLE_V67_TOURS__ = true;

  function inject(){
    if(!window.RoutexPlatformHouseCircleV67) return;
    var host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host || document.getElementById('hc67_tour_card')) return;
    if(!(typeof APP !== 'undefined' && APP && (APP.view === 'platform-house' || APP.view === 'dashboard' || APP.view === 'settings'))) return;
    var card = document.createElement('div');
    card.id = 'hc67_tour_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Operator walkthrough launcher</h2><div class="hint">Use the master walkthrough when you need the deep product explanation instead of pass-by-pass fragments. It covers the full stack from shell to deployment boundary.</div><div class="sep"></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn" id="hc67_tour_open">Open master walkthrough</button><button class="btn primary" id="hc67_tour_static">Open static walkthrough</button></div>';
    host.appendChild(card);
    var openBtn = document.getElementById('hc67_tour_open'); if(openBtn) openBtn.onclick = function(){ window.RoutexPlatformHouseCircleV67.openWalkthroughModal(); };
    var staticBtn = document.getElementById('hc67_tour_static'); if(staticBtn) staticBtn.onclick = function(){ try{ window.open('./operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.html', '_blank'); }catch(_){ window.RoutexPlatformHouseCircleV67.exportHtml(); } };
  }

  var prev = typeof render === 'function' ? render : null;
  if(prev){
    render = async function(){ var out = await prev.apply(this, arguments); try{ inject(); }catch(_){} return out; };
  }
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(function(){ try{ if(typeof render === 'function') render(); else inject(); }catch(_){} });
})();
