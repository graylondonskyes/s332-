const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>fabric.ok(fabric.runEstateQA((fabric.parseBody(event)||{}).orgId||'default-org'));
