import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import sanitizeHtml from 'sanitize-html';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import EPub from 'epub2';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.SKYE_READER_DATA_DIR || path.join(__dirname, 'data'));
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const VOICE_SAMPLE_DIR = path.join(DATA_DIR, 'voice-samples');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);
const OCR_MODEL = process.env.OCR_MODEL || 'gpt-4.1-mini';
const WEB_EXTRACT_TIMEOUT_MS = Number(process.env.WEB_EXTRACT_TIMEOUT_MS || 20000);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const BUILT_IN_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar'
];

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024
  }
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function ensureBootstrap() {
  await Promise.all([
    ensureDir(DATA_DIR),
    ensureDir(AUDIO_DIR),
    ensureDir(UPLOAD_DIR),
    ensureDir(VOICE_SAMPLE_DIR)
  ]);

  try {
    await fsp.access(STORE_PATH, fs.constants.F_OK);
  } catch {
    const starter = {
      documents: [],
      audio: [],
      pronunciations: [],
      customVoices: [],
      settings: {
        defaultModel: 'gpt-4o-mini-tts',
        defaultVoice: 'marin',
        defaultFormat: 'mp3',
        defaultSpeed: 1
      }
    };
    await fsp.writeFile(STORE_PATH, JSON.stringify(starter, null, 2), 'utf8');
  }
}

async function readStore() {
  const raw = await fsp.readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(data) {
  await fsp.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function ok(res, payload = {}, status = 200) {
  res.status(status).json({ ok: true, ...payload });
}

function fail(res, message, status = 400, detail = undefined) {
  res.status(status).json({ ok: false, error: message, detail });
}

function safeFileName(input) {
  return String(input || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'file';
}

function stripHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {}
  }).replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToText(html) {
  return stripHtml(
    sanitizeHtml(html, {
      allowedTags: ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'blockquote'],
      allowedAttributes: {}
    })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
  );
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokenizeSearch(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreDocumentMatch(doc, terms = []) {
  const haystack = `${doc.title || ''}
${doc.text || ''}`.toLowerCase();
  let score = 0;
  const matches = [];
  for (const term of terms) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const count = (haystack.match(regex) || []).length;
    if (count > 0) {
      const weighted = count * ((doc.title || '').toLowerCase().includes(term) ? 6 : 2);
      score += weighted;
      matches.push({ term, count, weighted });
    }
  }
  return {
    score,
    matches,
    excerpt: normalizeText(doc.text || '').replace(/\s+/g, ' ').trim().slice(0, 220)
  };
}

function computeLibrarySummary(documents = []) {
  const totalCharacters = documents.reduce((acc, item) => acc + String(item.text || '').length, 0);
  const sourceBreakdown = {};
  for (const item of documents) {
    const key = item.sourceType || 'unknown';
    sourceBreakdown[key] = (sourceBreakdown[key] || 0) + 1;
  }
  const topTerms = new Map();
  for (const item of documents) {
    for (const token of tokenizeSearch(item.text || '')) {
      if (token.length < 4) continue;
      topTerms.set(token, (topTerms.get(token) || 0) + 1);
    }
  }
  const keywords = [...topTerms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));
  return {
    documentCount: documents.length,
    totalCharacters,
    sourceBreakdown,
    keywords
  };
}


function inferSourceLabel(urlString) {
  try {
    const u = new URL(urlString);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

function splitIntoSpeechChunks(text, maxLen = 3500) {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) continue;

    if ((current + '\n\n' + block).trim().length <= maxLen) {
      current = current ? `${current}\n\n${block}` : block;
      continue;
    }

    if (current) flush();

    if (block.length <= maxLen) {
      current = block;
      continue;
    }

    const sentences = block.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [block];
    let sentenceBucket = '';
    for (const sentence of sentences) {
      const candidate = `${sentenceBucket} ${sentence}`.trim();
      if (candidate.length <= maxLen) {
        sentenceBucket = candidate;
      } else {
        if (sentenceBucket) chunks.push(sentenceBucket);
        if (sentence.length <= maxLen) {
          sentenceBucket = sentence.trim();
        } else {
          let start = 0;
          while (start < sentence.length) {
            chunks.push(sentence.slice(start, start + maxLen).trim());
            start += maxLen;
          }
          sentenceBucket = '';
        }
      }
    }
    if (sentenceBucket) chunks.push(sentenceBucket.trim());
  }

  if (current) flush();
  return chunks.filter(Boolean);
}

