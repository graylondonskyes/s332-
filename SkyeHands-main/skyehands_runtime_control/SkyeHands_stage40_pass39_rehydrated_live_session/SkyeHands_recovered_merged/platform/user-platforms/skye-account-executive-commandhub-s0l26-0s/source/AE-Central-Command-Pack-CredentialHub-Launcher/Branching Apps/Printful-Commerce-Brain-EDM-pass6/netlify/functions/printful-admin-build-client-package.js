const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { getCatalog } = require('./_storefront');
const { describeStore, saveRecord } = require('./_state-store');
const { makeId, sanitizeString } = require('./_order');

function addDaysIso(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

function normalizeItems(source = {}) {
  if (Array.isArray(source.items) && source.items.length) {
    return source.items.map((item, index) => ({
      lineId: item.lineId || `line-${index + 1}`,
      title: item.product?.title || item.productTitle || 'Product',
      variantLabel: item.product?.variantLabel || item.variantLabel || item.product?.variantKey || '',
      placementLabel: item.product?.placementLabel || item.placementLabel || '',
      printMethodLabel: item.product?.printMethodLabel || item.printMethodLabel || item.product?.printMethod || '',
      quantity: Number(item.pricing?.quantity || item.quantity || 0),
      unitRetail: Number(item.pricing?.unitRetail || item.unitRetail || 0),
      lineTotal: Number(item.pricing?.total || item.total || 0),
      turnaroundLabel: item.logistics?.turnaroundLabel || item.turnaroundLabel || '',
    }));
  }
  return [];
}

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const source = body.lockedOrder || body.source || body;
    const catalog = getCatalog();
    const brand = catalog.brand || {};
    const items = normalizeItems(source);
    if (!items.length) {
      return json(event, 400, {
        ok: false,
        error: 'A locked order with at least one item is required to build a client package.',
      });
    }

    const packageId = makeId('clientpkg');
    const invoiceId = makeId('invoice');
    const createdAt = new Date().toISOString();
    const expiresAt = sanitizeString(source.expiresAt) || addDaysIso(7);
    const currency = source.totals?.currency || brand.currency || 'USD';
    const total = Number(source.totals?.total || 0);
    const depositDue = Number(source.totals?.depositDue || 0);
    const balanceDue = Number(source.totals?.balanceDue || 0);

    const clientPackage = {
      packageId,
      createdAt,
      expiresAt,
      brand: {
        name: brand.name || 'Your Company',
        currency,
        currencySymbol: brand.currencySymbol || '$',
        supportEmail: brand.supportEmail || '',
        depositLabel: brand.depositLabel || 'Deposit due',
      },
      customer: {
        name: sanitizeString(source.customer?.name || source.recipient?.name),
        company: sanitizeString(source.customer?.company || source.recipient?.company),
        email: sanitizeString(source.customer?.email || source.recipient?.email),
      },
      lockedOrderId: source.lockedOrderId || '',
      quote: {
        itemCount: Number(source.itemCount || items.length),
        quantity: Number(source.totals?.quantity || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
        turnaroundLabel: source.turnaround?.label || items.map((item) => item.turnaroundLabel).filter(Boolean)[0] || '',
        items,
        totals: {
          currency,
          subtotal: Number(source.totals?.subtotal || 0),
          setupFee: Number(source.totals?.setupFee || 0),
          logosFeeTotal: Number(source.totals?.logosFeeTotal || 0),
          methodFeeTotal: Number(source.totals?.methodFeeTotal || 0),
          digitizeFee: Number(source.totals?.digitizeFee || 0),
          rushFee: Number(source.totals?.rushFee || 0),
          shippingFee: Number(source.totals?.shippingFee || 0),
          estimatedTax: Number(source.totals?.estimatedTax || 0),
          discountAmount: Number(source.totals?.discountAmount || 0),
          total,
          depositDue,
          balanceDue,
        },
      },
      invoice: {
        invoiceId,
        issueDate: createdAt,
        dueDate: expiresAt,
        label: `${brand.depositLabel || 'Deposit due'} invoice`,
        depositDue,
        balanceDue,
        total,
        paymentInstructions: sanitizeString(body.paymentInstructions) || 'Collect payment through your company checkout or send a manual invoice from your internal billing flow.',
      },
      tracker: {
        currentStatus: sanitizeString(source.status || 'quoted') || 'quoted',
        history: [
          {
            at: createdAt,
            status: sanitizeString(source.status || 'quoted') || 'quoted',
            actor: 'system',
            note: 'Client approval package created.',
          },
        ],
      },
      approval: {
        approvalLabel: 'Approve quote',
        disclaimer: 'Approving this package confirms scope, pricing, and production intent under your company terms.',
      },
      operator: source.operator || {},
      summary: [
        `${Number(source.itemCount || items.length)} line item(s)`,
        `${Number(source.totals?.quantity || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0))} total unit(s)`,
        `${currency} ${total.toFixed(2)} total`,
        `${currency} ${depositDue.toFixed(2)} deposit due`,
      ],
      publicPaths: {
        approvalPath: `./approve.html?id=${encodeURIComponent(packageId)}`,
        statusPath: `./status.html?id=${encodeURIComponent(packageId)}`,
      },
    };

    const record = await saveRecord('clientPackages', clientPackage.packageId, clientPackage, { status: clientPackage.tracker?.currentStatus || '', customer: clientPackage.customer?.name || '', total: clientPackage.quote?.totals?.total || 0 });
    const storage = await describeStore();

    return json(event, 200, {
      ok: true,
      clientPackage,
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
