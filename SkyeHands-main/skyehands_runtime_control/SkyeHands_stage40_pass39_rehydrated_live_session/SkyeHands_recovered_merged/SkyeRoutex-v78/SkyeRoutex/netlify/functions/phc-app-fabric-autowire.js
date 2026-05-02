const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>fabric.ok(fabric.autowireEstate((fabric.parseBody(event)||{}).orgId||'default-org'));
