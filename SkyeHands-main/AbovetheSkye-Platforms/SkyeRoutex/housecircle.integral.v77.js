(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V77__) return; window.__ROUTEX_HOUSECIRCLE_V77__ = true;
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
  function nowISO(){ return new Date().toISOString(); }
  function readCache(){ try{ return JSON.parse(localStorage.getItem('skye-app-fabric-v77-cache') || '{}'); }catch(_){ return {}; } }
  function notify(msg){ try{ if(typeof toast === 'function') toast(msg, 'ok'); }catch(_){} }
  function modal(title, body, footer){ try{ if(typeof openModal === 'function') return openModal(title, body, footer); }catch(_){} alert(title + '\n\n' + body.replace(/<[^>]+>/g,' ')); }
  async function call(path, body){ try{ var res = await fetch(path, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify(body || {}) }); return await res.json(); }catch(_){ if(window.RoutexSharedAppFabricV77){ if(path.indexOf('autodiscover') >= 0) return window.RoutexSharedAppFabricV77.autodiscoverEstate(); if(path.indexOf('autowire') >= 0) return window.RoutexSharedAppFabricV77.autowireEstate(); if(path.indexOf('estate-qa') >= 0) return window.RoutexSharedAppFabricV77.runEstateQA(); if(path.indexOf('dead-button') >= 0) return window.RoutexSharedAppFabricV77.runDeadButtonAudit(); if(path.indexOf('certify') >= 0) return window.RoutexSharedAppFabricV77.certifyEstate(); }
      return { ok:false, error:'offline fallback unavailable' };
    }
  }
  function appRows(){ var cache = readCache(); return cache.apps || []; }
  function openDock(){
    var rows = appRows();
    var list = rows.map(function(app){ return '<div class="pill" style="margin:6px 6px 0 0;">' + esc(app.title || app.slug) + ' · ' + esc(app.appType || 'ui') + '</div>'; }).join('');
    modal('App Fabric Dock · V77', '<div class="hint">Integrated estate registry, certification lane, and dead-button audit.</div><div class="sep"></div><div class="hint"><strong>Apps discovered:</strong> ' + esc(String(rows.length)) + '</div><div class="row" style="flex-wrap:wrap;">' + list + '</div><div class="sep"></div><div class="hint">Open the Audit Ready Console to manage certifications and scaffolds from the product surface.</div>', '<button class="btn" id="hc77_refresh">Refresh</button><button class="btn" id="hc77_autodiscover">Autodiscover</button><button class="btn" id="hc77_autowire">Autowire</button><button class="btn" id="hc77_qa">Estate QA</button><button class="btn" id="hc77_dead">Dead Buttons</button><button class="btn primary" id="hc77_certify">Certify</button><button class="btn" id="hc77_open_audit">Open Audit Console</button>');
    function bind(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; }
    bind('hc77_refresh', async function(){ notify('Registry refreshed.'); openDock(); });
    bind('hc77_autodiscover', async function(){ await call('/.netlify/functions/phc-app-fabric-autodiscover', {}); notify('Estate autodiscovered.'); openDock(); });
    bind('hc77_autowire', async function(){ await call('/.netlify/functions/phc-app-fabric-autowire', {}); notify('Estate autowired.'); openDock(); });
    bind('hc77_qa', async function(){ await call('/.netlify/functions/phc-app-fabric-estate-qa', {}); notify('Estate QA completed.'); openDock(); });
    bind('hc77_dead', async function(){ await call('/.netlify/functions/phc-app-fabric-dead-button-audit', {}); notify('Dead-button audit completed.'); openDock(); });
    bind('hc77_certify', async function(){ await call('/.netlify/functions/phc-app-fabric-certify', {}); notify('Estate certified.'); openDock(); });
    bind('hc77_open_audit', function(){ try{ window.open('./apps/audit-ready-console/index.html', '_blank'); }catch(_){} });
  }
  function inject(){
    if(document.getElementById('hc77_toolbar_btn')) return;
    var hosts = [];
    try{ hosts = Array.prototype.slice.call(document.querySelectorAll('.topbar .row, #nav')); }catch(_){ hosts = []; }
    for(var i=0;i<hosts.length;i++){
      var host = hosts[i]; if(!host) continue;
      var btn = document.createElement('button');
      btn.id = 'hc77_toolbar_btn';
      btn.className = host.id === 'nav' ? 'navbtn' : 'btn';
      btn.innerHTML = host.id === 'nav' ? '<span>🧩</span><div class="l"><b>App Dock</b><span>V77 fabric</span></div>' : 'App Dock';
      btn.onclick = openDock;
      host.appendChild(btn);
      break;
    }
  }
  function patchRender(){ if(window.__HC_V77_RENDER_PATCHED__) return; window.__HC_V77_RENDER_PATCHED__ = true; var prev = typeof render === 'function' ? render : null; if(prev){ render = async function(){ var out = await prev.apply(this, arguments); try{ inject(); }catch(_){} return out; }; } }
  patchRender(); inject();
  window.RoutexPlatformHouseCircleV77 = { openDock:openDock, generatedAt:nowISO() };
})();