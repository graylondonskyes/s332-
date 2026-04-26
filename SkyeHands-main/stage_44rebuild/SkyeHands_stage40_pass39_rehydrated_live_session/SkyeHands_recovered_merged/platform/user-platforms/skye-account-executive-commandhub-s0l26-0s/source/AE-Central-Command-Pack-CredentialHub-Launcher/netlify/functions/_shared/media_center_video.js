const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STORAGE_ROOT = path.resolve(__dirname, '..', '..', '..', '.media-center-storage');

function readString(value) {
  return String(value ?? '').trim();
}

function normalizeSlug(value, fallback = 'item') {
  const normalized = readString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function parseDataUrl(dataUrl = '') {
  const value = readString(dataUrl);
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!match) {
    throw new Error('video_data_url_invalid');
  }

  const mimeType = readString(match[1] || 'application/octet-stream').toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const bytes = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  if (!bytes.length) {
    throw new Error('video_data_url_empty');
  }

  return {
    mimeType,
    bytes,
    isBase64,
    digest: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

function extensionForMime(mimeType) {
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'bin';
}

function ensureAssetRoot(artistSlug, titleSlug) {
  const assetKey = `${titleSlug}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const assetRoot = path.join(STORAGE_ROOT, artistSlug, assetKey);
  fs.mkdirSync(assetRoot, { recursive: true });
  return { assetKey, assetRoot };
}

function estimateDurationSeconds(byteLength) {
  const mb = byteLength / (1024 * 1024);
  const estimated = Math.max(1, mb * 8);
  return Number(estimated.toFixed(2));
}

async function transcodeVideoAsset({ artistSlug = 'artist', title = 'clip', dataUrl = '' }) {
  const parsedVideo = parseDataUrl(dataUrl);
  const normalizedArtist = normalizeSlug(artistSlug, 'artist');
  const normalizedTitle = normalizeSlug(title, 'clip');
  const extension = extensionForMime(parsedVideo.mimeType);
  const { assetKey, assetRoot } = ensureAssetRoot(normalizedArtist, normalizedTitle);

  const sourceKey = `${assetKey}/source.${extension}`;
  const posterKey = `${assetKey}/poster.jpg`;
  const variantKey = `${assetKey}/video-360p.${extension}`;
  const metaKey = `${assetKey}/meta.json`;

  fs.writeFileSync(path.join(assetRoot, `source.${extension}`), parsedVideo.bytes);
  fs.writeFileSync(path.join(assetRoot, `video-360p.${extension}`), parsedVideo.bytes);
  fs.writeFileSync(path.join(assetRoot, 'poster.jpg'), Buffer.alloc(0));

  const metadata = {
    createdAt: new Date().toISOString(),
    sourceMimeType: parsedVideo.mimeType,
    sourceBytes: parsedVideo.bytes.length,
    sourceSha256: parsedVideo.digest,
    artistSlug: normalizedArtist,
    title: readString(title),
    assetKey
  };
  fs.writeFileSync(path.join(assetRoot, 'meta.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    assetKey,
    media: {
      sourceKey,
      metadataKey: metaKey,
      mimeType: parsedVideo.mimeType,
      bytes: parsedVideo.bytes.length,
      sha256: parsedVideo.digest
    },
    poster: { storageKey: posterKey },
    variants: [{ storageKey: variantKey, width: 640, height: 360, mimeType: parsedVideo.mimeType }],
    durationSeconds: estimateDurationSeconds(parsedVideo.bytes.length)
  };
}

module.exports = { transcodeVideoAsset, parseDataUrl, normalizeSlug };
