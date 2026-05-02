'use strict';

const fs      = require('node:fs');
const path    = require('node:path');
const os      = require('node:os');
const crypto  = require('node:crypto');

// ── Storage ──────────────────────────────────────────────────────────────────

function dataDir() {
  return process.env.APPOINTMENT_DATA_DIR || path.join(os.tmpdir(), 'skye-appointments');
}

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

function file(name) {
  const dir = dataDir();
  ensure(dir);
  return path.join(dir, name);
}

function readJSON(name, fallback) {
  const p = file(name);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function writeJSON(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf8');
}

// ── Booking storage ──────────────────────────────────────────────────────────

function allBookings() {
  return readJSON('bookings.json', []);
}

function saveBookings(list) {
  writeJSON('bookings.json', list);
}

function getBooking(id) {
  return allBookings().find(b => b.id === id) || null;
}

function upsertBooking(booking) {
  const list = allBookings();
  const idx  = list.findIndex(b => b.id === booking.id);
  if (idx >= 0) list[idx] = booking;
  else list.push(booking);
  saveBookings(list);
  return booking;
}

// ── Services storage ─────────────────────────────────────────────────────────

const DEFAULT_SERVICES = [
  { id: 'discovery-call',    name: 'Discovery Call',    durationMinutes: 30, pricesCents: 0,      description: 'Free intro call to explore fit and next steps.' },
  { id: 'strategy-session',  name: 'Strategy Session',  durationMinutes: 60, priceCents: 45000,   description: 'Deep-dive session for planning and roadmap alignment.' },
  { id: 'onboarding-call',   name: 'Onboarding Call',   durationMinutes: 45, priceCents: 0,       description: 'Welcome call for new clients.' },
  { id: 'consultation',      name: 'Consultation',      durationMinutes: 60, priceCents: 25000,   description: 'Expert consultation on a specific challenge or project.' },
  { id: 'demo',              name: 'Platform Demo',     durationMinutes: 30, priceCents: 0,       description: 'Walkthrough of the SkyeHands platform.' },
];

function allServices() {
  return readJSON('services.json', DEFAULT_SERVICES);
}

function getService(id) {
  return allServices().find(s => s.id === id) || null;
}

// ── Business hours ───────────────────────────────────────────────────────────

function orgSettings() {
  return readJSON('org.json', {
    timezone:          'America/New_York',
    openHour:          9,
    closeHour:         17,
    slotMinutes:       30,
    bufferMinutes:     15,
    operatingDays:     [1, 2, 3, 4, 5],   // Mon-Fri (0=Sun)
  });
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function slotsForDay(dateStr, service, existingBookings) {
  const org  = orgSettings();
  const slotMin = service ? service.durationMinutes : org.slotMinutes;
  const bufMin  = org.bufferMinutes;

  const date = new Date(dateStr + 'T00:00:00');
  const dow  = date.getDay();

  if (!org.operatingDays.includes(dow)) return [];

  const slots = [];
  const openMs  = org.openHour  * 60 * 60 * 1000;
  const closeMs = org.closeHour * 60 * 60 * 1000;

  let cursor = openMs;
  const dayStart = date.getTime();

  while (cursor + slotMin * 60 * 1000 <= closeMs) {
    const startMs = dayStart + cursor;
    const endMs   = startMs + slotMin * 60 * 1000;

    const startISO = new Date(startMs).toISOString();
    const endISO   = new Date(endMs).toISOString();

    // Check conflicts: any confirmed booking overlaps this slot?
    const conflict = existingBookings.some(b => {
      if (b.status === 'cancelled') return false;
      if (b.date !== dateStr) return false;
      const bStart = new Date(b.startISO).getTime();
      const bEnd   = new Date(b.endISO).getTime() + bufMin * 60 * 1000;
      return startMs < bEnd && endMs > bStart;
    });

    slots.push({ startISO, endISO, available: !conflict, durationMinutes: slotMin });
    cursor += (slotMin + bufMin) * 60 * 1000;
  }

  return slots;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
}

function response(code, body) {
  return {
    statusCode: code,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  };
}

function nowISO() { return new Date().toISOString(); }
function genId()  { return crypto.randomUUID(); }

module.exports = {
  allBookings, saveBookings, getBooking, upsertBooking,
  allServices, getService,
  orgSettings, slotsForDay, toDateStr,
  parseBody, response, nowISO, genId,
};
