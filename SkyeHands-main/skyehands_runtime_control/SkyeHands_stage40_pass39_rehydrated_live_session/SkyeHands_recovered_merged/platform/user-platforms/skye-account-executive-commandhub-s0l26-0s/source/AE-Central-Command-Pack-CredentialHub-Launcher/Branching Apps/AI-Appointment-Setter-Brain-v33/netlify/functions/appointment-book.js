'use strict';

/**
 * appointment-book.js
 *
 * POST /.netlify/functions/appointment-book
 * Body (action: 'book'):
 *   { action: 'book', serviceId, startISO, name, email, phone?, notes?, tenantId? }
 *
 * Body (action: 'reschedule'):
 *   { action: 'reschedule', id, startISO }
 *
 * Body (action: 'cancel'):
 *   { action: 'cancel', id, reason? }
 *
 * GET  /.netlify/functions/appointment-book?id=<uuid>
 *   Returns single booking.
 */

const {
  allBookings, getBooking, upsertBooking, getService,
  slotsForDay, orgSettings,
  parseBody, response, nowISO, genId,
} = require('./_shared');

function dateStrFromISO(iso) {
  return iso.slice(0, 10);
}

function slotAvailable(startISO, service, existingBookings, excludeId) {
  const dateStr = dateStrFromISO(startISO);
  const bookings = existingBookings.filter(b => b.id !== excludeId);
  const slots    = slotsForDay(dateStr, service, bookings);
  return slots.some(s => s.startISO === startISO && s.available);
}

function computeEndISO(startISO, durationMinutes) {
  return new Date(new Date(startISO).getTime() + durationMinutes * 60000).toISOString();
}

module.exports.handler = async (event = {}) => {
  const method = (event.httpMethod || 'POST').toUpperCase();
  if (method === 'OPTIONS') return response(204, {});

  // GET single booking by id
  if (method === 'GET') {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return response(400, { ok: false, error: 'id query param required' });
    const booking = getBooking(id);
    if (!booking) return response(404, { ok: false, error: 'Booking not found' });
    return response(200, { ok: true, booking });
  }

  if (method !== 'POST') return response(405, { ok: false, error: 'method_not_allowed' });

  const body   = parseBody(event);
  const action = String(body.action || 'book').toLowerCase();

  // ── BOOK ─────────────────────────────────────────────────────────────────
  if (action === 'book') {
    const { serviceId, startISO, name, email, phone, notes, tenantId } = body;

    if (!startISO)  return response(400, { ok: false, error: 'startISO is required' });
    if (!name)      return response(400, { ok: false, error: 'name is required' });
    if (!email)     return response(400, { ok: false, error: 'email is required' });

    const service  = serviceId ? getService(serviceId) : null;
    const duration = service?.durationMinutes || orgSettings().slotMinutes;
    const existing = allBookings();

    if (!slotAvailable(startISO, service, existing, null)) {
      return response(409, { ok: false, error: 'Slot not available — it may already be booked or outside business hours.' });
    }

    const booking = {
      id:              genId(),
      serviceId:       serviceId || null,
      serviceName:     service?.name || 'Appointment',
      date:            dateStrFromISO(startISO),
      startISO,
      endISO:          computeEndISO(startISO, duration),
      durationMinutes: duration,
      name,
      email,
      phone:           phone  || null,
      notes:           notes  || null,
      tenantId:        tenantId || 'default',
      status:          'confirmed',
      createdAt:       nowISO(),
      updatedAt:       nowISO(),
    };

    upsertBooking(booking);

    return response(201, {
      ok:      true,
      booking,
      message: `Appointment confirmed for ${name} on ${booking.date} at ${booking.startISO.slice(11, 16)} UTC`,
    });
  }

  // ── RESCHEDULE ───────────────────────────────────────────────────────────
  if (action === 'reschedule') {
    const { id, startISO } = body;
    if (!id)       return response(400, { ok: false, error: 'id is required' });
    if (!startISO) return response(400, { ok: false, error: 'startISO is required' });

    const booking = getBooking(id);
    if (!booking)  return response(404, { ok: false, error: 'Booking not found' });
    if (booking.status === 'cancelled') return response(409, { ok: false, error: 'Cannot reschedule a cancelled booking' });

    const service  = booking.serviceId ? getService(booking.serviceId) : null;
    const duration = service?.durationMinutes || orgSettings().slotMinutes;
    const existing = allBookings();

    if (!slotAvailable(startISO, service, existing, id)) {
      return response(409, { ok: false, error: 'New slot not available.' });
    }

    const updated = {
      ...booking,
      date:            dateStrFromISO(startISO),
      startISO,
      endISO:          computeEndISO(startISO, duration),
      durationMinutes: duration,
      status:          'confirmed',
      updatedAt:       nowISO(),
    };

    upsertBooking(updated);
    return response(200, { ok: true, booking: updated });
  }

  // ── CANCEL ───────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    const { id, reason } = body;
    if (!id) return response(400, { ok: false, error: 'id is required' });

    const booking = getBooking(id);
    if (!booking) return response(404, { ok: false, error: 'Booking not found' });

    const updated = {
      ...booking,
      status:       'cancelled',
      cancelReason: reason || null,
      cancelledAt:  nowISO(),
      updatedAt:    nowISO(),
    };

    upsertBooking(updated);
    return response(200, { ok: true, booking: updated, message: 'Booking cancelled.' });
  }

  return response(400, { ok: false, error: `Unknown action: ${action}. Valid: book, reschedule, cancel` });
};
