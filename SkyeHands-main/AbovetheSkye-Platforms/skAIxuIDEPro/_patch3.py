import re, sys

with open('skAIxuide/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File size: {len(content)} chars, {content.count(chr(10))+1} lines")

# ============================================================
# 1. RIP OUT: kaixuChat function (lines ~1051-1077)
# ============================================================
kc_start = content.find('        // --- GATEWAY CLIENT LOGIC ---')
kc_end = content.find('        // --- ROBUST SSE CLIENT ---')
if kc_start == -1 or kc_end == -1:
    print("ERROR: Could not find kaixuChat block boundaries")
    print(f"  kc_start={kc_start}, kc_end={kc_end}")
    sys.exit(1)
print(f"[1] kaixuChat block: chars {kc_start}-{kc_end}")

# ============================================================
# 2. RIP OUT: kaixuStreamChat function (through closing brace)
# ============================================================
sse_start = kc_end  # starts at "// --- ROBUST SSE CLIENT ---"
# Find the end: the function closes with "        }" then next section
# Look for the next major section after kaixuStreamChat
sse_end_marker = '        // --- SEARCH/REPLACE EDIT ENGINE ---'
sse_end = content.find(sse_end_marker, sse_start)
if sse_end == -1:
    print("ERROR: Could not find end of kaixuStreamChat")
    sys.exit(1)
print(f"[2] kaixuStreamChat block: chars {sse_start}-{sse_end}")

# ============================================================
# 3. RIP OUT: applySearchReplace function
# ============================================================
asr_start = sse_end  # "// --- SEARCH/REPLACE EDIT ENGINE ---"
asr_end = content.find('        async function handleSend()', asr_start)
if asr_end == -1:
    print("ERROR: Could not find handleSend after applySearchReplace")
    sys.exit(1)
print(f"[3] applySearchReplace block: chars {asr_start}-{asr_end}")

# ============================================================
# 4. RIP OUT: executeAiCommand function  
# ============================================================
exec_start = content.find('        async function executeAiCommand(prompt, attachments) {')
exec_end = content.find('\n        // --- GLOBAL EXPORTS FOR HTML HANDLERS ---')
if exec_start == -1 or exec_end == -1:
    print("ERROR: Could not find executeAiCommand boundaries")
    print(f"  exec_start={exec_start}, exec_end={exec_end}")
    sys.exit(1)
print(f"[4] executeAiCommand block: chars {exec_start}-{exec_end}")

# ============================================================
# Build replacement: ONE clean gateway + executeAiCommand
# ============================================================
NEW_GATEWAY = '''        // --- GATEWAY: Single streaming function ---
        async function streamFromGateway(messages, { maxTokens = 65536, temperature = 0.3 } = {}) {
            const payload = {
                provider: 'SKYES OVER LONDON',
                model: 'kAIxU',
                messages,
                max_tokens: maxTokens,
                temperature
            };
            
            broadcastLog(`Sending stream to gemini (kAIxU)`, 'info');
            
            const response = await fetch(`${KAIXU_GATEWAY_BASE}/.netlify/functions/gateway-stream`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${kaixuKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let msg = `HTTP ${response.status}`;
                try { const j = await response.json(); if (j.error) msg = j.error; } catch(e) {
                    try { msg = await response.text() || msg; } catch(e2) {}
                }
                if (response.status === 401) window.toggleModal(true);
                throw new Error(msg);
            }

            // Read SSE stream, return accumulated text
            let text = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                
                const parts = buf.split('\\n\\n');
                buf = parts.pop();
                
                for (const part of parts) {
                    let evt = null, data = '';
                    for (const line of part.split('\\n')) {
                        if (line.startsWith('event:')) evt = line.slice(6).trim();
                        else if (line.startsWith('data:')) data += line.slice(5).trim();
                    }
                    if (!data) continue;
                    try {
                        const j = JSON.parse(data);
                        if (evt === 'delta' && j.text) text += j.text;
                        else if (evt === 'meta' && j.month) updateBudgetDisplay(j.month);
                        else if (evt === 'done') {
                            const u = j.usage || {};
                            broadcastLog(`Stream done | in=${u.input_tokens||'?'} out=${u.output_tokens||'?'}`, 'success');
                        }
                        else if (evt === 'error') throw new Error(j.error || 'Stream error');
                        else if (j.text) text += j.text; // unlabeled delta
                    } catch(e) {
                        if (evt === 'error') throw new Error(data);
                    }
                }
            }
            return text;
        }

'''

NEW_EXECUTE = '''        async function executeAiCommand(prompt, attachments) {
            const isDev = elements['mode-toggle'] ? elements['mode-toggle'].checked : true;
            
            let elementCtx = '';
            if (selectedElement) {
                elementCtx = '\\nUser selected this element in preview:\\n' + selectedElement.outerHTML + '\\n';
            }

            const fileList = Object.keys(fileSystem[activeProject] || {}).join(', ');
            const lineCount = currentCode.split('\\n').length;

            // Build messages
            let sys;
            if (isDev) {
                sys = `You are skAIxu Flow, an expert web developer. Edit the user\\u2019s HTML file.
Project: ${activeProject} | File: ${activeFilePath} | Files: ${fileList}
${elementCtx}
INSTRUCTIONS:
- Return ONLY the complete updated HTML file.
- Do NOT wrap it in markdown fences or add any explanation.
- Start your response with <!DOCTYPE html> and end with </html>.
- Keep ALL existing functionality. Only change what the user asked for.

CURRENT FILE (${lineCount} lines):
${currentCode}`;
            } else {
                sys = `You are skAIxu Flow, a coding advisor.
Project: ${activeProject} | File: ${activeFilePath}
${elementCtx}
Current code (${lineCount} lines, showing first 6000 chars):
${currentCode.substring(0, 6000)}
Be concise and specific. Reference code directly.`;
            }

            const msgs = [{ role: 'system', content: sys }, { role: 'user', content: prompt }];

            // === DEV MODE ===
            if (isDev) {
                const bubble = addChatMessage('assistant',
                    '<div class="flex items-center gap-3"><div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span class="text-indigo-400 font-bold uppercase tracking-widest text-[10px]">Editing\\u2026</span></div>');
                if (!bubble) return;

                try {
                    broadcastLog(`DEV edit (${lineCount} lines): ${prompt.substring(0, 80)}`, 'info');
                    
                    const raw = await streamFromGateway(msgs, { maxTokens: 65536, temperature: 0.2 });
                    broadcastLog(`Response: ${raw.length} chars`, 'info');

                    // Extract code: no fences expected, but handle them gracefully
                    let code = raw;

                    // Strip markdown fences if AI wrapped anyway
                    const fenced = raw.match(/```(?:html)?\\s*\\n([\\s\\S]*?)\\n```/);
                    if (fenced) code = fenced[1];

                    // Find HTML start
                    const htmlStart = code.indexOf('<!DOCTYPE');
                    if (htmlStart === -1) {
                        const altStart = code.indexOf('<html');
                        if (altStart !== -1) code = code.substring(altStart);
                    } else {
                        code = code.substring(htmlStart);
                    }

                    // Find HTML end
                    const htmlEnd = code.lastIndexOf('</html>');
                    if (htmlEnd !== -1) code = code.substring(0, htmlEnd + 7);

                    code = code.trim();

                    if (code.length > 50 && code !== currentCode) {
                        currentCode = code;
                        if (elements['code-editor']) elements['code-editor'].value = currentCode;
                        await setFsEntry(activeProject, activeFilePath, { type: 'file', content: currentCode });
                        pushHistory(currentCode);
                        updatePreview();

                        bubble.innerHTML = `<div class="flex items-center gap-2 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 p-3 rounded-lg"><i data-lucide="check-circle" size="16"></i><span class="font-bold tracking-widest text-[10px] uppercase">Edit Applied</span><span class="text-[9px] text-slate-500 ml-2">${code.length} chars</span></div>`;
                        broadcastLog('Edit applied successfully', 'success');
                        lucide.createIcons();
                    } else if (raw.length > 0) {
                        // Show response as text
                        const safe = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
                        const preview = safe.length > 800 ? safe.substring(0, 800) + '\\u2026' : safe;
                        const btnId = 'apply_' + Date.now();
                        window['_pendingApply_' + btnId] = raw;
                        bubble.innerHTML = `<div class="p-4 rounded-xl border border-slate-700 bg-slate-800/50"><div class="text-[9px] text-amber-400 font-bold uppercase mb-2">AI responded (${raw.length} chars) but no HTML detected</div><div class="text-[11px] leading-relaxed text-slate-300 max-h-40 overflow-auto custom-scrollbar">${preview}</div><button id="${btnId}" onclick="window._applyRawResponse(\\u2019${btnId}\\u2019)" class="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest">Force Apply</button></div>`;
                        broadcastLog('No HTML found in response', 'warn');
                    } else {
                        bubble.innerHTML = '<div class="text-amber-400 text-xs font-bold">Empty response from AI</div>';
                        broadcastLog('Empty AI response', 'warn');
                    }
                } catch (err) {
                    console.error('DEV edit failed:', err);
                    bubble.innerHTML = `<div class="text-red-400 font-bold border border-red-500/30 bg-red-500/10 p-4 rounded-xl"><div class="mb-1 text-xs">${err.message}</div></div>`;
                    broadcastLog('DEV error: ' + err.message, 'error');
                }
                return;
            }

            // === CONSULT MODE ===
            const bubble = addChatMessage('assistant', 'Thinking\\u2026');
            if (!bubble) return;
            try {
                const raw = await streamFromGateway(msgs, { maxTokens: 8192, temperature: 0.7 });
                const safe = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
                bubble.innerHTML = `<div class="text-[12px] leading-relaxed text-slate-300">${safe}</div>`;
            } catch (err) {
                bubble.innerHTML = `<div class="text-red-400 text-xs font-bold">${err.message}</div>`;
            }
        }

'''

# ============================================================
# Apply the replacements
# ============================================================

# Replace blocks 1+2+3 (contiguous: kaixuChat -> kaixuStreamChat -> applySearchReplace)
# They go from kc_start to asr_end (which is where handleSend starts)
old_section = content[kc_start:asr_end]
content = content[:kc_start] + NEW_GATEWAY + content[asr_end:]

# Now find executeAiCommand again (indices shifted)
exec_start2 = content.find('        async function executeAiCommand(prompt, attachments) {')
exec_end2 = content.find('\n        // --- GLOBAL EXPORTS FOR HTML HANDLERS ---')
if exec_start2 == -1 or exec_end2 == -1:
    print("ERROR: Could not find executeAiCommand after first replacement")
    sys.exit(1)

old_exec = content[exec_start2:exec_end2]
content = content[:exec_start2] + NEW_EXECUTE + content[exec_end2:]

with open('skAIxuide/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

new_lines = content.count('\n') + 1
print(f"SUCCESS: Removed {len(old_section)} + {len(old_exec)} chars of old code")
print(f"Added {len(NEW_GATEWAY)} + {len(NEW_EXECUTE)} chars of new code")
print(f"Final file: {len(content)} chars, {new_lines} lines")
