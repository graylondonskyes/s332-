import crypto from 'crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function hashAuditEvent(event) {
  const payload = {
    id: event.id,
    actor_user_id: event.actor_user_id || null,
    event_type: event.event_type,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    metadata: event.metadata || {},
    created_at: event.created_at,
    previous_hash: event.previous_hash || null
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export function appendAuditChainFields(db, event) {
  const previous = db.audit_events[db.audit_events.length - 1];
  event.previous_hash = previous?.event_hash || null;
  event.event_hash = hashAuditEvent(event);
  return event;
}

export function verifyAuditChain(events) {
  const failures = [];
  let previousHash = null;
  events.forEach((event, index) => {
    if ((event.previous_hash || null) !== previousHash) {
      failures.push({ index, id: event.id, type: 'previous_hash_mismatch', expected: previousHash, actual: event.previous_hash || null });
    }
    const actualHash = hashAuditEvent(event);
    if (event.event_hash !== actualHash) {
      failures.push({ index, id: event.id, type: 'event_hash_mismatch', expected: actualHash, actual: event.event_hash || null });
    }
    previousHash = event.event_hash || null;
  });
  return {
    ok: failures.length === 0,
    event_count: events.length,
    head_hash: previousHash,
    failures
  };
}