function parseVoiceValue(voice) {
  if (!voice) return 'marin';
  if (typeof voice === 'string' && voice.startsWith('voice_')) {
    return { id: voice };
  }
  if (typeof voice === 'object' && voice.id) return { id: voice.id };
  return voice;
}

function applyPronunciations(text, pronunciationRules = []) {
  let updated = text;
  for (const rule of pronunciationRules) {
    if (!rule?.find) continue;
    const escaped = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    updated = updated.replace(regex, rule.replace || rule.find);
  }
  return updated;
}

async function saveAudioMetadata(entry) {
  const store = await readStore();
  store.audio.unshift(entry);
  await writeStore(store);
  return entry;
}

async function saveDocumentMetadata(entry) {
  const store = await readStore();
  const existingIndex = store.documents.findIndex((doc) => doc.id === entry.id);
  if (existingIndex >= 0) {
    store.documents[existingIndex] = entry;
  } else {
    store.documents.unshift(entry);
  }
  await writeStore(store);
  return entry;
}

async function getPronunciations() {
  const store = await readStore();
  return store.pronunciations || [];
}

async function saveUploadedFilePermanent(tempPath, targetName) {
  const finalPath = path.join(UPLOAD_DIR, targetName);
  await fsp.rename(tempPath, finalPath);
  return finalPath;
}

async function extractUrlText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_EXTRACT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkyeReader/1.0 (+reader extraction)'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent?.trim()) {
      return {
        title: article.title?.trim() || url,
        text: normalizeText(article.textContent),
        sourceLabel: inferSourceLabel(url)
      };
    }

    return {
      title: dom.window.document.title || url,
      text: normalizeText(htmlToText(html)),
      sourceLabel: inferSourceLabel(url)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractEpubText(filePath) {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);
    const chapters = [];

    epub.on('error', reject);
    epub.on('end', async () => {
      try {
        const flow = epub.flow || [];
        for (const item of flow) {
          const chapterText = await new Promise((res, rej) => {
            epub.getChapter(item.id, (err, text) => {
              if (err) return rej(err);
              return res(text || '');
            });
          });
          chapters.push(htmlToText(chapterText));
        }

        resolve({
          title: epub.metadata?.title || path.basename(filePath),
          text: normalizeText(chapters.join('\n\n'))
        });
      } catch (error) {
        reject(error);
      }
    });

    epub.parse();
  });
}

async function ocrImageBuffer(buffer, mimeType = 'image/png') {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is required for OCR.');
  }

  const base64 = buffer.toString('base64');
  const imageUrl = `data:${mimeType};base64,${base64}`;

  const response = await openai.chat.completions.create({
    model: OCR_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You extract text exactly as written. Preserve headings, paragraphs, and reading order. Return plain text only.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract every readable word from this image. Output plain text only.' },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
        ]
      }
    ]
  });

  return normalizeText(response.choices?.[0]?.message?.content || '');
}

async function ocrPdfOrBinaryFile(buffer, filename, mimeType) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is required for scan-to-text on this file type.');
  }

  const base64 = buffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: OCR_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You extract text from uploaded documents. Preserve natural reading order. Return plain text only.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the readable text from this file. Return plain text only.' },
          {
            type: 'file',
            file: {
              filename,
              file_data: `data:${mimeType};base64,${base64}`
            }
          }
        ]
      }
    ]
  });

  return normalizeText(response.choices?.[0]?.message?.content || '');
}

