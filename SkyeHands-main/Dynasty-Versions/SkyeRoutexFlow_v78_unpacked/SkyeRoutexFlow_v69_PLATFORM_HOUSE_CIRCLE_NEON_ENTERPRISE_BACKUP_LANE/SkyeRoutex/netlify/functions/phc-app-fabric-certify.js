const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>fabric.ok(fabric.certifyEstate((fabric.parseBody(event)||{}).orgId||'default-org'));
