const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { calculateQuote, findPlacement, findProduct, findVariant } = require('./_storefront');

function sanitizeString(value) {
  return String(value || '').trim();
}

function normalizeRecipient(input = {}) {
  return {
    name: sanitizeString(input.name),
    company: sanitizeString(input.company),
    email: sanitizeString(input.email),
    phone: sanitizeString(input.phone),
    address1: sanitizeString(input.address1),
    address2: sanitizeString(input.address2),
    city: sanitizeString(input.city),
    state_code: sanitizeString(input.state_code),
    zip: sanitizeString(input.zip),
    country_code: sanitizeString(input.country_code || 'US').toUpperCase(),
  };
}

function makePacketId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const productKey = sanitizeString(body.productKey);
    const variantRef = body.variantId != null ? String(body.variantId) : sanitizeString(body.variantKey);
    const quantity = Math.max(1, Number(body.quantity || 1));
    const extraLogoCount = Math.max(1, Number(body.extraLogoCount || 1));
    const rush = Boolean(body.rush);
    const printMethod = sanitizeString(body.printMethod || 'print');
    const shippingSpeed = sanitizeString(body.shippingSpeed || body.shipping || 'STANDARD').toUpperCase();
    const placementKey = sanitizeString(body.placementKey || body.placement);

    const product = findProduct(productKey);
    const variant = findVariant(productKey, variantRef);
    if (!product || !variant) {
      return json(event, 400, {
        ok: false,
        error: 'Valid productKey and variantKey are required.',
      });
    }

    const quote = calculateQuote({
      productKey,
      variantId: variantRef,
      quantity,
      extraLogoCount,
      rush,
      shippingSpeed,
      printMethod,
      placementKey,
    });

    const recipient = normalizeRecipient(body.recipient || {});
    const placement = findPlacement(product, quote.placementKey);

    const packet = {
      packetId: makePacketId(),
      createdAt: new Date().toISOString(),
      orderMode: body.orderMode === 'live' ? 'live' : 'intake',
      externalProductId: sanitizeString(body.externalProductId),
      templateId: body.templateId ? String(body.templateId) : '',
      customer: recipient,
      product: {
        key: product.key,
        title: product.title,
        description: product.description || '',
        variantKey: variant.key,
        variantLabel: variant.label,
        variantId: variant.variantId ?? null,
        quantity: quote.quantity,
        minimumQuantity: quote.minimumQuantity,
        printMethod: quote.printMethod,
        printMethodLabel: quote.printMethodLabel,
        placementKey: quote.placementKey,
        placementLabel: quote.placementLabel,
        placement,
      },
      artwork: {
        localLogoAttached: Boolean(body.localLogoAttached),
        localPreviewTransform: body.localPreviewTransform || null,
        textLine1: sanitizeString(body.textLine1),
        textLine2: sanitizeString(body.textLine2),
        textColor: sanitizeString(body.textColor || '#ffffff'),
        notes: sanitizeString(body.designNotes),
        sizeBreakdown: sanitizeString(body.sizeBreakdown),
      },
      pricing: quote,
      logistics: {
        shippingSpeed: quote.shippingSpeed,
        shippingLabel: quote.shippingLabel,
        turnaround: quote.turnaround,
        turnaroundLabel: quote.turnaroundLabel,
        eventDate: sanitizeString(body.eventDate),
      },
      notes: {
        customerNotes: sanitizeString(body.customerNotes),
        internalNotes: sanitizeString(body.internalNotes),
      },
      summaryLines: [
        `${product.title} · ${variant.label}`,
        `${quote.quantity} unit(s) · ${quote.printMethodLabel}`,
        `${quote.shippingLabel} shipping · ${quote.turnaroundLabel}`,
        `Total ${quote.currency} ${quote.total.toFixed(2)} · Deposit ${quote.currency} ${quote.depositDue.toFixed(2)}`,
      ],
    };

    return json(event, 200, {
      ok: true,
      packet,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