async function extractFileText(file, options = {}) {
  const ext = path.extname(file.originalname || file.filename).toLowerCase();
  const mimeType = file.mimetype || mime.lookup(ext) || 'application/octet-stream';
  const buffer = await fsp.readFile(file.path);
  const wantsOcr = Boolean(options.forceOcr);

  if (mimeType.startsWith('text/') || ['.md', '.rtf', '.csv', '.json', '.xml'].includes(ext)) {
    return {
      title: file.originalname,
      text: normalizeText(buffer.toString('utf8')),
      sourceType: 'upload',
      detectedType: mimeType
    };
  }

  if (['.html', '.htm'].includes(ext)) {
    return {
      title: file.originalname,
      text: normalizeText(htmlToText(buffer.toString('utf8'))),
      sourceType: 'upload',
      detectedType: mimeType
    };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: file.path });
    return {
      title: file.originalname,
      text: normalizeText(result.value),
      sourceType: 'upload',
      detectedType: mimeType
    };
  }

  if (ext === '.epub') {
    const result = await extractEpubText(file.path);
    return {
      title: result.title || file.originalname,
      text: result.text,
      sourceType: 'upload',
      detectedType: mimeType
    };
  }

  if (ext === '.pdf') {
    const pdfResult = await pdfParse(buffer);
    let text = normalizeText(pdfResult.text);

    if ((wantsOcr || text.length < 80) && openai) {
      try {
        const ocrText = await ocrPdfOrBinaryFile(buffer, file.originalname, mimeType);
        if (ocrText.length > text.length) text = ocrText;
      } catch {
        // keep parsed text if OCR fails
      }
    }

    return {
      title: file.originalname,
      text,
      sourceType: 'upload',
      detectedType: mimeType,
      note:
        text.length < 40
          ? 'This PDF appears to have little extractable text. Use scan-to-text with OCR enabled for better results when your API key is configured.'
          : undefined
    };
  }

  if (mimeType.startsWith('image/')) {
    const text = await ocrImageBuffer(buffer, mimeType);
    return {
      title: file.originalname,
      text,
      sourceType: 'upload',
      detectedType: mimeType
    };
  }

  throw new Error(`Unsupported file type: ${ext || mimeType}`);
}

async function generateSpeechMp3({ text, voice, model, instructions, speed, responseFormat }) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is required for speech generation.');
  }

  const chunks = splitIntoSpeechChunks(text);
  if (!chunks.length) {
    throw new Error('No text available for speech generation.');
  }

  const buffers = [];
  for (const chunk of chunks) {
    const speechResponse = await openai.audio.speech.create({
      model,
      input: chunk,
      voice: parseVoiceValue(voice),
      instructions: instructions || undefined,
      speed,
      response_format: responseFormat
    });

    const arr = await speechResponse.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }

  return Buffer.concat(buffers);
}

app.get('/api/health', async (req, res) => {
  ok(res, {
    service: 'skye-reader-hardened',
    time: nowIso(),
    openaiConfigured: Boolean(openai),
    audioDir: AUDIO_DIR,
    uploadDir: UPLOAD_DIR,
    voiceCloneAvailable: Boolean(openai)
  });
});

app.get('/api/config', async (req, res) => {
  const store = await readStore();
  ok(res, {
    openaiConfigured: Boolean(openai),
    builtInVoices: BUILT_IN_VOICES,
    customVoices: store.customVoices || [],
    defaults: store.settings || {}
  });
});

app.get('/api/library', async (req, res) => {
  const store = await readStore();
  ok(res, { documents: store.documents || [] });
});


