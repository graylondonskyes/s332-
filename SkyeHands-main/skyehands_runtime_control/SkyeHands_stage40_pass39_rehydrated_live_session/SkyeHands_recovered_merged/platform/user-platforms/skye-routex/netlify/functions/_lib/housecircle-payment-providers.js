const crypto = require('crypto');
const { clean, compact, num, uid, nowISO, clone, queueJob, pushEvent } = require('./housecircle-cloud-store');
const { boolEnv } = require('./housecircle-runtime-guard');
function cents(v){ return Math.max(0, Math.round(Number(v || 0))); }
function money(body){ return { amount:cents(body.amount || body.amountCents || body.totalCents), currency:compact(body.currency || 'USD').toUpperCase() }; }
function providerName(body){ return clean(body.provider || body.processor || 'stripe').toLowerCase(); }
function networkAllowed(){ return boolEnv('PHC_ALLOW_PROVIDER_NETWORK'); }
function getEnv(name){ return clean(process.env[name] || ''); }
function providerConfig(provider){
  const p = clean(provider).toLowerCase();
  if(p === 'stripe') return { provider:p, configured:!!getEnv('STRIPE_SECRET_KEY'), secret:getEnv('STRIPE_SECRET_KEY'), endpoint:'https://api.stripe.com/v1/payment_intents', refundEndpoint:'https://api.stripe.com/v1/refunds', missing:getEnv('STRIPE_SECRET_KEY') ? [] : ['STRIPE_SECRET_KEY'] };
  if(p === 'square') return { provider:p, configured:!!(getEnv('SQUARE_ACCESS_TOKEN') && getEnv('SQUARE_LOCATION_ID')), secret:getEnv('SQUARE_ACCESS_TOKEN'), locationId:getEnv('SQUARE_LOCATION_ID'), endpoint:'https://connect.squareup.com/v2/payments', refundEndpoint:'https://connect.squareup.com/v2/refunds', missing:[!getEnv('SQUARE_ACCESS_TOKEN') && 'SQUARE_ACCESS_TOKEN', !getEnv('SQUARE_LOCATION_ID') && 'SQUARE_LOCATION_ID'].filter(Boolean) };
  if(p === 'paypal') return { provider:p, configured:!!(getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET')), endpoint:'https://api-m.paypal.com/v2/checkout/orders', refundEndpoint:'https://api-m.paypal.com/v2/payments/captures/{capture_id}/refund', missing:[!getEnv('PAYPAL_CLIENT_ID') && 'PAYPAL_CLIENT_ID', !getEnv('PAYPAL_CLIENT_SECRET') && 'PAYPAL_CLIENT_SECRET'].filter(Boolean) };
  return { provider:p, configured:false, missing:['unsupported_provider'], error:'Unsupported payment provider.' };
}
function providerHealth(){ return ['stripe','square','paypal'].map((p)=>{ const cfg=providerConfig(p); return { provider:p, configured:cfg.configured, missing:cfg.missing||[], networkAllowed:networkAllowed(), liveExecutionReady:!!(cfg.configured && networkAllowed()) }; }); }
function idempotencyKey(input){ return clean(input.idempotencyKey || input.orderId || input.intentId) || uid('idem'); }
function safePreview(value){ const out=clone(value||{}); if(out.headers && out.headers.Authorization) out.headers.Authorization='Bearer ***'; return out; }
async function providerFetch(url, options){
  if(!networkAllowed()) return { ok:false, statusCode:503, networkBlocked:true, reason:'Provider network calls are blocked until PHC_ALLOW_PROVIDER_NETWORK=1 is set.' };
  if(typeof fetch !== 'function') return { ok:false, statusCode:503, reason:'fetch is not available in this runtime.' };
  const res = await fetch(url, options); const text = await res.text(); let body; try{ body=text?JSON.parse(text):{}; }catch(_){ body={ raw:text }; }
  return { ok:res.ok, statusCode:res.status, body };
}
function buildStripeIntent(body){ const m=money(body); const params=new URLSearchParams(); params.set('amount',String(m.amount)); params.set('currency',m.currency.toLowerCase()); params.set('description',compact(body.description || body.memo || 'SkyeRoutex service payment')); params.set('metadata[orgId]', clean(body.orgId || 'default-org')); if(clean(body.customerEmail)) params.set('receipt_email',clean(body.customerEmail)); return { amount:m.amount, currency:m.currency, body:params.toString(), contentType:'application/x-www-form-urlencoded' }; }
function buildSquareIntent(body,cfg){ const m=money(body); return { amount:m.amount, currency:m.currency, body:JSON.stringify({ idempotency_key:idempotencyKey(body), source_id:clean(body.sourceId || body.nonce || 'cnon:card-nonce-required'), amount_money:{ amount:m.amount, currency:m.currency }, location_id:cfg.locationId, note:compact(body.description || 'SkyeRoutex service payment'), reference_id:clean(body.orderId || '') }), contentType:'application/json' }; }
function buildPaypalOrder(body){ const m=money(body); return { amount:m.amount, currency:m.currency, body:JSON.stringify({ intent:'CAPTURE', purchase_units:[{ reference_id:clean(body.orderId || idempotencyKey(body)), description:compact(body.description || 'SkyeRoutex service payment'), amount:{ currency_code:m.currency, value:(m.amount/100).toFixed(2) } }] }), contentType:'application/json' }; }
async function createPaymentIntent(input, context){
  const body=input||{}; const provider=providerName(body); const cfg=providerConfig(provider); const intentId=uid('pay_intent');
  if(!cfg.configured) return { ok:false, statusCode:503, provider, intentId, error:'Payment provider is not configured.', missing:cfg.missing || [] };
  let request;
  if(provider==='stripe'){ const built=buildStripeIntent(body); request={ url:cfg.endpoint, method:'POST', headers:{ Authorization:'Bearer '+cfg.secret, 'Content-Type':built.contentType, 'Idempotency-Key':idempotencyKey(body) }, body:built.body, amount:built.amount, currency:built.currency }; }
  else if(provider==='square'){ const built=buildSquareIntent(body,cfg); request={ url:cfg.endpoint, method:'POST', headers:{ Authorization:'Bearer '+cfg.secret, 'Content-Type':built.contentType, 'Square-Version':clean(process.env.SQUARE_VERSION || '2026-02-19') }, body:built.body, amount:built.amount, currency:built.currency }; }
  else if(provider==='paypal'){ const built=buildPaypalOrder(body); request={ url:cfg.endpoint, method:'POST', headers:{ 'Content-Type':built.contentType }, body:built.body, amount:built.amount, currency:built.currency, requiresOauth:true }; }
  else return { ok:false, statusCode:400, provider, intentId, error:'Unsupported payment provider.' };
  const ledger={ id:intentId, type:'payment_intent', provider, status:'prepared', amount:request.amount, currency:request.currency, orderId:clean(body.orderId), operatorId:clean(context && context.operatorId), createdAt:nowISO(), updatedAt:nowISO(), requestPreview:safePreview({ url:request.url, method:request.method, headers:request.headers }) };
  const execution=await providerFetch(request.url,{ method:request.method, headers:request.headers, body:request.body });
  if(!execution.ok){ ledger.status=execution.networkBlocked?'network-blocked':'provider-error'; ledger.error=execution.reason || (execution.body && execution.body.error && execution.body.error.message) || 'Provider request failed.'; return { ok:false, statusCode:execution.statusCode || 502, provider, intentId, ledger, execution }; }
  ledger.status='provider-created'; ledger.providerResponse=execution.body; return { ok:true, statusCode:200, provider, intentId, ledger, execution };
}
async function createRefundIntent(input, context){
  const body=input||{}; const provider=providerName(body); const cfg=providerConfig(provider); const refundId=uid('refund');
  if(!cfg.configured) return { ok:false, statusCode:503, provider, refundId, error:'Refund provider is not configured.', missing:cfg.missing || [] };
  const m=money(body); let request;
  if(provider==='stripe'){ const params=new URLSearchParams(); params.set('payment_intent', clean(body.paymentIntentId || body.providerPaymentId)); params.set('amount', String(m.amount)); request={ url:cfg.refundEndpoint, method:'POST', headers:{ Authorization:'Bearer '+cfg.secret, 'Content-Type':'application/x-www-form-urlencoded', 'Idempotency-Key':idempotencyKey(body) }, body:params.toString(), amount:m.amount, currency:m.currency }; }
  else if(provider==='square'){ request={ url:cfg.refundEndpoint, method:'POST', headers:{ Authorization:'Bearer '+cfg.secret, 'Content-Type':'application/json', 'Square-Version':clean(process.env.SQUARE_VERSION || '2026-02-19') }, body:JSON.stringify({ idempotency_key:idempotencyKey(body), payment_id:clean(body.paymentId || body.providerPaymentId), amount_money:{ amount:m.amount, currency:m.currency }, reason:compact(body.reason || 'operator refund') }), amount:m.amount, currency:m.currency }; }
  else if(provider==='paypal'){ request={ url:cfg.refundEndpoint.replace('{capture_id}', clean(body.captureId || body.providerPaymentId)), method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ amount:{ currency_code:m.currency, value:(m.amount/100).toFixed(2) }, note_to_payer:compact(body.reason || 'operator refund') }), amount:m.amount, currency:m.currency, requiresOauth:true }; }
  else return { ok:false, statusCode:400, provider, refundId, error:'Unsupported refund provider.' };
  const ledger={ id:refundId, type:'refund_intent', provider, status:'prepared', amount:request.amount, currency:request.currency, paymentRef:clean(body.paymentIntentId || body.paymentId || body.captureId || body.providerPaymentId), operatorId:clean(context && context.operatorId), createdAt:nowISO(), updatedAt:nowISO(), requestPreview:safePreview({ url:request.url, method:request.method, headers:request.headers }) };
  const execution=await providerFetch(request.url,{ method:request.method, headers:request.headers, body:request.body });
  if(!execution.ok){ ledger.status=execution.networkBlocked?'network-blocked':'provider-error'; ledger.error=execution.reason || 'Provider refund request failed.'; return { ok:false, statusCode:execution.statusCode || 502, provider, refundId, ledger, execution }; }
  ledger.status='provider-created'; ledger.providerResponse=execution.body; return { ok:true, statusCode:200, provider, refundId, ledger, execution };
}
function appendPaymentLedger(state,row){ state.paymentLedger=Array.isArray(state.paymentLedger)?state.paymentLedger:[]; const next={ ...(row||{}), updatedAt:nowISO() }; state.paymentLedger=[next].concat(state.paymentLedger.filter((item)=>clean(item.id)!==clean(next.id))).slice(0,500); pushEvent(state,{ kind:next.type || 'payment_ledger', note:'Payment provider ledger row recorded.', detail:{ id:next.id, provider:next.provider, status:next.status } }); if(next.status==='provider-created') queueJob(state,{ type:next.type || 'payment_provider', provider:next.provider, refId:next.id, status:'queued', payload:{ id:next.id, status:next.status } }); return next; }
function verifyStripeSignature(event){
  const secret=clean(process.env.STRIPE_WEBHOOK_SECRET || process.env.PHC_STRIPE_WEBHOOK_SECRET || ''); if(!secret) return { ok:false, statusCode:503, error:'STRIPE_WEBHOOK_SECRET is not configured.' };
  const h=event.headers || {}; const header=clean(h['stripe-signature'] || h['Stripe-Signature'] || h['STRIPE-SIGNATURE']); if(!header) return { ok:false, statusCode:401, error:'Missing Stripe-Signature header.' };
  const parts={}; header.split(',').forEach((p)=>{ const i=p.indexOf('='); if(i>0) parts[clean(p.slice(0,i))]=clean(p.slice(i+1)); }); const t=parts.t, v1=parts.v1; if(!t || !v1) return { ok:false, statusCode:401, error:'Malformed Stripe signature header.' };
  const tolerance=Math.max(60, Number(process.env.PHC_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS || 300)); if(Math.abs(Date.now()/1000 - Number(t)) > tolerance) return { ok:false, statusCode:401, error:'Stripe webhook timestamp outside tolerance.' };
  const expected=crypto.createHmac('sha256', secret).update(t+'.'+(event.body || '')).digest('hex'); const a=Buffer.from(v1); const b=Buffer.from(expected); if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return { ok:false, statusCode:401, error:'Invalid Stripe webhook signature.' };
  return { ok:true, mode:'stripe-v1-hmac' };
}

