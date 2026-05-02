const {
  assertMethod,
  callPrintful,
  json,
  noContent,
  readJsonBody,
  requireEnv,
} = require('./_printful');
const {
  buildRecipient,
  normalizeBool,
  normalizeLineItem,
  normalizeSourceToItems,
  requiredRecipientMissing,
} = require('./_order');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const storeId = requireEnv('PRINTFUL_STORE_ID');
    const envDefaultConfirm = normalizeBool(process.env.PRINTFUL_ORDER_CONFIRM_DEFAULT, false);
    const body = await readJsonBody(event);
    const source = body.lockedOrder || body.source || body;
    const confirm = normalizeBool(body.confirm ?? source.confirm, envDefaultConfirm);
    const recipient = source.customer || source.recipient || body.recipient || {};
    const missing = requiredRecipientMissing(recipient);
    if (missing.length) {
      return json(event, 400, {
        ok: false,
        error: `Missing recipient fields: ${missing.join(', ')}`,
      });
    }

    const rawItems = normalizeSourceToItems(source);
    if (!rawItems.length) {
      return json(event, 400, {
        ok: false,
        error: 'No promotable items found.',
      });
    }

    const normalized = rawItems.map((raw) => normalizeLineItem(raw, source));
    const shipping = String(body.shipping || source.shipping || normalized[0]?.shippingSpeed || 'STANDARD').trim();
    const totals = source.totals || {};

    const payload = {
      recipient: buildRecipient(recipient),
      shipping,
      items: normalized.map((entry) => entry.item),
      retail_costs: {
        currency: totals.currency || normalized[0]?.quote?.currency || 'USD',
        subtotal: String(totals.subtotal ?? normalized.reduce((sum, entry) => sum + Number(entry.quote.subtotal || 0), 0)),
        discount: String(totals.discountAmount ?? 0),
        shipping: String(totals.shippingFee ?? normalized.reduce((sum, entry) => sum + Number(entry.quote.shippingFee || 0), 0)),
        tax: String(totals.estimatedTax ?? normalized.reduce((sum, entry) => sum + Number(entry.quote.estimatedTax || 0), 0)),
      },
    };

    if (body.externalOrderId || source.lockedOrderId || source.bundleId || source.packetId) {
      payload.external_id = String(body.externalOrderId || source.lockedOrderId || source.bundleId || source.packetId).trim();
    }

    const data = await callPrintful({
      path: `/orders?confirm=${encodeURIComponent(String(confirm))}`,
      method: 'POST',
      version: 'v1',
      headers: {
        'X-PF-Store-Id': String(storeId),
      },
      body: payload,
    });

    return json(event, 200, {
      ok: true,
      confirm,
      promotedFrom: source.lockedOrderId || source.bundleId || source.packetId || null,
      quotes: normalized.map((entry) => entry.quote),
      result: data?.result || data || null,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
      printful: error.printful || null,
    });
  }
};
