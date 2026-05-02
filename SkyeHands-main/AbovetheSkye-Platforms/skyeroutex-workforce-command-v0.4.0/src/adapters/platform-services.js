import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function unsupportedProvider(kind, driver) {
  throw new Error(`${kind}=${driver} is unsupported. Use a configured provider driver before booting.`);
}

function requiredConfig(kind, driver, env, keys) {
  const missing = keys.filter(key => !env[key]);
  if (missing.length) throw new Error(`${kind}=${driver} requires ${missing.join(', ')}.`);
  return Object.fromEntries(keys.map(key => [key, env[key]]));
}

function httpDispatchSummary({ provider_kind, driver, endpoint, method = 'POST', headers = {}, body, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetch(endpoint, { method, headers, body, signal: controller.signal })
    .then(async res => {
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`${driver} returned ${res.status}: ${text.slice(0, 300)}`);
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { ok: true, status: res.status, body: json || text };
    })
    .catch(error => ({ ok: false, error: error.message }))
    .finally(() => clearTimeout(timer));
  const summary = { provider_kind, driver, endpoint, method, status: 'queued' };
  Object.defineProperty(summary, 'promise', { value: promise, enumerable: false });
  return summary;
}

function formBody(fields) {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params;
}

function bearer(secret) {
  return { authorization: `Bearer ${secret}` };
}

function basic(user, pass) {
  return { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
}

function requiredWebhookConfig(kind, driver, env, endpointKey, secretKey) {
  const endpoint = env[endpointKey];
  const secret = env[secretKey];
  if (!endpoint) throw new Error(`${kind}=${driver} requires ${endpointKey}.`);
  if (!secret) throw new Error(`${kind}=${driver} requires ${secretKey}.`);
  let url;
  try { url = new URL(endpoint); } catch {
    throw new Error(`${kind}=${driver} has invalid ${endpointKey}.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${kind}=${driver} ${endpointKey} must be http or https.`);
  if (String(secret).length < 16) throw new Error(`${kind}=${driver} ${secretKey} must be at least 16 characters.`);
  return { endpoint, secret };
}

function signedWebhookDispatcher({ endpoint, secret, provider_kind, driver, timeoutMs = 5000 }) {
  return function dispatchWebhook(event_type, entity_type, entity_id, payload = {}) {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      provider_kind,
      driver,
      event_type,
      entity_type,
      entity_id,
      payload,
      sent_at: timestamp
    });
    const signature = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
    const headers = {
      'content-type': 'application/json',
      'x-skyeroutex-provider-kind': provider_kind,
      'x-skyeroutex-driver': driver,
      'x-skyeroutex-timestamp': timestamp,
      'x-skyeroutex-signature': signature
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const promise = fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal })
      .then(async res => {
        const text = await res.text().catch(() => '');
        if (!res.ok) throw new Error(`${driver} webhook returned ${res.status}: ${text.slice(0, 200)}`);
        return { ok: true, status: res.status };
      })
      .catch(error => ({ ok: false, error: error.message }))
      .finally(() => clearTimeout(timer));
    return { endpoint, signature, timestamp, promise };
  };
}

function dispatchSummary(dispatch) {
  return {
    endpoint: dispatch.endpoint,
    signature: dispatch.signature,
    timestamp: dispatch.timestamp,
    status: 'queued'
  };
}

function localPaymentProvider() {
  return {
    driver: 'ledger-only',
    status: 'local-proof',
    note: 'Real internal payment ledger transitions; no external money movement.',
    authorizeJob({ db, job, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: null, contractor_id: null, provider_id: job.provider_id, amount_cents: job.pay_amount_cents * job.slots, status: 'payment_authorized', reason: 'Initial provider authorization state for job.', provider_driver: this.driver, created_at: now(), updated_at: now() };
      db.payment_ledger.push(row);
      return row;
    },
    createAssignmentLedger({ db, job, assignment, contractorId, reason, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: assignment.id, contractor_id: contractorId, provider_id: job.provider_id, amount_cents: job.pay_amount_cents, status: 'work_pending', reason, provider_driver: this.driver, created_at: now(), updated_at: now() };
      db.payment_ledger.push(row);
      return row;
    },
    markAssignment({ db, assignmentId, status, reason, now }) {
      const rows = db.payment_ledger.filter(x => x.assignment_id === assignmentId);
      rows.forEach(x => { x.status = status; x.reason = reason; x.provider_driver = this.driver; x.updated_at = now(); });
      return rows;
    },
    freeze({ payment, reason, now }) {
      payment.status = 'held';
      payment.reason = reason || 'Operator freeze.';
      payment.provider_driver = this.driver;
      payment.updated_at = now();
      return payment;
    }
  };
}

