'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function nowIso() {
  return new Date().toISOString();
}

function toIsoFromNow(seconds) {
  return new Date(Date.now() + (seconds * 1000)).toISOString();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function randomId() {
  return crypto.randomUUID();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashPassword(password, saltBuffer) {
  const salt = saltBuffer || crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyPassword(password, storedHash) {
  const raw = clean(storedHash);
  const parts = raw.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'base64url');
    const expected = Buffer.from(parts[2], 'base64url');
    const derived = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function createLocalIdentity(config = {}) {
  const dataDir = clean(process.env[clean(config.dataDirEnv)] || config.dataDir)
    || path.join(os.tmpdir(), clean(config.defaultDataDirName || 'skye-local-app'));
  const identityDir = path.join(dataDir, '_identity');
  const usersPath = path.join(identityDir, 'users.json');
  const sessionsPath = path.join(identityDir, 'sessions.json');
  const issuer = clean(config.issuer || 'local://skye/session');
  const audience = clean(config.audience || 'skye-local-session');
  const sessionTtlSeconds = Number(config.sessionTtlSeconds || 43200);

  function ensureDir() {
    fs.mkdirSync(identityDir, { recursive: true });
  }

  function readArray(filePath) {
    ensureDir();
    if (!fs.existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeArray(filePath, rows) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }

  function loadUsers() {
    return readArray(usersPath)
      .map((row) => {
        const email = normalizeEmail(row.email);
        if (!email || !clean(row.passwordHash)) return null;
        return {
          id: clean(row.id || randomId()),
          email,
          name: clean(row.name),
          passwordHash: clean(row.passwordHash),
          role: clean(row.role || 'admin') || 'admin',
          artistId: clean(row.artistId),
          createdAt: clean(row.createdAt || nowIso()),
          updatedAt: clean(row.updatedAt || nowIso()),
        };
      })
      .filter(Boolean);
  }

  function saveUsers(users) {
    writeArray(usersPath, users);
  }

  function loadSessions() {
    const rows = readArray(sessionsPath);
    const now = Date.now();
    const active = rows.filter((row) => {
      if (clean(row.revokedAt)) return false;
      const expiresAt = Date.parse(clean(row.expiresAt));
      return Number.isFinite(expiresAt) && expiresAt > now;
    });
    if (active.length !== rows.length) {
      writeArray(sessionsPath, active);
    }
    return active;
  }

  function saveSessions(sessions) {
    writeArray(sessionsPath, sessions);
  }

  function findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    return loadUsers().find((user) => user.email === normalized) || null;
  }

  function hasAdminUser() {
    return loadUsers().some((user) => user.role === 'admin');
  }

  function validatePassword(password) {
    const raw = String(password || '');
    if (raw.length < 10) {
      return { ok: false, error: 'Password must be at least 10 characters.' };
    }
    return { ok: true };
  }

  function createUser(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const role = clean(input.role || 'admin') || 'admin';
    const artistId = clean(input.artistId);
    const passwordCheck = validatePassword(password);
    if (!email) return { ok: false, statusCode: 400, error: 'Email is required.' };
    if (!passwordCheck.ok) return { ok: false, statusCode: 400, error: passwordCheck.error };
    if (findUserByEmail(email)) {
      return { ok: false, statusCode: 409, error: `A local identity already exists for ${email}.` };
    }
    const users = loadUsers();
    const user = {
      id: randomId(),
      email,
      name: clean(input.name),
      passwordHash: hashPassword(password),
      role,
      artistId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    users.push(user);
    saveUsers(users);
    return { ok: true, user };
  }

  function createFirstAdmin(input = {}) {
    if (hasAdminUser()) {
      return { ok: false, statusCode: 409, error: 'A local admin account already exists. Sign in instead.' };
    }
    return createUser({ ...input, role: 'admin' });
  }

  function createArtistUser(input = {}) {
    return createUser({ ...input, role: 'artist' });
  }

  function authenticate(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    if (!email || !password) {
      return { ok: false, statusCode: 400, error: 'Email and password are required.' };
    }
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { ok: false, statusCode: 401, error: 'Invalid email or password.' };
    }
    const expectedRole = clean(input.role);
    if (expectedRole && user.role !== expectedRole) {
      return { ok: false, statusCode: 403, error: `${expectedRole} access is required for this sign-in.` };
    }
    return { ok: true, user };
  }

  function issueSession(user, options = {}) {
    const subject = clean(options.subject || user.artistId || user.email || user.id) || user.id;
    const token = 'skls_' + crypto.randomBytes(24).toString('base64url');
    const session = {
      id: randomId(),
      tokenHash: sha256(token),
      userId: user.id,
      email: user.email,
      role: user.role,
      artistId: clean(user.artistId),
      subject,
      issuedAt: nowIso(),
      expiresAt: toIsoFromNow(sessionTtlSeconds),
      lastSeenAt: nowIso(),
      issuer,
      audience,
    };
    const sessions = loadSessions();
    sessions.push(session);
    saveSessions(sessions);
    return {
      ok: true,
      token,
      subject,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        artistId: clean(user.artistId),
      },
      issuer,
      audience,
      expiresInSeconds: sessionTtlSeconds,
      source: 'local-identity-session',
    };
  }

  function verifySessionToken(token, options = {}) {
    const raw = clean(token);
    if (!raw) return { ok: false, statusCode: 401, error: 'Missing bearer token.' };
    const sessions = loadSessions();
    const session = sessions.find((entry) => timingSafeEqualText(entry.tokenHash, sha256(raw)));
    if (!session) return { ok: false, statusCode: 401, error: 'Unknown or expired local session.' };
    const user = loadUsers().find((entry) => entry.id === session.userId);
    if (!user) return { ok: false, statusCode: 401, error: 'Session user no longer exists.' };
    const claims = {
      sub: session.subject,
      iss: session.issuer || issuer,
      aud: session.audience || audience,
      email: user.email,
      role: user.role,
      artistId: clean(user.artistId),
      source: 'local-identity-session',
    };
    const roles = Array.isArray(options.roles) ? options.roles.map(clean).filter(Boolean) : [];
    if (roles.length && !roles.includes(claims.role)) {
      return { ok: false, statusCode: 403, error: 'The active session does not have the required role.' };
    }
    const requiredArtistId = clean(options.artistId);
    if (requiredArtistId && claims.role === 'artist' && claims.artistId && claims.artistId !== requiredArtistId) {
      return { ok: false, statusCode: 403, error: 'The active artist session does not match this record.' };
    }
    return { ok: true, claims, session };
  }

  function sessionStatus() {
    const users = loadUsers();
    return {
      ok: true,
      localIdentity: true,
      setupRequired: !users.some((user) => user.role === 'admin'),
      usersConfigured: users.length,
      adminUsers: users.filter((user) => user.role === 'admin').length,
      artistUsers: users.filter((user) => user.role === 'artist').length,
      issuer,
      audience,
      sessionTtlSeconds,
    };
  }

  return {
    authenticate,
    createArtistUser,
    createFirstAdmin,
    findUserByEmail,
    hasAdminUser,
    issueSession,
    loadUsers,
    sessionStatus,
    verifySessionToken,
  };
}

module.exports = {
  createLocalIdentity,
  hashPassword,
  verifyPassword,
};
