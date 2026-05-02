const RESPONSES_ROUTE = '/v1/responses';

const PROVIDER_CONTRACTS = {
  skydexia: {
    provider: 'skydexia',
    requiredEnv: ['SKYDEXIA_WORKER_URL'],
    requiredActionFields: ['brief'],
    endpoint: '/build-website',
    baseUrl: 'http://localhost:4120',
  },
  'skydexia-threejs': {
    provider: 'skydexia-threejs',
    requiredEnv: ['SKYDEXIA_WORKER_URL'],
    requiredActionFields: ['brief'],
    endpoint: '/build-threejs',
    baseUrl: 'http://localhost:4120',
  },
  'skydexia-health': {
    provider: 'skydexia-health',
    requiredEnv: ['SKYDEXIA_WORKER_URL'],
    requiredActionFields: [],
    endpoint: '/health',
    baseUrl: 'http://localhost:4120',
  },
  'skydexia-status': {
    provider: 'skydexia-status',
    requiredEnv: ['SKYDEXIA_WORKER_URL'],
    requiredActionFields: [],
    endpoint: '/status',
    baseUrl: 'http://localhost:4120',
  },
  'skydexia-preview': {
    provider: 'skydexia-preview',
    requiredEnv: ['SKYDEXIA_WORKER_URL'],
    requiredActionFields: ['projectId'],
    endpoint: '/preview',
    baseUrl: 'http://localhost:4120',
  },
  openai: {
    provider: 'openai',
    requiredEnv: ['OPENAI_API_KEY'],
    requiredActionFields: ['model', 'input'],
    endpoint: RESPONSES_ROUTE,
    baseUrl: 'https://api.openai.com'
  },
  printful: {
    provider: 'printful',
    requiredEnv: ['PRINTFUL_API_TOKEN'],
    requiredActionFields: ['sku', 'quantity'],
    endpoint: '/orders',
    baseUrl: 'https://api.printful.com'
  },
  calendly: {
    provider: 'calendly',
    requiredEnv: ['CALENDLY_TOKEN'],
    requiredActionFields: ['eventTypeUri', 'inviteeEmail'],
    endpoint: '/scheduling_links',
    baseUrl: 'https://api.calendly.com'
  },
  anthropic: {
    provider: 'anthropic',
    requiredEnv: ['ANTHROPIC_API_KEY'],
    requiredActionFields: ['model', 'input'],
    endpoint: '/v1/messages',
    baseUrl: 'https://api.anthropic.com'
  },
  gemini: {
    provider: 'gemini',
    requiredEnv: ['GEMINI_API_KEY'],
    requiredActionFields: ['model', 'input'],
    endpoint: '/v1beta/models',
    baseUrl: 'https://generativelanguage.googleapis.com'
  },
};

function getProviderContract(provider) {
  return PROVIDER_CONTRACTS[String(provider || '').toLowerCase()] || null;
}

function isDryRun(env = process.env) {
  return String(env.AE_PROVIDERS_DRY_RUN || '').trim() === '1';
}

function validateProviderAction(provider, action = {}, env = process.env) {
  const contract = getProviderContract(provider);
  if (!contract) {
    return { ok: false, errors: [`Unsupported provider '${provider}'.`] };
  }

  const missingEnv = isDryRun(env)
    ? []
    : contract.requiredEnv.filter((key) => !String(env[key] || '').trim());
  const missingFields = contract.requiredActionFields.filter(
    (key) => action[key] === undefined || action[key] === null || String(action[key]).trim() === ''
  );
  const errors = [];
  if (missingEnv.length) errors.push(`Missing env vars: ${missingEnv.join(', ')}`);
  if (missingFields.length) errors.push(`Missing action fields: ${missingFields.join(', ')}`);

  return { ok: errors.length === 0, provider: contract.provider, endpoint: contract.endpoint, errors, contract };
}

// ── Per-provider HTTP dispatch ──────────────────────────────────────────────

async function dispatchOpenAI(action, env) {
  const apiKey = String(env.OPENAI_API_KEY || '');
  const body = {
    model: action.model,
    input: action.input,
  };
  if (action.systemPrompt) body.instructions = action.systemPrompt;
  if (action.maxTokens) body.max_output_tokens = action.maxTokens;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message || JSON.stringify(data)}`);

  const text = data.output?.find((b) => b.type === 'message')?.content?.find((c) => c.type === 'output_text')?.text
    || data.output?.[0]?.content?.[0]?.text
    || '';

  return { rawResponse: data, text, usage: data.usage || {}, responseId: data.id };
}

async function dispatchAnthropic(action, env) {
  const apiKey = String(env.ANTHROPIC_API_KEY || '');
  const body = {
    model: action.model,
    max_tokens: action.maxTokens || 1024,
    messages: [{ role: 'user', content: action.input }]
  };
  if (action.systemPrompt) body.system = action.systemPrompt;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data.error?.message || JSON.stringify(data)}`);

  const text = data.content?.find((b) => b.type === 'text')?.text || '';
  return { rawResponse: data, text, usage: data.usage || {}, responseId: data.id };
}

