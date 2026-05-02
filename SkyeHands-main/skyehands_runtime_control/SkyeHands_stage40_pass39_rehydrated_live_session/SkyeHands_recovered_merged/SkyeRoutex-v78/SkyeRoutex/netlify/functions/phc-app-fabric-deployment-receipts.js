const fabric=require('./_lib/platform-app-fabric'); exports.handler=async(event)=>fabric.ok(fabric.deploymentReceipts((fabric.parseBody(event)||{}).orgId||'default-org'));
