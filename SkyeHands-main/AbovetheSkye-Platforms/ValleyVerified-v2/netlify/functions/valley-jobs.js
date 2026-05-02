'use strict';

const { requireOperator, verifyOperatorBearer } = require('./_lib/skygate-auth');
const { emit, json, normalizeJob, parseBody, readState, writeState } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  const state = readState();

  if (event.httpMethod === 'GET') {
    const status = event.queryStringParameters?.status || 'posted';
    const jobs = state.jobs
      .filter((job) => !status || status === 'all' || job.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(200, { ok: true, jobs });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const denied = requireOperator(event);
  if (denied) return denied;
  const auth = verifyOperatorBearer(event);
  const job = normalizeJob(parseBody(event), auth.claims || {});
  if (!job.company) return json(400, { ok: false, error: 'company is required' });
  if (!job.title) return json(400, { ok: false, error: 'title is required' });

  state.jobs.unshift(job);
  emit(state, 'valleyverified.job.posted', {
    job_id: job.id,
    company: job.company,
    type: job.type,
    route_to: ['jobping.board', 'ae-flow.dispatch', 'skye-routex.procurement'],
  });
  writeState(state);
  return json(201, { ok: true, job });
};
