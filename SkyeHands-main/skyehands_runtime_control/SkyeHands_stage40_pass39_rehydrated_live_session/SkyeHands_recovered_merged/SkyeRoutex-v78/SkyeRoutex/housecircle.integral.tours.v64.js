(function(){
  if(window.__ROUTEX_HOUSECIRCLE_TOURS_V64__) return;
  window.__ROUTEX_HOUSECIRCLE_TOURS_V64__ = true;
  function boot(){
    if(!window.RoutexPlatformHouseCircleV64) return setTimeout(boot, 60);
    window.RoutexPlatformHouseCircleV64Tour = {
      steps: [
        'V64 adds a server-side lane through shipped Netlify functions.',
        'Cloud control handles signed operator login, snapshot push/pull, and outbox replay.',
        'Server frame ingest turns local replica frames into remote merge operations.',
        'Server job drain processes queued POS ingests and Square-style webhook jobs.',
        'This still respects the local-first stack: cloud is additive, not a replacement.'
      ]
    };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
