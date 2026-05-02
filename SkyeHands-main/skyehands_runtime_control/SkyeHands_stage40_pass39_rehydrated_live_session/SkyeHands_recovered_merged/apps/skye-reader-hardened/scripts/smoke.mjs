const base = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed: ${typeof payload === 'object' ? payload.error : payload}`);
  }
  return payload;
}

async function main() {
  console.log(`Smoke testing ${base}`);

  const health = await request('/api/health');
  console.log('health:', health.ok ? 'ok' : 'not ok', 'openaiConfigured=', health.openaiConfigured);

  const config = await request('/api/config');
  console.log('config voices:', (config.builtInVoices || []).length);

  const pronunciation = await request('/api/pronunciations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ find: 'Kaixu', replace: 'Kai-zoo' })
  });
  console.log('pronunciation created:', pronunciation.pronunciation.id);

  const doc = await request('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Smoke Doc',
      text: 'This is a smoke-test document for Skye Reader Hardened.',
      sourceType: 'manual',
      sourceLabel: 'smoke'
    })
  });
  console.log('document created:', doc.document.id);

  const library = await request('/api/library');
  console.log('library count:', (library.documents || []).length);

  const summary = await request('/api/library/summary');
  console.log('library summary docs:', summary.summary.documentCount);

  const search = await request('/api/library/search?q=smoke&limit=3');
  console.log('search results:', (search.results || []).length);
  if (!search.results || !search.results.length) {
    throw new Error('search endpoint returned no results for smoke doc');
  }

  await request(`/api/pronunciations/${pronunciation.pronunciation.id}`, { method: 'DELETE' });
  await request(`/api/library/${doc.document.id}`, { method: 'DELETE' });

  console.log('cleanup complete');
  console.log('SMOKE OK');
}

main().catch((error) => {
  console.error('SMOKE FAILED');
  console.error(error.message);
  process.exit(1);
});
