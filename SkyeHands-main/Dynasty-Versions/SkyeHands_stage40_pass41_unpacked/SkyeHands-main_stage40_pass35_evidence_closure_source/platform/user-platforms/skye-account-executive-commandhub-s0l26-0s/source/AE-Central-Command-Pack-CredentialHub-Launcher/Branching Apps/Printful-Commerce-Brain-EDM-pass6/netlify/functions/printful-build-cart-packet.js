const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { calculateQuote, findPlacement, findProduct, findVariant, money } = require('./_storefront');

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

function makeBundleId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) {
      return json(event, 400, {
        ok: false,
        error: 'At least one cart item is required.',
      });
    }

    const items = rawItems.map((raw, index) => {
      const productKey = sanitizeString(raw.productKey);
      const variantRef = raw.variantId != null ? String(raw.variantId) : sanitizeString(raw.variantKey);
      const quantity = Math.max(1, Number(raw.quantity || 1));
      const extraLogoCount = Math.max(1, Number(raw.extraLogoCount || 1));
      const rush = Boolean(raw.rush);
      const printMethod = sanitizeString(raw.printMethod || 'print');
      const shippingSpeed = sanitizeString(raw.shippingSpeed || raw.shipping || 'STANDARD').toUpperCase();
      const placementKey = sanitizeString(raw.placementKey || raw.placement);

      const product = findProduct(productKey);
      const variant = findVariant(productKey, variantRef);
      if (!product || !variant) {
        const error = new Error(`Invalid cart item at index ${index}.`);
        error.statusCode = 400;
        throw error;
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

      return {
        lineId: `line-${index + 1}`,
        externalProductId: sanitizeString(raw.externalProductId),
        templateId: raw.templateId ? String(raw.templateId) : '',
        product: {
          key: product.key,
          title: product.title,
          description: product.description || '',
          variantKey: variant.key,
          variantLabel: variant.label,
          variantId: variant.variantId ?? null,
          printMethod: quote.printMethod,
          printMethodLabel: quote.printMethodLabel,
          placementKey: quote.placementKey,
          placementLabel: quote.placementLabel,
          placement: findPlacement(product, quote.placementKey),
        },
        artwork: {
          localLogoAttached: Boolean(raw.localLogoAttached),
          localPreviewTransform: raw.localPreviewTransform || null,
          textLine1: sanitizeString(raw.textLine1),
          textLine2: sanitizeString(raw.textLine2),
          textColor: sanitizeString(raw.textColor || '#ffffff'),
          notes: sanitizeString(raw.designNotes),
          sizeBreakdown: sanitizeString(raw.sizeBreakdown),
        },
        logistics: {
          shippingSpeed: quote.shippingSpeed,
          shippingLabel: quote.shippingLabel,
          turnaround: quote.turnaround,
          turnaroundLabel: quote.turnaroundLabel,
          eventDate: sanitizeString(raw.eventDate),
        },
        pricing: quote,
      };
    });

    const recipient = normalizeRecipient(body.recipient || {});
    const totals = items.reduce((acc, item) => {
      const pricing = item.pricing || {};
      acc.quantity += Number(pricing.quantity || 0);
      acc.subtotal += Number(pricing.subtotal || 0);
      acc.setupFee += Number(pricing.setupFee || 0);
      acc.logosFeeTotal += Number(pricing.logosFeeTotal || 0);
      acc.methodFeeTotal += Number(pricing.methodFeeTotal || 0);
      acc.digitizeFee += Number(pricing.digitizeFee || 0);
      acc.rushFee += Number(pricing.rushFee || 0);
      acc.shippingFee += Number(pricing.shippingFee || 0);
      acc.estimatedTax += Number(pricing.estimatedTax || 0);
      acc.total += Number(pricing.total || 0);
      acc.depositDue += Number(pricing.depositDue || 0);
      acc.balanceDue += Number(pricing.balanceDue || 0);
      return acc;
    }, {
      quantity: 0,
      subtotal: 0,
      setupFee: 0,
      logosFeeTotal: 0,
      methodFeeTotal: 0,
      digitizeFee: 0,
      rushFee: 0,
      shippingFee: 0,
      estimatedTax: 0,
      total: 0,
      depositDue: 0,
      balanceDue: 0,
    });

    Object.keys(totals).forEach((key) => {
      totals[key] = money(totals[key]);
    });

    const turnaroundMax = Math.max(...items.map((item) => Number(item.logistics?.turnaround?.max || 0)));
    const turnaroundMin = Math.min(...items.map((item) => Number(item.logistics?.turnaround?.min || 0)));
    const currency = items[0]?.pricing?.currency || 'USD';

    const bundle = {
      bundleId: makeBundleId(),
      createdAt: new Date().toISOString(),
      orderMode: body.orderMode === 'live' ? 'live' : 'intake',
      customer: recipient,
      itemCount: items.length,
      totalQuantity: totals.quantity,
      items,
      totals: {
        currency,
        ...totals,
      },
      logistics: {
        turnaround: { min: turnaroundMin, max: turnaroundMax },
        turnaroundLabel: `${turnaroundMin}-${turnaroundMax} business days`,
        eventDate: sanitizeString(body.eventDate),
      },
      notes: {
        customerNotes: sanitizeString(body.customerNotes),
        internalNotes: sanitizeString(body.internalNotes),
      },
      summaryLines: [
        `${items.length} configured line item(s)`,
        `${totals.quantity} total unit(s)`,
        `Total ${currency} ${totals.total.toFixed(2)}`,
        `Deposit ${currency} ${totals.depositDue.toFixed(2)}`,
      ],
    };

    return json(event, 200, {
      ok: true,
      bundle,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
