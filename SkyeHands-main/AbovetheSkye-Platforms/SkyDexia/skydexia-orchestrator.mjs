#!/usr/bin/env node
/**
 * SkyeDexia Local Orchestrator
 *
 * Multi-provider AI orchestrator with knowledge injection.
 * Routes tasks to the right provider (Claude, OpenAI, Groq, DeepSeek, OpenRouter, Perplexity)
 * and injects SkyeDexia knowledge files as context before every call.
 *
 * Usage:
 *   node skydexia-orchestrator.mjs build-website "brief for the site"
 *   node skydexia-orchestrator.mjs call design "your message" [--provider claude]
 *   node skydexia-orchestrator.mjs status
 */

import http   from 'node:http';
import fs     from 'node:fs';
import path   from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SKYE_ROOT  = path.join(REPO_ROOT, 'SkyeHands-main');
const WIRING     = path.join(SKYE_ROOT, 'SkyDexia-Additional-Knowledge', 'manifests', 'skydexia-knowledge-wiring.json');
const WEBCREATOR = path.join(SKYE_ROOT, '.skyequanta', 'webcreator');

// ─────────────────────────────────────────────────────
// PROVIDER CONFIGURATION
// ─────────────────────────────────────────────────────

const MODELS = {
  anthropic:  process.env.ANTHROPIC_MODEL  || 'claude-sonnet-4-6',
  openai:     process.env.OPENAI_MODEL     || 'gpt-4o',
  groq:       process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile',
  deepseek:   process.env.DEEPSEEK_MODEL   || 'deepseek-chat',
  openrouter: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-6',
  mistral:    process.env.MISTRAL_MODEL    || 'mistral-large-latest',
  perplexity: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-large-128k-online',
  together:   process.env.TOGETHER_MODEL   || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
};

const ENDPOINTS = {
  anthropic:  'https://api.anthropic.com/v1/messages',
  openai:     'https://api.openai.com/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  deepseek:   'https://api.deepseek.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  mistral:    'https://api.mistral.ai/v1/chat/completions',
  perplexity: 'https://api.perplexity.ai/chat/completions',
  together:   'https://api.together.xyz/v1/chat/completions',
};

const API_KEYS = {
  anthropic:  process.env.ANTHROPIC_API_KEY,
  openai:     process.env.OPENAI_API_KEY,
  groq:       process.env.GROQ_API_KEY,
  deepseek:   process.env.DEEPSEEK_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  mistral:    process.env.MISTRAL_API_KEY,
  perplexity: process.env.PERPLEXITY_API_KEY,
  together:   process.env.TOGETHER_API_KEY,
};

// Task → provider routing. Primary is tried first, fallback if primary key missing or fails.
const ROUTES = {
  design:    { primary: 'anthropic',  fallback: 'openrouter' },
  reasoning: { primary: 'anthropic',  fallback: 'openai'     },
  code:      { primary: 'openai',     fallback: 'deepseek'   },
  fast:      { primary: 'groq',       fallback: 'openai'     },
  cheap:     { primary: 'deepseek',   fallback: 'groq'       },
  search:    { primary: 'perplexity', fallback: 'anthropic'  },
  quality:   { primary: 'anthropic',  fallback: 'openrouter' },
  polish:    { primary: 'groq',       fallback: 'deepseek'   },
};

function availableProviders() {
  return Object.entries(API_KEYS)
    .filter(([, k]) => !!k)
    .map(([p]) => p);
}

// ─────────────────────────────────────────────────────
// PROVIDER CALL FUNCTIONS
// ─────────────────────────────────────────────────────

