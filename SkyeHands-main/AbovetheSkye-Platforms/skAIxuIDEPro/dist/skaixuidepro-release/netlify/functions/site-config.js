import { getStore } from '@netlify/blobs';
import { json, noContent, parseBody, requireMember } from './_lib/kaixu-platform.js';

const DEFAULT_CONFIG = {
  announcement: 's0l26 0s · skAIxuIDEpro is part of the Creative Environment Eco-System by Skyes Over London and kAIxU.',
  footer_collapsed: true,
  support_email: 'SkyesOverLondonLC@SOLEnterprises.org',
  support_phone: '(480) 469-5416'
};

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();

  let store = null;
  try {
    store = getStore({ name: 'skaixuide-runtime', consistency: 'strong' });
  } catch (error) {
    if (event.httpMethod === 'GET') {
      return json(200, {
        ok: true,
        degraded: true,
        config: DEFAULT_CONFIG,
        warning: error.message || 'Netlify Blobs unavailable'
      });
    }
    return json(503, { ok: false, error: error.message || 'Netlify Blobs unavailable' });
  }

  if (event.httpMethod === 'GET') {
    try {
      const current = await store.getJSON('site-config');
      return json(200, { ok: true, config: { ...DEFAULT_CONFIG, ...(current || {}) } });
    } catch (error) {
      return json(200, {
        ok: true,
        degraded: true,
        config: DEFAULT_CONFIG,
        warning: error.message || 'Netlify Blobs unavailable'
      });
    }
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    await requireMember(context, { requireAdmin: true });
    const body = parseBody(event);
    const next = {
      ...DEFAULT_CONFIG,
      ...(await store.getJSON('site-config') || {}),
      announcement: String(body.announcement || DEFAULT_CONFIG.announcement).slice(0, 2000),
      footer_collapsed: Boolean(body.footer_collapsed),
      support_email: String(body.support_email || DEFAULT_CONFIG.support_email).slice(0, 320),
      support_phone: String(body.support_phone || DEFAULT_CONFIG.support_phone).slice(0, 64)
    };
    await store.setJSON('site-config', next);
    return json(200, { ok: true, config: next });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'site config failed' });
  }
};
