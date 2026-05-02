'use strict';

const { requireOperator, verifyOperatorBearer } = require('./_lib/skygate-auth');
const { emit, id, json, nowISO, parseBody, readState, scoreMatch, writeState } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  const state = readState();

  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, claims: state.claims, fulfillments: state.fulfillments });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const denied = requireOperator(event);
  if (denied) return denied;
  const auth = verifyOperatorBearer(event);
  const body = parseBody(event);
  const job = state.jobs.find((item) => item.id === body.job_id);
  if (!job) return json(404, { ok: false, error: 'Job not found' });
  if (job.status !== 'posted') return json(409, { ok: false, error: 'Job is not open for claim' });

  const contractor = state.contractors.find((item) => item.id === body.contractor_id || item.email === body.contractor_email);
  if (!contractor) return json(404, { ok: false, error: 'Contractor not found' });
  if (contractor.status === 'suspended') return json(403, { ok: false, error: 'Contractor is suspended' });

  const claim = {
    id: id('clm'),
    job_id: job.id,
    contractor_id: contractor.id,
    status: 'accepted',
    match_score: scoreMatch(job, contractor),
    claimedBy: auth.claims?.sub || auth.claims?.email || 'unknown',
    createdAt: nowISO(),
  };
  const fulfillment = {
    id: id('ful'),
    claim_id: claim.id,
    job_id: job.id,
    contractor_id: contractor.id,
    company: job.company,
    contractor: contractor.name,
    status: 'assigned',
    procurement_status: 'ready_for_work_order',
    payment_status: 'pending_skye_routex',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  job.status = 'claimed';
  job.updatedAt = nowISO();
  state.claims.unshift(claim);
  state.fulfillments.unshift(fulfillment);
  emit(state, 'valleyverified.job.claimed', {
    job_id: job.id,
    claim_id: claim.id,
    fulfillment_id: fulfillment.id,
    route_to: ['jobping.message.contractor', 'ae-flow.follow_up', 'skye-routex.work_order'],
  });
  writeState(state);
  return json(201, { ok: true, claim, fulfillment, job, contractor });
};