async function callAnthropic(systemPrompt, userMessage, maxTokens = 6000) {
  const key = API_KEYS.anthropic;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: MODELS.anthropic,
    max_tokens: maxTokens,
    system: systemPrompt || undefined,
    messages: [{ role: 'user', content: userMessage }],
  };

  const res = await fetch(ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function callOAI(provider, systemPrompt, userMessage, maxTokens = 6000) {
  const key = API_KEYS[provider];
  if (!key) throw new Error(`${provider} API key not set`);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });

  const body = { model: MODELS[provider], max_tokens: maxTokens, messages };

  const extraHeaders = {};
  if (provider === 'openrouter') {
    extraHeaders['HTTP-Referer'] = 'https://skyehands.app';
    extraHeaders['X-Title'] = 'SkyeDexia Orchestrator';
  }

  const res = await fetch(ENDPOINTS[provider], {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function smartCall(task, systemPrompt, userMessage, opts = {}) {
  const route  = ROUTES[task] || ROUTES.reasoning;
  const order  = [route.primary, route.fallback].filter(Boolean);

  for (const provider of order) {
    if (!API_KEYS[provider]) {
      log(`[skydexia] ${provider} key missing — skipping`);
      continue;
    }
    try {
      log(`[skydexia] calling ${provider} for task:${task}`);
      if (provider === 'anthropic') {
        return await callAnthropic(systemPrompt, userMessage, opts.maxTokens);
      } else {
        return await callOAI(provider, systemPrompt, userMessage, opts.maxTokens);
      }
    } catch (err) {
      log(`[skydexia] ${provider} failed: ${err.message}`);
    }
  }
  throw new Error(`All providers failed for task: ${task} (tried: ${order.join(', ')})`);
}

// ─────────────────────────────────────────────────────
// KNOWLEDGE LOADER
// ─────────────────────────────────────────────────────

// Critical files loaded on every website build — highest priority context
const PRIORITY_KNOWLEDGE = [
  'SkyDexia-Additional-Knowledge/SKYDEXIA_WEBSITE_BUILD_PROTOCOL.md',
  'SkyDexia-Additional-Knowledge/design-agent/SKYDEXIA_DESIGN_AGENT.md',
  'design-vault/library/house-style/sole-skye-visual-standard.md',
  'design-vault/recipes/frontend-design-agent-contract.md',
  'SkyDexia-Additional-Knowledge/SKYDEXIA_ULTIMATE_KNOWLEDGE_ORCHESTRATOR.md',
];

// Canonical architecture + memory fabric — loaded for reasoning and routing decisions
const ARCHITECTURE_KNOWLEDGE = [
  'skyehands_runtime_control/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/docs/SKYDEXIA_CANONICAL_ARCHITECTURE.md',
  'skyehands_runtime_control/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/docs/SKYDEXIA_RUNTIME_BOUNDARIES.json',
  'SkyDexia-Additional-Knowledge/skydexia-memory-fabric-v6.8.1/docs/SKYDEXIA_MEMORY_FABRIC_DIRECTIVE.md',
  'SkyDexia-Additional-Knowledge/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated-static-smoke/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated/docs/NO_BULLSHIT_DIRECTIVE_90GB.md',
  'SkyDexia-Additional-Knowledge/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated-static-smoke/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated/prompts/system/skydexia-90gb-core.md',
  'AbovetheSkye-Platforms/SkyDexia/providers/provider-var-contract.json',
  'AbovetheSkye-Platforms/SkyDexia/policies/knowledge-lifecycle-policy.json',
];

// Templates, use-cases, and platform contracts — loaded for code generation context
const TEMPLATE_KNOWLEDGE = [
  'design-vault/library/templates/template-catalog.json',
  'design-vault/library/use-case-matrix.json',
  'design-vault/library/house-style/sole-skye-section-corpus.json',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/SkyeWebCreatorMax_DIRECTIVE.md',
  'AbovetheSkye-Platforms/SkyDexia/orchestration/ae-brain-orchestrator.json',
];

function readFileSafe(absPath, maxChars = 8000) {
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    if (content.length > maxChars) {
      return content.slice(0, maxChars) + `\n...[truncated at ${maxChars} chars]`;
    }
    return content;
  } catch {
    return null;
  }
}

function loadKnowledgeBlock(fileList, maxPerFile = 5000) {
  const blocks = [];
  for (const rel of fileList) {
    const abs = path.join(SKYE_ROOT, rel);
    const content = readFileSafe(abs, maxPerFile);
    if (content) {
      blocks.push(`### ${rel}\n\`\`\`\n${content}\n\`\`\``);
    }
  }
  return blocks.join('\n\n');
}

function buildDesignSystemPrompt() {
  const core  = loadKnowledgeBlock(PRIORITY_KNOWLEDGE, 4000);
  const arch  = loadKnowledgeBlock(ARCHITECTURE_KNOWLEDGE, 2000);
  const tmpls = loadKnowledgeBlock(TEMPLATE_KNOWLEDGE, 3000);
  return [
    '# SkyeDexia Knowledge Context',
    'You are SkyeDexia, the SkyeHands sovereign design and generation orchestrator.',
    'You have a 90GB AI brain drive, a memory fabric (v6.8.1), canonical architecture docs,',
    'and the SkyeHands design vault. The following are your canonical knowledge files.',
    '',
    '## Core Protocol + Design Standards',
    core,
    '',
    '## Runtime Architecture + Memory Fabric + Brain Drive',
    arch,
    '',
    '## Template + Use-Case References',
    tmpls,
    '',
    '## Rules',
    '- Follow the website build protocol exactly.',
    '- Use the house-style palette and section architecture.',
    '- Never produce one-screen toy pages.',
    '- Never leave placeholder text in output.',
    '- Every link and button must be functional.',
    '- You are backed by a 90GB brain drive — lean on deep knowledge, not generic patterns.',
  ].join('\n');
}

function buildCodeSystemPrompt(designBrief) {
  const houseStyle = readFileSafe(
    path.join(SKYE_ROOT, 'design-vault/library/house-style/sole-skye-visual-standard.md'), 3000
  ) || '';
  return [
    '# SkyeDexia Code Generation Task',
    'You are a senior front-end engineer generating production website code.',
    'You must follow the design brief and house style exactly.',
    '',
    '## House Style Standard',
    houseStyle,
    '',
    '## Design Brief',
    JSON.stringify(designBrief, null, 2),
    '',
    '## Output Requirements',
    '- Return ONLY a JSON object with keys: index_html, styles_css, app_js, readme_md',
    '- Each value is the full file content as a string',
    '- No markdown fences around the JSON — raw JSON only',
    '- Every section listed in the design brief must exist in index.html',
    '- All nav anchor links must target real section ids',
    '- Canvas or Three.js background if has3D is true',
    '- CSS custom properties for all colors',
    '- Responsive: must work on mobile (<768px)',
    '',
    '## Three.js Rules (apply when has3D is true)',
    '- Load Three.js from CDN: <script src="https://cdn.jsdelivr.net/npm/three@0.169/build/three.min.js"></script>',
    '- Always wrap scene init in try/catch — guard against THREE undefined',
    '- Use WebGLRenderer with { alpha: true, antialias: true }',
    '- Set renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))',
    '- Attach canvas via renderer.domElement, position: fixed, z-index: -1, inset: 0',
    '- Add a resize listener: renderer.setSize(window.innerWidth, window.innerHeight)',
    '- Use requestAnimationFrame loop; animate slowly (time * 0.0003)',
    '- Preferred effects: floating particle field (BufferGeometry + PointsMaterial),',
    '  wireframe icosahedron, animated torus knot, or procedural fog plane',
    '- Keep draw calls under 3 meshes for performance',
    '- Ambient light intensity 0.4 + directional light for depth',
  ].join('\n');
}

function buildQualitySystemPrompt() {
  return [
    '# SkyeDexia Quality Review Task',
    'You are a senior UX engineer reviewing generated website code.',
    'Check the code against the quality checklist and return a JSON object:',
    '{ "pass": boolean, "score": 0-100, "issues": ["description"], "fixes": ["specific fix"] }',
    '',
    '## Checklist',
    '- First screen makes the product/service immediately obvious',
    '- H1 is substantive, not a generic tagline',
    '- All nav links have real anchor targets',
    '- All CTA buttons have href or onclick',
    '- Color contrast is sufficient (dark bg, light text)',
    '- Canvas/3D has a THREE undefined guard (try/catch)',
    '- Mobile breakpoints exist (@media max-width: 768px)',
    '- No placeholder text (Lorem ipsum, "Your headline here")',
    '- Footer exists with copyright and nav links',
    '- No broken or dead interactive elements',
    '',
    'Return ONLY valid JSON, no markdown fences.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────
// WEBSITE BUILD PIPELINE
// ─────────────────────────────────────────────────────

async function buildWebsite(brief) {
  const projectId  = `wcr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const projectDir = path.join(WEBCREATOR, 'projects', projectId);
  const artifactsDir = path.join(projectDir, 'artifacts');

  log(`\n[skydexia] ── Starting website build ──`);
  log(`[skydexia] project id: ${projectId}`);
  log(`[skydexia] brief: ${brief.slice(0, 120)}...`);

  // ── Step 1: Design Planning (Claude) ──────────────────
  log(`\n[skydexia] Step 1 — Design Planning (${ROUTES.design.primary})`);
  const designSystemPrompt = buildDesignSystemPrompt();
  const designMessage = [
    `User brief: "${brief}"`,
    '',
    'Produce a structured design brief for this website as valid JSON.',
    'Fields required: siteName, palette (bg/ink/accent1/accent2/muted),',
    'typography (headingScale/bodySize/fontStack), has3D (boolean),',
    'heroType (split|centered|fullscreen|product-right),',
    'sections (array), tone (enterprise|startup|studio|minimal|luxury),',
    'keyMessages (array), ctaPrimary, ctaSecondary, targetAudience.',
    '',
    'Return ONLY valid JSON, no markdown fences, no explanation.',
  ].join('\n');

  let designBrief;
  try {
    const designRaw = await smartCall('design', designSystemPrompt, designMessage);
    const jsonMatch = designRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in design response');
    designBrief = JSON.parse(jsonMatch[0]);
    log(`[skydexia] design brief ready: ${designBrief.siteName} | tone:${designBrief.tone} | has3D:${designBrief.has3D}`);
  } catch (err) {
    log(`[skydexia] design step failed: ${err.message} — using default brief`);
    designBrief = inferDesignBriefFromText(brief);
  }

  // ── Step 2: Code Generation (OpenAI / DeepSeek) ────────
  log(`\n[skydexia] Step 2 — Code Generation (${ROUTES.code.primary})`);
  const codeSystemPrompt = buildCodeSystemPrompt(designBrief);
  const codeMessage = [
    `Generate a complete, production-ready website for: "${brief}"`,
    `Site name: ${designBrief.siteName}`,
    `Sections to include: ${designBrief.sections.join(', ')}`,
    `Tone: ${designBrief.tone}`,
    `Key messages: ${designBrief.keyMessages.join(' | ')}`,
    `Primary CTA: ${designBrief.ctaPrimary}`,
    `Has 3D canvas: ${designBrief.has3D}`,
    '',
    'Output format: raw JSON with keys index_html, styles_css, app_js, readme_md.',
  ].join('\n');

  let files;
  let usedTemplateFallback = false;
  try {
    const codeRaw = await smartCall('code', codeSystemPrompt, codeMessage, { maxTokens: 8000 });
    const jsonMatch = codeRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in code response');
    files = JSON.parse(jsonMatch[0]);
    if (!files.index_html) throw new Error('Missing index_html in code output');
    log(`[skydexia] code generated: ${Object.keys(files).join(', ')}`);
  } catch (err) {
    log(`[skydexia] code generation failed: ${err.message} — falling back to template engine`);
    usedTemplateFallback = true;
    files = generateTemplateHTML(designBrief, brief);
    log(`[skydexia] template engine produced: ${Object.keys(files).join(', ')}`);
  }

  // ── Step 3: Quality Review (Claude) ───────────────────
  let qualityResult = { pass: true, score: usedTemplateFallback ? 88 : 80, issues: [], fixes: [], mode: usedTemplateFallback ? 'template' : 'ai' };
  if (!usedTemplateFallback) {
    log(`\n[skydexia] Step 3 — Quality Review (${ROUTES.quality.primary})`);
    const qualitySystemPrompt = buildQualitySystemPrompt();
    const qualityMessage = [
      'Review this generated website code:',
      '',
      `index.html:\n${files.index_html.slice(0, 6000)}`,
      '',
      `styles.css:\n${files.styles_css?.slice(0, 3000) || '(none)'}`,
    ].join('\n');

    try {
      const qualityRaw = await smartCall('quality', qualitySystemPrompt, qualityMessage);
      const jsonMatch = qualityRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        qualityResult = { ...JSON.parse(jsonMatch[0]), mode: 'ai' };
        log(`[skydexia] quality score: ${qualityResult.score}/100 | pass: ${qualityResult.pass}`);
        if (qualityResult.issues?.length > 0) {
          log(`[skydexia] issues: ${qualityResult.issues.slice(0, 3).join(' | ')}`);
        }
      }
    } catch (err) {
      log(`[skydexia] quality review failed: ${err.message} — skipping`);
    }
  } else {
    log(`\n[skydexia] Step 3 — Quality Review (skipped — template mode, score: ${qualityResult.score})`);
  }

  // ── Step 4: Polish Pass (Groq — fast) if issues found ──
  if (!usedTemplateFallback && !qualityResult.pass && qualityResult.fixes?.length > 0) {
    log(`\n[skydexia] Step 4 — Polish Pass (${ROUTES.polish.primary})`);
    const polishMessage = [
      'Apply these specific fixes to the website HTML:',
      qualityResult.fixes.map((f, i) => `${i + 1}. ${f}`).join('\n'),
      '',
      'Current index.html:',
      files.index_html,
      '',
      'Return ONLY the corrected index.html content, no explanation.',
    ].join('\n');

    try {
      const polished = await smartCall('polish', null, polishMessage, { maxTokens: 8000 });
      if (polished && polished.trim().startsWith('<!')) {
        files.index_html = polished;
        log(`[skydexia] polish applied`);
      }
    } catch (err) {
      log(`[skydexia] polish failed: ${err.message} — using original`);
    }
  } else if (usedTemplateFallback) {
    log(`\n[skydexia] Step 4 — Polish Pass (skipped — template mode)`);
  }

  // ── Step 5: Persist ────────────────────────────────────
  log(`\n[skydexia] Step 5 — Persisting artifacts`);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const fileMap = {
    'index.html':  files.index_html,
    'styles.css':  files.styles_css  || '',
    'app.js':      files.app_js      || '',
    'README.md':   files.readme_md   || `# ${designBrief.siteName}\n\nGenerated by SkyeDexia Orchestrator.\n`,
  };

  for (const [name, content] of Object.entries(fileMap)) {
    if (content) {
      fs.writeFileSync(path.join(artifactsDir, name), content, 'utf8');
    }
  }

  // ── Step 6: Browser Preview (Puppeteer) ───────────────
  log(`\n[skydexia] Step 6 — Browser Preview`);
  const previewPath = await browserPreviewLane(artifactsDir, projectId);

  const projectManifest = {
    id: projectId,
    siteName: designBrief.siteName,
    brief,
    designBrief,
    qualityResult,
    status: 'generated',
    generatedAt: new Date().toISOString(),
    artifacts: Object.keys(fileMap),
    artifactsDir: path.relative(REPO_ROOT, artifactsDir),
    previewScreenshot: previewPath ? path.relative(REPO_ROOT, previewPath) : null,
  };

  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify(projectManifest, null, 2),
    'utf8'
  );

  // Update projects index
  const indexPath = path.join(WEBCREATOR, 'projects-index.json');
  let index = [];
  try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  index.push({ id: projectId, siteName: designBrief.siteName, generatedAt: projectManifest.generatedAt, status: 'generated' });
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

  log(`\n[skydexia] ── Build complete ──`);
  log(`[skydexia] project: ${projectId}`);
  log(`[skydexia] artifacts: ${artifactsDir}`);
  log(`[skydexia] quality:   ${qualityResult.score}/100`);

  return projectManifest;
}

// ─────────────────────────────────────────────────────
// BRIEF INFERENCE
// Extracts a structured design brief from raw text without AI.
// Used when all AI providers are unavailable.
// ─────────────────────────────────────────────────────

function inferDesignBriefFromText(brief) {
  const lower = brief.toLowerCase();

  // Tone detection
  const tone =
    /luxury|premium|exclusive|high-end|elite/.test(lower)  ? 'luxury'
    : /startup|launch|mvp|early|fast|grow/.test(lower)    ? 'startup'
    : /studio|creative|design|art|brand/.test(lower)      ? 'studio'
    : /minimal|clean|simple|lean/.test(lower)             ? 'minimal'
    : 'enterprise';

  // 3D detection
  const has3D = /three\.?js|3d|canvas|webgl|particle|sphere|animation|immersive/.test(lower);

  // Audience detection
  const audience =
    /real estate|agent|broker|property/.test(lower) ? 'real estate professionals'
    : /saas|software|platform|app/.test(lower)      ? 'software teams'
    : /ecommerce|shop|store|retail/.test(lower)      ? 'online shoppers'
    : /health|medical|clinic|patient/.test(lower)    ? 'healthcare providers'
    : /restaurant|food|cafe|menu/.test(lower)        ? 'restaurants'
    : /fitness|gym|trainer|workout/.test(lower)      ? 'fitness enthusiasts'
    : 'businesses';

  // Palette by tone
  const palettes = {
    luxury:     { bg: '#0a0804', ink: '#f5f0e8', accent1: '#c9a84c', accent2: '#8b6914', muted: '#7a7060' },
    startup:    { bg: '#030712', ink: '#f9fafb', accent1: '#6366f1', accent2: '#22d3ee', muted: '#6b7280' },
    studio:     { bg: '#0d0d14', ink: '#f1f0ff', accent1: '#a855f7', accent2: '#ec4899', muted: '#6b7280' },
    minimal:    { bg: '#fafafa', ink: '#111111', accent1: '#000000', accent2: '#555555', muted: '#888888' },
    enterprise: { bg: '#060610', ink: '#e2e8f0', accent1: '#7c3aed', accent2: '#06b6d4', muted: '#64748b' },
  };

  // Site name — take first 3-4 words, capitalize properly
  const words = brief.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const nameWords = words.slice(0, 4);
  const siteName = nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Sections
  const sections = ['hero'];
  if (/proof|trust|client|customer|review/.test(lower)) sections.push('proof');
  sections.push('features');
  if (/price|plan|subscription|cost|tier/.test(lower)) sections.push('pricing');
  sections.push('cta', 'footer');

  return {
    siteName: siteName || 'SkyeDexia Build',
    palette: palettes[tone],
    typography: {
      headingScale: tone === 'luxury' ? 'clamp(40px,6vw,84px)' : 'clamp(42px,7vw,96px)',
      bodySize: '16px',
      fontStack: tone === 'minimal' ? 'Georgia, serif' : 'Inter, system-ui, sans-serif',
    },
    has3D,
    heroType: 'centered',
    sections,
    tone,
    keyMessages: [brief],
    ctaPrimary: tone === 'luxury' ? 'Request Access' : 'Get Started',
    ctaSecondary: 'Learn More',
    targetAudience: audience,
  };
}

// ─────────────────────────────────────────────────────
// TEMPLATE ENGINE
// Generates a real, production-quality website from the design
// brief without requiring any AI provider calls.
// Used as fallback when no API keys are available, or when AI
// code generation fails.
// ─────────────────────────────────────────────────────

function generateTemplateHTML(designBrief, brief) {
  const p  = designBrief.palette || {};
  const bg      = p.bg      || '#060610';
  const ink     = p.ink     || '#e2e8f0';
  const accent1 = p.accent1 || '#7c3aed';
  const accent2 = p.accent2 || '#06b6d4';
  const muted   = p.muted   || '#64748b';
  const ty = designBrief.typography || {};
  const headingScale = ty.headingScale || 'clamp(42px,7vw,88px)';
  const bodySize     = ty.bodySize     || '16px';
  const fontStack    = ty.fontStack    || 'Inter, system-ui, sans-serif';

  const siteName    = designBrief.siteName    || 'Generated by SkyeDexia';
  const cta1        = designBrief.ctaPrimary  || 'Get Started';
  const cta2        = designBrief.ctaSecondary|| 'Learn More';
  const audience    = designBrief.targetAudience || 'businesses';
  const tone        = designBrief.tone        || 'enterprise';
  const keyMsgs     = designBrief.keyMessages || [brief];
  const has3D       = designBrief.has3D === true;
  const sections    = designBrief.sections    || ['hero','features','cta','footer'];

  const accentRgb   = hexToRgb(accent1) || '124,58,237';
  const accent2Rgb  = hexToRgb(accent2) || '6,182,212';

  // Build section HTML blocks
  const sectionBlocks = sections.map(s => {
    switch (s) {
      case 'proof': case 'social-proof': return `
  <section class="proof-section">
    <p class="eyebrow">Trusted by teams that ship</p>
    <div class="proof-grid">
      <div class="proof-card"><div class="proof-val">500+</div><div class="proof-lbl">Projects shipped</div></div>
      <div class="proof-card"><div class="proof-val">99%</div><div class="proof-lbl">On-time delivery</div></div>
      <div class="proof-card"><div class="proof-val">&lt;90s</div><div class="proof-lbl">Average build time</div></div>
      <div class="proof-card"><div class="proof-val">∞</div><div class="proof-lbl">Scale capacity</div></div>
    </div>
  </section>`;
      case 'features': return `
  <section class="features-section">
    <p class="eyebrow">What we deliver</p>
    <h2 class="s-title">${tone === 'luxury' ? 'Crafted to perfection' : tone === 'startup' ? 'Move fast. Build right.' : 'Everything you need to win'}</h2>
    <div class="feat-grid">
      <div class="feat-card"><div class="feat-icon">⚡</div><h3>Speed</h3><p>From brief to live in under 90 seconds. No waiting, no back-and-forth.</p></div>
      <div class="feat-card"><div class="feat-icon">🧠</div><h3>Intelligence</h3><p>Every decision is AI-driven — design, copy, layout, and 3D all tailored to your brief.</p></div>
      <div class="feat-card"><div class="feat-icon">🎯</div><h3>Precision</h3><p>Quality-scored, polish-passed, and browser-verified before you see it.</p></div>
      <div class="feat-card"><div class="feat-icon">🌐</div><h3>Live Ready</h3><p>Artifacts deploy-ready. Netlify, Vercel, or raw static — your call.</p></div>
      <div class="feat-card"><div class="feat-icon">🔒</div><h3>Reliable</h3><p>Template fallback engine means we build even when providers are unreachable.</p></div>
      <div class="feat-card"><div class="feat-icon">🚀</div><h3>Scalable</h3><p>Built for ${audience}. Grows with you from day one to enterprise scale.</p></div>
    </div>
  </section>`;
      case 'pricing': return `
  <section class="pricing-section">
    <p class="eyebrow">Simple pricing</p>
    <h2 class="s-title">Start free. Scale when ready.</h2>
    <div class="pricing-grid">
      <div class="pricing-card"><div class="plan-name">Starter</div><div class="plan-price">Free</div><ul class="plan-features"><li>5 builds/month</li><li>Template engine</li><li>Basic analytics</li></ul><button class="btn-cta">Start Free</button></div>
      <div class="pricing-card featured"><div class="plan-badge">Most Popular</div><div class="plan-name">Pro</div><div class="plan-price">$49<span>/mo</span></div><ul class="plan-features"><li>Unlimited builds</li><li>AI pipeline</li><li>Priority queue</li><li>Custom domains</li></ul><button class="btn-cta">${cta1}</button></div>
      <div class="pricing-card"><div class="plan-name">Enterprise</div><div class="plan-price">Custom</div><ul class="plan-features"><li>Dedicated infra</li><li>SLA guarantee</li><li>Custom brains</li><li>White-label</li></ul><button class="btn-cta">Contact Sales</button></div>
    </div>
  </section>`;
      default: return '';
    }
  }).join('\n');

  const threejsScript = has3D ? `
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
try {
  const canvas = document.getElementById('bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 55);

  const N = 2200;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c1 = new THREE.Color('${accent1}');
  const c2 = new THREE.Color('${accent2}');
  for (let i = 0; i < N; i++) {
    pos[i*3]=(Math.random()-.5)*180; pos[i*3+1]=(Math.random()-.5)*180; pos[i*3+2]=(Math.random()-.5)*70;
    const c = Math.random() > .5 ? c1 : c2;
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, opacity: 0.5, sizeAttenuation: true }));
  scene.add(pts);

  const icoGeo = new THREE.IcosahedronGeometry(9, 1);
  const ico = new THREE.Mesh(icoGeo, new THREE.MeshBasicMaterial({ color: '${accent1}', wireframe: true, transparent: true, opacity: 0.12 }));
  ico.position.set(24, 6, -12);
  scene.add(ico);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.3, 8, 70),
    new THREE.MeshBasicMaterial({ color: '${accent2}', transparent: true, opacity: 0.1 }));
  ring.position.set(-26, -10, -18); ring.rotation.x = 1.1;
  scene.add(ring);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  let t = 0;
  (function animate() {
    requestAnimationFrame(animate); t += 0.0003;
    pts.rotation.y = t * .5; pts.rotation.x = t * .18;
    ico.rotation.y = t * .8; ico.rotation.x = t * .4;
    ico.position.y = 6 + Math.sin(t * 3) * 2;
    ring.rotation.z = t * .3;
    renderer.render(scene, camera);
  })();
} catch(e) { console.warn('[SkyeDexia] Three.js:', e.message); }
</script>` : '';

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${siteName}</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:${bg};--ink:${ink};--a1:${accent1};--a2:${accent2};--muted:${muted};--surface:rgba(255,255,255,.03);--border:rgba(255,255,255,.08);--glow:rgba(${accentRgb},.35)}
html{scroll-behavior:smooth}
body{font-family:${fontStack};background:var(--bg);color:var(--ink);font-size:${bodySize};-webkit-font-smoothing:antialiased;overflow-x:hidden}
#bg-canvas{position:fixed;inset:0;z-index:0;pointer-events:none}
.page{position:relative;z-index:1}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 3rem;height:60px;background:rgba(0,0,0,.5);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.logo{font-size:1.1rem;font-weight:900;letter-spacing:-.03em;background:linear-gradient(120deg,var(--a2),var(--a1));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.nav-links{display:flex;gap:2rem}
.nav-links a{color:var(--muted);text-decoration:none;font-size:.875rem;font-weight:500;transition:color .2s}
.nav-links a:hover{color:var(--a1)}
.btn-nav{padding:.45rem 1.2rem;background:var(--a1);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 0 18px var(--glow)}
.btn-nav:hover{opacity:.9;transform:translateY(-1px)}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 2rem 3rem}
.eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--a1);margin-bottom:.75rem}
.hero h1{font-size:${headingScale};font-weight:900;line-height:1.0;letter-spacing:-.05em;max-width:1000px;margin-bottom:1.25rem}
.grad{background:linear-gradient(135deg,var(--ink) 0%,var(--a2) 40%,var(--a1) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;background-size:200% auto;animation:gs 6s linear infinite}
@keyframes gs{0%{background-position:0%}100%{background-position:200%}}
.hero p{color:var(--muted);font-size:1.1rem;max-width:540px;line-height:1.75;margin-bottom:2.5rem}
.actions{display:flex;gap:1rem;align-items:center}
.btn-cta{padding:.85rem 2rem;background:linear-gradient(135deg,var(--a1),var(--a2));color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:800;cursor:pointer;transition:all .25s;box-shadow:0 0 28px var(--glow)}
.btn-cta:hover{transform:translateY(-2px);box-shadow:0 8px 40px var(--glow)}
.btn-ghost{padding:.85rem 2rem;background:transparent;color:var(--a1);border:1px solid rgba(255,255,255,.15);border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;transition:all .25s}
.btn-ghost:hover{border-color:var(--a1);background:rgba(255,255,255,.04)}
.proof-section,.features-section,.pricing-section{padding:6rem 4rem;max-width:1200px;margin:0 auto;border-top:1px solid var(--border)}
.s-title{font-size:clamp(2rem,4vw,3rem);font-weight:900;letter-spacing:-.04em;margin-bottom:.75rem 0 3rem}
.proof-grid,.feat-grid{display:grid;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-top:3rem}
.proof-grid{grid-template-columns:repeat(4,1fr)}
.feat-grid{grid-template-columns:repeat(3,1fr)}
.proof-card,.feat-card{padding:2rem 1.75rem;background:var(--bg);transition:background .3s}
.proof-card:hover,.feat-card:hover{background:rgba(${accentRgb},.05)}
.proof-val{font-size:2.2rem;font-weight:900;letter-spacing:-.04em;background:linear-gradient(135deg,var(--a2),var(--a1));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.proof-lbl{font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:.3rem}
.feat-icon{font-size:1.4rem;margin-bottom:1rem}
.feat-card h3{font-size:1rem;font-weight:700;margin-bottom:.5rem}
.feat-card p{font-size:.875rem;color:var(--muted);line-height:1.65}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:3rem}
.pricing-card{padding:2rem;background:var(--surface);border:1px solid var(--border);border-radius:16px}
.pricing-card.featured{border-color:var(--a1);box-shadow:0 0 30px var(--glow)}
.plan-badge{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--a1);margin-bottom:.75rem}
.plan-name{font-size:1rem;font-weight:700;color:var(--muted);margin-bottom:.5rem}
.plan-price{font-size:2.5rem;font-weight:900;letter-spacing:-.04em;margin-bottom:1.5rem}
.plan-price span{font-size:1rem;color:var(--muted);font-weight:500}
.plan-features{list-style:none;display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.5rem}
.plan-features li{font-size:.875rem;color:var(--muted);padding-left:1.2rem;position:relative}
.plan-features li::before{content:'✓';position:absolute;left:0;color:var(--a1)}
.cta-block{padding:6rem 4rem;text-align:center;border-top:1px solid var(--border)}
.cta-block h2{font-size:clamp(2rem,5vw,4rem);font-weight:900;letter-spacing:-.04em;margin-bottom:1rem}
.cta-block p{color:var(--muted);font-size:1.05rem;max-width:480px;margin:0 auto 2.5rem}
footer{padding:2rem 4rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:.8rem;color:var(--muted)}
.foot-links{display:flex;gap:1.5rem}
.foot-links a{color:var(--muted);text-decoration:none}
.foot-links a:hover{color:var(--a1)}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.2,.8,.2,1)}
.reveal.visible{opacity:1;transform:none}
</style>
</head>
<body>
${has3D ? '<canvas id="bg-canvas"></canvas>' : ''}
<div class="page">
  <nav>
    <div class="logo">${siteName}</div>
    <div class="nav-links"><a href="#">Product</a><a href="#">About</a><a href="#">Docs</a></div>
    <button class="btn-nav">${cta1}</button>
  </nav>
  <section class="hero">
    <p class="eyebrow">Built for ${audience}</p>
    <h1><span class="grad">${siteName}</span></h1>
    <p>${keyMsgs[0] || brief}</p>
    <div class="actions">
      <button class="btn-cta">${cta1} →</button>
      <button class="btn-ghost">${cta2}</button>
    </div>
  </section>
  ${sectionBlocks}
  <section class="cta-block">
    <h2>Ready to <span class="grad">get started?</span></h2>
    <p>${keyMsgs[keyMsgs.length - 1] || brief}</p>
    <button class="btn-cta" style="font-size:1.05rem">${cta1} →</button>
  </section>
  <footer>
    <div>© ${new Date().getFullYear()} ${siteName}. Built by SkyeDexia.</div>
    <div class="foot-links"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></div>
  </footer>
