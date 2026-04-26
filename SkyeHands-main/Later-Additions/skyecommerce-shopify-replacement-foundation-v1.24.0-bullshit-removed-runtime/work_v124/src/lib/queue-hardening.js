export function queueMaxAttempts(env = {}) {
  const raw = Number(env.QUEUE_MAX_ATTEMPTS || 5);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.min(25, Math.floor(raw));
}

export function dueQueuePredicate(tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `(${prefix}next_attempt_at IS NULL OR ${prefix}next_attempt_at = '' OR datetime(${prefix}next_attempt_at) <= datetime('now'))`;
}

export function nextQueueFailureState(row = {}, error = '', env = {}) {
  const nextAttemptCount = Number(row.attempt_count || 0) + 1;
  const maxAttempts = queueMaxAttempts(env);
  const deadLetter = nextAttemptCount >= maxAttempts;
  return {
    status: deadLetter ? 'dead_letter' : 'failed',
    attemptCount: nextAttemptCount,
    maxAttempts,
    deadLetter,
    error: String(error || 'queue_dispatch_failed').slice(0, 500),
    retryDelayMinutes: deadLetter ? 0 : Math.min(60, Math.pow(2, Math.min(Math.max(1, nextAttemptCount), 6))),
    nextAttemptSql: deadLetter ? null : `+${Math.min(60, Math.pow(2, Math.min(Math.max(1, nextAttemptCount), 6)))} minutes`
  };
}

export function notificationProviderMissingMessage() {
  return 'No live notification provider configured. Notification dispatch is fail-closed until a live provider connection and credentials are configured.';
}

export function queueRunSummary({ attempted = 0, succeeded = 0, failed = 0, deadLettered = 0, failures = [] } = {}) {
  return {
    attempted: Number(attempted || 0),
    succeeded: Number(succeeded || 0),
    failed: Number(failed || 0),
    deadLettered: Number(deadLettered || 0),
    failures: Array.isArray(failures) ? failures : []
  };
}
