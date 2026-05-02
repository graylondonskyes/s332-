// server.js
// Artificial Sole API · Executive AI Clones & Invisible AI Agency

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();

// ---- Basic middleware ----
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

// ---- In-memory persona store (for demo) ----
const personas = {};

function buildSystemPrompt(persona) {
  if (!persona) {
    return `
You are an AI assistant for Artificial Sole, an AI persona & autonomous team lab.
Be helpful, honest, and concise. If asked about a specific executive or clone,
respond generally and say that this is a demo persona, not the real human.
    `.trim();
  }

  return `
You are an AI persona for Artificial Sole representing the following executive profile:

Name: ${persona.displayName || 'Executive Clone'}
Role: ${persona.role || 'Leadership'}
Industry: ${persona.industry || 'General'}

Communication style:
- ${persona.communicationStyle || 'Direct, clear, professional.'}
- Avoid slang and jokes unless explicitly asked.
- Always provide a short executive summary, followed by 3–5 actionable steps.

Behavior & guardrails:
- Never claim to be the real human. You are a synthetic AI clone.
- Stay away from legal, clinical, or highly regulated advice.
- If unsure or missing data, ask clarifying questions.
- If asked for confidential decisions or HR matters, recommend a human leader review.

Your primary goals:
- Save leadership time by drafting, structuring, and clarifying.
- Help teams think, not just receive text.
- Stay aligned with the values provided by the client.
  `.trim();
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Artificial Sole API',
    timestamp: new Date().toISOString()
  });
});

// Onboard / create a persona
app.post('/api/v1/clone/onboard', (req, res) => {
  const {
    displayName,
    role,
    industry,
    communicationStyle,
    principles,
    strengths,
    boundaries
  } = req.body || {};

  if (!displayName || !role) {
    return res.status(400).json({
      error: 'displayName and role are required'
    });
  }

  const id = uuidv4();
  personas[id] = {
    id,
    displayName,
    role,
    industry: industry || null,
    communicationStyle: communicationStyle || null,
    principles: principles || null,
    strengths: strengths || null,
    boundaries: boundaries || null,
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({
    message: 'Persona registered with Artificial Sole',
    personaId: id,
    persona: personas[id]
  });
});

// Chat with a persona
app.post('/api/v1/clone/chat', async (req, res) => {
  const { personaId, message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const persona = personaId ? personas[personaId] : null;
  const systemPrompt = buildSystemPrompt(persona);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 700,
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer =
      response?.data?.choices?.[0]?.message?.content ||
      'No response generated from the LLM.';

    return res.json({
      personaId: personaId || null,
      personaUsed: persona ? persona.displayName : 'Artificial Sole – demo persona',
      reply: answer,
      model: response?.data?.model || 'unknown'
    });
  } catch (err) {
    console.error('Error calling LLM:', err?.response?.data || err.message || err);
    return res.status(500).json({
      error: 'LLM call failed',
      details: err?.response?.data || null
    });
  }
});

// List personas (debug/demo)
app.get('/api/v1/clone/personas', (req, res) => {
  const list = Object.values(personas);
  res.json({ count: list.length, personas: list });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    service: 'Artificial Sole API'
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Artificial Sole API listening on port ${PORT}`);
});