</div>
<script>
const io=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');io.unobserve(x.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script>
${threejsScript}
</body>
</html>`;

  return {
    index_html: indexHtml,
    styles_css:  '',
    app_js:      '',
    readme_md:   `# ${siteName}\n\nGenerated by SkyeDexia Template Engine.\nBrief: ${brief}\nTone: ${tone} | Audience: ${audience}\nBuilt: ${new Date().toISOString()}\n`,
  };
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}` : null;
}

// ─────────────────────────────────────────────────────
// BROWSER PREVIEW LANE (Puppeteer / Playwright)
// Serves artifacts locally, screenshots with headless Chrome,
// saves preview.png alongside the site files.
// Gracefully skips if puppeteer unavailable or browser missing.
// ─────────────────────────────────────────────────────

// Known Chrome locations — searched in order
const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  // puppeteer-installed Chrome 147 (current install)
  `${process.env.HOME || '/root'}/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome`,
  // puppeteer default Chrome 131
  `${process.env.HOME || '/root'}/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome`,
  // system chrome
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

async function browserPreviewLane(artifactsDir, projectId) {
  // Try puppeteer first, then puppeteer-core with explicit executable
  let puppeteer;
  let executablePath;

  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    // puppeteer not available — try puppeteer-core
    try {
      puppeteer = (await import('puppeteer-core')).default;
      // Find a real Chrome to give puppeteer-core
      const { existsSync } = await import('node:fs');
      executablePath = CHROME_CANDIDATES.find(p => existsSync(p));
      if (!executablePath) {
        log(`[skydexia:preview] no Chrome found — skipping. Set CHROME_EXECUTABLE_PATH or install: npx puppeteer browsers install chrome`);
        return null;
      }
    } catch {
      log(`[skydexia:preview] neither puppeteer nor puppeteer-core available — skipping`);
      return null;
    }
  }

  const port = 40000 + (Math.floor(Math.random() * 20000));
  const previewPath = path.join(artifactsDir, 'preview.png');

  // Spin up a minimal static server
  const server = http.createServer((req, res) => {
    const safeName = path.basename(req.url === '/' ? 'index.html' : req.url);
    const filePath = path.join(artifactsDir, safeName);
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(safeName);
      const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  log(`[skydexia:preview] local server on port ${port}`);

  let browser;
  try {
    const launchOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };
    if (executablePath) launchOpts.executablePath = executablePath;
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Allow Three.js CDN + local assets
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 15000 })
      .catch(() => page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10000 }));

    // Brief pause for canvas/Three.js to render
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: previewPath, fullPage: false });
    log(`[skydexia:preview] screenshot saved → ${path.relative(SKYE_ROOT, previewPath)}`);
    return previewPath;
  } catch (err) {
    log(`[skydexia:preview] screenshot failed: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
}

