const { generateSkyeDocxPackage, generateSkyeBlogPackage, validatePublishingWorkspace } = require('../platform/publishing');
const { fail, ok } = require('./lib');

const skydocxWorkspace = {
  mode: 'skydocx',
  files: {
    'manuscript.md': '# Title\n\nThe owned lane matters.',
    'metadata.json': JSON.stringify({ title:'Sovereign Author Publishing OS', slug:'sovereign-author-publishing-os', author:'Skyes Over London', imprint:'SOLEnterprises', priceUsd:49, territories:['US','CA'] }),
    'edition.json': JSON.stringify({ editionName:'Founding Release', editionNumber:'1.0.0', outputs:['docx-master','pdf-suite','retailer-export-zips'] }),
    'storefront.json': JSON.stringify({ checkoutMode:'direct-first', bundleTargets:['Publishing OS bundle'] })
  }
};

const skyeblogWorkspace = {
  mode: 'skyeblog',
  files: {
    'post.md': '# Headline\n\nA launch article from the same release lane.',
    'channel.json': JSON.stringify({ channelTitle:'SkyeBlog Command', slug:'author-stack-needs-sovereign-command-layer', author:'Skyes Over London', ctaLabel:'Open release lane', canonicalCollection:'publishing-os' }),
    'campaign.json': JSON.stringify({ releaseHook:'Launch article tied to canonical author package', promoTargets:['site-homepage','author-storefront'], callouts:['direct-sale first','edition lineage intact'] }),
    'cta.html': '<aside>cta</aside>'
  }
};

for (let index = 0; index < 6; index += 1) {
  const docxPackage = generateSkyeDocxPackage(skydocxWorkspace, { runId:`docx-${index}` });
  if (docxPackage.schema !== 'skye.skydocx.package') fail(`[publishing-packages] FAIL :: docx-schema-${index}`);
  if (docxPackage.slug !== 'sovereign-author-publishing-os') fail(`[publishing-packages] FAIL :: docx-slug-${index}`);
  if (!docxPackage.outputs.includes('retailer-export-zips')) fail(`[publishing-packages] FAIL :: docx-outputs-${index}`);
}

for (let index = 0; index < 6; index += 1) {
  const blogPackage = generateSkyeBlogPackage(skyeblogWorkspace, { runId:`blog-${index}` });
  if (blogPackage.schema !== 'skye.skyeblog.package') fail(`[publishing-packages] FAIL :: blog-schema-${index}`);
  if (blogPackage.article_slug !== 'author-stack-needs-sovereign-command-layer') fail(`[publishing-packages] FAIL :: blog-slug-${index}`);
  if (!blogPackage.promo_targets.includes('author-storefront')) fail(`[publishing-packages] FAIL :: blog-targets-${index}`);
}

const docxValidation = validatePublishingWorkspace(skydocxWorkspace);
if (!docxValidation.ok) fail('[publishing-packages] FAIL :: docx-validation');

const blogValidation = validatePublishingWorkspace(skyeblogWorkspace);
if (!blogValidation.ok) fail('[publishing-packages] FAIL :: blog-validation');

const brokenValidation = validatePublishingWorkspace({ mode:'skydocx', files:{ 'metadata.json':'{}' } });
if (brokenValidation.ok || brokenValidation.missing.length !== 3) fail('[publishing-packages] FAIL :: broken-validation');

ok('[publishing-packages] PASS (15 vectors)');
