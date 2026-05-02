(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V59__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V59__ = true;

  const TOUR_KEY = 'skye_routex_platform_house_circle_tour_v59';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const toastFn = (typeof toast === 'function') ? toast : function(){};

  function readTourState(){
    try{ return JSON.parse(localStorage.getItem(TOUR_KEY) || '{}'); }catch(_){ return {}; }
  }
  function writeTourState(value){ localStorage.setItem(TOUR_KEY, JSON.stringify(value || {})); }

  function openIntro(){
    if(typeof openModal !== 'function') return;
    openModal(
      'Platform House Circle',
      '<div class="hint">This lane makes House Circle native to SkyeRoutexFlow. Locations, guests, campaigns, events, drops, route follow-up tasks, and live route missions now speak through one shell and one data spine.</div>' +
      '<div class="sep"></div>' +
      '<div class="list">' +
      '<div class="item"><div class="meta"><div class="name">1. Shared locations</div><div class="sub">Venues become shared platform records instead of separate app rows.</div></div></div>' +
      '<div class="item"><div class="meta"><div class="name">2. Guest ledger</div><div class="sub">Relationship intelligence now lives with route ops.</div></div></div>' +
      '<div class="item"><div class="meta"><div class="name">3. Hospitality → Routex bridge</div><div class="sub">Events, campaigns, and drops can become Routex tasks or full route missions.</div></div></div>' +
      '<div class="item"><div class="meta"><div class="name">4. Routex → Hospitality writeback</div><div class="sub">Stop outcomes write back into Platform House history.</div></div></div>' +
      '</div>',
      '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button><button class="btn primary" id="hc_tour_ack">Got it</button>'
    );
    const ack = document.getElementById('hc_tour_ack');
    if(ack) ack.onclick = function(){
      const state = readTourState();
      state.seenIntro = true;
      writeTourState(state);
      if(typeof closeModal === 'function') closeModal();
      toastFn('Platform House intro saved.', 'good');
    };
  }

  function injectHelpButton(){
    if(document.getElementById('hcTourHelpBtn')) return;
    const target = document.querySelector('.topbar .row') || document.querySelector('.topbar');
    if(!target) return;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'hcTourHelpBtn';
    btn.textContent = 'Platform House intro';
    btn.onclick = openIntro;
    target.insertBefore(btn, target.firstChild);
  }

  function init(){
    injectHelpButton();
    const state = readTourState();
    if(!state.seenIntro && location.hash.replace('#','') === 'platform-house'){
      setTimeout(openIntro, 120);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
