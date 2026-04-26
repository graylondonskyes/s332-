window.PrintfulLocalRuntime = (() => { const module = { exports: {} };
'use strict';
const DEFAULT_PRODUCTS = [
  { sku:'tee-black', name:'Premium Tee — Black', cost:18, price:34, category:'apparel' },
  { sku:'tee-cream', name:'Premium Tee — Cream', cost:18, price:34, category:'apparel' },
  { sku:'hoodie-midnight', name:'Midnight Hoodie', cost:31, price:58, category:'apparel' },
  { sku:'mug-sigil', name:'Sigil Mug', cost:9, price:24, category:'drinkware' }
];
function uid(prefix='order'){ return `${prefix}_${Math.random().toString(16).slice(2,10)}_${Date.now().toString(16)}`; }
function getProducts(){ return DEFAULT_PRODUCTS.map(item => ({...item})); }
function createState(seed = {}) { return { orders: Array.isArray(seed.orders) ? seed.orders.slice() : [], assets: Array.isArray(seed.assets) ? seed.assets.slice() : [] }; }
function createDraftOrder(input = {}) {
  const product = getProducts().find(item => item.sku === input.sku) || getProducts()[0];
  const quantity = Math.max(1, Number(input.quantity || 1));
  const price = Number(input.price || product.price);
  const cost = Number(input.cost || product.cost);
  return { id: String(input.id || uid('order')), customer: String(input.customer || 'Demo Client').trim(), sku: product.sku, productName: product.name, quantity, price, cost, stage: String(input.stage || 'draft'), artPacketReady: Boolean(input.artPacketReady), createdAt: String(input.createdAt || new Date().toISOString()), history: Array.isArray(input.history) ? input.history.slice() : [{ stage: String(input.stage || 'draft'), at: new Date().toISOString() }] };
}
function addDraftOrder(state = {}, input = {}) { const next = createState(state); next.orders.unshift(createDraftOrder(input)); return next; }
function moveOrder(state = {}, orderId, stage) { const next = createState(state); next.orders = next.orders.map(order => order.id === orderId ? { ...order, stage, history: [...order.history, { stage, at: new Date().toISOString() }] } : order); return next; }
function addArtPacket(state = {}, input = {}) { const next = createState(state); next.assets.unshift({ id: uid('asset'), orderId: String(input.orderId || ''), assetName: String(input.assetName || 'art-packet').trim(), revision: Number(input.revision || 1), createdAt: new Date().toISOString() }); next.orders = next.orders.map(order => order.id === input.orderId ? { ...order, artPacketReady:true } : order); return next; }
function profitability(state = {}) { const next = createState(state); const revenue = next.orders.reduce((sum, item) => sum + (item.price * item.quantity), 0); const cost = next.orders.reduce((sum, item) => sum + (item.cost * item.quantity), 0); return { orders: next.orders.length, revenue, cost, profit: revenue - cost, approved: next.orders.filter(item => ['approved','in-production','ready-to-ship','shipped'].includes(item.stage)).length, production: next.orders.filter(item => ['in-production','ready-to-ship'].includes(item.stage)).length, artPackets: next.assets.length }; }
module.exports = { DEFAULT_PRODUCTS, getProducts, createState, addDraftOrder, moveOrder, addArtPacket, profitability };

return module.exports; })();
