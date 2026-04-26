export function buildRoutePacket({ agent = {}, bookings = [], merchants = [], routeDate = '' }) {
  const merchantMap = new Map((Array.isArray(merchants) ? merchants : []).map((merchant) => [merchant.id, merchant]));
  const normalizedBookings = (Array.isArray(bookings) ? bookings : [])
    .slice()
    .sort((a, b) => String(a.bookingDate || '').localeCompare(String(b.bookingDate || '')))
    .map((booking, index) => {
      const merchant = merchantMap.get(booking.merchantId) || {};
      return {
        stopNumber: index + 1,
        bookingId: booking.id,
        merchantId: booking.merchantId,
        merchantName: merchant.brandName || merchant.slug || 'Merchant',
        location: booking.location || '',
        contactName: booking.contactName || '',
        contactPhone: booking.contactPhone || '',
        bookingDate: booking.bookingDate,
        status: booking.status || 'scheduled',
        notes: booking.notes || ''
      };
    });
  return {
    generatedAt: new Date().toISOString(),
    routeDate,
    agent: {
      id: agent.id,
      displayName: agent.displayName,
      territory: agent.territory || ''
    },
    stopCount: normalizedBookings.length,
    stops: normalizedBookings
  };
}
