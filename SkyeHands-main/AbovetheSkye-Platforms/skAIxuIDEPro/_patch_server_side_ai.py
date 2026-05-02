from pathlib import Path
import re, json, os
root = Path('/mnt/data/work_skaixuidepro')

# --- Shared helper files ---
lib = root/'netlify/functions/_lib/kaixu-openai.js'
lib.parent.mkdir(parents=True, exist_ok=True)
lib.write_text("""
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const BRAND_PROVIDER = 'SKYES OVER LONDON';
const BRAND_MODEL = 'kAIxU';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

export const KAIXU_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function brandSystemPrompt() {
  return [
    'You are kAIxU, the AI system operated by Skyes Over London.',
    'Never mention OpenAI, Anthropic, Gemini, Google, Claude, model vendors, or provider implementation details.',
    'If asked what you are or who powers you, say: "I am kAIxU by Skyes Over London."',
    'Keep branding consistent: provider = SKYES OVER LONDON, AI name = kAIxU.'
  ].join(' ');
}

function normalizeMessages(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  const normalized = safe
    .filter(Boolean)
    .map((m) => ({
      role: ['system', 'developer', 'user', 'assistant', 'tool'].includes(m.role) ? m.role : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    }))
    .filter((m) => m.content.trim().length > 0);

  return [
    { role: 'system', content: brandSystemPrompt() },
    ...normalized
  ];
}

function extractText(data) {
  return data?.choices?.[0]?.message?.content || '';
}

function mapUsage(data) {
  const usage = data?.usage || {};
  return {
    input_tokens: usage.prompt_tokens || 0,
    output_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0
  };
}

export async function callKaixu(payload = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('Missing OPENAI_API_KEY');
    err.statusCode = 500;
    throw err;
  }

  const body = {
    model: DEFAULT_MODEL,
    messages: normalizeMessages(payload.messages),
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.2,
    stream: false
  };

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!resp.ok) {
    const err = new Error(data?.error?.message || text || `OpenAI HTTP ${resp.status}`);
    err.statusCode = resp.status;
    throw err;
  }

  const outputText = extractText(data);
  const usage = mapUsage(data);

  return {
    raw: data,
    outputText,
    usage,
    brand: {
      provider: BRAND_PROVIDER,
      model: BRAND_MODEL
    }
  };
}

export function jsonResponse({ outputText, usage, brand }) {
  return {
    id: `kaixu_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: brand.model,
    provider: brand.provider,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: outputText }
      }
    ],
    output_text: outputText,
    usage,
    meta: brand
  };
}

export function sseResponse({ outputText, usage, brand }) {
  const events = [
    ['meta', { provider: brand.provider, model: brand.model }],
    ['delta', { text: outputText }],
    ['done', { text: outputText, usage, provider: brand.provider, model: brand.model }]
  ];
  return events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join('');
}
""".strip()+"\n", encoding='utf-8')

(root/'netlify/functions/gateway-chat.js').write_text("""
import { KAIXU_CORS, callKaixu, jsonResponse } from './_lib/kaixu-openai.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: KAIXU_CORS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: KAIXU_CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const result = await callKaixu(payload);
    return {
      statusCode: 200,
      headers: { ...KAIXU_CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonResponse(result))
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      headers: { ...KAIXU_CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'kAIxU lane failure' })
    };
  }
};
""".strip()+"\n", encoding='utf-8')

(root/'netlify/functions/gateway-stream.js').write_text("""
import { KAIXU_CORS, callKaixu, sseResponse } from './_lib/kaixu-openai.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: KAIXU_CORS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: KAIXU_CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const result = await callKaixu(payload);
    return {
      statusCode: 200,
      headers: { ...KAIXU_CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: sseResponse(result)
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      headers: { ...KAIXU_CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'kAIxU stream failure' })
    };
  }
};
""".strip()+"\n", encoding='utf-8')

# --- root config ---
(root/'netlify.toml').write_text("""
[build]
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"

[dev]
  command = "npx serve . -l 5500 --no-clipboard"
  targetPort = 5500
  port = 8080
  autoLaunch = false
""".strip()+"\n", encoding='utf-8')

pkg = json.loads((root/'package.json').read_text(encoding='utf-8'))
pkg['scripts'] = {
  'start': 'netlify dev',
  'dev': 'netlify dev',
  'netlify': 'netlify dev'
}
(root/'package.json').write_text(json.dumps(pkg, indent=2)+"\n", encoding='utf-8')

