# skAIxuide Chat Implementation Plan

## Objective
Make the skAIxuide IDE chat/AI system work like Neural-Space-Pro, which is the proven reference implementation.

---

## Current State: What's Broken

### skAIxuide IDE (broken)
```
handleSend() → processQueue() → executeAiCommand() → kaixuStreamChat() → POST gateway-stream → SSE parse loop → accumulate raw → regex extract → apply
```

- Uses `gateway-stream` (SSE streaming) for **everything** — both DEV edits and Consult chat
- Accumulates stream chunks into `raw` string, then runs regex to extract code
- Has **no** `kaixuChat()` non-stream function
- Does **NOT** pass conversation history — each request is standalone (no memory)
- Consult mode renders with raw HTML-escaped text, not `marked.parse()`
- `onError: (err) => { throw err; }` inside the stream reader is dangerous — if the gateway sends an error event before any deltas, the throw aborts the stream, `raw` is empty, code extraction fails → "AI returned text instead of code"
- The `kaixuStreamChat` function lacks watchdog timer (15s), idle timer (20s), `firstDataSeen` tracking, and `rawEvents` diagnostics

### Neural-Space-Pro (working perfectly)
```
handleSend() → runChat() → kaixuChat() → POST gateway-chat → JSON response → done
```

- Uses `gateway-chat` (non-streaming, simple JSON POST)
- Gets back a complete JSON object: `{ output_text: "...", usage: {...}, month: {...} }`
- Reads `result.output_text`, renders it with `marked.parse()` + Prism highlighting
- Has `kaixuStreamChat` defined but **never called** — exclusively uses non-stream endpoint
- Passes full conversation history to the AI (`...conversation.map(...)`)

---

## Root Causes

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Wrong endpoint for DEV mode** | DEV mode doesn't need streaming. The entire response is accumulated before applying anyway. Using SSE adds fragility for zero benefit. Neural-Space-Pro wisely uses `gateway-chat`. |
| 2 | **Streaming function is weaker** | IDE's `kaixuStreamChat` lacks watchdog timer, idle timer, `firstDataSeen` tracking, and `rawEvents` diagnostics. If the stream stalls or sends no deltas, IDE silently gets an empty `raw`. |
| 3 | **`onError: throw` is a bomb** | If the gateway sends an `error` event before any `delta` events, the throw aborts the entire stream, `raw` is empty string, code extraction fails → log shows "AI returned text instead of code". |
| 4 | **No conversation history** | IDE sends only `[system, user]`. Neural-Space-Pro sends `[system, ...allPriorMessages, user]`. The AI has no context from prior turns. |
| 5 | **Consult mode doesn't use markdown** | Neural-Space-Pro uses `marked.parse()` + Prism. IDE escapes HTML and renders monospace — no formatting, no code highlighting. |

---

## Implementation Plan

### Step 1: Add `kaixuChat()` (non-stream) to the IDE

Port the `kaixuChat` function directly from Neural-Space-Pro. It's a simple `fetch → JSON → return`.

**Source:** `Neural-Space-Pro/index.html` lines ~580-620

```js
async function kaixuChat(kaixuKey, payload) {
    const bases = [KAIXU_GATEWAY_PRIMARY];
    if (KAIXU_IS_LOCAL) bases.push(KAIXU_GATEWAY_FALLBACK);
    let lastErr = null;

    for (const base of bases) {
        try {
            const res = await fetch(`${base}/.netlify/functions/gateway-chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${kaixuKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                if (KAIXU_IS_LOCAL && base === KAIXU_GATEWAY_PRIMARY && res.status === 404) continue;
                throw mapGatewayError(res.status, body);
            }
            return res.json();
        } catch (err) {
            lastErr = err;
            if (base !== bases[bases.length - 1]) continue;
            throw lastErr;
        }
    }
    if (lastErr) throw lastErr;
}
```

**Where to place:** Right before the existing `kaixuStreamChat` function in `skAIxuide/index.html`.

---

### Step 2: DEV Mode — Switch from `kaixuStreamChat` to `kaixuChat`

Replace the entire DEV mode block inside `executeAiCommand` to use the non-stream endpoint.

**Before (broken):**
```js
await kaixuStreamChat({
    kaixuKey,
    payload: { ... },
    onDelta: (text) => { raw += text; },
    onError: (err) => { throw err; }  // ← THE BUG
});
// then regex extract from raw
```

**After (correct):**
```js
const result = await kaixuChat(kaixuKey, {
    provider: 'SKYES OVER LONDON',
    model: 'kAIxU',
    messages: msgs,
    max_tokens: 8192,
    temperature: 0.15
});

