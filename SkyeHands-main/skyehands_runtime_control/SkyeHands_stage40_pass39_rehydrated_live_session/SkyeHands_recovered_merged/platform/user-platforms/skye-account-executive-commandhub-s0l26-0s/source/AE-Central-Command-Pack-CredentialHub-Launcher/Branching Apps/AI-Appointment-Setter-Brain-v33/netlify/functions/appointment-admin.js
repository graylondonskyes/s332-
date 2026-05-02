'use strict';

/**
 * appointment-admin.js
 *
 * Admin operations for the appointment setter:
 *
 * GET  ?action=list[&status=confirmed|cancelled|all][&date=YYYY-MM-DD]
 * GET  ?action=stats
 * POST action=update-status  { id, status }
 * POST action=update-org     { openHour, closeHour, slotMinutes, bufferMinutes, operatingDays, timezone }
 * POST action=clear-test     { confirm: true }  — wipes test data
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const { allBookings, saveBookings, getBooking, upsertBooking, orgSettings, parseBody, response, nowISO } = require('./_shared');

function orgFile() {
  const dir = process.env.APPOINTMENT_DATA_DIR || path.join(os.tmpdir(), 'skye-appointments');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'org.json');
}

function saveOrg(settings) {
  fs.writeFileSync(orgFile(), JSON.stringify(settings, null, 2), 'utf8');
}

function dataDir() {
  return process.env.APPOINTMENT_DATA_DIR || path.join(os.tmpdir(), 'skye-appointments');
}

module.exports.handler = async (event = {}) => {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') return response(204, {});

  // ── GET ──────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    const q      = event.queryStringParameters || {};
    const action = String(q.action || 'list').toLowerCase();

    if (action === 'list') {
      let bookings = allBookings();
      if (q.status && q.status !== 'all') {
        bookings = bookings.filter(b => b.status === q.status);
      }
      if (q.date) {
        bookings = bookings.filter(b => b.date === q.date);
      }
      // Sort newest first
      bookings = bookings.slice().sort((a, b) => b.createdAt?.localeCompare(a.createdAt) || 0);
      return response(200, { ok: true, bookings, total: bookings.length, orgSettings: orgSettings() });
    }

    if (action === 'stats') {
      const all       = allBookings();
      const confirmed = all.filter(b => b.status === 'confirmed');
      const cancelled = all.filter(b => b.status === 'cancelled');

      const byService = {};
      confirmed.forEach(b => {
        const k = b.serviceName || b.serviceId || 'unknown';
        byService[k] = (byService[k] || 0) + 1;
      });

      // upcoming (confirmed, date >= today)
      const today   = new Date().toISOString().slice(0, 10);
      const upcoming = confirmed.filter(b => b.date >= today).length;
      const past     = confirmed.filter(b => b.date <  today).length;

      return response(200, {
        ok: true,
        total:     all.length,
        confirmed: confirmed.length,
        cancelled: cancelled.length,
        upcoming,
        past,
        byService,
        orgSettings: orgSettings(),
      });
    }

    return response(400, { ok: false, error: `Unknown GET action: ${action}. Valid: list, stats` });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (method !== 'POST') return response(405, { ok: false, error: 'method_not_allowed' });

  const body   = parseBody(event);
  const action = String(body.action || '').toLowerCase();

  if (action === 'update-status') {
    const { id, status } = body;
    if (!id)     return response(400, { ok: false, error: 'id is required' });
    if (!status) return response(400, { ok: false, error: 'status is required' });

    const allowed = ['confirmed', 'cancelled', 'completed', 'no-show'];
    if (!allowed.includes(status)) {
      return response(400, { ok: false, error: `status must be one of: ${allowed.join(', ')}` });
    }

    const booking = getBooking(id);
    if (!booking) return response(404, { ok: false, error: 'Booking not found' });

    const updated = { ...booking, status, updatedAt: nowISO() };
    upsertBooking(updated);
    return response(200, { ok: true, booking: updated });
  }

  if (action === 'update-org') {
    const current = orgSettings();
    const allowed = ['openHour','closeHour','slotMinutes','bufferMinutes','operatingDays','timezone'];
    const updates = {};
    allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k]; });
    const next = { ...current, ...updates };
    saveOrg(next);
    return response(200, { ok: true, orgSettings: next });
  }

  if (action === 'clear-test') {
    if (body.confirm !== true) {
      return response(400, { ok: false, error: 'Set confirm: true to wipe test data' });
    }
    saveBookings([]);
    return response(200, { ok: true, message: 'All bookings cleared.' });
  }

  return response(400, { ok: false, error: `Unknown action: ${action}. Valid: update-status, update-org, clear-test` });
};
