const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>fabric.ok(fabric.exportZeroSPack((fabric.parseBody(event)||{}).orgId||'default-org'));
