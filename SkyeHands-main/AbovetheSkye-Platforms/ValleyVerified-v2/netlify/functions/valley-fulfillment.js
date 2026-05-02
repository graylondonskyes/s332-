'use strict';

const { requireOperator } = require('./_lib/skygate-auth');
const { emit, json, nowISO, parseBody, readState, writeState } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  const state = readState();

  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, fulfillments: state.fulfillments, events: state.events.slice(0, 50) });
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') return json(405, { ok: false, error: 'Method not allowed' });
  const denied = requireOperator(event);
  if (denied) return denied;
  const body = parseBody(event);
  const fulfillment = state.fulfillments.find((item) => item.id === body.fulfillment_id || item.job_id === body.job_id);
  if (!fulfillment) return json(404, { ok: false, error: 'Fulfillment not found' });

  fulfillment.status = body.status || fulfillment.status;
  fulfillment.procurement_status = body.procurement_status || fulfillment.procurement_status;
  fulfillment.payment_status = body.payment_status || fulfillment.payment_status;
  fulfillment.notes = body.notes || fulfillment.notes || '';
  fulfillment.updatedAt = nowISO();

  const job = state.jobs.find((item) => item.id === fulfillment.job_id);
  if (job && fulfillment.status === 'fulfilled') {
    job.status = 'fulfilled';
    job.updatedAt = nowISO();
  }

  emit(state, 'valleyverified.fulfillment.updated', {
    fulfillment_id: fulfillment.id,
    job_id: fulfillment.job_id,
    status: fulfillment.status,
    procurement_status: fulfillment.procurement_status,
    payment_status: fulfillment.payment_status,
    route_to: ['skye-routex.payment', 'ae-flow.closeout', 'jobping.customer_update'],
  });
  writeState(state);
  return json(200, { ok: true, fulfillment, job });
};
