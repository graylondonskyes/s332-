(function(){
  const KEY = 'printful.command.desk.v1';
  const $ = (sel) => document.querySelector(sel);
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '{"orders":[],"assets":[]}'); } catch { return { orders: [], assets: [] }; } }
  function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function money(n){ return '$' + Number(n || 0).toLocaleString(); }
  function render(){
    const state = load();
    const stats = window.PrintfulLocalRuntime.profitability(state);
    $('#pfStats').innerHTML = `<div class="stats-grid"><div><span>Orders</span><strong>${stats.orders}</strong></div><div><span>Approved</span><strong>${stats.approved}</strong></div><div><span>Production</span><strong>${stats.production}</strong></div><div><span>Revenue</span><strong>${money(stats.revenue)}</strong></div><div><span>Profit</span><strong>${money(stats.profit)}</strong></div></div>`;
    $('#pfOrders').innerHTML = state.orders.map(order => `<article class="row-card"><div><strong>${order.customer}</strong><div class="muted">${order.productName} · qty ${order.quantity} · ${order.stage}</div></div><div class="row-actions"><button class="btn" data-advance="${order.id}">Advance</button><button class="btn" data-asset="${order.id}">Add art packet</button></div></article>`).join('') || '<div class="row-card"><div><strong>No draft orders yet</strong><div class="muted">Create one below.</div></div></div>';
    $('#pfAssets').innerHTML = state.assets.map(item => `<div class="row-card"><div><strong>${item.assetName}</strong><div class="muted">Order ${item.orderId} · revision ${item.revision}</div></div></div>`).join('') || '<div class="row-card"><div><strong>No art packets yet</strong></div></div>';
    document.querySelectorAll('[data-advance]').forEach(btn => btn.onclick = () => advance(btn.dataset.advance));
    document.querySelectorAll('[data-asset]').forEach(btn => btn.onclick = () => addAsset(btn.dataset.asset));
  }
  function createOrder(){ save(window.PrintfulLocalRuntime.addDraftOrder(load(), { customer: $('#pfCustomer').value, sku: $('#pfSku').value, quantity: Number($('#pfQty').value || 1) })); render(); }
  function advance(id){ const state = load(); const order = state.orders.find(item => item.id === id); if (!order) return; const flow = ['draft','approved','in-production','ready-to-ship','shipped']; const nextStage = flow[Math.min(flow.indexOf(order.stage) + 1, flow.length - 1)]; save(window.PrintfulLocalRuntime.moveOrder(state, id, nextStage)); render(); }
  function addAsset(id){ const state = load(); save(window.PrintfulLocalRuntime.addArtPacket(state, { orderId:id, assetName:'operator-art-packet', revision: state.assets.filter(item => item.orderId === id).length + 1 })); render(); }
  document.addEventListener('DOMContentLoaded', () => { const state = load(); if (!state.orders.length) save(window.PrintfulLocalRuntime.addDraftOrder(state, { customer:'Demo Merch Client', sku:'hoodie-midnight', quantity:2 })); document.getElementById('pfCreate')?.addEventListener('click', createOrder); render(); });
})();
