const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { findProduct, findPlacement, money } = require('./_storefront');
const { describeStore, saveRecord } = require('./_state-store');
const {
  makeId,
  normalizeSourceToItems,
  normalizeLineItem,
  sanitizeString,
  summarizeQuotes,
} = require('./_order');

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildWorkflow(status) {
  const current = sanitizeString(status || 'quoted').toLowerCase() || 'quoted';
  const stages = [
    'quoted',
    'proofing',
    'awaiting-payment',
    'approved',
    'in-production',
    'fulfilled',
  ];
  return stages.map((key) => ({
    key,
    complete: stages.indexOf(key) <= stages.indexOf(current),
  }));
}

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const source = body.source || body.packet || body.bundle || body;
    const rawItems = normalizeSourceToItems(source);
    if (!rawItems.length) {
      return json(event, 400, {
        ok: false,
        error: 'No lockable items were found in packet or bundle payload.',
      });
    }

    const normalized = rawItems.map((raw) => normalizeLineItem(raw, source));
    const baseTotals = summarizeQuotes(normalized.map((entry) => entry.quote));
    const currency = normalized[0]?.quote?.currency || 'USD';
    const overrides = body.overrides || {};

    const discountAmount = money(Math.max(0, numberOrNull(overrides.discountAmount) || 0));
    const shippingFee = money(numberOrNull(overrides.shippingFeeOverride) ?? baseTotals.shippingFee);
    const estimatedTax = money(numberOrNull(overrides.taxOverride) ?? baseTotals.estimatedTax);
    const depositPercent = clamp(numberOrNull(overrides.depositPercentOverride) ?? normalized[0]?.quote?.depositPercent ?? 0.5, 0, 1);

    const lockedTotal = money(
      baseTotals.subtotal +
      baseTotals.setupFee +
      baseTotals.logosFeeTotal +
      baseTotals.methodFeeTotal +
      baseTotals.digitizeFee +
      baseTotals.rushFee +
      shippingFee +
      estimatedTax -
      discountAmount
    );
    const depositDue = money(lockedTotal * depositPercent);
    const balanceDue = money(lockedTotal - depositDue);

    const customer = source.customer || source.recipient || {};
    const turnaroundMin = Math.min(...normalized.map((entry) => Number(entry.quote.turnaround?.min || 0)));
    const turnaroundMax = Math.max(...normalized.map((entry) => Number(entry.quote.turnaround?.max || 0)));
    const status = sanitizeString(body.status || overrides.status || 'quoted');
    const lockedItems = normalized.map((entry, index) => {
      const product = findProduct(entry.productKey);
      const placement = findPlacement(product, entry.quote.placementKey);
      return {
        lineId: `locked-line-${index + 1}`,
        externalProductId: entry.externalProductId,
        templateId: entry.productTemplateId,
        product: {
          key: entry.productKey,
          title: product?.title || entry.quote.productTitle,
          variantKey: entry.quote.variantKey,
          variantId: entry.quote.variantId,
          variantLabel: entry.quote.variantLabel,
          placementKey: entry.quote.placementKey,
          placementLabel: entry.quote.placementLabel,
          placement,
          printMethod: entry.quote.printMethod,
          printMethodLabel: entry.quote.printMethodLabel,
        },
        logistics: {
          shippingSpeed: entry.quote.shippingSpeed,
          shippingLabel: entry.quote.shippingLabel,
          turnaround: entry.quote.turnaround,
          turnaroundLabel: entry.quote.turnaroundLabel,
          eventDate: sanitizeString(source.logistics?.eventDate || source.eventDate),
        },
        pricing: entry.quote,
      };
    });

    const lockedOrder = {
      lockedOrderId: makeId('lock'),
      createdAt: new Date().toISOString(),
      sourceType: Array.isArray(source.items) ? 'bundle' : 'packet',
      status,
      workflow: buildWorkflow(status),
      expiresAt: sanitizeString(overrides.expiresAt || body.expiresAt) || '',
      customer,
      items: lockedItems,
      itemCount: lockedItems.length,
      totals: {
        currency,
        quantity: baseTotals.quantity,
        subtotal: baseTotals.subtotal,
        setupFee: baseTotals.setupFee,
        logosFeeTotal: baseTotals.logosFeeTotal,
        methodFeeTotal: baseTotals.methodFeeTotal,
        digitizeFee: baseTotals.digitizeFee,
        rushFee: baseTotals.rushFee,
        shippingFee,
        estimatedTax,
        discountAmount,
        total: lockedTotal,
        depositPercent,
        depositDue,
        balanceDue,
      },
      turnaround: {
        min: turnaroundMin,
        max: turnaroundMax,
        label: `${turnaroundMin}-${turnaroundMax} business days`,
      },
      operator: {
        name: sanitizeString(overrides.operatorName || body.operatorName),
        approvalNotes: sanitizeString(overrides.approvalNotes || body.approvalNotes),
        internalReference: sanitizeString(overrides.internalReference || body.internalReference),
      },
      summaryLines: [
        `${lockedItems.length} line item(s) locked`,
        `${baseTotals.quantity} total unit(s)`,
        `Locked total ${currency} ${lockedTotal.toFixed(2)}`,
        `Deposit due ${currency} ${depositDue.toFixed(2)}`,
      ],
      rawSource: source,
    };

    const record = await saveRecord('lockedOrders', lockedOrder.lockedOrderId, lockedOrder, { status: lockedOrder.status, customer: lockedOrder.customer?.name || '', total: lockedOrder.totals?.total || 0 });
    const storage = await describeStore();

    return json(event, 200, {
      ok: true,
      lockedOrder,
      record,
      storage,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
