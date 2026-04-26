function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function getHeader(event, name) {
  const h = event.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.toUpperCase()] || '';
}

function getRequiredEnv(name, fallback) {
  const value = process.env[name] || (fallback ? process.env[fallback] : '');
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ''}`);
  return value;
}

function safeJsonParse(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function sanitizeText(value, limit = 12000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, limit);
}

function promptForMode(payload) {
  const transcript = sanitizeText(payload.transcript, 24000);
  const userPrompt = sanitizeText(payload.userPrompt, 8000);
  const extraNotes = sanitizeText(payload.extraNotes, 8000);
  const arrangement = JSON.stringify(payload.arrangement || [], null, 2).slice(0, 12000);
  const clipFacts = JSON.stringify(payload.clipFacts || {}, null, 2).slice(0, 4000);
  const beatPrefs = JSON.stringify(payload.beatPrefs || {}, null, 2).slice(0, 4000);

  switch (payload.mode) {
    case 'music_coach':
      return `You are an elite vocal producer and songwriting coach. Analyze the lyrics/transcript and session context below. Return: 1) quick diagnosis, 2) what is strongest, 3) what to tighten, 4) performance ideas for rap/singing delivery, 5) ad-lib ideas, 6) next punch-in plan. Keep it specific and practical.\n\nLyrics/Transcript:\n${transcript}\n\nDesired vibe:\n${userPrompt}\n\nSession notes:\n${extraNotes}\n\nClip facts:\n${clipFacts}\n\nArrangement:\n${arrangement}`;
    case 'hook_punchup':
      return `You are helping write a stronger song section. Based on the text below, deliver: 1) sharper version, 2) alternate hook, 3) 8 replacement punchlines/bars, 4) melody / cadence suggestions in plain language. Keep the artist's meaning but make it hit harder.\n\nLyrics/Transcript:\n${transcript}\n\nDesired vibe:\n${userPrompt}\n\nExtra notes:\n${extraNotes}`;
    case 'mix_notes':
      return `You are a mix engineer and arrangement editor. Review the arrangement summary, lyrics, and notes. Return concise notes under these headings: Balance, Vocal Chain, Beat Space, Arrangement Fixes, Automation Ideas, Fastest Wins.\n\nLyrics/Transcript:\n${transcript}\n\nDesired vibe:\n${userPrompt}\n\nExtra notes:\n${extraNotes}\n\nArrangement:\n${arrangement}`;
    case 'beat_blueprint':
      return `Create a music production beat blueprint in raw JSON only. Do not wrap in markdown. Match this shape exactly: {"title":"string","bpm":96,"bars":4,"swing":0.06,"genre":"string","key":"string","energy":"string","kick":[0/1...16*bars entries],"snare":[0/1...],"hat":[0/1...],"openHat":[0/1...],"bass":[{"step":0,"length":4,"note":"A2"}],"lead":[{"step":0,"length":2,"note":"C4"}],"notes":"string"}. Use musical, usable patterns. Keep arrays to exactly 16*bars steps.\n\nLyrics/Transcript:\n${transcript}\n\nDesired vibe:\n${userPrompt}\n\nExtra notes:\n${extraNotes}\n\nClip facts:\n${clipFacts}\n\nBeat preferences:\n${beatPrefs}`;
    default:
      return transcript || userPrompt || 'Return a concise helpful response.';
  }
}

async function fetchOpenAIJson(path, apiKey, body) {
  const response = await fetch(`https://api.openai.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function handleText(payload) {
  const apiKey = getRequiredEnv('OPENAI_TEXT_KEY', 'OPENAI_API_KEY');
  const model = sanitizeText(payload.model || process.env.OPENAI_TEXT_MODEL || 'gpt-5.4-mini', 120);
  const input = promptForMode(payload);

  const data = await fetchOpenAIJson('/v1/responses', apiKey, {
    model,
    input,
    store: false,
  });

  return { text: data.output_text || 'No response returned.' };
}

async function handleSpeak(payload) {
  const apiKey = getRequiredEnv('OPENAI_AUDIO_KEY', 'OPENAI_API_KEY');
  const input = sanitizeText(payload.text, 3200);
  const voice = sanitizeText(payload.voice || process.env.OPENAI_TTS_VOICE || 'alloy', 40);
  if (!input) throw new Error('Text is required for speech');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice,
      input,
      instructions: 'Speak clearly, musically, and with crisp confidence. Keep the delivery natural and controlled.',
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message || `OpenAI speech request failed (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { audioBase64: buffer.toString('base64'), mimeType: 'audio/mpeg' };
}

async function handleTranscribe(payload) {
  const apiKey = getRequiredEnv('OPENAI_AUDIO_KEY', 'OPENAI_API_KEY');
  const audioBase64 = String(payload.audioBase64 || '');
  const mimeType = sanitizeText(payload.mimeType || 'audio/webm', 80);
  const filename = sanitizeText(payload.filename || 'music-forge-audio.webm', 120);
  const model = sanitizeText(payload.model || process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe', 120);
  if (!audioBase64) throw new Error('Audio payload is required');

  const buffer = Buffer.from(audioBase64, 'base64');
  const form = new FormData();
  form.append('model', model);
  form.append('response_format', 'json');
  form.append('file', new Blob([buffer], { type: mimeType }), filename);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI transcription request failed (${response.status})`);
  }

  return { text: data?.text || '' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Access-Key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const requiredAccessKey = process.env.AUDIO_STUDIO_ACCESS_KEY || '';
    const providedAccessKey = String(getHeader(event, 'X-Studio-Access-Key') || '').trim();
    if (requiredAccessKey && providedAccessKey !== requiredAccessKey) {
      return json(401, { ok: false, error: 'Invalid studio access key' }, { 'Cache-Control': 'no-store' });
    }

    const payload = safeJsonParse(event.body);
    const action = sanitizeText(payload.action, 40);
    if (!action) throw new Error('Action is required');

    let result;
    if (action === 'text') result = await handleText(payload);
    else if (action === 'speak') result = await handleSpeak(payload);
    else if (action === 'transcribe') result = await handleTranscribe(payload);
    else throw new Error('Unsupported action');

    return json(200, { ok: true, ...result }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return json(500, { ok: false, error: error.message || 'Studio request failed' }, { 'Cache-Control': 'no-store' });
  }
};
