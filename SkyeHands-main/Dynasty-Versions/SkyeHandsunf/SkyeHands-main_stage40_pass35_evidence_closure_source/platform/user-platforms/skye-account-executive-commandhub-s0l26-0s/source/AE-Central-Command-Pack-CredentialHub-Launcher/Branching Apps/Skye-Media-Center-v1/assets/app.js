const DB_NAME = 'skye-media-center';
const DB_VERSION = 2;
const STORES = ['artists', 'entries'];
const $ = (selector) => document.querySelector(selector);

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function put(store, row) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(row);
    tx.oncomplete = () => resolve(row);
    tx.onerror = () => reject(tx.error);
  });
}

async function fileToDataUrl(file, maxBytes) {
  if (!file) return '';
  if (file.size > maxBytes) throw new Error(`File too large for this lane. Max ${(maxBytes / 1024 / 1024).toFixed(1)}MB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || `artist-${Date.now()}`;
}

async function fetchRemote(path = '') {
  const res = await fetch('/.netlify/functions/media-center' + path);
  return res.json().catch(() => ({ ok: false }));
}

async function postRemote(body) {
  const res = await fetch('/.netlify/functions/media-center', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ ok: false }));
}

function shareUrl(slug) {
  const url = new URL('./artist.html', location.href);
  url.searchParams.set('slug', slug);
  return url.toString();
}

async function registerWithCommandHub(payload) {
  try {
    const token = localStorage.getItem('skye.commandhub.token') || '';
    if (!token) return;
    await fetch('/.netlify/functions/commandhub-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {}
}

function renderVideo(payload) {
  const streamUrl = payload.streamUrl || payload.videoUpload?.streamUrl || '';
  const posterUrl = payload.posterUrl || payload.videoUpload?.posterUrl || '';
  if (streamUrl) {
    return `<video class="video" controls preload="metadata" poster="${posterUrl}"><source src="${streamUrl}" type="video/mp4"></video>`;
  }
  if (payload.videoEmbedUrl) {
    return `<div class="small">Video embed: <a href="${payload.videoEmbedUrl}" target="_blank" rel="noopener">Open</a></div>`;
  }
  return '';
}

function renderArtistGrid(artists = []) {
  $('#artistGrid').innerHTML = artists.map((item) => {
    const artist = item.profile_json || item.profile || {};
    return `
      <article class="entry">
        <div class="eyebrow">Artist</div>
        <h3>${item.display_name || item.displayName}</h3>
        <p class="small">${artist.genre || ''}${artist.city ? ` · ${artist.city}` : ''}</p>
        <p>${artist.bio || ''}</p>
        <div class="toolbar">
          <a class="btn soft" href="./artist.html?slug=${item.slug}">Open page</a>
          <span class="pill">${item.slug}</span>
        </div>
      </article>
    `;
  }).join('') || '<div class="entry">No artists yet.</div>';
}

function renderFeed(entries = []) {
  $('#feed').innerHTML = entries.map((item) => {
    const payload = item.payload_json || item.payload || {};
    return `
      <article class="entry">
        <div class="eyebrow">${item.entry_type || item.entryType}</div>
        <h3>${item.title}</h3>
        <p class="small">${item.artist_slug || item.artistSlug}${payload.preReleaseDate ? ` · Pre-release ${payload.preReleaseDate}` : ''}</p>
        ${payload.imageDataUrl ? `<img src="${payload.imageDataUrl}" alt="">` : ''}
        ${payload.audioDataUrl ? `<audio class="audio" controls src="${payload.audioDataUrl}"></audio>` : ''}
        ${renderVideo(payload)}
        ${Array.isArray(payload.videoVariants) && payload.videoVariants.length ? `<div class="toolbar">${payload.videoVariants.map((variant) => `<span class="tag">${variant.label} ${variant.height ? `${variant.height}p` : ''}</span>`).join('')}</div>` : ''}
        <p>${payload.description || ''}</p>
      </article>
    `;
  }).join('') || '<div class="entry">No media yet.</div>';
}

async function refresh(search = '') {
  const localArtists = await getAll('artists');
  const localEntries = await getAll('entries');
  let remote = { ok: false, artists: [], entries: [], localOnly: true };
  try { remote = await fetchRemote(search ? `?q=${encodeURIComponent(search)}` : ''); } catch {}
  const artists = remote.ok && remote.artists?.length ? remote.artists : localArtists;
  const entries = remote.ok && remote.entries?.length ? remote.entries : localEntries;
  $('#artistCount').textContent = artists.length;
  $('#entryCount').textContent = entries.length;
  $('#storageMode').textContent = remote.localOnly ? 'IndexedDB + local direct-upload runtime' : 'IndexedDB + Neon metadata + direct video storage';
  renderArtistGrid(artists);
  renderFeed(entries);
}

async function saveArtist() {
  const displayName = $('#artistName').value.trim();
  const slug = slugify($('#artistSlug').value || displayName);
  const heroImage = await fileToDataUrl($('#artistHero').files[0], 5 * 1024 * 1024).catch((err) => {
    alert(err.message);
    return '';
  });
  const artist = {
    id: `artist-${slug}`,
    slug,
    displayName,
    profile: {
      bio: $('#artistBio').value.trim(),
      genre: $('#artistGenre').value.trim(),
      city: $('#artistCity').value.trim(),
      heroImage,
      avatarImage: heroImage,
    },
  };
  await put('artists', artist);
  try {
    await postRemote({ action: 'upsertArtist', id: artist.id, slug, displayName, bio: artist.profile.bio, genre: artist.profile.genre, city: artist.profile.city, heroImage });
  } catch {}
  await registerWithCommandHub({ action: 'registerAsset', asset: { assetId: artist.id, artistSlug: slug, title: displayName, mediaType: 'artist-profile', tags: ['artist','profile'], sourceApp: 'skye-media-center', payload: artist.profile } });
  $('#shareLinkBox').textContent = shareUrl(slug);
  $('#entryArtistSlug').value = slug;
  await refresh();
}

async function saveEntry() {
  const artistSlug = slugify($('#entryArtistSlug').value);
  if (!artistSlug) {
    alert('Artist slug is required.');
    return;
  }
  const entryType = $('#entryType').value;
  const audioDataUrl = await fileToDataUrl($('#entryAudio').files[0], 15 * 1024 * 1024).catch(() => '');
  const imageDataUrl = await fileToDataUrl($('#entryImage').files[0], 6 * 1024 * 1024).catch(() => '');
  const videoFile = $('#entryVideoFile').files[0];
  const videoDataUrl = entryType === 'video' && videoFile ? await fileToDataUrl(videoFile, 120 * 1024 * 1024).catch((err) => { alert(err.message); return ''; }) : '';
  const entry = {
    id: `entry-${Date.now()}`,
    artistSlug,
    entryType,
    title: $('#entryTitle').value.trim(),
    payload: {
      description: $('#entryDescription').value.trim(),
      audioDataUrl,
      imageDataUrl,
      videoEmbedUrl: $('#entryVideo').value.trim(),
      preReleaseDate: $('#entryPreRelease').value,
    },
  };

  let remoteResult = null;
  if (entryType === 'video' && videoDataUrl) {
    entry.payload.videoUpload = { streamUrl: '', posterUrl: '', variants: [] };
  }
  try {
    remoteResult = await postRemote({
      action: 'upsertEntry',
      id: entry.id,
      artistSlug,
      entryType,
      title: entry.title,
      description: entry.payload.description,
      audioDataUrl,
      imageDataUrl,
      videoEmbedUrl: entry.payload.videoEmbedUrl,
      preReleaseDate: entry.payload.preReleaseDate,
      videoDataUrl,
      videoMimeType: videoFile?.type || '',
      videoFilename: videoFile?.name || '',
    });
  } catch {}

  if (remoteResult?.artist?.entries?.length) {
    const latest = remoteResult.artist.entries.find((item) => item.id === entry.id) || remoteResult.artist.entries[0];
    entry.payload = latest.payload_json || entry.payload;
  } else if (remoteResult?.entry?.payload) {
    entry.payload = remoteResult.entry.payload;
  }

  await put('entries', entry);
  await registerWithCommandHub({ action: 'registerAsset', asset: { assetId: entry.id, artistSlug, title: entry.title, mediaType: entryType, tags: ['entry', entryType], sourceApp: 'skye-media-center', payload: entry.payload } });
  $('#entryVideoFile').value = '';
  await refresh();
}

function loadDemo() {
  const slug = 'demo-artist';
  $('#artistName').value = 'Demo Artist';
  $('#artistSlug').value = slug;
  $('#artistGenre').value = 'Alt-R&B';
  $('#artistCity').value = 'Phoenix';
  $('#artistBio').value = 'Demo artist profile built inside Skye Media Center.';
  $('#entryArtistSlug').value = slug;
  $('#entryTitle').value = 'Midnight Proof';
  $('#entryDescription').value = 'Demo single built to show the music-streaming, image-drop, and direct-video-share lane.';
}

document.getElementById('loadDemoBtn').onclick = loadDemo;
document.getElementById('saveArtistBtn').onclick = () => saveArtist().catch((err) => alert(err.message));
document.getElementById('saveEntryBtn').onclick = () => saveEntry().catch((err) => alert(err.message));
document.getElementById('searchBtn').onclick = () => refresh($('#searchInput').value.trim());

refresh();