(root/'.env').write_text("OPENAI_API_KEY=\nOPENAI_MODEL=gpt-4.1-mini\n", encoding='utf-8')
(root/'.env.example').write_text("OPENAI_API_KEY=\nOPENAI_MODEL=gpt-4.1-mini\n", encoding='utf-8')

# Remove noisy historical logs that leak prior architecture
for p in [root/'skAIxuide/server.log', root/'skAIxuide/CODE PULSE ', root/'skAIxuide/CODE PULSE']:
    if p.exists():
        p.unlink()

# Shared notes
(root/'SERVER_SIDE_AI_HARDENING.md').write_text("""
# skAIxuIDEpro server-side AI hardening

This package has been hardened so browser surfaces do not require or store KAIXU keys or provider keys.

## Required env vars
- OPENAI_API_KEY
- OPENAI_MODEL (optional, defaults to gpt-4.1-mini)

## Branding contract
- Public AI name: kAIxU
- Public provider label: SKYES OVER LONDON
- Browser runtime should not expose provider implementation details.

## Local dev
Run:

npm install
npm start

## Netlify deploy
This package is Netlify-ready. Add OPENAI_API_KEY in site environment variables before deploy.
""".strip()+"\n", encoding='utf-8')

# --- targeted browser/runtime patch helpers ---
BRAND = 'kAIxU'
PROVIDER = 'SKYES OVER LONDON'

client_files = [
    root/'skAIxuide/index.html',
    root/'skAIxuide/smartide.html',
    root/'skAIxuide/diagnostics.html',
    root/'skAIxuide/SourceCode',
    root/'skAIxuide/Analysis.html',
    root/'skAIxuide/features&specs.html',
    root/'skAIxuide/server.py',
    root/'skyehawk.js',
]

# direct-provider pages to reroute server-side
client_files += [
    root/'projectaegis-skyex/index.html',
    root/'Code Genie/CodeGenie.html',
    root/'Data Forge/DataForge.html',
    root/'reactforge/index.html',
]

repls = [
    (r"https://kaixugateway13\.netlify\.app", ""),
    (r"localStorage\.getItem\(['\"]kAIxU Server Lane['\"]\)\s*\|\|\s*['\"]['\"]", "'server-managed'"),
    (r"localStorage\.getItem\(['\"]kAIxU Server Lane['\"]\)", "'server-managed'"),
    (r"localStorage\.getItem\(['\"]kaixu_api_key['\"]\)\s*\|\|\s*['\"]['\"]", "'server-managed'"),
    (r"localStorage\.getItem\(['\"]kaixu_api_key['\"]\)", "'server-managed'"),
    (r"localStorage\.getItem\(['\"]sk_api_key['\"]\)\s*\|\|\s*['\"]['\"]", "''"),
    (r"localStorage\.getItem\(['\"]sk_api_key['\"]\)", "''"),
    (r"localStorage\.getItem\(['\"]gemini_api_key['\"]\)", "''"),
    (r".*localStorage\.setItem\(['\"](?:kAIxU Server Lane|kaixu_api_key|sk_api_key|gemini_api_key)['\"].*?\);\s*", "// server-managed credential storage removed\n"),
    (r".*localStorage\.removeItem\(['\"](?:kAIxU Server Lane|kaixu_api_key|sk_api_key|gemini_api_key)['\"].*?\);\s*", "// server-managed credential storage removed\n"),
    (r"Kaixu Virtual Key", "kAIxU Server Lane"),
    (r"Gateway Key", "Server AI Lane"),
    (r"Enter Gateway Key\.\.\.", "Server-managed via Netlify env"),
    (r"sk-\.\.\.", "Server-managed"),
    (r"gemini-2\.0-flash-thinking-exp|gemini-2\.5-pro-exp-03-25|gemini-2\.0-flash|gemini-1\.5-pro", "kAIxU"),
    (r"Gemini 2\.0 Flash • Fast|Gemini 1\.5 Pro • Smart|Gemini 2\.5 Pro • Smartest|Flash Thinking • Reasoning", f"{BRAND} • {PROVIDER}"),
    (r"provider:\s*['\"]gemini['\"]", "provider: 'kAIxU'"),
    (r"model:\s*['\"]kAIxU['\"]", "model: 'kAIxU'"),
    (r"provider:\s*\"gemini\"", 'provider: "kAIxU"'),
    (r"model:\s*\"kAIxU\"", 'model: "kAIxU"'),
    (r"openai|anthropic|gemini", lambda m: {'openai':'kAIxU','anthropic':'kAIxU','gemini':'kAIxU'}[m.group(0)]),
]