const raw = result.output_text || '';
if (!raw) throw new Error('Empty response from gateway');
// then extract code from raw (same regex logic)
```

**Why:** You don't watch the text stream in; you need the complete code. One call, one response, extract code, apply. This eliminates all SSE parsing bugs instantly.

---

### Step 3: CONSULT Mode — Switch to `kaixuChat` + `marked.parse()`

Replace the Consult mode streaming with a simple non-stream call, matching Neural-Space-Pro exactly.

**Before (broken):**
```js
onDelta: (text) => {
    accumulatedText += text;
    const safe = accumulatedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")  // ← kills all formatting
        .replace(/>/g, "&gt;");
    bubble.innerHTML = `<div class="...">${safe}</div>`;
},
```

**After (correct):**
```js
const result = await kaixuChat(kaixuKey, {
    provider: 'SKYES OVER LONDON',
    model: 'kAIxU',
    messages: msgs,
    max_tokens: 8192,
    temperature: 0.7
});

const reply = result.output_text || '';
bubble.innerHTML = marked.parse(reply);
Prism.highlightAllUnder(bubble);
```

**Note:** The IDE already loads `marked` via CDN. It's available but unused in chat.

---

### Step 4: Add Conversation History

Maintain a `conversation[]` array (already exists as a concept in the queue system but isn't populated).

**Changes needed:**
1. Declare `let conversation = [];` in the IDE's app state
2. After each successful AI response, push: `conversation.push({ role: 'user', content: prompt }, { role: 'assistant', content: reply })`
3. Pass history in messages array:
```js
messages: [
    { role: "system", content: sys },
    ...conversation,
    { role: "user", content: prompt }
]
```
4. Clear conversation on new project or file switch if desired

---

### Step 5: Remove the Dangerous `onError: throw`

If streaming is kept for any future use, the `onError` callback must never throw inside the reader loop. Replace with graceful error handling:

```js
// BAD
onError: (err) => { throw err; }

// GOOD
onError: (err) => {
    broadcastLog(`Stream error: ${err.message}`, 'error');
    // set a flag, don't throw
}
```

---

## Summary of Changes

| File | Change | Lines (approx) |
|------|--------|----------------|
| `skAIxuide/index.html` | Add `kaixuChat()` function | +30 lines |
| `skAIxuide/index.html` | Rewrite DEV mode block in `executeAiCommand` to use `kaixuChat` | ~40 lines changed |
| `skAIxuide/index.html` | Rewrite CONSULT mode block to use `kaixuChat` + `marked.parse()` | ~30 lines changed |
| `skAIxuide/index.html` | Add `conversation[]` state + push/pass logic | +10 lines |
| `skAIxuide/index.html` | Keep `kaixuStreamChat` available but unused (can remove later) | 0 lines |

**Total impact:** ~5 targeted edits, ~110 lines changed. Zero new dependencies. Mirrors the proven Neural-Space-Pro pattern exactly.

---

## Validation Checklist

- [ ] DEV mode edit → code applied to preview silently, no chat bubble
- [ ] CONSULT mode → markdown-rendered response in chat bubble
- [ ] Conversation history maintained across turns
- [ ] Error from gateway → clean error display, not a crash
- [ ] Budget/usage telemetry still logs correctly
- [ ] Log shows "DEV edit applied (code-block)" not "AI returned text instead of code"
