(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V60__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V60__ = true;

  const KEY = 'skye_routex_platform_house_circle_tours_v60';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const toastFn = typeof toast === 'function' ? toast : function(){};
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(_){ return {}; } }
  function write(v){ localStorage.setItem(KEY, JSON.stringify(v || {})); return v; }

  function body(){
    return `
      <div class="hint">V60 adds four real lanes inside the same shell.</div>
      <div class="sep"></div>
      <div class="list">
        <div class="item"><div class="meta"><div class="name">1. Local operator RBAC</div><div class="sub">Switch operators and constrain actions by role without leaving Routex.</div></div></div>
        <div class="item"><div class="meta"><div class="name">2. Join packets + check-ins</div><div class="sub">Generate packets, export SVG join cards, redeem member check-ins, and deep-link into the hospitality lane.</div></div></div>
        <div class="item"><div class="meta"><div class="name">3. POS logging</div><div class="sub">Log revenue directly into location and guest history or import a JSON batch.</div></div></div>
        <div class="item"><div class="meta"><div class="name">4. Unified audit lane</div><div class="sub">Operator changes, check-ins, POS activity, and bridge actions are now recorded together.</div></div></div>
      </div>
      <div class="sep"></div>
      <div class="hint">Strongest next move after this pass: shared server persistence + live QR/POS adapters so these local lanes can sync across devices.</div>`;
  }

  function openTour(){
    if(typeof openModal !== 'function') return;
    openModal('Platform House V60 guide', body(), `<button class="btn" id="hc60_tour_dont_show">Do not auto-open</button><button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`);
    const btn = document.getElementById('hc60_tour_dont_show');
    if(btn) btn.onclick = function(){ const st = read(); st.dismissed = true; write(st); toastFn('V60 guide dismissed.', 'good'); document.getElementById('modalClose').click(); };
  }

  function injectButton(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    const toolbar = document.querySelector('#content .row') || document.querySelector('.topbar .row');
    if(!toolbar || document.getElementById('hc60_tour_btn')) return;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'hc60_tour_btn';
    btn.textContent = 'V60 guide';
    btn.onclick = openTour;
    toolbar.appendChild(btn);
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V60_TOUR_RENDER__) return;
    window.__ROUTEX_HC_V60_TOUR_RENDER__ = true;
    const prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      const out = await prev.apply(this, arguments);
      setTimeout(function(){ try{ injectButton(); }catch(_){ } }, 0);
      return out;
    };
  }

  function init(){
    patchRender();
    setTimeout(function(){
      try{
        injectButton();
        const st = read();
        if(!(st && st.dismissed) && typeof APP !== 'undefined' && APP && APP.view === 'platform-house') openTour();
      }catch(_){ }
    }, 140);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
