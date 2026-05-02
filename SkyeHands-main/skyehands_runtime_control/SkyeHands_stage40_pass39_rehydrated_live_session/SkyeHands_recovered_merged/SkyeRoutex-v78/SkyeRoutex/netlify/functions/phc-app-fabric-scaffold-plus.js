const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>{ const body=fabric.parseBody(event)||{}; return fabric.ok(fabric.scaffoldPlus(body, body.orgId||'default-org')); };
