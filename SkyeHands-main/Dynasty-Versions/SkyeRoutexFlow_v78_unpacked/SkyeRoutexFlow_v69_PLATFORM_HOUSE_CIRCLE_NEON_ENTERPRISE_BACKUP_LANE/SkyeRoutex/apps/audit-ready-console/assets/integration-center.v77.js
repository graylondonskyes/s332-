(function(){
  function out(v){ if(window.RoutexAuditReadyConsoleV77) window.RoutexAuditReadyConsoleV77.printOutput(v); }
  function rerender(){ if(window.RoutexAuditReadyConsoleV77) window.RoutexAuditReadyConsoleV77.renderShell(); }
  function on(id, fn){ var el = document.getElementById(id); if(el) el.onclick = fn; }
  function bind(){
    if(!window.RoutexSharedAppFabricV77) return;
    on('arf77_refresh', async function(){ var res = await window.RoutexSharedAppFabricV77.refreshRegistry(); out(res.registry || res); rerender(); });
    on('arf77_autodiscover', async function(){ var res = await window.RoutexSharedAppFabricV77.autodiscoverEstate(); out(res.run || res); rerender(); });
    on('arf77_autowire', async function(){ var res = await window.RoutexSharedAppFabricV77.autowireEstate(); out(res.run || res); rerender(); });
    on('arf77_qa', async function(){ var res = await window.RoutexSharedAppFabricV77.runEstateQA(); out(res.audit || res); rerender(); });
    on('arf77_dead_buttons', async function(){ var res = await window.RoutexSharedAppFabricV77.runDeadButtonAudit(); out(res.audit || res); rerender(); });
    on('arf77_certify', async function(){ var res = await window.RoutexSharedAppFabricV77.certifyEstate(); out(res.audit || res); rerender(); });
    on('arf77_scaffold_plus', async function(){ var slug = 'dropin-' + Date.now().toString(36); var res = await window.RoutexSharedAppFabricV77.scaffoldPlus({ slug:slug, title:'Dropin ' + slug }); out(res.output || res); rerender(); });
    on('arf77_rbac_audit', async function(){ await window.RoutexSharedAppFabricV77.seedRbac(); var res = await window.RoutexSharedAppFabricV77.auditRbac(); out(res.audit || res); rerender(); });
    on('arf77_tenant_audit', async function(){ await window.RoutexSharedAppFabricV77.seedTenant(); var res = await window.RoutexSharedAppFabricV77.auditTenant(); out(res.audit || res); rerender(); });
    on('arf77_receipts', async function(){ var res = await window.RoutexSharedAppFabricV77.deploymentReceipts(); out(res.receipts || res); rerender(); });
    on('arf77_zero_s_mount', async function(){ var res = await window.RoutexSharedAppFabricV77.executeZeroSMount(); out(res.mountPlan || res); rerender(); });
  }
  function init(){ if(window.RoutexAuditReadyConsoleV77){ window.RoutexAuditReadyConsoleV77.renderShell(); setTimeout(bind, 30); } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();