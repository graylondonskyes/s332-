/**
 * Repository interfaces — production and local smoke share same business logic
 * Directive section 6 — AE Command Hub Completion / Section 15 — Persistence
 *
 * Adapters:
 *   - LocalAdapter: SQLite via better-sqlite3 (smoke/dev)
 *   - NeonAdapter: Neon PostgreSQL (production) — injected externally
 */

'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

// ─── Adapter registry ─────────────────────────────────────────────────────

let _db = null;

function useDatabase(db) {
  _db = db;
}

function requireDb() {
  if (!_db) throw new Error('[Repositories] No database adapter configured. Call repositories.useDatabase(db).');
  return _db;
}

// ─── Local SQLite initializer (smoke mode) ────────────────────────────────

function initLocalSqlite(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const schemaPath = path.resolve(__dirname, 'db_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const db = new Database(dbPath ?? ':memory:');
    db.exec(schema);
    useDatabase({
      run: (sql, params) => db.prepare(sql).run(...(params ?? [])),
      get: (sql, params) => db.prepare(sql).get(...(params ?? [])),
      all: (sql, params) => db.prepare(sql).all(...(params ?? [])),
    });
    return db;
  } catch (err) {
    throw new Error(`[Repositories] SQLite init failed: ${err.message}. Install better-sqlite3 for local smoke.`);
  }
}

// ─── Tenant repository ────────────────────────────────────────────────────

const Tenants = {
  create({ name, plan = 'starter' }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run('INSERT INTO tenants(id, name, plan) VALUES(?, ?, ?)', [id, name, plan]);
    return db.get('SELECT * FROM tenants WHERE id = ?', [id]);
  },
  findById(id) {
    return requireDb().get('SELECT * FROM tenants WHERE id = ?', [id]);
  },
};

// ─── User repository ─────────────────────────────────────────────────────

const Users = {
  create({ tenantId, email, displayName, role = 'viewer', passwordHash }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO users(id, tenant_id, email, display_name, role, password_hash) VALUES(?, ?, ?, ?, ?, ?)',
      [id, tenantId, email, displayName ?? null, role, passwordHash ?? null]
    );
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
  },
  findByEmail(email) {
    return requireDb().get('SELECT * FROM users WHERE email = ?', [email]);
  },
  findById(id) {
    return requireDb().get('SELECT * FROM users WHERE id = ?', [id]);
  },
  updateLastLogin(id) {
    requireDb().run('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?', [id]);
  },
};

// ─── Session repository ───────────────────────────────────────────────────

const Sessions = {
  create({ userId, tenantId, tokenHash, expiresAt }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO sessions(id, user_id, tenant_id, token_hash, expires_at) VALUES(?, ?, ?, ?, ?)',
      [id, userId, tenantId, tokenHash, expiresAt]
    );
    return db.get('SELECT * FROM sessions WHERE id = ?', [id]);
  },
  findByTokenHash(tokenHash) {
    return requireDb().get(
      'SELECT * FROM sessions WHERE token_hash = ? AND revoked = 0 AND expires_at > datetime(\'now\')',
      [tokenHash]
    );
  },
  revoke(id) {
    requireDb().run('UPDATE sessions SET revoked = 1 WHERE id = ?', [id]);
  },
  revokeAllForUser(userId) {
    requireDb().run('UPDATE sessions SET revoked = 1 WHERE user_id = ?', [userId]);
  },
};

// ─── Client repository ────────────────────────────────────────────────────

const Clients = {
  create({ tenantId, name, email, phone, source, assignedBrainId }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO clients(id, tenant_id, name, email, phone, source, assigned_brain_id) VALUES(?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId, name, email ?? null, phone ?? null, source ?? null, assignedBrainId ?? null]
    );
    return db.get('SELECT * FROM clients WHERE id = ?', [id]);
  },
  findById(id) {
    return requireDb().get('SELECT * FROM clients WHERE id = ?', [id]);
  },
  listByTenant(tenantId) {
    return requireDb().all('SELECT * FROM clients WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
  },
  updateStatus(id, status) {
    requireDb().run('UPDATE clients SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    return requireDb().get('SELECT * FROM clients WHERE id = ?', [id]);
  },
};

// ─── Task repository ─────────────────────────────────────────────────────

const Tasks = {
  create({ tenantId, brainId, clientId, type, priority = 5, payload }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO tasks(id, tenant_id, brain_id, client_id, type, priority, payload) VALUES(?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId, brainId ?? null, clientId ?? null, type, priority, payload ? JSON.stringify(payload) : null]
    );
    return db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  },
  updateStatus(id, status, result) {
    const db = requireDb();
    const now = `datetime('now')`;
    if (status === 'in-progress') {
      db.run('UPDATE tasks SET status = ?, started_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    } else if (status === 'completed' || status === 'failed') {
      db.run(
        'UPDATE tasks SET status = ?, completed_at = datetime(\'now\'), result = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [status, result ? JSON.stringify(result) : null, id]
      );
    } else {
      db.run('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    }
    return db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  },
  findById(id) {
    return requireDb().get('SELECT * FROM tasks WHERE id = ?', [id]);
  },
  listByBrain(brainId, tenantId) {
    return requireDb().all(
      'SELECT * FROM tasks WHERE brain_id = ? AND tenant_id = ? ORDER BY enqueued_at DESC',
      [brainId, tenantId]
    );
  },
};

// ─── Audit log repository ─────────────────────────────────────────────────

const AuditLog = {
  write({ tenantId, actorId, brainId, action, entityType, entityId, detail }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO audit_log(id, tenant_id, actor_id, brain_id, action, entity_type, entity_id, detail) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId ?? null, actorId ?? null, brainId ?? null, action, entityType ?? null, entityId ?? null, detail ?? null]
    );
    return id;
  },
  listByTenant(tenantId, limit = 50) {
    return requireDb().all(
      'SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY at DESC LIMIT ?',
      [tenantId, limit]
    );
  },
};

// ─── Workspace repository ─────────────────────────────────────────────────

const Workspaces = {
  create({ tenantId, ownerId, name, languageStack, runtimeProfile, fsRoot }) {
    const db = requireDb();
    const id = crypto.randomUUID();
    db.run(
      'INSERT INTO workspaces(id, tenant_id, owner_id, name, language_stack, runtime_profile, fs_root) VALUES(?, ?, ?, ?, ?, ?, ?)',
      [id, tenantId, ownerId, name, languageStack ?? null, runtimeProfile ?? null, fsRoot ?? null]
    );
    return db.get('SELECT * FROM workspaces WHERE id = ?', [id]);
  },
  findById(id) {
    return requireDb().get('SELECT * FROM workspaces WHERE id = ?', [id]);
  },
  updateStatus(id, status) {
    requireDb().run('UPDATE workspaces SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, id]);
    return requireDb().get('SELECT * FROM workspaces WHERE id = ?', [id]);
  },
};

module.exports = {
  useDatabase,
  initLocalSqlite,
  Tenants,
  Users,
  Sessions,
  Clients,
  Tasks,
  AuditLog,
  Workspaces,
};