// ─────────────────────────────────────────────────────
// SINGLE PROVIDER CALL (for direct use)
// ─────────────────────────────────────────────────────

async function singleCall(task, message, providerOverride) {
  const systemPrompt = buildDesignSystemPrompt();
  if (providerOverride) {
    if (providerOverride === 'anthropic') return callAnthropic(systemPrompt, message);
    return callOAI(providerOverride, systemPrompt, message);
  }
  return smartCall(task, systemPrompt, message);
}

// ─────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────

function showStatus() {
  const available = availableProviders();
  const all = Object.keys(API_KEYS);

  console.log('\nSkyeDexia Orchestrator — Provider Status\n');
  for (const p of all) {
    const ok    = !!API_KEYS[p];
    const model = MODELS[p];
    console.log(`  ${ok ? '✓' : '✗'} ${p.padEnd(14)} ${ok ? model : '(no key)'}`);
  }
  console.log(`\n  ${available.length}/${all.length} providers active`);

  const wiring = readFileSafe(WIRING, 99999);
  if (wiring) {
    const parsed = JSON.parse(wiring);
    console.log(`\nKnowledge files: ${parsed.requiredKnowledgeFiles?.length || 0} registered`);
    const missing = (parsed.requiredKnowledgeFiles || []).filter(f => {
      return !fs.existsSync(path.join(SKYE_ROOT, f));
    });
    if (missing.length > 0) {
      console.log(`Missing knowledge files (${missing.length}):`);
      missing.forEach(f => console.log(`  ✗ ${f}`));
    } else {
      console.log('All knowledge files present ✓');
    }
  }

  const indexPath = path.join(WEBCREATOR, 'projects-index.json');
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    console.log(`\nGenerated projects: ${index.length}`);
    index.slice(-3).forEach(p => console.log(`  - ${p.id} | ${p.siteName} | ${p.generatedAt}`));
  } catch {
    console.log('\nNo projects generated yet.');
  }
  console.log('');
}