function webhookPaymentProvider(config) {
  const dispatch = signedWebhookDispatcher({ ...config, provider_kind: 'payment_provider', driver: 'payment-webhook' });
  return {
    driver: 'payment-webhook',
    status: 'connected',
    note: 'Signed payment events are dispatched to the configured webhook endpoint while local ledger rows remain authoritative.',
    authorizeJob({ db, job, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: null, contractor_id: null, provider_id: job.provider_id, amount_cents: job.pay_amount_cents * job.slots, status: 'payment_authorized', reason: 'Initial provider authorization state for job.', provider_driver: this.driver, created_at: now(), updated_at: now() };
      db.payment_ledger.push(row);
      row.external_dispatch = dispatchSummary(dispatch('payment_authorized', 'payment_ledger', row.id, { job_id: job.id, provider_id: job.provider_id, amount_cents: row.amount_cents, status: row.status }));
      return row;
    },
    createAssignmentLedger({ db, job, assignment, contractorId, reason, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: assignment.id, contractor_id: contractorId, provider_id: job.provider_id, amount_cents: job.pay_amount_cents, status: 'work_pending', reason, provider_driver: this.driver, created_at: now(), updated_at: now() };
      db.payment_ledger.push(row);
      row.external_dispatch = dispatchSummary(dispatch('assignment_payment_created', 'payment_ledger', row.id, { job_id: job.id, assignment_id: assignment.id, contractor_id: contractorId, amount_cents: row.amount_cents, status: row.status }));
      return row;
    },
    markAssignment({ db, assignmentId, status, reason, now }) {
      const rows = db.payment_ledger.filter(x => x.assignment_id === assignmentId);
      rows.forEach(x => {
        x.status = status;
        x.reason = reason;
        x.provider_driver = this.driver;
        x.updated_at = now();
        x.external_dispatch = dispatchSummary(dispatch('assignment_payment_status_changed', 'payment_ledger', x.id, { assignment_id: assignmentId, status: x.status, reason: x.reason }));
      });
      return rows;
    },
    freeze({ payment, reason, now }) {
      payment.status = 'held';
      payment.reason = reason || 'Operator freeze.';
      payment.provider_driver = this.driver;
      payment.updated_at = now();
      payment.external_dispatch = dispatchSummary(dispatch('payment_frozen', 'payment_ledger', payment.id, { assignment_id: payment.assignment_id, job_id: payment.job_id, status: payment.status, reason: payment.reason }));
      return payment;
    }
  };
}

function stripePaymentProvider(config) {
  const endpoint = `${config.STRIPE_API_BASE || 'https://api.stripe.com'}/v1/payment_intents`;
  return {
    driver: 'stripe',
    status: 'connected',
    note: 'Creates real Stripe PaymentIntent requests when STRIPE_SECRET_KEY is configured; local ledger remains the system record.',
    authorizeJob({ db, job, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: null, contractor_id: null, provider_id: job.provider_id, amount_cents: job.pay_amount_cents * job.slots, status: 'payment_authorization_queued', reason: 'Stripe PaymentIntent authorization queued.', provider_driver: this.driver, created_at: now(), updated_at: now() };
      const body = formBody({
        amount: row.amount_cents,
        currency: config.STRIPE_CURRENCY || 'usd',
        capture_method: config.STRIPE_CAPTURE_METHOD || 'manual',
        description: `SkyeRoutex job ${job.id}`,
        'metadata[job_id]': job.id,
        'metadata[payment_ledger_id]': row.id,
        'metadata[provider_id]': job.provider_id
      });
      row.external_dispatch = httpDispatchSummary({
        provider_kind: 'payment_provider',
        driver: this.driver,
        endpoint,
        headers: { ...bearer(config.STRIPE_SECRET_KEY), 'content-type': 'application/x-www-form-urlencoded' },
        body
      });
      db.payment_ledger.push(row);
      return row;
    },
    createAssignmentLedger({ db, job, assignment, contractorId, reason, id, now }) {
      const row = { id: id('pay'), job_id: job.id, assignment_id: assignment.id, contractor_id: contractorId, provider_id: job.provider_id, amount_cents: job.pay_amount_cents, status: 'work_pending', reason, provider_driver: this.driver, created_at: now(), updated_at: now() };
      db.payment_ledger.push(row);
      return row;
    },
    markAssignment({ db, assignmentId, status, reason, now }) {
      const rows = db.payment_ledger.filter(x => x.assignment_id === assignmentId);
      rows.forEach(x => { x.status = status; x.reason = reason; x.provider_driver = this.driver; x.updated_at = now(); });
      return rows;
    },
    freeze({ payment, reason, now }) {
      payment.status = 'held';
      payment.reason = reason || 'Operator freeze.';
      payment.provider_driver = this.driver;
      payment.updated_at = now();
      return payment;
    }
  };
}

