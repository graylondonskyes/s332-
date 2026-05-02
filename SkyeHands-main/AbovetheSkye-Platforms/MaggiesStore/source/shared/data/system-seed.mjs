export const STORE_SYSTEM_SEED = {
  merchant: {
    id: 'merchant-001',
    status: 'intake',
    storeName: "Maggie's Neighborhood Store",
    slug: 'maggies-neighborhood-store',
    contactEmail: 'owner@maggies.local',
    contactPhone: '623-000-0000',
    deliveryEnabled: true,
    recurringDeliveryEnabled: true,
    onDemandDeliveryEnabled: true,
    pickupEnabled: true,
    serviceWindows: [
      { id: 'window-001', label: 'Friday Evening', day: 'Friday', start: '17:00', end: '20:00', mode: 'recurring' },
      { id: 'window-002', label: 'Saturday Midday', day: 'Saturday', start: '11:00', end: '14:00', mode: 'on-demand' }
    ]
  },
  merchantUsers: [
    { id: 'user-001', email: 'owner@maggies.local', pin: '2468', name: 'Store Owner', role: 'merchant-admin', status: 'active' }
  ],
  inventory: [
    {
      id: 'item-001',
      status: 'published',
      title: 'House Special Bundle',
      category: 'Featured',
      description: 'Starter product proving admin publish sync into the storefront.',
      price: 24.99,
      stock: 18,
      image: '',
      featured: true,
      deliveryEligible: true,
      pickupEligible: true,
      tags: ['featured', 'starter']
    }
  ],
  featuredInventoryIds: ['item-001'],
  bookings: [],
  routePackets: [],
  aeRoster: [
    { id: 'ae-001', name: 'Avery Lane', title: 'Merchant Launch AE', lane: 'merchant-launch', status: 'active' },
    { id: 'ae-002', name: 'Jordan Skye', title: 'Delivery Ops AE', lane: 'delivery-ops', status: 'active' }
  ],
  merchantAssignments: [
    { merchantId: 'merchant-001', aeId: 'ae-001', status: 'intake' }
  ],
  bookingSettings: {
    minimumNoticeMinutes: 90,
    serviceArea: ['El Mirage', 'Surprise', 'Glendale', 'Peoria'],
    orderNotice: 'Orders remain subject to merchant approval and service-area review.'
  },
  audit: [],
  sync: {
    publishedAt: '2026-04-15T00:00:00.000Z',
    lastInventoryMutationAt: '2026-04-15T00:00:00.000Z',
    source: 'merchant-admin'
  }
};
