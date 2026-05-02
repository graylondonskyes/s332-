const els = {
  navButtons: [...document.querySelectorAll('.nav-btn')],
  panels: [...document.querySelectorAll('.panel')],
  healthBadge: document.getElementById('healthBadge'),
  healthText: document.getElementById('healthText'),
  docTitle: document.getElementById('docTitle'),
  readerText: document.getElementById('readerText'),
  urlInput: document.getElementById('urlInput'),
  fileInput: document.getElementById('fileInput'),
  forceOcrToggle: document.getElementById('forceOcrToggle'),
  importUrlBtn: document.getElementById('importUrlBtn'),
  newDocBtn: document.getElementById('newDocBtn'),
  saveDocBtn: document.getElementById('saveDocBtn'),
  previewBtn: document.getElementById('previewBtn'),
  speakBtn: document.getElementById('speakBtn'),
  modelSelect: document.getElementById('modelSelect'),
  voiceSelect: document.getElementById('voiceSelect'),
  speedInput: document.getElementById('speedInput'),
  speedValue: document.getElementById('speedValue'),
  formatSelect: document.getElementById('formatSelect'),
  instructionsInput: document.getElementById('instructionsInput'),
  audioPlayer: document.getElementById('audioPlayer'),
  nowPlayingText: document.getElementById('nowPlayingText'),
  downloadAudioLink: document.getElementById('downloadAudioLink'),
  stopAudioBtn: document.getElementById('stopAudioBtn'),
  sleepTimerSelect: document.getElementById('sleepTimerSelect'),
  libraryList: document.getElementById('libraryList'),
  audioList: document.getElementById('audioList'),
  pronunciationFind: document.getElementById('pronunciationFind'),
  pronunciationReplace: document.getElementById('pronunciationReplace'),
  savePronunciationBtn: document.getElementById('savePronunciationBtn'),
  pronunciationList: document.getElementById('pronunciationList'),
  uploadConsentBtn: document.getElementById('uploadConsentBtn'),
  consentName: document.getElementById('consentName'),
  consentLanguage: document.getElementById('consentLanguage'),
  consentFile: document.getElementById('consentFile'),
  consentResult: document.getElementById('consentResult'),
  customVoiceName: document.getElementById('customVoiceName'),
  consentIdInput: document.getElementById('consentIdInput'),
  customVoiceFile: document.getElementById('customVoiceFile'),
  createVoiceBtn: document.getElementById('createVoiceBtn'),
  voiceCreateResult: document.getElementById('voiceCreateResult'),
  refreshVoicesBtn: document.getElementById('refreshVoicesBtn'),
  customVoicesList: document.getElementById('customVoicesList'),
  toast: document.getElementById('toast')
};

const state = {
  config: null,
  library: [],
  audio: [],
  pronunciations: [],
  sleepTimerHandle: null,
  currentDocumentId: null
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.style.borderColor = isError ? 'rgba(255, 123, 135, 0.35)' : 'rgba(240, 201, 120, 0.28)';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add('hidden'), 3400);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = typeof payload === 'object' ? payload.error || 'Request failed.' : 'Request failed.';
    throw new Error(errorMessage);
  }

  return payload;
}

function setHealthBadge(okConfigured) {
  els.healthBadge.className = `pill ${okConfigured ? 'pill-ok' : 'pill-warn'}`;
  els.healthBadge.textContent = okConfigured ? 'Ready' : 'API Key Missing';
  els.healthText.textContent = okConfigured
    ? 'OpenAI speech, OCR, and voice lab are online.'
    : 'Import, library, and editing work. Speech, OCR, and voice lab need OPENAI_API_KEY.';
}

function switchPanel(panelId) {
  for (const btn of els.navButtons) {
    btn.classList.toggle('active', btn.dataset.panel === panelId);
  }
  for (const panel of els.panels) {
    panel.classList.toggle('active', panel.id === panelId);
  }
}

function setLoading(button, isLoading, loadingText = 'Working…') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
}

function currentReaderPayload() {
  return {
    title: els.docTitle.value.trim() || 'Untitled reading',
    text: els.readerText.value,
    documentId: state.currentDocumentId,
    model: els.modelSelect.value,
    voice: els.voiceSelect.value,
    speed: Number(els.speedInput.value),
    responseFormat: els.formatSelect.value,
    instructions: els.instructionsInput.value.trim()
  };
}

function updateSpeedLabel() {
  els.speedValue.textContent = `${Number(els.speedInput.value).toFixed(2)}x`;
}