async function dispatchGemini(action, env) {
  const apiKey = String(env.GEMINI_API_KEY || '');
  const model = action.model || 'gemini-1.5-flash';
  const body = {
    contents: [{ parts: [{ text: action.input }] }]
  };
  if (action.systemPrompt) {
    body.systemInstruction = { parts: [{ text: action.systemPrompt }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message || JSON.stringify(data)}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};
  return { rawResponse: data, text, usage, responseId: `gemini_${Date.now()}` };
}

async function dispatchPrintful(action, env) {
  const apiKey = String(env.PRINTFUL_API_TOKEN || '');
  const body = {
    recipient: action.recipient || {
      name: action.recipientName || 'Draft Order',
      address1: '1 Placeholder St',
      city: 'Los Angeles',
      state_code: 'CA',
      country_code: 'US',
      zip: '90001'
    },
    items: [{ sync_variant_id: action.sku, quantity: Number(action.quantity) || 1 }],
    confirm: false
  };

  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Printful ${res.status}: ${data.error?.message || JSON.stringify(data)}`);

  return { rawResponse: data, orderId: data.result?.id, status: data.result?.status, responseId: `pf_${data.result?.id || Date.now()}` };
}

async function dispatchSkydexia(action, env) {
  const workerUrl = String(env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
  const secret    = String(env.SKYDEXIA_WORKER_SECRET || '');

  const brief = String(action.brief || action.input || '').trim();
  if (!brief) throw new Error('SkyeDexia: brief or input is required');

  const body = {
    brief,
    name:     String(action.name || action.input || brief).slice(0, 140),
    tenantId: action.tenantId  || 'ae-commandhub',
    actorId:  action.actorId   || 'ae-brain',
    audience: action.audience  || null,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-worker-secret'] = secret;

  const res  = await fetch(`${workerUrl}/build-website`, {
    method: 'POST',
    headers,
    body:   JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SkyeDexia worker ${res.status}: ${data.error || JSON.stringify(data)}`);

  return {
    rawResponse:           data,
    projectId:             data.projectId,
    orchestratorProjectId: data.orchestratorProjectId,
    artifactId:            data.artifactId,
    appGeneratedEventId:   data.appGeneratedEventId,
    siteName:              data.siteName,
    qualityScore:          data.qualityScore,
    files:                 data.files,
    artifactsDir:          data.artifactsDir,
    responseId:            `skydexia_${data.projectId || Date.now()}`,
  };
}