app.get('/api/library/search', async (req, res) => {
  const query = String(req.query?.q || '').trim();
  const limit = Math.max(1, Math.min(25, Number(req.query?.limit || 8)));
  const store = await readStore();
  const documents = store.documents || [];
  if (!query) {
    return ok(res, { query, results: [], summary: computeLibrarySummary(documents) });
  }
  const terms = [...new Set(tokenizeSearch(query))];
  const results = documents
    .map((doc) => ({ document: doc, match: scoreDocumentMatch(doc, terms) }))
    .filter((entry) => entry.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score || String(b.document.updatedAt || '').localeCompare(String(a.document.updatedAt || '')))
    .slice(0, limit)
    .map((entry) => ({
      id: entry.document.id,
      title: entry.document.title,
      sourceType: entry.document.sourceType,
      sourceLabel: entry.document.sourceLabel,
      updatedAt: entry.document.updatedAt,
      score: entry.match.score,
      matches: entry.match.matches,
      excerpt: entry.match.excerpt
    }));
  ok(res, { query, terms, results, summary: computeLibrarySummary(documents) });
});

app.get('/api/library/summary', async (req, res) => {
  const store = await readStore();
  ok(res, { summary: computeLibrarySummary(store.documents || []) });
});

app.post('/api/library', async (req, res) => {
  const { title, text, sourceType = 'manual', sourceLabel = 'manual', metadata = {} } = req.body || {};
  const cleaned = normalizeText(text);

  if (!title || !cleaned) {
    return fail(res, 'Title and text are required.');
  }

  const doc = {
    id: uuidv4(),
    title: String(title).trim(),
    text: cleaned,
    sourceType,
    sourceLabel,
    metadata,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await saveDocumentMetadata(doc);
  ok(res, { document: doc }, 201);
});

app.put('/api/library/:id', async (req, res) => {
  const { id } = req.params;
  const store = await readStore();
  const doc = store.documents.find((item) => item.id === id);
  if (!doc) return fail(res, 'Document not found.', 404);

  const nextTitle = req.body?.title ? String(req.body.title).trim() : doc.title;
  const nextText = req.body?.text ? normalizeText(req.body.text) : doc.text;

  doc.title = nextTitle;
  doc.text = nextText;
  doc.updatedAt = nowIso();

  await writeStore(store);
  ok(res, { document: doc });
});

app.delete('/api/library/:id', async (req, res) => {
  const store = await readStore();
  const next = store.documents.filter((item) => item.id !== req.params.id);
  if (next.length === store.documents.length) {
    return fail(res, 'Document not found.', 404);
  }
  store.documents = next;
  await writeStore(store);
  ok(res, { id: req.params.id });
});

app.get('/api/audio', async (req, res) => {
  const store = await readStore();
  ok(res, { audio: store.audio || [] });
});

app.delete('/api/audio/:id', async (req, res) => {
  const store = await readStore();
  const audioItem = store.audio.find((item) => item.id === req.params.id);
  if (!audioItem) return fail(res, 'Audio entry not found.', 404);

  store.audio = store.audio.filter((item) => item.id !== req.params.id);
  await writeStore(store);

  if (audioItem.filePath) {
    const fullPath = path.join(__dirname, audioItem.filePath);
    await fsp.rm(fullPath, { force: true });
  }

  ok(res, { id: req.params.id });
});

app.get('/api/pronunciations', async (req, res) => {
  const rules = await getPronunciations();
  ok(res, { pronunciations: rules });
});

app.post('/api/pronunciations', async (req, res) => {
  const { find, replace } = req.body || {};
  if (!find || typeof find !== 'string') {
    return fail(res, 'A source phrase is required.');
  }

  const store = await readStore();
  const entry = {
    id: uuidv4(),
    find: find.trim(),
    replace: String(replace || '').trim(),
    createdAt: nowIso()
  };
  store.pronunciations.unshift(entry);
  await writeStore(store);
  ok(res, { pronunciation: entry }, 201);
});

app.delete('/api/pronunciations/:id', async (req, res) => {
  const store = await readStore();
  const next = store.pronunciations.filter((item) => item.id !== req.params.id);
  if (next.length === store.pronunciations.length) {
    return fail(res, 'Pronunciation rule not found.', 404);
  }
  store.pronunciations = next;
  await writeStore(store);
  ok(res, { id: req.params.id });
});

app.post('/api/import/url', async (req, res) => {
  try {
    const { url, saveToLibrary = true } = req.body || {};
    if (!url) return fail(res, 'A URL is required.');

    const result = await extractUrlText(String(url).trim());
    const document = {
      id: uuidv4(),
      title: result.title,
      text: result.text,
      sourceType: 'url',
      sourceLabel: result.sourceLabel,
      metadata: { url: String(url).trim() },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    if (saveToLibrary) {
      await saveDocumentMetadata(document);
    }

    ok(res, { document });
  } catch (error) {
    fail(res, 'Failed to extract webpage text.', 500, error.message);
  }
});

app.post('/api/import/file', upload.single('file'), async (req, res) => {
  const tempFile = req.file;
  try {
    if (!tempFile) return fail(res, 'No file uploaded.');
    const forceOcr = req.body?.forceOcr === 'true' || req.body?.forceOcr === true;
    const saveToLibrary = req.body?.saveToLibrary !== 'false';
    const parsed = await extractFileText(tempFile, { forceOcr });

    const targetName = `${Date.now()}-${safeFileName(tempFile.originalname)}`;
    const finalPath = await saveUploadedFilePermanent(tempFile.path, targetName);

    const document = {
      id: uuidv4(),
      title: parsed.title || tempFile.originalname,
      text: parsed.text,
      sourceType: parsed.sourceType || 'upload',
      sourceLabel: tempFile.originalname,
      metadata: {
        originalName: tempFile.originalname,
        mimeType: parsed.detectedType,
        savedFile: path.relative(__dirname, finalPath),
        note: parsed.note || null
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    if (saveToLibrary) {
      await saveDocumentMetadata(document);
    }

    ok(res, { document });
  } catch (error) {
    if (tempFile) {
      await fsp.rm(tempFile.path, { force: true }).catch(() => {});
    }
    fail(res, 'File import failed.', 500, error.message);
  }
});

app.post('/api/tts/speak', async (req, res) => {
  try {
    const {
      title,
      text,
      voice = 'marin',
      model = 'gpt-4o-mini-tts',
      instructions = '',
      speed = 1,
      responseFormat = 'mp3',
      saveAudio = true,
      documentId = null
    } = req.body || {};

    const cleaned = normalizeText(text);
    if (!cleaned) return fail(res, 'Text is required.');
    if (!['mp3', 'wav', 'aac', 'flac', 'opus', 'pcm'].includes(responseFormat)) {
      return fail(res, 'Unsupported response format.');
    }

    const pronunciations = await getPronunciations();
    const transformedText = applyPronunciations(cleaned, pronunciations);
    const buffer = await generateSpeechMp3({
      text: transformedText,
      voice,
      model,
      instructions,
      speed: Number(speed || 1),
      responseFormat
    });

    const id = uuidv4();
    const safeTitle = safeFileName(title || 'speech');
    const relativePath = path.join('data', 'audio', `${Date.now()}-${safeTitle}.${responseFormat}`);
    const absolutePath = path.join(__dirname, relativePath);
    await fsp.writeFile(absolutePath, buffer);

    const entry = {
      id,
      title: String(title || 'Speech Export').trim(),
      filePath: relativePath,
      downloadUrl: `/${relativePath.replace(/\\/g, '/')}`,
      voice,
      model,
      speed: Number(speed || 1),
      responseFormat,
      charCount: transformedText.length,
      documentId,
      createdAt: nowIso()
    };

    if (saveAudio) {
      await saveAudioMetadata(entry);
    }

    ok(res, { audio: entry });
  } catch (error) {
    fail(res, 'Speech generation failed.', 500, error.message);
  }
});

app.post('/api/tts/preview', async (req, res) => {
  try {
    const {
      text,
      voice = 'marin',
      model = 'gpt-4o-mini-tts',
      instructions = '',
      speed = 1,
      responseFormat = 'mp3'
    } = req.body || {};

    const cleaned = normalizeText(text).slice(0, 600);
    if (!cleaned) return fail(res, 'Preview text is required.');

    const pronunciations = await getPronunciations();
    const transformedText = applyPronunciations(cleaned, pronunciations);
    const buffer = await generateSpeechMp3({
      text: transformedText,
      voice,
      model,
      instructions,
      speed: Number(speed || 1),
      responseFormat
    });

    res.setHeader('Content-Type', mime.lookup(responseFormat) || 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    fail(res, 'Preview generation failed.', 500, error.message);
  }
});

app.get('/data/audio/:fileName', async (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const fullPath = path.join(AUDIO_DIR, fileName);
  try {
    await fsp.access(fullPath, fs.constants.R_OK);
    res.sendFile(fullPath);
  } catch {
    fail(res, 'Audio file not found.', 404);
  }
});

app.post('/api/voices/consent', upload.single('recording'), async (req, res) => {
  try {
    if (!openai) return fail(res, 'OPENAI_API_KEY is required for voice consent.', 500);
    if (!req.file) return fail(res, 'Consent recording is required.');

    const response = await openai.audio.voiceConsents.create({
      name: String(req.body?.name || 'Voice Consent').trim(),
      language: String(req.body?.language || 'en-US').trim(),
      recording: fs.createReadStream(req.file.path)
    });

    await fsp.rm(req.file.path, { force: true }).catch(() => {});
    ok(res, { consent: response }, 201);
  } catch (error) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    fail(res, 'Voice consent upload failed.', 500, error.message);
  }
});

app.get('/api/voices/consents', async (req, res) => {
  try {
    if (!openai) return fail(res, 'OPENAI_API_KEY is required for voice consents.', 500);
    const data = await openai.audio.voiceConsents.list({ limit: 20 });
    ok(res, { consents: data.data || data.items || data });
  } catch (error) {
    fail(res, 'Could not load voice consents.', 500, error.message);
  }
});

app.post('/api/voices/create', upload.single('audioSample'), async (req, res) => {
  try {
    if (!openai) return fail(res, 'OPENAI_API_KEY is required for voice cloning.', 500);
    if (!req.file) return fail(res, 'A voice sample is required.');
    if (!req.body?.consent) return fail(res, 'A consent ID is required.');

    const created = await openai.audio.voices.create({
      name: String(req.body?.name || 'Custom Voice').trim(),
      consent: String(req.body.consent).trim(),
      audio_sample: fs.createReadStream(req.file.path)
    });

    const voiceRecord = {
      id: created.id,
      name: created.name,
      createdAt: nowIso()
    };

    const store = await readStore();
    store.customVoices = [voiceRecord, ...(store.customVoices || []).filter((v) => v.id !== voiceRecord.id)];
    await writeStore(store);

    await fsp.rm(req.file.path, { force: true }).catch(() => {});
    ok(res, { voice: voiceRecord }, 201);
  } catch (error) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    fail(res, 'Custom voice creation failed.', 500, error.message);
  }
});

app.delete('/api/voices/custom/:id', async (req, res) => {
  const store = await readStore();
  const before = store.customVoices?.length || 0;
  store.customVoices = (store.customVoices || []).filter((item) => item.id !== req.params.id);
  if ((store.customVoices?.length || 0) === before) {
    return fail(res, 'Custom voice not found.', 404);
  }
  await writeStore(store);
  ok(res, { id: req.params.id });
});

app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return fail(res, `Upload exceeds ${MAX_UPLOAD_MB} MB limit.`, 413);
  }
  return fail(res, 'Unexpected server error.', 500, err?.message || 'Unknown error');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureBootstrap()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Skye Reader Hardened running on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to bootstrap app:', error);
    process.exit(1);
  });