# some replacements should not touch server-side env var names in server files, handle per-file below.
for path in client_files:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')

    if path.name in {'index.html','smartide.html','SourceCode'} and 'skAIxuide' in str(path.parent):
        text = text.replace("const KAIXU_GATEWAY_PRIMARY = KAIXU_IS_LOCAL ? '/api' : '';", "const KAIXU_GATEWAY_PRIMARY = ''; // same-origin server-side AI lane")
        text = text.replace("const KAIXU_GATEWAY_FALLBACK = '';", "const KAIXU_GATEWAY_FALLBACK = '';")
        remote_gateway = 'https://' + 'kaixugateway13' + '.netlify.app'
        text = text.replace(f"const KAIXU_GATEWAY_PRIMARY = KAIXU_IS_LOCAL ? '/api' : '{remote_gateway}';", "const KAIXU_GATEWAY_PRIMARY = ''; // same-origin server-side AI lane")
        text = text.replace(f"const KAIXU_GATEWAY_FALLBACK = '{remote_gateway}';", "const KAIXU_GATEWAY_FALLBACK = ''; // no browser-side provider fallback")
        text = text.replace("const GATEWAY_DIRECT = '';", "const GATEWAY_DIRECT = '';")
        text = text.replace(f"const GATEWAY_DIRECT = '{remote_gateway}';", "const GATEWAY_DIRECT = ''; // no browser-side provider fallback")
        text = text.replace("const GATEWAY_BASE = _isLocal ? GATEWAY_LOCAL : GATEWAY_DIRECT;", "const GATEWAY_BASE = ''; // same-origin server-side AI lane")
        text = re.sub(r"'Authorization':\s*`Bearer \$\{[^}]+\}`,?\s*", "", text)
        text = re.sub(r'"Authorization":\s*`Bearer \$\{[^}]+\}`,?\s*', "", text)
        text = re.sub(r"if \(!kaixuKey\) \{ window\.toggleModal\(true\); return; \}", "", text)
        text = re.sub(r"if \(!state\.kaixuKey\) \{ openKeyModal\(\); return; \}", "", text)
        text = text.replace("let kaixuKey = 'server-managed';", "let kaixuKey = 'server-managed';")
        text = re.sub(r"let activeModel = .*?;", "let activeModel = 'kAIxU';", text)
        text = re.sub(r"const MODEL_LABELS = \{[\s\S]*?\};", f"const MODEL_LABELS = {{ 'kAIxU': '{BRAND} • {PROVIDER}' }};", text)
        text = text.replace("localStorage.setItem('sk_active_model', model);", "")
        text = text.replace("const savedModel = localStorage.getItem('sk_active_model');", "const savedModel = 'kAIxU';")
        text = text.replace("if (savedModel) {", "if (savedModel) {")
        legacy_key_probe = '/' + 'api' + '/' + 'kaixu-key'
        text = text.replace(f"const keyResp = await fetch('{legacy_key_probe}');", "const keyResp = { ok: false }; // browser key injection removed")
        text = text.replace(f"const resp = await fetch('{legacy_key_probe}');", "const resp = { ok: false }; // browser key injection removed")
        text = text.replace("const k = document.getElementById('key-kaixu').value.trim();\n                    if(k) {\n                        kaixuKey = k;\n                        broadcastLog(`Key Injected: ...${k.slice(-4)}`, 'success');\n                        window.toggleModal(false);\n                        addChatMessage('assistant', \"Gateway synchronized. Neural link active.\");\n                    }", "broadcastLog('Server-side AI lane active', 'success');\n                    window.toggleModal(false);\n                    addChatMessage('assistant', 'kAIxU server lane confirmed.');")
        text = text.replace("const k = el['key-input']?.value.trim();\n                    if (k) {\n                        state.kaixuKey = k;\n                        broadcastLog(`Key set: ...${k.slice(-4)}`, 'success');\n                        el['key-modal'].classList.remove('open');\n                        addMsg('system', 'Gateway connected');\n                        toast('Gateway key saved', 'success');\n                    }", "state.kaixuKey = 'server-managed';\n                    broadcastLog('Server-side AI lane active', 'success');\n                    el['key-modal'].classList.remove('open');\n                    addMsg('system', 'kAIxU server lane connected');\n                    toast('Server AI active', 'success');")
        text = text.replace("if (!tourDone) window.showTutorialOffer();\n                else if(!kaixuKey) window.toggleModal(true);", "if (!tourDone) window.showTutorialOffer();")
        text = text.replace("window.skipTutorial = function() { const el = document.getElementById('tour-offer-modal'); if(el) el.classList.add('hidden'); localStorage.setItem('sk_tour_completed', 'true'); if(!kaixuKey) window.toggleModal(true); };", "window.skipTutorial = function() { const el = document.getElementById('tour-offer-modal'); if(el) el.classList.add('hidden'); localStorage.setItem('sk_tour_completed', 'true'); };" )
        text = text.replace("broadcastLog(`Non-stream request: ${payload.provider}/${payload.model}`, 'info');", "broadcastLog('Non-stream request: kAIxU', 'info');")
        text = text.replace("broadcastLog(`Request: ${payload.provider}/${payload.model} | ${payload.messages.length} msgs`, 'info');", "broadcastLog(`Request: kAIxU | ${payload.messages.length} msgs`, 'info');")
        text = text.replace("broadcastLog(`Streaming Request: ${payload.provider}`, 'info');", "broadcastLog('Streaming Request: kAIxU', 'info');")
        text = text.replace("console.log(`[Kaixu Gateway] Streaming to ${payload.provider}...`);", "console.log('[kAIxU] Streaming request...');")
        text = text.replace("if (result.usage) broadcastLog(`Usage in:${result.usage.input_tokens||0} out:${result.usage.output_tokens||0} model:${activeModel}`, 'info');", "if (result.usage) broadcastLog(`Usage in:${result.usage.input_tokens||0} out:${result.usage.output_tokens||0} model:kAIxU`, 'info');")
        text = text.replace("'Brain: ' + (savedModel.includes('thinking') ? 'Thinking' : savedModel.includes('1.5-pro') ? 'Pro 1.5' : savedModel.includes('2.5') ? '2.5 Pro' : 'skAIxu Flow')", f"'Brain: {BRAND} • {PROVIDER}'")
        text = text.replace("'Brain: ' + (model.includes('thinking') ? 'Thinking' : model.includes('1.5-pro') ? 'Pro 1.5' : model.includes('2.5') ? '2.5 Pro' : 'skAIxu Flow')", f"'Brain: {BRAND} • {PROVIDER}'")
        text = text.replace("'Brain: skAIxu Flow'", f"'Brain: {BRAND} • {PROVIDER}'")

    if path == root/'skAIxuide/index.html':
        text = re.sub(r"<option value=\"kAIxU\">.*?</option>\s*<option value=\"kAIxU\">.*?</option>\s*<option value=\"kAIxU\">.*?</option>\s*<option value=\"kAIxU\">.*?</option>", '<option value="kAIxU">⚡ kAIxU</option>', text, count=1, flags=re.S)
        text = text.replace("<div id=\"model-label\" class=\"text-[8px] text-slate-500 font-bold\">kAIxU • SKYES OVER LONDON</div>", f"<div id=\"model-label\" class=\"text-[8px] text-slate-500 font-bold\">{BRAND} • {PROVIDER}</div>")
        text = text.replace("let apiKey = '' || \"\";", "let apiKey = ''; // provider keys removed from browser")
        text = text.replace("let kaixuKey = 'server-managed';", "let kaixuKey = 'server-managed';")
        text = text.replace("if(!kaixuKey) {\n                    const storedKey = 'server-managed';\n                    if(storedKey) kaixuKey = storedKey;\n                }", "kaixuKey = 'server-managed';")
        text = text.replace("// Start in production: Do NOT attempt to fetch key. Rely on user input.", "// Production uses server-side env secrets only.")
        text = text.replace("else if(!kaixuKey) window.toggleModal(true);", "")
        text = text.replace("if(!kaixuKey) { window.toggleModal(true); return; }", "")
        text = text.replace("provider: 'kAIxU',\n                        model: activeModel === 'kAIxU' ? 'kAIxU' : activeModel,", "provider: 'kAIxU',\n                        model: 'kAIxU',")
        text = text.replace("provider: 'kAIxU',\n                        model: activeModel,", "provider: 'kAIxU',\n                        model: 'kAIxU',")
        text = text.replace("provider: 'kAIxU',\n                    model: activeModel,", "provider: 'kAIxU',\n                    model: 'kAIxU',")

    if path == root/'skAIxuide/diagnostics.html':
        text = text.replace("<h2 class=\"text-xl font-bold mb-4\">kAIxU Server Lane</h2>", f"<h2 class=\"text-xl font-bold mb-4\">{BRAND} Server Lane</h2>")
        text = text.replace("<button onclick=\"saveKey()\" class=\"bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg font-bold text-sm transition-colors\">Save Key</button>", "")
        text = text.replace("<button onclick=\"clearKey()\" class=\"bg-red-900/50 hover:bg-red-800/50 border border-red-500/30 px-6 py-2 rounded-lg font-bold text-sm transition-colors\">Clear</button>", "")
        text = text.replace("<input id=\"key-input\" type=\"password\" placeholder=\"Server-managed\" class=\"flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 font-mono text-sm focus:border-indigo-500 outline-none\">", "<input id=\"key-input\" type=\"text\" readonly value=\"Server-managed via Netlify env\" class=\"flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 font-mono text-sm text-slate-400 outline-none\">")
        text = text.replace("const hasKey = !!'server-managed';\n            checks.push(`localStorage=${hasKey ? 'HAS_KEY' : 'NO_KEY'}`);", "checks.push('browser_keys=DISABLED');")
        text = text.replace("// Enhanced Key Check (Cross-App Persistence)\n            let key = 'server-managed';\n            if(!key) key = 'server-managed'; // Check Neural Space Key\n            \n            const status = document.getElementById('key-status');\n            const input = document.getElementById('key-input');\n            \n            if(key) {\n                // Ensure sync\n                if(!'server-managed') // server-managed credential storage removed\n\n                status.innerText = \"Key found in LocalStorage (ends with ...\" + key.slice(-4) + \")\";\n                status.className = \"mt-2 text-xs font-mono text-emerald-400\";\n                input.value = key;\n            } else {\n                status.innerText = \"No key found in LocalStorage.\";\n                status.className = \"mt-2 text-xs font-mono text-red-400\";\n            }", "const status = document.getElementById('key-status');\n            const input = document.getElementById('key-input');\n            status.innerText = 'Server-side AI active. No browser credential storage.';\n            status.className = 'mt-2 text-xs font-mono text-emerald-400';\n            input.value = 'Server-managed via Netlify env';")
        text = re.sub(r"function saveKey\([\s\S]*?function clearKey\(\) \{[\s\S]*?\}\n\n", "function saveKey() { log('Browser key storage is disabled.', 'warn'); }\n\nfunction clearKey() { log('No browser key exists to clear.', 'info'); }\n\n", text, count=1)
        text = text.replace("log(\"4. Checking Credentials...\");\n            const key = 'server-managed';\n            if(!key) {\n                log(\"FAIL: No kAIxU Server Lane found.\", 'error');\n                log(\"Action: Enter a key above and save.\", 'warn');\n                return;\n            }\n            log(\"Key present in storage.\", 'success');", "log('4. Checking Server-side AI lane...');\n            log('Browser credentials disabled. Using Netlify env secrets.', 'success');")
        text = text.replace("const key = 'server-managed';\n            if(!key) {\n                log(\"Cannot test: Missing kAIxU Server Lane\", 'error');\n                return;\n            }", "")
        text = re.sub(r'headers:\s*\{\s*"Authorization":\s*`Bearer \$\{key\}`,\s*"Content-Type":\s*"application/json"\s*\}', 'headers: { "Content-Type": "application/json" }', text)
        text = text.replace("log(\"ACTION: Double check your key. It should start with 'sk-' or similar if it's a provider key, but here it must be the kAIxU Server Lane.\", 'warn');", "log('ACTION: Verify OPENAI_API_KEY is configured in Netlify env vars.', 'warn');")
        text = text.replace("log(\"Action: Verify you can access /.netlify/functions/gateway-chat in a new tab.\", 'warn');", "log('Action: Verify the deployed site has gateway-chat and gateway-stream functions.', 'warn');")

    if path == root/'skAIxuide/Analysis.html':
        text = text.replace('Kaixu Virtual Key', 'server-side AI lane')
        text = text.replace('localStorage', 'same-origin runtime state')
        text = text.replace('shared localStorage contract', 'shared same-origin AI contract')

    if path == root/'skAIxuide/features&specs.html':
        text = text.replace('OpenAI', 'kAIxU')
        text = text.replace('Anthropic', 'kAIxU')
        text = text.replace('Gemini', 'kAIxU')

    if path == root/'skAIxuide/server.py':
        text = text.replace("kAIxU Server Lane = os.environ.get('kAIxU Server Lane', '')", "OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')")
        text = text.replace('kAIxU Server Lane', 'OPENAI_API_KEY')
        text = text.replace(remote_gateway, ''.join(['<local-dev-runtime', '-url>']))

    if path == root/'skyehawk.js':
        text = text.replace("const GATEWAY_URL = '/api/chat';", "const GATEWAY_URL = '/.netlify/functions/gateway-chat';")
        text = text.replace(f"const GATEWAY_URL = '{remote_gateway}/api/chat';", "const GATEWAY_URL = '/.netlify/functions/gateway-chat';")
        text = re.sub(r"const KEY_STORAGE\s*=\s*'kAIxU Server Lane';", "const KEY_STORAGE = null; // browser credential storage removed", text)
        text = re.sub(r"const hasKey = !!.*?;", "const hasKey = true;", text)
        text = text.replace("'Authorization': `Bearer ${key}`,", "")
        text = text.replace("tabChat.title = hasKey ? 'Kaixu Chat' : 'Requires kAIxU Server Lane in localStorage';", "tabChat.title = 'kAIxU Chat';")
        text = text.replace("diagLink.textContent = '↗ Open Kaixu Gateway';", "diagLink.textContent = '↗ Open kAIxU Server Lane';")
        text = text.replace("diagLink.href = '';", "diagLink.href = '/.netlify/functions/gateway-chat';")

    # direct provider pages rerouted to same-origin gateway-chat
    if path in {root/'projectaegis-skyex/index.html', root/'Code Genie/CodeGenie.html', root/'Data Forge/DataForge.html', root/'reactforge/index.html'}:
        text = text.replace('Gemini API Key', 'Server AI Lane')
        text = text.replace('Paste Gemini API Key', 'Server-managed via Netlify env')
        text = re.sub(r'.*localStorage\.setItem\([\s\S]*?\n', '// provider key storage removed\n', text)
        text = re.sub(r'.*localStorage\.getItem\([\s\S]*?\n', '// provider key retrieval removed\n', text)
        text = text.replace('if(!apiKey) throw new Error("API Key is missing");', '')
        text = text.replace('if(!apiKey){', 'if(false){')
        text = re.sub(r'https://generativelanguage\.googleapis\.com[^`\"\']+', '/.netlify/functions/gateway-chat', text)
        text = text.replace("const url = `/.netlify/functions/gateway-chat`;", "const url = `/.netlify/functions/gateway-chat`; // server-side branded lane")
        text = text.replace("const currentApiUrl = `/.netlify/functions/gateway-chat`;", "const currentApiUrl = `/.netlify/functions/gateway-chat`; // server-side branded lane")
        text = text.replace("const apiUrl = `/.netlify/functions/gateway-chat`;", "const apiUrl = `/.netlify/functions/gateway-chat`; // server-side branded lane")
        text = re.sub(r'\?key=\$\{[^}]+\}', '', text)
        text = re.sub(r'\?key=\$\{apiKey\}', '', text)
        text = re.sub(r'headers:\s*\{\s*[\s\S]*?\}\s*,\s*body:\s*JSON\.stringify\(', 'headers: { "Content-Type": "application/json" }, body: JSON.stringify(', text)
        text = text.replace('provider: \"kAIxU\"', 'provider: "kAIxU"')

    # Global replacements after path-specific edits
    for pat, repl in repls:
        text = re.sub(pat, repl, text)

    # Clean dangling comma after removed Authorization header
    text = re.sub(r'\{\s*,', '{', text)
    text = re.sub(r',\s*\}', ' }', text)
    text = text.replace("fetch(`${base}/.netlify/functions/gateway-chat`, {\n                        method: 'POST',\n                        headers: {\n                            \n                            'Content-Type': 'application/json'\n                        },", "fetch(`${base}/.netlify/functions/gateway-chat`, {\n                        method: 'POST',\n                        headers: { 'Content-Type': 'application/json' },")
    text = text.replace("fetch(`${base}/.netlify/functions/gateway-stream`, {\n                        method: 'POST',\n                        headers: {\n                            \n                            'Content-Type': 'application/json'\n                        },", "fetch(`${base}/.netlify/functions/gateway-stream`, {\n                        method: 'POST',\n                        headers: { 'Content-Type': 'application/json' },")

    path.write_text(text, encoding='utf-8')

# Slight cleanup for source docs in skAIxuide folder
for p in [root/'skAIxuide/codepulse.html']:
    if p.exists():
        t = p.read_text(encoding='utf-8', errors='ignore').replace('Gemini', 'kAIxU').replace('OpenAI', 'kAIxU').replace('Anthropic', 'kAIxU')
        p.write_text(t, encoding='utf-8')

print('patched')
