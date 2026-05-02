(function(){
  function $(s){ return document.querySelector(s); }
  function ensureView(){
    var navAnchor = document.querySelector('.nav .nav-section:last-of-type');
    if(navAnchor && !document.querySelector('.nav-item[data-view="integration"]')){
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.setAttribute('data-view', 'integration');
      btn.textContent = 'Integration Center';
      navAnchor.appendChild(btn);
    }
    var content = document.querySelector('.content');
    if(content && !document.getElementById('view-integration')){
      var wrap = document.createElement('div');
      wrap.className = 'view';
      wrap.id = 'view-integration';
      wrap.innerHTML = '<div class="grid-2"><div class="card glow"><div class="card-title">Enterprise Integration Center</div><div class="muted">Working controls only. Every button in this panel is wired to either the live Netlify lane or the local browser fallback.</div><div class="divider"></div><div class="stack"><button class="btn btn-wide" id="arf77_refresh">Refresh Registry</button><button class="btn btn-wide" id="arf77_autodiscover">Autodiscover Apps</button><button class="btn btn-wide" id="arf77_autowire">Autowire Estate</button><button class="btn btn-wide" id="arf77_qa">Estate QA</button><button class="btn btn-wide" id="arf77_dead_buttons">Dead Button Audit</button><button class="btn btn-wide btn-gold" id="arf77_certify">Enterprise Certify</button></div></div><div class="card"><div class="card-title">Drop-in Intake</div><div class="muted">One-click scaffold for a new app folder, manifest, bridge, and starter action contract.</div><div class="divider"></div><div class="stack"><button class="btn btn-wide" id="arf77_scaffold_plus">Scaffold New App</button><button class="btn btn-wide" id="arf77_rbac_audit">RBAC Audit</button><button class="btn btn-wide" id="arf77_tenant_audit">Tenant Audit</button><button class="btn btn-wide" id="arf77_receipts">Deployment Receipts</button><button class="btn btn-wide" id="arf77_zero_s_mount">0s Runtime Mount</button></div></div></div><div class="card" style="margin-top:16px;"><div class="card-title">Integration Output</div><pre id="arf77_output" style="white-space:pre-wrap;overflow:auto;max-height:420px;background:rgba(0,0,0,.25);padding:12px;border-radius:12px;">Ready.</pre></div>';
      content.appendChild(wrap);
    }
  }
  function readRegistry(){
    if(window.RoutexSharedAppFabricV77 && window.RoutexSharedAppFabricV77.readCache) return window.RoutexSharedAppFabricV77.readCache();
    return { apps:[] };
  }
  function printOutput(value){
    var el = document.getElementById('arf77_output');
    if(!el) return;
    try{ el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }catch(_){ el.textContent = String(value); }
  }
  function renderShell(){
    ensureView();
    var registry = readRegistry() || { apps:[] };
    var activeMonth = document.getElementById('activeMonthLabel');
    if(activeMonth && activeMonth.title !== undefined){ activeMonth.title = 'Integrated apps: ' + ((registry.apps || []).length || 0); }
  }
  function collectStaticQa(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button')).map(function(btn){ return { id:btn.id || '', text:(btn.textContent || '').trim(), dataView:btn.getAttribute('data-view') || '', dataJump:btn.getAttribute('data-jump') || '' }; });
    var views = Array.prototype.slice.call(document.querySelectorAll('.view[id^="view-"]')).map(function(v){ return v.id.replace(/^view-/, ''); });
    return { buttons:buttons, views:views, totalButtons:buttons.length, totalViews:views.length };
  }
  window.RoutexAuditReadyConsoleV77 = { ensureView:ensureView, renderShell:renderShell, printOutput:printOutput, collectStaticQa:collectStaticQa };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderShell); else renderShell();
})();