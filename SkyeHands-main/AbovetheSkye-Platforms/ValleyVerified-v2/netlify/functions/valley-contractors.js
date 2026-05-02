'use strict';

const { requireOperator, verifyOperatorBearer } = require('./_lib/skygate-auth');
const { emit, json, normalizeContractor, parseBody, readState, writeState } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  const state = readState();

  if (event.httpMethod === 'GET') {
    const status = event.queryStringParameters?.status || 'verified';
    const contractors = state.contractors
      .filter((contractor) => !status || status === 'all' || contractor.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(200, { ok: true, contractors });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const denied = requireOperator(event);
  if (denied) return denied;
  const auth = verifyOperatorBearer(event);
  const contractor = normalizeContractor(parseBody(event), auth.claims || {});
  if (!contractor.name) return json(400, { ok: false, error: 'name is required' });
  if (!contractor.email) return json(400, { ok: false, error: 'email is required' });

  const existingIndex = state.contractors.findIndex((item) => item.email === contractor.email);
  if (existingIndex >= 0) {
    contractor.id = state.contractors[existingIndex].id;
    contractor.createdAt = state.contractors[existingIndex].createdAt;
    state.contractors[existingIndex] = contractor;
  } else {
    state.contractors.unshift(contractor);
  }

  emit(state, 'valleyverified.contractor.onboarded', {
    contractor_id: contractor.id,
    status: contractor.status,
    route_to: ['ae-contractor-network.review', 'contractor-income-verification', 'skye-routex.vendor-profile'],
  });
  writeState(state);
  return json(existingIndex >= 0 ? 200 : 201, { ok: true, contractor });
};