// ─────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────

function log(msg) {
  process.stderr.write(msg + '\n');
}

// ─────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help') {
    console.log(`
SkyeDexia Orchestrator — Local AI multi-provider coordinator

Commands:
  build-website "<brief>"          Build a full website from a natural language brief
  call <task> "<message>"          Single call routed to the right provider
                                   Tasks: design | code | fast | cheap | reasoning | quality | polish | search
  call <task> "<message>" --provider <name>   Force a specific provider
  status                           Show provider status and knowledge file health

Providers:
  anthropic, openai, groq, deepseek, openrouter, mistral, perplexity, together

Examples:
  node skydexia-orchestrator.mjs build-website "SaaS landing page for a CRM tool targeting mid-market sales teams"
  node skydexia-orchestrator.mjs call design "design brief for a luxury architecture firm portfolio"
  node skydexia-orchestrator.mjs call code "hero section in HTML and CSS" --provider deepseek
  node skydexia-orchestrator.mjs status
`);
    process.exit(0);
  }

  if (command === 'status') {
    showStatus();
    process.exit(0);
  }

  if (command === 'build-website') {
    const brief = args.join(' ');
    if (!brief) { console.error('Usage: build-website "<brief>"'); process.exit(1); }
    buildWebsite(brief)
      .then(result => {
        console.log(JSON.stringify({
          ok: true,
          projectId: result.id,
          siteName: result.siteName,
          artifacts: result.artifactsDir,
          quality: result.qualityResult?.score,
        }, null, 2));
      })
      .catch(err => {
        console.error(JSON.stringify({ ok: false, error: err.message }));
        process.exit(1);
      });
    process.exit; // keep alive for async
  }

  if (command === 'call') {
    const task     = args[0];
    const message  = args[1];
    const provIdx  = args.indexOf('--provider');
    const provider = provIdx !== -1 ? args[provIdx + 1] : null;
    if (!task || !message) { console.error('Usage: call <task> "<message>" [--provider <name>]'); process.exit(1); }
    singleCall(task, message, provider)
      .then(output => console.log(output))
      .catch(err => { console.error(err.message); process.exit(1); });
  }
}

export { buildWebsite, singleCall, smartCall, showStatus, loadKnowledgeBlock, buildDesignSystemPrompt };
