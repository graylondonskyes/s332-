const { canonicalize } = require('./export-import');

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function excerpt(value, length = 220) {
  const clean = String(value || '').replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim();
  return clean.length <= length ? clean : `${clean.slice(0, length - 1)}…`;
}

function parseJson(files, name, fallback = {}) {
  try {
    return JSON.parse(files[name] || '{}');
  } catch {
    return fallback;
  }
}

function generateSkyeDocxPackage(workspace, options = {}) {
  const files = workspace.files || {};
  const metadata = parseJson(files, 'metadata.json', {});
  const edition = parseJson(files, 'edition.json', {});
  const storefront = parseJson(files, 'storefront.json', {});
  const manuscript = files['manuscript.md'] || files['post.md'] || '';
  return canonicalize({
    schema: 'skye.skydocx.package',
    version: '2.8.0',
    run_id: options.runId || 'test-run',
    workspace_mode: workspace.mode || 'skydocx',
    title: metadata.title || 'Untitled Release',
    slug: metadata.slug || slugify(metadata.title || 'untitled-release'),
    author: metadata.author || 'Operator',
    imprint: metadata.imprint || 'SOLEnterprises',
    edition: edition.editionName || 'Founding Release',
    edition_number: edition.editionNumber || '1.0.0',
    direct_sale: {
      checkout_mode: storefront.checkoutMode || 'direct-first',
      price_usd: metadata.priceUsd || 0,
      membership_upsell: metadata.membershipUpsell || null,
      bundle_targets: storefront.bundleTargets || []
    },
    territories: metadata.territories || [],
    outputs: edition.outputs || ['docx-master', 'pdf-suite'],
    manuscript_excerpt: excerpt(manuscript),
    source_files: Object.keys(files).sort()
  });
}

function generateSkyeBlogPackage(workspace, options = {}) {
  const files = workspace.files || {};
  const metadata = parseJson(files, 'metadata.json', {});
  const storefront = parseJson(files, 'storefront.json', {});
  const channel = parseJson(files, 'channel.json', {});
  const campaign = parseJson(files, 'campaign.json', {});
  const post = files['post.md'] || files['manuscript.md'] || '';
  return canonicalize({
    schema: 'skye.skyeblog.package',
    version: '2.8.0',
    run_id: options.runId || 'test-run',
    workspace_mode: workspace.mode || 'skyeblog',
    headline: channel.channelTitle || metadata.title || 'Untitled Editorial',
    article_slug: channel.slug || metadata.slug || slugify(channel.channelTitle || metadata.title || 'untitled-editorial'),
    author: channel.author || metadata.author || 'Operator',
    release_hook: campaign.releaseHook || storefront.heroLine || 'Launch article seeded from canonical release',
    feed_entry: {
      excerpt: excerpt(post),
      cta_label: channel.ctaLabel || 'Open release lane',
      canonical_collection: channel.canonicalCollection || metadata.slug || null
    },
    promo_targets: campaign.promoTargets || [],
    callouts: campaign.callouts || [],
    source_files: Object.keys(files).sort()
  });
}

function validatePublishingWorkspace(workspace) {
  const files = workspace.files || {};
  const mode = workspace.mode || 'code';
  const required = mode === 'skydocx'
    ? ['manuscript.md', 'metadata.json', 'edition.json', 'storefront.json']
    : mode === 'skyeblog'
      ? ['post.md', 'channel.json', 'campaign.json', 'cta.html']
      : ['index.html', 'styles.css', 'app.js'];
  const missing = required.filter((name) => !files[name]);
  return {
    mode,
    required,
    missing,
    ok: missing.length === 0
  };
}

module.exports = {
  generateSkyeDocxPackage,
  generateSkyeBlogPackage,
  validatePublishingWorkspace
};
