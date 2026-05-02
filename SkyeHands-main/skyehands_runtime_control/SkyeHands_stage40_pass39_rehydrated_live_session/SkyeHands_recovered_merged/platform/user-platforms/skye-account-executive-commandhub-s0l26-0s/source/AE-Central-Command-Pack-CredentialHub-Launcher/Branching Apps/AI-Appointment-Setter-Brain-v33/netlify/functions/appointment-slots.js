'use strict';

/**
 * appointment-slots.js
 * GET  /.netlify/functions/appointment-slots?date=YYYY-MM-DD&serviceId=...&days=7
 *
 * Returns available time slots for a date (or range of dates).
 * Checks existing confirmed bookings and respects business hours + buffer.
 */

const { allBookings, allServices, getService, slotsForDay, response } = require('./_shared');

module.exports.handler = async (event = {}) => {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') return response(204, {});
  if (method !== 'GET')     return response(405, { ok: false, error: 'method_not_allowed' });

  const q         = event.queryStringParameters || {};
  const serviceId = q.serviceId || null;
  const days      = Math.min(Math.max(parseInt(q.days || '1', 10), 1), 30);

  // Start date: default today
  let startDate = q.date ? new Date(q.date + 'T00:00:00') : new Date();
  startDate.setHours(0, 0, 0, 0);

  const service  = serviceId ? getService(serviceId) : null;
  const bookings = allBookings();
  const result   = [];

  for (let i = 0; i < days; i++) {
    const d    = new Date(startDate.getTime() + i * 86400000);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const slots   = slotsForDay(dateStr, service, bookings);
    if (slots.length > 0) result.push({ date: dateStr, slots });
  }

  const totalAvailable = result.reduce((n, day) => n + day.slots.filter(s => s.available).length, 0);

  return response(200, {
    ok: true,
    serviceId: serviceId || null,
    service:   service   || null,
    days:      result,
    totalAvailableSlots: totalAvailable,
  });
};
