function sum(values = []) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

export function buildMerchantAnalytics({ orders = [], products = [], returns = [], importJobs = [], customers = [], locations = [], inventoryLevels = [] } = {}) {
  const normalizedOrders = Array.isArray(orders) ? orders : [];
  const normalizedProducts = Array.isArray(products) ? products : [];
  const normalizedReturns = Array.isArray(returns) ? returns : [];
  const normalizedJobs = Array.isArray(importJobs) ? importJobs : [];
  const normalizedCustomers = Array.isArray(customers) ? customers : [];
  const normalizedLocations = Array.isArray(locations) ? locations : [];
  const normalizedLevels = Array.isArray(inventoryLevels) ? inventoryLevels : [];

  const bookedOrders = normalizedOrders.filter((order) => order.status !== 'cancelled');
  const paidOrders = normalizedOrders.filter((order) => ['authorized', 'paid'].includes(String(order.paymentStatus || '').toLowerCase()));
  const openOrders = normalizedOrders.filter((order) => !['fulfilled', 'cancelled'].includes(String(order.status || '').toLowerCase()));
  const openReturns = normalizedReturns.filter((item) => !['denied', 'refunded', 'closed'].includes(String(item.status || '').toLowerCase()));
  const lowStockProducts = normalizedProducts
    .filter((product) => Boolean(product.trackInventory) && Number(product.inventoryOnHand || 0) <= 5)
    .sort((a, b) => Number(a.inventoryOnHand || 0) - Number(b.inventoryOnHand || 0))
    .slice(0, 5)
    .map((product) => ({ id: product.id, title: product.title, inventoryOnHand: Number(product.inventoryOnHand || 0), sku: product.sku || '' }));

  const productUnits = new Map();
  for (const order of bookedOrders) {
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const current = productUnits.get(item.productId) || { productId: item.productId, title: item.title || item.productId, units: 0, revenueCents: 0 };
      current.units += Number(item.quantity || 0);
      current.revenueCents += Number(item.quantity || 0) * Number(item.unitPriceCents || 0);
      productUnits.set(item.productId, current);
    }
  }

  const inventoryAvailable = normalizedLevels.length
    ? sum(normalizedLevels.map((level) => level.available))
    : sum(normalizedProducts.map((product) => product.inventoryOnHand));

  return {
    counts: {
      orders: normalizedOrders.length,
      openOrders: openOrders.length,
      paidOrders: paidOrders.length,
      products: normalizedProducts.length,
      activeProducts: normalizedProducts.filter((product) => String(product.status || '').toLowerCase() === 'active').length,
      customers: normalizedCustomers.length,
      locations: normalizedLocations.length,
      lowStockProducts: lowStockProducts.length,
      openReturns: openReturns.length,
      importJobs: normalizedJobs.length
    },
    revenue: {
      bookedCents: sum(bookedOrders.map((order) => order.totalCents)),
      collectedCents: sum(paidOrders.map((order) => order.totalCents)),
      averageOrderValueCents: bookedOrders.length ? Math.round(sum(bookedOrders.map((order) => order.totalCents)) / bookedOrders.length) : 0,
      refundsRequestedCents: sum(normalizedReturns.map((item) => item.requestedCents)),
      refundsApprovedCents: sum(normalizedReturns.map((item) => item.approvedCents))
    },
    inventory: {
      availableUnits: inventoryAvailable,
      trackedProducts: normalizedProducts.filter((product) => Boolean(product.trackInventory)).length,
      locationsConfigured: normalizedLocations.filter((location) => location.active !== false).length
    },
    imports: {
      complete: normalizedJobs.filter((job) => String(job.status || '').toLowerCase() === 'complete').length,
      running: normalizedJobs.filter((job) => String(job.status || '').toLowerCase() === 'running').length,
      failed: normalizedJobs.filter((job) => String(job.status || '').toLowerCase() === 'failed').length
    },
    lowStockProducts,
    topProducts: [...productUnits.values()].sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents).slice(0, 5)
  };
}
