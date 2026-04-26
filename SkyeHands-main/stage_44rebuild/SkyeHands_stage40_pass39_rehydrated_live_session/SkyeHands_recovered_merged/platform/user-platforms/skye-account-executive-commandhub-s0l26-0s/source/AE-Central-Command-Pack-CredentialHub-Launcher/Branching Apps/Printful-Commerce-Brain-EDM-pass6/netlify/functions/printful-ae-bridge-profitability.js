const { listRecords, describeStore } = require('./_state-store');

exports.handler = async () => {
  try {
    const [orders, profitability] = await Promise.all([
      listRecords('aeBridgeOrders'),
      listRecords('aeBridgeProfitability'),
    ]);
    const orderRows = (orders || []).map(item => item.payload || item);
    const profitabilityRows = (profitability || []).map(item => item.payload || item);
    const totals = orderRows.reduce((acc, row) => {
      acc.amount += Number(row.amount || 0);
      acc.collected += Number(row.collectedValue || 0);
      acc.net += Number(row.netPosition || 0);
      return acc;
    }, { amount: 0, collected: 0, net: 0 });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, exportedAt: new Date().toISOString(), totals, orders: orderRows, profitability: profitabilityRows, storage: await describeStore() }) };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge profitability export failed' }) };
  }
};