async function paypalAccessToken(){
  const clientId = getEnv('PAYPAL_CLIENT_ID');
  const secret = getEnv('PAYPAL_CLIENT_SECRET');
  if(!clientId || !secret) return { ok:false, statusCode:503, error:'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.' };
  const base = providerConfig('paypal').base;
  const auth = Buffer.from(clientId + ':' + secret).toString('base64');
  const res = await providerFetch(base + '/v1/oauth2/token', { method:'POST', headers:{ Authorization:'Basic ' + auth, 'Content-Type':'application/x-www-form-urlencoded' }, body:'grant_type=client_credentials' });
  if(!res.ok) return { ok:false, statusCode:res.statusCode || 502, error:res.reason || 'PayPal OAuth token request failed.', execution:res };
  const token = res.body && res.body.access_token;
  if(!token) return { ok:false, statusCode:502, error:'PayPal OAuth response did not include access_token.', execution:res };
  return { ok:true, accessToken:token };
}

async function verifyPaypalWebhook(event){
  const webhookId=clean(process.env.PAYPAL_WEBHOOK_ID || process.env.PHC_PAYPAL_WEBHOOK_ID || ''); if(!webhookId) return { ok:false, statusCode:503, error:'PAYPAL_WEBHOOK_ID is not configured.' };
  const h=event.headers || {}; const required=['paypal-transmission-id','paypal-transmission-time','paypal-cert-url','paypal-auth-algo','paypal-transmission-sig']; const missing=required.filter((name)=>!clean(h[name] || h[name.toUpperCase()])); if(missing.length) return { ok:false, statusCode:401, error:'Missing PayPal webhook signature headers.', missing };
  if(!networkAllowed()) return { ok:false, statusCode:503, error:'PayPal webhook verification requires PHC_ALLOW_PROVIDER_NETWORK=1 because PayPal verification is server-to-server.', verificationReady:true };
  if(!(getEnv('PAYPAL_CLIENT_ID') && getEnv('PAYPAL_CLIENT_SECRET'))) return { ok:false, statusCode:503, error:'PayPal credentials are required for webhook verification.', verificationReady:true };
  let body = {}; try{ body = event.body ? JSON.parse(event.body) : {}; }catch(_){ return { ok:false, statusCode:400, error:'Invalid PayPal webhook JSON body.' }; }
  const token = await paypalAccessToken();
  if(!token.ok) return { ...token, verificationReady:true };
  const base = providerConfig('paypal').base;
  const payload = {
    auth_algo: clean(h['paypal-auth-algo'] || h['PAYPAL-AUTH-ALGO']),
    cert_url: clean(h['paypal-cert-url'] || h['PAYPAL-CERT-URL']),
    transmission_id: clean(h['paypal-transmission-id'] || h['PAYPAL-TRANSMISSION-ID']),
    transmission_sig: clean(h['paypal-transmission-sig'] || h['PAYPAL-TRANSMISSION-SIG']),
    transmission_time: clean(h['paypal-transmission-time'] || h['PAYPAL-TRANSMISSION-TIME']),
    webhook_id: webhookId,
    webhook_event: body
  };
  const verified = await providerFetch(base + '/v1/notifications/verify-webhook-signature', { method:'POST', headers:{ Authorization:'Bearer ' + token.accessToken, 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
  if(!verified.ok) return { ok:false, statusCode:verified.statusCode || 502, error:verified.reason || 'PayPal webhook verification request failed.', verificationReady:true, execution:verified };
  const status = clean(verified.body && verified.body.verification_status).toUpperCase();
  if(status !== 'SUCCESS') return { ok:false, statusCode:401, error:'PayPal webhook signature verification failed.', verificationStatus:status || 'UNKNOWN' };
  return { ok:true, mode:'paypal-verify-webhook-signature', verificationStatus:status };
}
module.exports={ providerConfig, providerHealth, createPaymentIntent, createRefundIntent, appendPaymentLedger, verifyStripeSignature, verifyPaypalWebhook, paypalAccessToken };