function updateVoiceOptions() {
  const builtIns = state.config?.builtInVoices || [];
  const customs = state.config?.customVoices || [];
  const current = els.voiceSelect.value;

  els.voiceSelect.innerHTML = '';

  const builtInGroup = document.createElement('optgroup');
  builtInGroup.label = 'Built-in Voices';
  builtIns.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice;
    option.textContent = voice;
    builtInGroup.appendChild(option);
  });
  els.voiceSelect.appendChild(builtInGroup);

  if (customs.length) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom Voices';
    customs.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = `${voice.name} (${voice.id})`;
      customGroup.appendChild(option);
    });
    els.voiceSelect.appendChild(customGroup);
  }

  if (current) {
    els.voiceSelect.value = current;
  }

  if (!els.voiceSelect.value && builtIns.includes('marin')) {
    els.voiceSelect.value = 'marin';
  }
}

function renderLibrary() {
  if (!state.library.length) {
    els.libraryList.innerHTML = '<div class="note">No saved documents yet.</div>';
    return;
  }

  els.libraryList.innerHTML = state.library.map((item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="list-meta">
        <span>${escapeHtml(item.sourceType || 'manual')}</span>
        <span>${escapeHtml(item.sourceLabel || '')}</span>
        <span>${formatDate(item.updatedAt || item.createdAt)}</span>
        <span>${(item.text || '').length.toLocaleString()} chars</span>
      </div>
      ${item.metadata?.note ? `<div class="note">${escapeHtml(item.metadata.note)}</div>` : ''}
      <div class="list-actions">
        <button class="ghost-btn" data-load-doc="${item.id}">Load</button>
        <button class="ghost-btn" data-speak-doc="${item.id}">Load + Speak</button>
        <button class="ghost-btn" data-delete-doc="${item.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

function renderAudio() {
  if (!state.audio.length) {
    els.audioList.innerHTML = '<div class="note">No generated audio yet.</div>';
    return;
  }

  els.audioList.innerHTML = state.audio.map((item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="list-meta">
        <span>${escapeHtml(item.model)}</span>
        <span>${escapeHtml(String(item.voice))}</span>
        <span>${escapeHtml(item.responseFormat)}</span>
        <span>${item.charCount?.toLocaleString?.() || item.charCount} chars</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="list-actions">
        <button class="ghost-btn" data-play-audio="${item.id}">Play</button>
        <a class="ghost-btn as-link" href="${item.downloadUrl}" download>Download</a>
        <button class="ghost-btn" data-delete-audio="${item.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

function renderPronunciations() {
  if (!state.pronunciations.length) {
    els.pronunciationList.innerHTML = '<div class="note">No pronunciation rules yet.</div>';
    return;
  }

  els.pronunciationList.innerHTML = state.pronunciations.map((item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.find)}</h3>
      <div class="list-meta">
        <span>Speak as: ${escapeHtml(item.replace || item.find)}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="list-actions">
        <button class="ghost-btn" data-delete-pronunciation="${item.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

function renderCustomVoices() {
  const customs = state.config?.customVoices || [];
  if (!customs.length) {
    els.customVoicesList.innerHTML = '<div class="note">No custom voices saved yet.</div>';
    return;
  }

  els.customVoicesList.innerHTML = customs.map((item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="list-meta">
        <span>${escapeHtml(item.id)}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <div class="list-actions">
        <button class="ghost-btn" data-use-voice="${item.id}">Use This Voice</button>
        <button class="ghost-btn" data-delete-voice="${item.id}">Remove</button>
      </div>
    </article>
  `).join('');
}

function loadDocumentIntoReader(doc) {
  state.currentDocumentId = doc.id;
  els.docTitle.value = doc.title || 'Untitled reading';
  els.readerText.value = doc.text || '';
  switchPanel('readerPanel');
  showToast(`Loaded “${doc.title}”.`);
}

function attachEventDelegation() {
  els.libraryList.addEventListener('click', async (event) => {
    const loadId = event.target.dataset.loadDoc;
    const speakId = event.target.dataset.speakDoc;
    const deleteId = event.target.dataset.deleteDoc;

    if (loadId) {
      const doc = state.library.find((item) => item.id === loadId);
      if (doc) loadDocumentIntoReader(doc);
    }

    if (speakId) {
      const doc = state.library.find((item) => item.id === speakId);
      if (doc) {
        loadDocumentIntoReader(doc);
        await generateAudio();
      }
    }

    if (deleteId) {
      await api(`/api/library/${deleteId}`, { method: 'DELETE' });
      await refreshLibrary();
      showToast('Document deleted.');
    }
  });

  els.audioList.addEventListener('click', async (event) => {
    const playId = event.target.dataset.playAudio;
    const deleteId = event.target.dataset.deleteAudio;

    if (playId) {
      const audio = state.audio.find((item) => item.id === playId);
      if (audio) playAudio(audio);
    }

    if (deleteId) {
      await api(`/api/audio/${deleteId}`, { method: 'DELETE' });
      await refreshAudio();
      showToast('Audio deleted.');
    }
  });

  els.pronunciationList.addEventListener('click', async (event) => {
    const deleteId = event.target.dataset.deletePronunciation;
    if (!deleteId) return;
    await api(`/api/pronunciations/${deleteId}`, { method: 'DELETE' });
    await refreshPronunciations();
    showToast('Pronunciation rule removed.');
  });

  els.customVoicesList.addEventListener('click', async (event) => {
    const useVoiceId = event.target.dataset.useVoice;
    const deleteVoiceId = event.target.dataset.deleteVoice;

    if (useVoiceId) {
      els.voiceSelect.value = useVoiceId;
      switchPanel('readerPanel');
      showToast('Custom voice selected.');
    }

    if (deleteVoiceId) {
      await api(`/api/voices/custom/${deleteVoiceId}`, { method: 'DELETE' });
      await refreshConfig();
      showToast('Custom voice removed from local app list.');
    }
  });
}

function playAudio(audio) {
  els.audioPlayer.src = audio.downloadUrl;
  els.audioPlayer.play().catch(() => {});
  els.nowPlayingText.textContent = `${audio.title} · ${audio.voice} · ${audio.responseFormat}`;
  els.downloadAudioLink.href = audio.downloadUrl;
  els.downloadAudioLink.classList.remove('disabled-link');
  if (!els.downloadAudioLink.hasAttribute('download')) {
    els.downloadAudioLink.setAttribute('download', 'audio');
  }
  resetSleepTimer();
}

function resetSleepTimer() {
  if (state.sleepTimerHandle) {
    clearTimeout(state.sleepTimerHandle);
    state.sleepTimerHandle = null;
  }

  const minutes = Number(els.sleepTimerSelect.value || 0);
  if (minutes > 0) {
    state.sleepTimerHandle = setTimeout(() => {
      els.audioPlayer.pause();
      showToast(`Sleep timer stopped playback after ${minutes} minutes.`);
    }, minutes * 60 * 1000);
  }
}

async function refreshConfig() {
  state.config = await api('/api/config');
  setHealthBadge(state.config.openaiConfigured);
  updateVoiceOptions();
  renderCustomVoices();
}

async function refreshLibrary() {
  const payload = await api('/api/library');
  state.library = payload.documents || [];
  renderLibrary();
}

async function refreshAudio() {
  const payload = await api('/api/audio');
  state.audio = payload.audio || [];
  renderAudio();
}

async function refreshPronunciations() {
  const payload = await api('/api/pronunciations');
  state.pronunciations = payload.pronunciations || [];
  renderPronunciations();
}

async function importUrl() {
  const url = els.urlInput.value.trim();
  if (!url) {
    showToast('Enter a webpage URL first.', true);
    return;
  }

  setLoading(els.importUrlBtn, true, 'Importing…');
  try {
    const payload = await api('/api/import/url', {
      method: 'POST',
      body: JSON.stringify({ url, saveToLibrary: true })
    });
    loadDocumentIntoReader(payload.document);
    await refreshLibrary();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(els.importUrlBtn, false);
  }
}

async function importFile() {
  const file = els.fileInput.files?.[0];
  if (!file) return;

  const form = new FormData();
  form.append('file', file);
  form.append('saveToLibrary', 'true');
  form.append('forceOcr', String(els.forceOcrToggle.checked));

  try {
    showToast(`Importing ${file.name}…`);
    const payload = await api('/api/import/file', {
      method: 'POST',
      body: form
    });
    loadDocumentIntoReader(payload.document);
    await refreshLibrary();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    els.fileInput.value = '';
  }
}

async function saveCurrentDocument() {
  const title = els.docTitle.value.trim();
  const text = els.readerText.value.trim();
  if (!title || !text) {
    showToast('Add a title and text before saving.', true);
    return;
  }

  const existing = state.currentDocumentId ? state.library.find((item) => item.id === state.currentDocumentId) : null;
  if (existing) {
    await api(`/api/library/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, text })
    });
    showToast('Document updated.');
  } else {
    const payload = await api('/api/library', {
      method: 'POST',
      body: JSON.stringify({ title, text, sourceType: 'manual', sourceLabel: 'manual' })
    });
    state.currentDocumentId = payload.document.id;
    showToast('Document saved to library.');
  }
  await refreshLibrary();
}

async function generateAudio() {
  const payload = currentReaderPayload();
  if (!payload.text.trim()) {
    showToast('There is no text to read.', true);
    return;
  }

  setLoading(els.speakBtn, true, 'Generating…');
  try {
    const response = await api('/api/tts/speak', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshAudio();
    playAudio(response.audio);
    showToast('Audio generated.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(els.speakBtn, false);
  }
}

async function previewVoice() {
  const payload = currentReaderPayload();
  if (!payload.text.trim()) {
    showToast('Add some text to preview.', true);
    return;
  }

  setLoading(els.previewBtn, true, 'Previewing…');
  try {
    const response = await fetch('/api/tts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Preview failed.');
    }

    const blob = await response.blob();
    const tempUrl = URL.createObjectURL(blob);
    els.audioPlayer.src = tempUrl;
    els.audioPlayer.play().catch(() => {});
    els.nowPlayingText.textContent = `Preview · ${payload.voice} · ${payload.model}`;
    els.downloadAudioLink.href = tempUrl;
    els.downloadAudioLink.classList.remove('disabled-link');
    els.downloadAudioLink.download = `${(payload.title || 'preview').replace(/\s+/g, '-').toLowerCase()}.${payload.responseFormat}`;
    resetSleepTimer();
    showToast('Preview ready.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(els.previewBtn, false);
  }
}

async function savePronunciation() {
  const find = els.pronunciationFind.value.trim();
  const replace = els.pronunciationReplace.value.trim();
  if (!find) {
    showToast('Add a phrase to replace.', true);
    return;
  }

  await api('/api/pronunciations', {
    method: 'POST',
    body: JSON.stringify({ find, replace })
  });

  els.pronunciationFind.value = '';
  els.pronunciationReplace.value = '';
  await refreshPronunciations();
  showToast('Pronunciation rule added.');
}

async function uploadConsent() {
  const file = els.consentFile.files?.[0];
  if (!file) {
    showToast('Choose a consent recording first.', true);
    return;
  }

  const form = new FormData();
  form.append('name', els.consentName.value.trim() || 'Voice Consent');
  form.append('language', els.consentLanguage.value.trim() || 'en-US');
  form.append('recording', file);

  setLoading(els.uploadConsentBtn, true, 'Uploading…');
  try {
    const payload = await api('/api/voices/consent', { method: 'POST', body: form });
    els.consentIdInput.value = payload.consent.id;
    els.consentResult.textContent = `Consent saved: ${payload.consent.id}`;
    showToast('Consent uploaded.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(els.uploadConsentBtn, false);
    els.consentFile.value = '';
  }
}

async function createCustomVoice() {
  const file = els.customVoiceFile.files?.[0];
  const consent = els.consentIdInput.value.trim();
  if (!file || !consent) {
    showToast('Add a consent ID and a voice sample first.', true);
    return;
  }

  const form = new FormData();
  form.append('name', els.customVoiceName.value.trim() || 'Custom Voice');
  form.append('consent', consent);
  form.append('audioSample', file);

  setLoading(els.createVoiceBtn, true, 'Creating…');
  try {
    const payload = await api('/api/voices/create', { method: 'POST', body: form });
    els.voiceCreateResult.textContent = `Custom voice created: ${payload.voice.id}`;
    els.voiceSelect.value = payload.voice.id;
    await refreshConfig();
    showToast('Custom voice created.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(els.createVoiceBtn, false);
    els.customVoiceFile.value = '';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function bindCoreEvents() {
  els.navButtons.forEach((btn) => btn.addEventListener('click', () => switchPanel(btn.dataset.panel)));
  els.speedInput.addEventListener('input', updateSpeedLabel);
  els.importUrlBtn.addEventListener('click', importUrl);
  els.fileInput.addEventListener('change', importFile);
  els.newDocBtn.addEventListener('click', () => {
    state.currentDocumentId = null;
    els.docTitle.value = '';
    els.readerText.value = '';
    showToast('Blank document ready.');
  });
  els.saveDocBtn.addEventListener('click', saveCurrentDocument);
  els.speakBtn.addEventListener('click', generateAudio);
  els.previewBtn.addEventListener('click', previewVoice);
  els.stopAudioBtn.addEventListener('click', () => {
    els.audioPlayer.pause();
    showToast('Playback stopped.');
  });
  els.sleepTimerSelect.addEventListener('change', resetSleepTimer);
  els.savePronunciationBtn.addEventListener('click', savePronunciation);
  els.uploadConsentBtn.addEventListener('click', uploadConsent);
  els.createVoiceBtn.addEventListener('click', createCustomVoice);
  els.refreshVoicesBtn.addEventListener('click', refreshConfig);
}

async function init() {
  bindCoreEvents();
  attachEventDelegation();
  updateSpeedLabel();

  try {
    await Promise.all([refreshConfig(), refreshLibrary(), refreshAudio(), refreshPronunciations()]);
    showToast('Reader ready.');
  } catch (error) {
    setHealthBadge(false);
    showToast(error.message, true);
  }
}

init();
