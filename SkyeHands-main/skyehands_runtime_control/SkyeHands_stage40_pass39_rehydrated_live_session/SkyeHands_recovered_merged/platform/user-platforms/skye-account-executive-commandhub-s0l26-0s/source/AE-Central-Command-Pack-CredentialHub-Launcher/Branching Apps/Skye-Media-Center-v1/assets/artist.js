const DB_NAME = 'skye-media-center';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('artists')) db.createObjectStore('artists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
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

async function fetchArtist(slug) {
  try {
    const res = await fetch('/.netlify/functions/media-center?slug=' + encodeURIComponent(slug));
    const data = await res.json();
    if (data?.artist?.artist || data?.artist?.entries) return data.artist;
  } catch {}
  const artists = await getAll('artists');
  const entries = await getAll('entries');
  const artist = artists.find((item) => item.slug === slug);
  if (!artist) return null;
  return {
    artist: { display_name: artist.displayName, slug: artist.slug, profile_json: artist.profile },
    entries: entries
      .filter((item) => item.artistSlug === slug)
      .map((item) => ({ id: item.id, title: item.title, entry_type: item.entryType, payload_json: item.payload, artist_slug: item.artistSlug })),
  };
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

function render(artistBundle) {
  const hero = document.getElementById('artistHero');
  const feed = document.getElementById('artistFeed');
  if (!artistBundle) {
    hero.innerHTML = '<div class="card"><h1>Artist not found</h1></div>';
    feed.innerHTML = '';
    return;
  }
  const artist = artistBundle.artist;
  const profile = artist.profile_json || {};
  hero.innerHTML = `
    <div>
      <div class="eyebrow">Artist page</div>
      <h1>${artist.display_name}</h1>
      <p>${profile.bio || ''}</p>
      <div class="row">
        <span class="tag">${artist.slug}</span>
        <span class="tag">${profile.genre || 'Independent'}</span>
        <span class="tag">${profile.city || 'Worldwide'}</span>
      </div>
    </div>
    <div class="card">
      ${profile.heroImage ? `<img src="${profile.heroImage}" alt="">` : ''}
      <p class="small">Share this page directly to promote tracks, image drops, pre-release countdowns, and direct-upload videos.</p>
    </div>
  `;
  feed.innerHTML = (artistBundle.entries || []).map((item) => {
    const payload = item.payload_json || {};
    return `
      <article class="entry">
        <div class="eyebrow">${item.entry_type}</div>
        <h3>${item.title}</h3>
        ${payload.preReleaseDate ? `<div class="small">Pre-release date: ${payload.preReleaseDate}</div>` : ''}
        ${payload.imageDataUrl ? `<img src="${payload.imageDataUrl}" alt="">` : ''}
        ${payload.audioDataUrl ? `<audio class="audio" controls src="${payload.audioDataUrl}"></audio>` : ''}
        ${renderVideo(payload)}
        ${Array.isArray(payload.videoVariants) && payload.videoVariants.length ? `<div class="row">${payload.videoVariants.map((variant) => `<span class="tag">${variant.label}${variant.height ? ` ${variant.height}p` : ''}</span>`).join('')}</div>` : ''}
        <p>${payload.description || ''}</p>
      </article>
    `;
  }).join('') || '<div class="entry">No media published yet.</div>';
}

const slug = new URL(location.href).searchParams.get('slug') || '';
fetchArtist(slug).then(render);
