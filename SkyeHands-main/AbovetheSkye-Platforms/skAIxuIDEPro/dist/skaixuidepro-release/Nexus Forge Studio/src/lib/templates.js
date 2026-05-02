import { clampText, joinNonEmpty, safeTrim, slugify, titleCase } from "./text.js";

function pickOne(arr, seed) {
  const a = arr || [];
  if (a.length === 0) return "";
  const i = Math.abs(seed) % a.length;
  return a[i];
}

function hashSeed(...parts) {
  const s = parts.map(p => String(p ?? "")).join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function defaultBrandSettings() {
  return {
    brandName: "Skyes Over London LC",
    brandSite: "SOLEnterprises.org",
    defaultCity: "Phoenix, AZ",
    voice: "editorial, confident, warm, practical",
    ctaPrimary: "Book a quick call",
    ctaSecondary: "Request a quote",
  };
}

export function buildBlogBrief({ account, keyword, city, service, angle, settings }) {
  const s = settings || defaultBrandSettings();
  const a = account || {};
  const bizName = safeTrim(a.name) || "This business";
  const bizCity = safeTrim(city) || safeTrim(a.city) || s.defaultCity || "";
  const svc = safeTrim(service) || safeTrim(a.service) || safeTrim(a.services) || "services";
  const kw = safeTrim(keyword) || `${svc} ${bizCity}`.trim();
  const ang = safeTrim(angle) || "Local success case study";

  const seed = hashSeed(bizName, bizCity, svc, kw, ang);

  const headline = pickOne(
    [
      `${bizName}: A ${bizCity} ${svc} story worth copying`,
      `Why ${bizName} is winning in ${bizCity} (${svc})`,
      `${bizName} in ${bizCity}: ${svc} done the right way`,
      `How ${bizName} is raising the bar for ${svc} in ${bizCity}`,
    ],
    seed
  );

  const metaTitle = clampText(`${bizName} — ${titleCase(svc)} in ${bizCity} | ${titleCase(kw)}`, 60);
  const metaDesc = clampText(
    `An editorial-style local feature on ${bizName}: what they do, why it works, and how to choose ${svc} in ${bizCity}.`,
    155
  );

  const slug = slugify(`${bizName}-${kw}-${bizCity}`) || slugify(`${bizName}-${bizCity}`);

  const outline = [
    "Intro: what makes them instantly credible",
    "What they actually do (plain-English breakdown)",
    `Why it works in ${bizCity} (context + demand)`,
    "What customers notice first (experience + trust signals)",
    "Common mistakes buyers make (and how to avoid them)",
    "How to choose the right provider (checklist)",
    "FAQ",
    "Closing: best next step",
  ];

  const faq = [
    `How much does ${svc} usually cost in ${bizCity}?`,
    `How fast can you get started with ${svc}?`,
    `What should I look for when comparing ${svc} providers?`,
    `What makes ${bizName} different?`,
  ];

  const internalLinks = [
    { anchor: "Get a quote", href: `https://${s.brandSite}/` },
    { anchor: "See services", href: `https://${s.brandSite}/services` },
    { anchor: "Read more local features", href: `https://${s.brandSite}/blog` },
  ];

  const html = `<!-- NexusForge Blog Skeleton (offline generated) -->
<article>
  <header>
    <h1>${escapeHtml(headline)}</h1>
    <p><em>${escapeHtml(ang)} • ${escapeHtml(bizCity)}</em></p>
  </header>

  <section>
    <p><strong>${escapeHtml(bizName)}</strong> is one of those rare businesses that feels "obvious" once you experience it: clear service, crisp communication, and results that show.</p>
    <p>This feature breaks down what they do, why it works, and what to look for if you're comparing <strong>${escapeHtml(svc)}</strong> in <strong>${escapeHtml(bizCity)}</strong>.</p>
  </section>

  <h2>What ${escapeHtml(bizName)} does</h2>
  <p>${escapeHtml(bizName)} provides ${escapeHtml(svc)} with a focus on consistency, clarity, and customer experience.</p>

  <h2>Why it works in ${escapeHtml(bizCity)}</h2>
  <p>In a market like ${escapeHtml(bizCity)}, businesses that win are the ones that make it easy to say "yes": fast response times, clean delivery, and trust you can feel.</p>

  <h2>What customers notice first</h2>
  <ul>
    <li>Communication that doesn't vanish after the first call</li>
    <li>Predictable process (no mystery steps)</li>
    <li>Respect for time, budget, and expectations</li>
  </ul>

  <h2>Common mistakes buyers make</h2>
  <ul>
    <li>Picking the cheapest option without checking outcomes</li>
    <li>Skipping a written scope and timeline</li>
    <li>Not asking about support after delivery</li>
  </ul>

  <h2>How to choose the right provider</h2>
  <ol>
    <li>Ask for a simple scope and timeline in writing</li>
    <li>Look for a clear process (intake → delivery → follow-up)</li>
    <li>Check reviews, photos, and proof of work</li>
  </ol>

  <h2>FAQ</h2>
  <h3>${escapeHtml(faq[0])}</h3>
  <p>Costs vary by scope. The best move is to request a quote with your exact needs.</p>
  <h3>${escapeHtml(faq[1])}</h3>
  <p>Most projects start after a quick intake call and a clear scope.</p>

  <hr />
  <p><strong>Next step:</strong> ${escapeHtml(s.ctaPrimary)} or ${escapeHtml(s.ctaSecondary)}.</p>
  <p>
    <a href="${internalLinks[0].href}">${internalLinks[0].anchor}</a> •
    <a href="${internalLinks[1].href}">${internalLinks[1].anchor}</a> •
    <a href="${internalLinks[2].href}">${internalLinks[2].anchor}</a>
  </p>
</article>
`;

  const prompt = buildPrompt({ bizName, bizCity, svc, kw, ang, s, outline, faq });

  return {
    headline,
    metaTitle,
    metaDesc,
    slug,
    keyword: kw,
    city: bizCity,
    service: svc,
    angle: ang,
    outline,
    faq,
    internalLinks,
    html,
    prompt,
  };
}

export function buildEmailSequence({ account, blogUrl, settings }) {
  const s = settings || defaultBrandSettings();
  const a = account || {};
  const bizName = safeTrim(a.name) || "there";
  const contact = safeTrim(a.contactName) || "";
  const site = safeTrim(blogUrl) || "[PASTE BLOG LINK HERE]";
  const signature = `${s.brandName}`;

  const hi = contact ? `Hi ${contact},` : "Hi there,";

  const emails = [
    {
      key: "week1",
      subject: `Your feature is live — ${bizName}`,
      body: `${hi}\n\nQuick update: we published your editorial feature today.\n\n${site}\n\nIt highlights what you do, why it works, and gives people a clean reason to choose you.\n\nIf you want, send me 1–2 photos you love and we’ll update the post to match your best look.\n\n${signature}`,
    },
    {
      key: "week2",
      subject: `A few insights from the write-up (and a small upgrade)` ,
      body: `${hi}\n\nAfter writing your feature, here are 2 quick things that stood out:\n\n1) People trust clarity. A simple "here’s how it works" section converts.\n2) Proof beats claims. Photos, reviews, before/after, anything real.\n\nYour post is here again for reference:\n${site}\n\nIf you want the upgrade: we can add a short FAQ + pricing range section so the right customers self-select.\n\n${signature}`,
    },
    {
      key: "week3",
      subject: `Want us to turn the feature into steady weekly visibility?`,
      body: `${hi}\n\nThe feature is doing its job: it's building trust and giving people something credible to share.\n\nNext step is consistency: 1 post per week around the services you want more of (plus internal links pointing back to your feature).\n\nHere’s the feature link:\n${site}\n\nIf you want, reply with the top 2 services you want to push this month and we’ll map the topics.\n\n${signature}`,
    },
    {
      key: "week4",
      subject: `Recap + next steps for ${bizName}`,
      body: `${hi}\n\nRecap of what we shipped so far:\n- Editorial feature (live)\n- Local positioning (city + service intent)\n- A shareable link your customers can trust\n\n${site}\n\nIf you want us to keep it rolling, we’ll do a weekly post cadence and track it in a simple log (so nothing gets duplicated).\n\n${signature}`,
    },
  ];

  return { blogUrl: site, emails };
}

export function buildClusterPlan({ rootTopic, city, service, count = 13 }) {
  const rt = safeTrim(rootTopic) || "your service";
  const c = safeTrim(city) || "your city";
  const s = safeTrim(service) || "";
  const base = s ? `${s} ${rt}`.trim() : rt;

  const patterns = [
    `Best ${base} in ${c}`,
    `${base} cost in ${c}`,
    `${base} checklist for first-timers` ,
    `${base} mistakes to avoid` ,
    `${base} timeline: what to expect` ,
    `${base} vs alternatives (what’s right for you)` ,
    `How to choose a ${base} provider in ${c}`,
    `${base} FAQ (short answers)` ,
    `What makes great ${base} (quality signals)` ,
    `${base} for small businesses in ${c}` ,
    `${base} for homeowners in ${c}` ,
    `${base} maintenance + aftercare` ,
    `Local guide: ${base} resources in ${c}`,
    `Case study: ${base} done right in ${c}`,
    `Pricing guide: ${base} packages in ${c}`,
  ];

  const items = patterns.slice(0, Math.max(5, Math.min(25, count))).map((title, idx) => {
    return {
      order: idx + 1,
      title,
      keyword: title,
      slug: slugify(title),
      intent: idx === 0 ? "commercial" : idx % 3 === 0 ? "transactional" : "informational",
    };
  });

  // Simple internal linking: everything points to the pillar, plus neighbors
  const pillar = {
    title: `${titleCase(base)} in ${c}: The Complete Guide`,
    slug: slugify(`${base} in ${c} complete guide`),
  };

  const linkMap = items.map((it, i) => {
    const prev = items[(i - 1 + items.length) % items.length];
    const next = items[(i + 1) % items.length];
    return {
      from: it.slug,
      to: [pillar.slug, prev.slug, next.slug],
    };
  });

  return { pillar, items, linkMap };
}

function buildPrompt({ bizName, bizCity, svc, kw, ang, s, outline, faq }) {
  const o = outline.map((x, i) => `${i + 1}. ${x}`).join("\n");
  const f = faq.map((x, i) => `Q${i + 1}: ${x}`).join("\n");
  return `Write an editorial-style local blog post.\n\nBusiness: ${bizName}\nCity: ${bizCity}\nService: ${svc}\nPrimary keyword: ${kw}\nAngle: ${ang}\nVoice: ${s.voice}\nLength: 1200–1700 words\n\nRules:\n- No fluff intros. Start with a concrete reason the business is credible.\n- Use short paragraphs and helpful subheadings.\n- Include 1 checklist and 1 short FAQ section.\n- Include a "how to choose" section with 5 bullets.\n- Avoid medical/legal claims. Keep it practical.\n\nOutline:\n${o}\n\nFAQ prompts:\n${f}\n\nEnd with a gentle CTA: ${s.ctaPrimary} / ${s.ctaSecondary}.`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
