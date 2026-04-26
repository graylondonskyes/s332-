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
  buildRetailCosts,
  normalizeBool,
  normalizeLineItem,
  requiredRecipientMissing,
} = require('./_order');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const storeId = requireEnv('PRINTFUL_STORE_ID');
    const envDefaultConfirm = normalizeBool(process.env.PRINTFUL_ORDER_CONFIRM_DEFAULT, false);
    const body = await readJsonBody(event);

    const confirm = normalizeBool(body.confirm, envDefaultConfirm);
    const recipient = body.recipient || {};
    const missing = requiredRecipientMissing(recipient);
    if (missing.length) {
      return json(event, 400, {
        ok: false,
        error: `Missing recipient fields: ${missing.join(', ')}`,
      });
    }

    const rawItems = Array.isArray(body.items) && body.items.length
      ? body.items
      : [body];

    const normalized = rawItems.map((raw) => normalizeLineItem(raw, body));
    const shipping = String(body.shipping || normalized[0]?.shippingSpeed || 'STANDARD').trim();

    const payload = {
      recipient: buildRecipient(recipient),
      shipping,
      items: normalized.map((entry) => entry.item),
      retail_costs: buildRetailCosts(normalized.map((entry) => entry.quote)),
    };

    if (body.externalOrderId) payload.external_id = String(body.externalOrderId).trim();
    if (body.gift?.subject || body.gift?.message) {
      payload.gift = {
        subject: body.gift.subject ? String(body.gift.subject) : undefined,
        message: body.gift.message ? String(body.gift.message) : undefined,
      };
    }
    if (body.packingSlip && typeof body.packingSlip === 'object') {
      payload.packing_slip = body.packingSlip;
    }

    const query = `?confirm=${encodeURIComponent(String(confirm))}`;
    const data = await callPrintful({
      path: `/orders${query}`,
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