async function dispatchSkydexiaThreejs(action, env) {
  const workerUrl = String(env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
  const secret    = String(env.SKYDEXIA_WORKER_SECRET || '');
  const brief = String(action.brief || action.input || '').trim();
  if (!brief) throw new Error('SkyeDexia Three.js: brief or input is required');
  const body = {
    brief,
    name:     String(action.name || brief).slice(0, 140),
    tenantId: action.tenantId || 'ae-commandhub',
    actorId:  action.actorId  || 'ae-brain',
    audience: action.audience || null,
    forceHas3D: true,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-worker-secret'] = secret;
  const res  = await fetch(`${workerUrl}/build-threejs`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`SkyeDexia three.js worker ${res.status}: ${data.error || JSON.stringify(data)}`);
  return {
    rawResponse: data,
    projectId: data.projectId,
    orchestratorProjectId: data.orchestratorProjectId,
    artifactId: data.artifactId,
    siteName: data.siteName,
    qualityScore: data.qualityScore,
    previewScreenshot: data.previewScreenshot,
    files: data.files,
    artifactsDir: data.artifactsDir,
    responseId: `skydexia_3js_${data.projectId || Date.now()}`,
  };
}

async function dispatchSkydexiaHealth(action, env) {
  const workerUrl = String(env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
  const secret    = String(env.SKYDEXIA_WORKER_SECRET || '');
  const headers = {};
  if (secret) headers['x-worker-secret'] = secret;
  const res  = await fetch(`${workerUrl}/health`, { headers, signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`SkyeDexia health ${res.status}: ${JSON.stringify(data)}`);
  return { rawResponse: data, ok: true, uptime: data.uptime, startedAt: data.startedAt, responseId: `skydexia_health_${Date.now()}` };
}

async function dispatchSkydexiaStatus(action, env) {
  const workerUrl = String(env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
  const secret    = String(env.SKYDEXIA_WORKER_SECRET || '');
  const headers = {};
  if (secret) headers['x-worker-secret'] = secret;
  const res  = await fetch(`${workerUrl}/status`, { headers, signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (!res.ok) throw new Error(`SkyeDexia status ${res.status}: ${JSON.stringify(data)}`);
  return { rawResponse: data, ok: true, providers: data.providers, recentProjects: data.recentProjects, responseId: `skydexia_status_${Date.now()}` };
}

async function dispatchSkydexiaPreview(action, env) {
  const workerUrl = String(env.SKYDEXIA_WORKER_URL || 'http://localhost:4120').replace(/\/$/, '');
  const secret    = String(env.SKYDEXIA_WORKER_SECRET || '');
  const projectId = String(action.projectId || '').trim();
  if (!projectId) throw new Error('SkyeDexia preview: projectId is required');
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-worker-secret'] = secret;
  const res  = await fetch(`${workerUrl}/preview`, { method: 'POST', headers, body: JSON.stringify({ projectId }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`SkyeDexia preview ${res.status}: ${data.error || JSON.stringify(data)}`);
  return { rawResponse: data, ok: true, previewScreenshot: data.previewScreenshot, projectId, responseId: `skydexia_preview_${Date.now()}` };
}

async function dispatchCalendly(action, env) {
  const apiKey = String(env.CALENDLY_TOKEN || '');

  // Resolve the event type URI — use provided or fetch from user profile
  let eventTypeUri = action.eventTypeUri;
  if (!eventTypeUri) {
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error(`Calendly /users/me ${meRes.status}: ${JSON.stringify(meData)}`);

    const etRes = await fetch(
      `https://api.calendly.com/event_types?user=${meData.resource?.uri}&count=1&active=true`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    const etData = await etRes.json();
    eventTypeUri = etData.collection?.[0]?.uri;
    if (!eventTypeUri) throw new Error('Calendly: no active event types found on account');
  }

  const body = { max_event_count: 1, owner: eventTypeUri, owner_type: 'EventType' };
  const res = await fetch('https://api.calendly.com/scheduling_links', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly scheduling_links ${res.status}: ${JSON.stringify(data)}`);

  return {
    rawResponse: data,
    schedulingUrl: data.resource?.booking_url,
    responseId: `cal_${Date.now()}`
  };
}

// ── Dry-run realistic shapes ────────────────────────────────────────────────

function dryRunShape(provider, action) {
  const id = `dryrun_${provider}_${Date.now()}`;
  const shapes = {
    skydexia: { rawResponse: { ok: true, projectId: `swc-dryrun-${id}`, orchestratorProjectId: `wcr-dryrun-${id}`, artifactId: `artifact-dryrun`, siteName: action.name || 'Dry Run Site', qualityScore: 90, files: ['index.html', 'styles.css', 'app.js', 'README.md'], artifactsDir: '.skyequanta/webcreator/projects/wcr-dryrun/artifacts', previewScreenshot: null }, projectId: `swc-dryrun-${id}`, artifactId: 'artifact-dryrun', files: ['index.html', 'styles.css', 'app.js', 'README.md'], previewScreenshot: null, responseId: `skydexia_dryrun_${id}` },
    'skydexia-threejs': { rawResponse: { ok: true, projectId: `swc-3js-dryrun-${id}`, siteName: action.name || 'Dry Run 3D Site', qualityScore: 92, files: ['index.html', 'styles.css', 'app.js', 'README.md'], artifactsDir: '.skyequanta/webcreator/projects/wcr-3js-dryrun/artifacts', previewScreenshot: '.skyequanta/webcreator/projects/wcr-3js-dryrun/artifacts/preview.png' }, projectId: `swc-3js-dryrun-${id}`, previewScreenshot: '.skyequanta/webcreator/projects/wcr-3js-dryrun/artifacts/preview.png', files: ['index.html', 'styles.css', 'app.js', 'README.md'], responseId: `skydexia_3js_dryrun_${id}` },
    'skydexia-health': { rawResponse: { ok: true, uptime: 9999, startedAt: new Date().toISOString() }, ok: true, uptime: 9999, responseId: `skydexia_health_dryrun_${id}` },
    'skydexia-status': { rawResponse: { ok: true, providers: { anthropic: true, openai: true, groq: true }, recentProjects: [] }, ok: true, providers: { anthropic: true, openai: true, groq: true }, recentProjects: [], responseId: `skydexia_status_dryrun_${id}` },
    'skydexia-preview': { rawResponse: { ok: true, previewScreenshot: `.skyequanta/webcreator/projects/${action.projectId || 'unknown'}/artifacts/preview.png` }, ok: true, previewScreenshot: `.skyequanta/webcreator/projects/${action.projectId || 'unknown'}/artifacts/preview.png`, responseId: `skydexia_preview_dryrun_${id}` },
    openai: { rawResponse: { id, object: 'response', model: action.model, output: [{ type: 'message', content: [{ type: 'output_text', text: '[DRY_RUN] OpenAI response simulated.' }] }], usage: { input_tokens: 10, output_tokens: 8 } }, text: '[DRY_RUN] OpenAI response simulated.', usage: { input_tokens: 10, output_tokens: 8 }, responseId: id },
    anthropic: { rawResponse: { id, type: 'message', model: action.model, content: [{ type: 'text', text: '[DRY_RUN] Anthropic response simulated.' }], usage: { input_tokens: 10, output_tokens: 8 } }, text: '[DRY_RUN] Anthropic response simulated.', usage: { input_tokens: 10, output_tokens: 8 }, responseId: id },
    gemini: { rawResponse: { candidates: [{ content: { parts: [{ text: '[DRY_RUN] Gemini response simulated.' }] } }] }, text: '[DRY_RUN] Gemini response simulated.', usage: {}, responseId: id },
    printful: { rawResponse: { result: { id: 99999, status: 'draft' } }, orderId: 99999, status: 'draft', responseId: `pf_99999` },
    calendly: { rawResponse: { resource: { booking_url: 'https://calendly.com/dry-run/event' } }, schedulingUrl: 'https://calendly.com/dry-run/event', responseId: id }
  };
  return shapes[provider] || { rawResponse: {}, responseId: id };
}

// ── Main dispatch ──────────────────────────────────────────────────────────

const DISPATCH = {
  skydexia: dispatchSkydexia,
  'skydexia-threejs': dispatchSkydexiaThreejs,
  'skydexia-health': dispatchSkydexiaHealth,
  'skydexia-status': dispatchSkydexiaStatus,
  'skydexia-preview': dispatchSkydexiaPreview,
  openai: dispatchOpenAI,
  anthropic: dispatchAnthropic,
  gemini: dispatchGemini,
  printful: dispatchPrintful,
  calendly: dispatchCalendly,
};

async function executeProviderAction(provider, action = {}, env = process.env) {
  const validation = validateProviderAction(provider, action, env);
  if (!validation.ok) {
    return { ok: false, provider: validation.provider || provider, endpoint: validation.endpoint || null, errors: validation.errors, executedAt: new Date().toISOString() };
  }

  const executionId = `ae_provider_${validation.provider}_${Date.now()}`;
  const executedAt = new Date().toISOString();

  if (isDryRun(env)) {
    const shape = dryRunShape(provider, action);
    return { ok: true, dryRun: true, provider: validation.provider, endpoint: validation.endpoint, executionId, executedAt, ...shape };
  }

  const dispatcher = DISPATCH[validation.provider];
  if (!dispatcher) {
    return { ok: false, provider: validation.provider, endpoint: validation.endpoint, errors: [`No dispatcher for '${validation.provider}'`], executedAt };
  }

  try {
    const result = await dispatcher(action, env);
    return { ok: true, provider: validation.provider, endpoint: validation.endpoint, executionId, executedAt, ...result };
  } catch (err) {
    return { ok: false, provider: validation.provider, endpoint: validation.endpoint, errors: [String(err.message || err)], executedAt };
  }
}

async function executeWithFailover(primary, fallbacks = [], action = {}, env = process.env) {
  const attempts = [];
  for (const provider of [primary, ...fallbacks]) {
    const result = await executeProviderAction(provider, action, env);
    attempts.push({ provider, ok: result.ok, errors: result.errors || [] });
    if (result.ok) return { ok: true, selectedProvider: provider, result, attempts };
  }
  return { ok: false, selectedProvider: null, attempts };
}

module.exports = {
  RESPONSES_ROUTE,
  getProviderContract,
  validateProviderAction,
  executeProviderAction,
  executeWithFailover,
  isDryRun
};