function localNotificationProvider() {
  return {
    driver: 'in-app-ledger',
    status: 'local-proof',
    note: 'Notifications are persisted in the app ledger; no SMS/email/push delivery.',
    send({ db, user_id, title, body, id, now, channel = 'in_app' }) {
      const row = { id: id('not'), user_id, title, body, channel, delivery_provider: this.driver, delivery_status: 'stored', read_at: null, created_at: now() };
      db.notifications.push(row);
      return row;
    }
  };
}

function webhookNotificationProvider(config) {
  const dispatch = signedWebhookDispatcher({ ...config, provider_kind: 'notification_provider', driver: 'notification-webhook' });
  return {
    driver: 'notification-webhook',
    status: 'connected',
    note: 'Signed notification events are dispatched to the configured webhook endpoint and mirrored into the local notification ledger.',
    send({ db, user_id, title, body, id, now, channel = 'webhook' }) {
      const row = { id: id('not'), user_id, title, body, channel, delivery_provider: this.driver, delivery_status: 'queued', read_at: null, created_at: now() };
      db.notifications.push(row);
      row.external_dispatch = dispatchSummary(dispatch('notification_created', 'notification', row.id, { user_id, title, body, channel: row.channel }));
      return row;
    }
  };
}

function twilioNotificationProvider(config) {
  const endpoint = `${config.TWILIO_API_BASE || 'https://api.twilio.com'}/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;
  return {
    driver: 'twilio',
    status: 'connected',
    note: 'Sends real Twilio Message requests when account credentials and a recipient number are configured.',
    send({ db, user_id, title, body, id, now, channel = 'sms' }) {
      const text = `${title}: ${body}`.slice(0, 1500);
      const row = { id: id('not'), user_id, title, body, channel, delivery_provider: this.driver, delivery_status: 'queued', read_at: null, created_at: now() };
      const form = formBody({ To: config.TWILIO_DEFAULT_TO, From: config.TWILIO_FROM_NUMBER, Body: text, StatusCallback: config.TWILIO_STATUS_CALLBACK_URL });
      row.external_dispatch = httpDispatchSummary({
        provider_kind: 'notification_provider',
        driver: this.driver,
        endpoint,
        headers: { ...basic(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN), 'content-type': 'application/x-www-form-urlencoded' },
        body: form
      });
      db.notifications.push(row);
      return row;
    }
  };
}

function localRouteIntelligenceProvider() {
  return {
    driver: 'route-structure-only',
    status: 'local-proof',
    note: 'Deterministic local route stop planning and late-risk flags; no live maps/geocoding/ETA provider.',
    planRoute({ db, job, body, id, now }) {
      const route = { id: id('rte'), job_id: job.id, mode: job.route_mode, vehicle_type: job.vehicle_type, arrival_window: job.arrival_window, pickup_location: body.pickup_location || null, dropoff_location: body.dropoff_location || null, status: 'planned', route_provider: this.driver, late_risk: job.arrival_window ? 'unknown_without_live_eta' : 'not_evaluated', created_at: now(), updated_at: now() };
      db.route_jobs.push(route);
      const stops = Array.isArray(body.route_stops) && body.route_stops.length ? body.route_stops : [{ label: 'Arrive', address: body.location, proof_required: true }];
      stops.forEach((stop, idx) => db.route_stops.push({ id: id('rst'), route_job_id: route.id, job_id: job.id, sequence: idx + 1, label: stop.label || `Stop ${idx + 1}`, address: stop.address || '', proof_required: !!stop.proof_required, status: 'pending', route_provider: this.driver, planned_eta_minutes: idx * 15, created_at: now(), updated_at: now() }));
      return route;
    },
    completeStop({ db, route, stop, proofNote, now }) {
      stop.status = 'completed';
      stop.proof_note = proofNote || null;
      stop.completed_at = now();
      stop.updated_at = now();
      if (db.route_stops.filter(s => s.route_job_id === route.id).every(s => s.status === 'completed')) {
        route.status = 'completed';
        route.updated_at = now();
      }
      return { route, stop };
    }
  };
}

function mapboxRouteIntelligenceProvider(config) {
  const base = config.MAPBOX_API_BASE || 'https://api.mapbox.com';
  function coordinates(stop) {
    const lng = Number(stop.lng ?? stop.longitude);
    const lat = Number(stop.lat ?? stop.latitude);
    return Number.isFinite(lng) && Number.isFinite(lat) ? `${lng},${lat}` : null;
  }
  return {
    driver: 'mapbox',
    status: 'connected',
    note: 'Requests real Mapbox Directions data when route stops include lng/lat coordinates and MAPBOX_ACCESS_TOKEN is configured.',
    planRoute({ db, job, body, id, now }) {
      const route = { id: id('rte'), job_id: job.id, mode: job.route_mode, vehicle_type: job.vehicle_type, arrival_window: job.arrival_window, pickup_location: body.pickup_location || null, dropoff_location: body.dropoff_location || null, status: 'planned', route_provider: this.driver, late_risk: 'pending_live_eta', created_at: now(), updated_at: now() };
      db.route_jobs.push(route);
      const stops = Array.isArray(body.route_stops) && body.route_stops.length ? body.route_stops : [{ label: 'Arrive', address: body.location, proof_required: true }];
      const coords = stops.map(coordinates).filter(Boolean);
      stops.forEach((stop, idx) => db.route_stops.push({ id: id('rst'), route_job_id: route.id, job_id: job.id, sequence: idx + 1, label: stop.label || `Stop ${idx + 1}`, address: stop.address || '', proof_required: !!stop.proof_required, status: 'pending', route_provider: this.driver, planned_eta_minutes: null, created_at: now(), updated_at: now() }));
      if (coords.length >= 2) {
        const profile = config.MAPBOX_PROFILE || 'driving';
        const endpoint = `${base}/directions/v5/mapbox/${encodeURIComponent(profile)}/${coords.join(';')}?access_token=${encodeURIComponent(config.MAPBOX_ACCESS_TOKEN)}&overview=false&steps=false`;
        route.external_dispatch = httpDispatchSummary({ provider_kind: 'route_intelligence', driver: this.driver, endpoint, method: 'GET' });
      } else {
        route.external_dispatch = { provider_kind: 'route_intelligence', driver: this.driver, status: 'not_queued_missing_coordinates', required: 'route_stops[].lng and route_stops[].lat for at least two stops' };
      }
      return route;
    },
    completeStop({ db, route, stop, proofNote, now }) {
      stop.status = 'completed';
      stop.proof_note = proofNote || null;
      stop.completed_at = now();
      stop.updated_at = now();
      if (db.route_stops.filter(s => s.route_job_id === route.id).every(s => s.status === 'completed')) {
        route.status = 'completed';
        route.updated_at = now();
      }
      return { route, stop };
    }
  };
}

function webhookComplianceProvider(config) {
  const dispatch = signedWebhookDispatcher({ ...config, provider_kind: 'identity_compliance', driver: 'compliance-webhook' });
  return {
    driver: 'compliance-webhook',
    status: 'connected',
    note: 'Signed identity/compliance attestation events are dispatched to the configured webhook endpoint and recorded locally.',
    recordUserAttestation({ db, userId, role, id, now }) {
      const row = { id: id('cmp'), user_id: userId, role, provider: this.driver, status: 'external_attestation_queued', checks: ['terms_attestation'], created_at: now() };
      db.compliance_checks.push(row);
      row.external_dispatch = dispatchSummary(dispatch('user_compliance_attested', 'compliance_check', row.id, { user_id: userId, role, status: row.status, checks: row.checks }));
      return row;
    },
    recordAssignmentAttestation({ db, assignment, id, now }) {
      const row = { id: id('cmp'), user_id: assignment.contractor_id, assignment_id: assignment.id, provider: this.driver, status: 'external_assignment_attestation_queued', checks: ['assignment_state_machine'], created_at: now() };
      db.compliance_checks.push(row);
      row.external_dispatch = dispatchSummary(dispatch('assignment_compliance_attested', 'compliance_check', row.id, { user_id: assignment.contractor_id, assignment_id: assignment.id, status: row.status, checks: row.checks }));
      return row;
    }
  };
}

function checkrComplianceProvider(config) {
  const endpoint = `${config.CHECKR_API_BASE || 'https://api.checkr.com'}/v1/invitations`;
  return {
    driver: 'checkr',
    status: 'connected',
    note: 'Creates real Checkr invitation requests when CHECKR_API_KEY and package/workflow configuration are present.',
    recordUserAttestation({ db, userId, role, id, now }) {
      const row = { id: id('cmp'), user_id: userId, role, provider: this.driver, status: 'background_invitation_queued', checks: ['terms_attestation', 'background_invitation'], created_at: now() };
      const body = formBody({
        package: config.CHECKR_PACKAGE,
        work_locations: config.CHECKR_WORK_LOCATION || 'US',
        candidate_id: config.CHECKR_CANDIDATE_ID || userId
      });
      row.external_dispatch = httpDispatchSummary({
        provider_kind: 'identity_compliance',
        driver: this.driver,
        endpoint,
        headers: { ...basic(config.CHECKR_API_KEY, ''), 'content-type': 'application/x-www-form-urlencoded' },
        body
      });
      db.compliance_checks.push(row);
      return row;
    },
    recordAssignmentAttestation({ db, assignment, id, now }) {
      const row = { id: id('cmp'), user_id: assignment.contractor_id, assignment_id: assignment.id, provider: this.driver, status: 'assignment_compliance_recorded', checks: ['assignment_state_machine'], created_at: now() };
      db.compliance_checks.push(row);
      return row;
    }
  };
}

function localComplianceProvider() {
  return {
    driver: 'local-attestation-ledger',
    status: 'local-proof',
    note: 'Records local compliance attestations; no KYC, background-check, tax, or legal classification provider.',
    recordUserAttestation({ db, userId, role, id, now }) {
      const row = { id: id('cmp'), user_id: userId, role, provider: this.driver, status: 'attested_local_only', checks: ['terms_attestation'], created_at: now() };
      db.compliance_checks.push(row);
      return row;
    },
    recordAssignmentAttestation({ db, assignment, id, now }) {
      const row = { id: id('cmp'), user_id: assignment.contractor_id, assignment_id: assignment.id, provider: this.driver, status: 'work_assignment_local_only', checks: ['assignment_state_machine'], created_at: now() };
      db.compliance_checks.push(row);
      return row;
    }
  };
}

function webhookSkyeHandsRuntimeProvider(config) {
  const dispatch = signedWebhookDispatcher({ ...config, provider_kind: 'skyehands_runtime', driver: 'skyehands-runtime-webhook' });
  return {
    driver: 'skyehands-runtime-webhook',
    status: 'connected',
    note: 'Signed SkyeHands runtime events are dispatched to the configured webhook endpoint and mirrored locally.',
    emit({ db, event, id, now }) {
      const row = { id: id('rtevt'), provider: this.driver, event_type: event.event_type, entity_type: event.entity_type, entity_id: event.entity_id, actor_user_id: event.actor_user_id || null, metadata: event.metadata || {}, created_at: now() };
      db.runtime_events.push(row);
      row.external_dispatch = dispatchSummary(dispatch(row.event_type, row.entity_type, row.entity_id, { runtime_event_id: row.id, actor_user_id: row.actor_user_id, metadata: row.metadata }));
      return row;
    }
  };
}

function defaultSkyeHandsBusDir() {
  return path.resolve(process.cwd(), '../../skyehands_runtime_control/.skyequanta');
}

function skyeHandsRuntimeBusProvider(config) {
  const busRoot = path.resolve(config.SKYEHANDS_RUNTIME_BUS_DIR || defaultSkyeHandsBusDir());
  const queueDir = path.join(busRoot, 'bus-queue');
  const auditLedger = path.join(busRoot, 'bus-audit.ndjson');
  const sourcePlatform = config.SKYEHANDS_RUNTIME_SOURCE_PLATFORM || 'skyeroutex-workforce-command';
  const targetPlatform = config.SKYEHANDS_RUNTIME_TARGET_PLATFORM || null;
  const canonicalEventType = config.SKYEHANDS_RUNTIME_BUS_EVENT_TYPE || 'app.generated';

  return {
    driver: 'skyehands-runtime-bus',
    status: 'connected',
    note: 'Publishes SkyeRoutex runtime events into the canonical SkyeHands file-backed platform bus and bus audit ledger.',
    emit({ db, event, id, now }) {
      const row = { id: id('rtevt'), provider: this.driver, event_type: event.event_type, entity_type: event.entity_type, entity_id: event.entity_id, actor_user_id: event.actor_user_id || null, metadata: event.metadata || {}, created_at: now() };
      const payload = {
        runtime_event_id: row.id,
        source_audit_event_id: event.id,
        original_event_type: row.event_type,
        original_entity_type: row.entity_type,
        original_entity_id: row.entity_id,
        actor_user_id: row.actor_user_id,
        metadata: row.metadata
      };
      const payloadString = JSON.stringify(payload);
      const envelope = {
        eventId: crypto.randomUUID(),
        tenantId: config.SKYEHANDS_RUNTIME_TENANT_ID || 'default',
        workspaceId: config.SKYEHANDS_RUNTIME_WORKSPACE_ID || 'skyeroutex-workforce-command',
        actorId: row.actor_user_id || 'system',
        sourcePlatform,
        targetPlatform,
        eventType: canonicalEventType,
        payload,
        payloadHash: crypto.createHash('sha256').update(payloadString).digest('hex'),
        createdAt: row.created_at,
        replayNonce: crypto.randomBytes(16).toString('hex')
      };
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(path.join(queueDir, `${envelope.eventId}.json`), JSON.stringify(envelope, null, 2));
      fs.mkdirSync(path.dirname(auditLedger), { recursive: true });
      fs.appendFileSync(auditLedger, `${JSON.stringify({ action: 'published', envelope, status: 'sent', at: now() })}\n`);
      row.external_dispatch = {
        bus_root: busRoot,
        queue_file: path.join(queueDir, `${envelope.eventId}.json`),
        audit_ledger: auditLedger,
        event_id: envelope.eventId,
        event_type: envelope.eventType,
        payload_hash: envelope.payloadHash,
        status: 'published'
      };
      db.runtime_events.push(row);
      return row;
    }
  };
}

function localSkyeHandsRuntimeProvider() {
  return {
    driver: 'standalone-local-events',
    status: 'local-proof',
    note: 'Writes local runtime events without publishing to the SkyeHands platform bus.',
    emit({ db, event, id, now }) {
      const row = { id: id('rtevt'), provider: this.driver, event_type: event.event_type, entity_type: event.entity_type, entity_id: event.entity_id, actor_user_id: event.actor_user_id || null, metadata: event.metadata || {}, created_at: now() };
      db.runtime_events.push(row);
      return row;
    }
  };
}

export function createPlatformServices({ env = process.env } = {}) {
  const localProofAllowed = env.SKYE_ALLOW_LOCAL_PROOF_SERVICES === '1';
  const paymentDriver = env.PAYMENT_PROVIDER || (localProofAllowed ? 'ledger-only' : 'payment-webhook');
  const notificationDriver = env.NOTIFICATION_PROVIDER || (localProofAllowed ? 'in-app-ledger' : 'notification-webhook');
  const routeDriver = env.ROUTE_INTELLIGENCE_PROVIDER || (localProofAllowed ? 'route-structure-only' : 'mapbox');
  const complianceDriver = env.IDENTITY_COMPLIANCE_PROVIDER || (localProofAllowed ? 'local-attestation-ledger' : 'checkr');
  const runtimeDriver = env.SKYEHANDS_RUNTIME_PROVIDER || (localProofAllowed ? 'standalone-local-events' : 'skyehands-runtime-bus');

  const paymentWebhook = paymentDriver === 'payment-webhook' ? requiredWebhookConfig('PAYMENT_PROVIDER', paymentDriver, env, 'PAYMENT_WEBHOOK_ENDPOINT', 'PAYMENT_WEBHOOK_SIGNING_SECRET') : null;
  const notificationWebhook = notificationDriver === 'notification-webhook' ? requiredWebhookConfig('NOTIFICATION_PROVIDER', notificationDriver, env, 'NOTIFICATION_WEBHOOK_ENDPOINT', 'NOTIFICATION_WEBHOOK_SIGNING_SECRET') : null;
  const complianceWebhook = complianceDriver === 'compliance-webhook' ? requiredWebhookConfig('IDENTITY_COMPLIANCE_PROVIDER', complianceDriver, env, 'COMPLIANCE_WEBHOOK_ENDPOINT', 'COMPLIANCE_WEBHOOK_SIGNING_SECRET') : null;
  const runtimeWebhook = runtimeDriver === 'skyehands-runtime-webhook' ? requiredWebhookConfig('SKYEHANDS_RUNTIME_PROVIDER', runtimeDriver, env, 'SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT', 'SKYEHANDS_RUNTIME_WEBHOOK_SIGNING_SECRET') : null;
  const stripeConfig = paymentDriver === 'stripe' ? requiredConfig('PAYMENT_PROVIDER', paymentDriver, env, ['STRIPE_SECRET_KEY']) : null;
  const twilioConfig = notificationDriver === 'twilio' ? requiredConfig('NOTIFICATION_PROVIDER', notificationDriver, env, ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_DEFAULT_TO']) : null;
  const mapboxConfig = routeDriver === 'mapbox' ? requiredConfig('ROUTE_INTELLIGENCE_PROVIDER', routeDriver, env, ['MAPBOX_ACCESS_TOKEN']) : null;
  const checkrConfig = complianceDriver === 'checkr' ? requiredConfig('IDENTITY_COMPLIANCE_PROVIDER', complianceDriver, env, ['CHECKR_API_KEY', 'CHECKR_PACKAGE']) : null;

  return {
    payment: paymentDriver === 'ledger-only' ? localPaymentProvider() : paymentDriver === 'payment-webhook' ? webhookPaymentProvider(paymentWebhook) : paymentDriver === 'stripe' ? stripePaymentProvider({ ...env, ...stripeConfig }) : unsupportedProvider('PAYMENT_PROVIDER', paymentDriver),
    notifications: notificationDriver === 'in-app-ledger' ? localNotificationProvider() : notificationDriver === 'notification-webhook' ? webhookNotificationProvider(notificationWebhook) : notificationDriver === 'twilio' ? twilioNotificationProvider({ ...env, ...twilioConfig }) : unsupportedProvider('NOTIFICATION_PROVIDER', notificationDriver),
    routeIntelligence: routeDriver === 'route-structure-only' ? localRouteIntelligenceProvider() : routeDriver === 'mapbox' ? mapboxRouteIntelligenceProvider({ ...env, ...mapboxConfig }) : unsupportedProvider('ROUTE_INTELLIGENCE_PROVIDER', routeDriver),
    compliance: ['local-attestation-ledger', 'none'].includes(complianceDriver) ? localComplianceProvider() : complianceDriver === 'compliance-webhook' ? webhookComplianceProvider(complianceWebhook) : complianceDriver === 'checkr' ? checkrComplianceProvider({ ...env, ...checkrConfig }) : unsupportedProvider('IDENTITY_COMPLIANCE_PROVIDER', complianceDriver),
    runtime: ['standalone-local-events', 'standalone'].includes(runtimeDriver) ? localSkyeHandsRuntimeProvider() : runtimeDriver === 'skyehands-runtime-webhook' ? webhookSkyeHandsRuntimeProvider(runtimeWebhook) : runtimeDriver === 'skyehands-runtime-bus' ? skyeHandsRuntimeBusProvider(env) : unsupportedProvider('SKYEHANDS_RUNTIME_PROVIDER', runtimeDriver)
  };
}
