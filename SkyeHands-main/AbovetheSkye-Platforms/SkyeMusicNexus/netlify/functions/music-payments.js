'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { requireSkyGate } = require('./_lib/skygate-auth');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const MUSIC_NEXUS_DIR =
  process.env.MUSIC_NEXUS_DATA_DIR || path.join(os.tmpdir(), 'skye-music-nexus');

function artistsFile() {
  return path.join(MUSIC_NEXUS_DIR, 'artists.json');
}

function ledgerFile() {
  return path.join(MUSIC_NEXUS_DIR, 'ledger.json');
}

function payoutsFile() {
  return path.join(MUSIC_NEXUS_DIR, 'payouts.json');
}

function ensureFile(filePath, defaultValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadFile(filePath) {
  ensureFile(filePath, []);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveFile(filePath, data) {
  ensureFile(filePath, []);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadArtists() {
  return loadFile(artistsFile());
}

function saveArtists(artists) {
  saveFile(artistsFile(), artists);
}

function loadLedger() {
  return loadFile(ledgerFile());
}

function saveLedger(ledger) {
  saveFile(ledgerFile(), ledger);
}

function loadPayouts() {
  return loadFile(payoutsFile());
}

function savePayouts(payouts) {
  saveFile(payoutsFile(), payouts);
}

function makeId() {
  return crypto.randomBytes(8).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: credit artist account
// ---------------------------------------------------------------------------

function handleCredit(payload) {
  const { artistId, amount, reason, referenceId } = payload;

  if (!artistId) {
    return respond(400, { ok: false, error: 'artistId is required' });
  }

  const creditAmount = Number(amount);
  if (isNaN(creditAmount) || creditAmount <= 0) {
    return respond(400, { ok: false, error: 'amount must be a positive number' });
  }

  const artists = loadArtists();
  const artistIdx = artists.findIndex((a) => a.id === artistId);
  if (artistIdx === -1) {
    return respond(404, { ok: false, error: 'Artist not found' });
  }

  // Update artist balance
  const prevBalance = Number(artists[artistIdx].balance || 0);
  const newBalance = prevBalance + creditAmount;
  artists[artistIdx].balance = newBalance;
  artists[artistIdx].updatedAt = nowIso();
  saveArtists(artists);

  // Create ledger entry
  const ledger = loadLedger();
  const entry = {
    id: makeId(),
    artistId: String(artistId),
    type: 'credit',
    amount: creditAmount,
    balance_after: newBalance,
    reason: reason ? String(reason).trim() : '',
    referenceId: referenceId ? String(referenceId).trim() : '',
    createdAt: nowIso(),
  };
  ledger.push(entry);
  saveLedger(ledger);

  return respond(201, { ok: true, entry, balance: newBalance });
}

// ---------------------------------------------------------------------------
// Action: payout request
// ---------------------------------------------------------------------------

function handlePayout(payload) {
  const { artistId, amount, payoutMethod, payoutDetails } = payload;

  if (!artistId) {
    return respond(400, { ok: false, error: 'artistId is required' });
  }

  const payoutAmount = Number(amount);
  if (isNaN(payoutAmount) || payoutAmount <= 0) {
    return respond(400, { ok: false, error: 'amount must be a positive number' });
  }

  const validMethods = ['bank', 'paypal'];
  if (!payoutMethod || !validMethods.includes(payoutMethod)) {
    return respond(400, { ok: false, error: `payoutMethod must be one of: ${validMethods.join(', ')}` });
  }

  const artists = loadArtists();
  const artistIdx = artists.findIndex((a) => a.id === artistId);
  if (artistIdx === -1) {
    return respond(404, { ok: false, error: 'Artist not found' });
  }

  const currentBalance = Number(artists[artistIdx].balance || 0);
  if (currentBalance < payoutAmount) {
    return respond(422, {
      ok: false,
      error: `Insufficient balance. Available: ${currentBalance}, requested: ${payoutAmount}`,
    });
  }

  // Debit artist balance
  const newBalance = currentBalance - payoutAmount;
  artists[artistIdx].balance = newBalance;
  artists[artistIdx].updatedAt = nowIso();
  saveArtists(artists);

  // Create ledger debit entry
  const ledger = loadLedger();
  const ledgerEntry = {
    id: makeId(),
    artistId: String(artistId),
    type: 'debit',
    amount: payoutAmount,
    balance_after: newBalance,
    reason: `Payout request via ${payoutMethod}`,
    referenceId: '',
    createdAt: nowIso(),
  };
  ledger.push(ledgerEntry);
  saveLedger(ledger);

  // Create payout record
  const payouts = loadPayouts();
  const payout = {
    id: makeId(),
    artistId: String(artistId),
    amount: payoutAmount,
    payoutMethod,
    payoutDetails: payoutDetails && typeof payoutDetails === 'object' ? payoutDetails : {},
    status: 'pending',
    ledgerEntryId: ledgerEntry.id,
    createdAt: nowIso(),
    completedAt: null,
  };
  ledger[ledger.length - 1].referenceId = payout.id;
  payouts.push(payout);
  savePayouts(payouts);
  saveLedger(ledger);

  return respond(201, { ok: true, payout, balance: newBalance });
}

// ---------------------------------------------------------------------------
// Action: get ledger for artist
// ---------------------------------------------------------------------------

function handleLedger(params) {
  const { artistId } = params;
  if (!artistId) {
    return respond(400, { ok: false, error: 'artistId is required' });
  }

  const ledger = loadLedger().filter((e) => e.artistId === artistId);

  const artists = loadArtists();
  const artist = artists.find((a) => a.id === artistId);

  return respond(200, {
    ok: true,
    artistId,
    balance: artist ? Number(artist.balance || 0) : null,
    ledger,
    total: ledger.length,
  });
}

// ---------------------------------------------------------------------------
// Action: list payouts
// ---------------------------------------------------------------------------

function handlePayouts(params) {
  let payouts = loadPayouts();

  const status = params.status ? params.status.trim() : '';
  if (status) {
    payouts = payouts.filter((p) => p.status === status);
  }

  return respond(200, { ok: true, payouts, total: payouts.length });
}

// ---------------------------------------------------------------------------
// Action: complete payout
// ---------------------------------------------------------------------------

function handleCompletePayout(payload, params) {
  const payoutId =
    (payload && payload.payoutId) || (params && params.payoutId);

  if (!payoutId) {
    return respond(400, { ok: false, error: 'payoutId is required' });
  }

  const payouts = loadPayouts();
  const idx = payouts.findIndex((p) => p.id === payoutId);
  if (idx === -1) {
    return respond(404, { ok: false, error: 'Payout not found' });
  }

  if (payouts[idx].status === 'completed') {
    return respond(409, { ok: false, error: 'Payout is already completed' });
  }

  payouts[idx].status = 'completed';
  payouts[idx].completedAt = nowIso();
  savePayouts(payouts);

  return respond(200, { ok: true, payout: payouts[idx] });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const params = event.queryStringParameters || {};

    if (method === 'GET') {
      const denied = requireSkyGate(event);
      if (denied) return denied;
      const action = params.action || '';
      if (action === 'ledger') return handleLedger(params);
      if (action === 'payouts') return handlePayouts(params);
      return respond(400, { ok: false, error: `Unknown GET action: ${action}` });
    }

    if (method === 'POST') {
      const denied = requireSkyGate(event);
      if (denied) return denied;
      const payload = parseBody(event);
      if (payload === null) {
        return respond(400, { ok: false, error: 'Invalid JSON body' });
      }
      const action = payload.action || params.action || '';
      if (action === 'credit') return handleCredit(payload);
      if (action === 'payout') return handlePayout(payload);
      if (action === 'complete-payout') return handleCompletePayout(payload, params);
      return respond(400, { ok: false, error: `Unknown POST action: ${action}` });
    }

    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
