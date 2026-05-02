import * as cheerio from "cheerio";
import crypto from "crypto";

function collapseWhitespace(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function shouldSkipHref(href = "") {
  const lower = String(href || "").toLowerCase();
  return (
    !href ||
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("#")
  );
}

function countMatches(text = "", regex) {
  const matches = String(text).match(regex);
  return matches ? matches.length : 0;
}

function hasPrice(text = "") {
  return /(\$|usd|us\$|price)[^\n\r]{0,30}\d/i.test(text) || /\b\d+(?:\.\d+)?\s*[-–~to]+\s*\d+(?:\.\d+)?\b/.test(text);
}

function hasMoq(text = "") {
  return /\bmoq\b|min(?:imum)?\s+order|\b\d+\s*(pcs|pieces|units)\b/i.test(text);
}

function hasSupplierSignal(text = "") {
  return /supplier|manufacturer|factory|company|store|vendor|oem|odm|private\s+label|custom/i.test(text);
}

function hasStyleSignal(text = "") {
  return /techwear|streetwear|punk|goth|dark|cyberpunk|hoodie|jacket|cargo|garment|apparel|clothing/i.test(text);
}

function normaliseClassToken(token = "") {
  return String(token || "")
    .toLowerCase()
    .replace(/[_\d]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function classTokens($container) {
  const raw = String($container.attr("class") || "");
  return raw
    .split(/\s+/)
    .map(normaliseClassToken)
    .filter((token) => token && token.length >= 3)
    .filter((token) => !/^(mt|mb|ml|mr|pt|pb|pl|pr|px|py|flex|grid|row|col|wrap|hidden|show|active)$/.test(token));
}

function containerSignature($container) {
  const tag = ($container.get(0)?.tagName || $container.get(0)?.name || "div").toLowerCase();
  const tokens = classTokens($container)
    .filter((token) => /card|item|offer|product|result|list|tile|grid|box|content|panel|cell|row|info|supplier|company|shop|store|module|entry|record/i.test(token))
    .slice(0, 5)
    .sort();

  if (tokens.length) return `${tag}:${tokens.join("|")}`;

  const childTags = $container.children().map((_, el) => el.tagName || el.name || "").get().slice(0, 6);
  const anchorCount = $container.find("a[href]").length;
  const structuralBits = [
    childTags.join("."),
    anchorCount ? `a${Math.min(anchorCount, 9)}` : "a0",
    hasPrice($container.text()) ? "p" : "",
    hasMoq($container.text()) ? "m" : ""
  ].filter(Boolean);
  return `${tag}:struct-${structuralBits.join("-")}`;
}

function immediateText($, $node) {
  return collapseWhitespace(
    $node
      .contents()
      .filter((_, child) => child.type === "text")
      .map((_, child) => child.data || "")
      .get()
      .join(" ")
  );
}

function containerStructureScore($, $container) {
  const text = collapseWhitespace($container.text());
  const textLen = text.length;
  const anchorCount = $container.find("a[href]").length;
  const tag = ($container.get(0)?.tagName || $container.get(0)?.name || "div").toLowerCase();
  const cls = classTokens($container).join(" ");
  const childCount = $container.children().length;

  let score = 0;
  if (textLen >= 40 && textLen <= 2600) score += 4;
  if (textLen > 2600) score -= 5;
  if (textLen < 40) score -= 4;

  if (anchorCount >= 1 && anchorCount <= 12) score += 3;
  if (anchorCount > 16) score -= 6;

  if (["article", "li", "tr"].includes(tag)) score += 3;
  if (/card|item|offer|product|result|tile|row|panel|box|supplier|company|shop|store|module|entry/i.test(cls)) score += 4;
  if (childCount >= 2 && childCount <= 15) score += 2;

  if (hasPrice(text)) score += 3;
  if (hasMoq(text)) score += 3;
  if (hasSupplierSignal(text)) score += 3;
  if (hasStyleSignal(text)) score += 3;

  if (/privacy|policy|login|sign in|wishlist|cart|help center|terms|cookie|captcha|security check/i.test(text)) score -= 10;
  return score;
}

function inferLikelyTitle($, $container) {
  const headingSelectors = [
    "[class*='title']",
    "[class*='subject']",
    "[class*='name']",
    "[class*='product']",
    "[data-title]",
    "h1",
    "h2",
    "h3",
    "h4"
  ];

  for (const selector of headingSelectors) {
    const nodes = $container.find(selector);
    for (const node of nodes.toArray()) {
      const text = collapseWhitespace($(node).attr("data-title") || $(node).text());
      if (text && text.length >= 6 && text.length <= 180) return text;
    }
  }

  const immediate = immediateText($, $container);
  if (immediate && immediate.length >= 6 && immediate.length <= 180) return immediate;

  const anchorTexts = $container
    .find("a[href]")
    .map((_, el) => collapseWhitespace($(el).text()))
    .get()
    .filter((text) => text && text.length >= 6 && text.length <= 180)
    .sort((a, b) => b.length - a.length);

  return anchorTexts[0] || collapseWhitespace($container.text()).slice(0, 120);
}

function isLikelySupplierAnchor({ text = "", href = "", className = "" } = {}) {
  const hay = `${text} ${href} ${className}`.toLowerCase();
  return /supplier|company|manufacturer|factory|store|shop|vendor|garments|apparel|fashion|works|studio/.test(hay);
}

function isLikelyProductAnchor({ text = "", href = "", className = "" } = {}) {
  const hay = `${text} ${href} ${className}`.toLowerCase();
  return /product|item|detail|offer|title|hoodie|jacket|pants|cargo|techwear|streetwear|punk|goth|dark|cyberpunk|apparel|garment/.test(hay);
}

function anchorScore(text = "", href = "", containerText = "", className = "") {
  const hay = `${text} ${href} ${containerText} ${className}`.toLowerCase();
  let score = 0;
  const positive = [
    "supplier", "company", "manufacturer", "factory", "oem", "odm", "custom", "techwear", "streetwear",
    "punk", "goth", "hoodie", "jacket", "pants", "clothing", "garment", "apparel", "fashion", "product",
    "cargo", "cyberpunk", "dark"
  ];
  for (const word of positive) if (hay.includes(word)) score += 2;
  if (hasPrice(containerText)) score += 2;
  if (hasMoq(containerText)) score += 2;
  if (/contact|about|login|privacy|policy|help|cart|quote request|sign in/.test(hay)) score -= 6;
  if (/product|offer|item|detail|supplier|company|store|shop/.test(href.toLowerCase())) score += 2;
  if (/view|details|read more|more/.test(text.toLowerCase())) score -= 1;
  if (text.length > 4 && text.length < 180) score += 1;
  if (isLikelySupplierAnchor({ text, href, className })) score += 8;
  if (isLikelyProductAnchor({ text, href, className })) score += 4;
  return score;
}

function cardScore(text = "", url = "") {
  const hay = String(text).toLowerCase();
  let score = 0;
  score += Math.min(10, countMatches(hay, /techwear|punk|goth|dark|cyberpunk|streetwear|jacket|hoodie|cargo|apparel|garment|clothing/g));
  score += Math.min(8, countMatches(hay, /oem|odm|manufacturer|factory|supplier|custom|private label|sample|low moq/g));
  if (hasPrice(text)) score += 3;
  if (hasMoq(text)) score += 3;
  if (/alibaba|made-in-china|1688/.test(url.toLowerCase())) score += 1;
  if (/contact|login|privacy|policy|help|terms|account|wishlist|cart|kitchen utensil|sink rack|home utility|household/i.test(hay)) score -= 8;
  if (text.length < 50) score -= 3;
  if (text.length > 2600) score -= 5;
  return score;
}

function findBestContainerForAnchor($, el) {
  const chain = [];
  let current = $(el);
  let depth = 0;
  while (current.length && depth < 8) {
    chain.push(current);
    const parent = current.parent();
    if (!parent.length || parent.is("body") || parent.is("html")) break;
    current = parent;
    depth += 1;
  }

  let best = $(el);
  let bestScore = -999;
  for (const $candidate of chain) {
    const score = containerStructureScore($, $candidate);
    if (score > bestScore) {
      bestScore = score;
      best = $candidate;
    }
  }
  return best;
}

function extractSupplierName($, $container) {
  const selectors = [
    "[class*='supplier']",
    "[class*='company']",
    "[class*='store']",
    "[class*='shop']",
    "[data-company]",
    "[data-supplier]"
  ];

  for (const selector of selectors) {
    const text = collapseWhitespace($container.find(selector).first().attr("data-company") || $container.find(selector).first().attr("data-supplier") || $container.find(selector).first().text());
    if (text && text.length >= 3 && text.length <= 120) return text;
  }

  const lines = $container
    .text()
    .split(/\n+/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);

  for (const line of lines) {
    if (line.length <= 120 && /manufacturer|factory|supplier|company|apparel|works|studio|garments|fashion|store|shop/i.test(line)) {
      return line;
    }
  }
  return "";
}

function pickBestAnchor($, $container, baseUrl, supplierName = "") {
  let best = null;
  const snippet = collapseWhitespace($container.text()).slice(0, 1800);

  $container.find("a[href]").each((_, el) => {
    const href = String($(el).attr("href") || "");
    if (shouldSkipHref(href)) return;
    const url = absoluteUrl(baseUrl, href);
    if (!url) return;
    const text = collapseWhitespace($(el).text()).slice(0, 180);
    const className = `${$(el).attr("class") || ""} ${$(el).parent().attr("class") || ""}`;
    let score = anchorScore(text, url, snippet, className);
    if (supplierName && text.toLowerCase() === supplierName.toLowerCase()) score += 6;
    const candidate = { url, text, score, className };
    if (!best || candidate.score > best.score) best = candidate;
  });

  return best || { url: "", text: "", score: -999, className: "" };
}

function isAncestorNode(ancestor, node) {
  let current = node?.parent || null;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent || null;
  }
  return false;
}

function pruneNestedContainers(containers) {
  return containers.filter(($container, idx) => {
    const node = $container.get(0);
    return !containers.some(($other, otherIdx) => otherIdx !== idx && isAncestorNode($container.get(0), $other.get(0)));
  });
}

function extractCandidateFromContainer($, $container, baseUrl, source = "card") {
  const snippet = collapseWhitespace($container.text()).slice(0, 1800);
  const effectiveSnippet = snippet || collapseWhitespace($container.find("a[href]").first().text()).slice(0, 240);
  if (!effectiveSnippet || effectiveSnippet.length < 6) return null;

  const supplierName = extractSupplierName($, $container);
  const bestAnchor = pickBestAnchor($, $container, baseUrl, supplierName);
  if (!bestAnchor.url) return null;

  const inferredTitle = inferLikelyTitle($, $container);
  let title = inferredTitle || bestAnchor.text || supplierName || bestAnchor.url;
  if (supplierName && inferredTitle && supplierName.toLowerCase() !== inferredTitle.toLowerCase()) {
    title = `${supplierName} — ${inferredTitle}`;
  } else if (!inferredTitle && supplierName) {
    title = supplierName;
  }

  const enrichedSnippet = [
    supplierName ? `Supplier: ${supplierName}` : "",
    effectiveSnippet
  ].filter(Boolean).join(" | ");

  const score = cardScore(`${title} ${enrichedSnippet}`, bestAnchor.url) + Math.max(0, bestAnchor.score) + containerStructureScore($, $container);
  if (score < 7) return null;

  return {
    url: bestAnchor.url,
    title: title.slice(0, 180),
    snippet: enrichedSnippet,
    score,
    source
  };
}

function dedupeCandidates(candidates, maxResults) {
  const seen = new Set();
  const final = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const key = candidate.url || `${candidate.title.toLowerCase()}::${candidate.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    final.push(candidate);
    if (final.length >= maxResults) break;
  }
  return final;
}

function extractRepeatedContainerCandidates(searchUrl, html, { maxResults = 40 } = {}) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const groups = new Map();
  $("article, li, div, section, tr").each((_, el) => {
    const $container = $(el);
    if (!$container.find("a[href]").length) return;
    const score = containerStructureScore($, $container);
    if (score < 8) return;
    const signature = containerSignature($container);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push($container);
  });

  const candidateContainers = [];
  for (const [, containers] of groups) {
    if (containers.length < 2) continue;
    const pruned = pruneNestedContainers(containers);
    if (pruned.length < 2) continue;
    candidateContainers.push(...pruned);
  }

  const candidates = candidateContainers
    .map(($container) => extractCandidateFromContainer($, $container, searchUrl, "repeated-card"))
    .filter(Boolean);

  return dedupeCandidates(candidates, maxResults);
}

function extractAnchorCandidates(searchUrl, html, { maxResults = 40 } = {}) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const candidates = [];
  const seen = new Set();

  $("a[href]").each((_, el) => {
    const href = String($(el).attr("href") || "");
    if (shouldSkipHref(href)) return;
    const url = absoluteUrl(searchUrl, href);
    if (!url || seen.has(url)) return;
    const $container = findBestContainerForAnchor($, el);
    const candidate = extractCandidateFromContainer($, $container, searchUrl, "anchor");
    if (candidate) {
      seen.add(candidate.url);
      candidates.push(candidate);
      return;
    }
    const fallbackText = collapseWhitespace($(el).text()).slice(0, 180);
    const fallbackScore = anchorScore(fallbackText, url, fallbackText, $(el).attr("class") || "") + cardScore(fallbackText, url);
    if (fallbackScore < 8) return;
    seen.add(url);
    candidates.push({ url, title: fallbackText || url, snippet: fallbackText, score: fallbackScore, source: "anchor-fallback" });
  });

  return dedupeCandidates(candidates, maxResults);
}

function safeJsonParse(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectJsonRoots(html) {
  const $ = cheerio.load(html);
  const roots = [];
  $("script").each((_, el) => {
    const scriptText = $(el).html() || "";
    const type = String($(el).attr("type") || "").toLowerCase();
    const direct = safeJsonParse(scriptText.trim());
    if (direct && (type.includes("json") || /^[\[{]/.test(scriptText.trim()))) {
      roots.push(direct);
    }

    const matches = [
      ...scriptText.matchAll(/=\s*(\{[\s\S]*\})\s*;?/g),
      ...scriptText.matchAll(/=\s*(\[[\s\S]*\])\s*;?/g)
    ];
    for (const match of matches.slice(0, 8)) {
      const parsed = safeJsonParse(match[1]);
      if (parsed) roots.push(parsed);
    }
  });
  return roots;
}

function objectScalarText(value, depth = 0) {
  if (depth > 2 || value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => objectScalarText(item, depth + 1)).slice(0, 60);
  if (typeof value === "object") {
    return Object.entries(value)
      .slice(0, 30)
      .flatMap(([, item]) => objectScalarText(item, depth + 1))
      .slice(0, 80);
  }
  return [];
}

function objectField(obj, keys = []) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && obj[key] !== "") {
      return obj[key];
    }
  }
  return "";
}

function candidateFromObject(searchUrl, obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const url = absoluteUrl(searchUrl, objectField(obj, ["url", "href", "link", "productUrl", "product_url", "detailUrl", "detail_url", "companyUrl", "company_url", "supplierUrl", "supplier_url"]));
  if (!url) return null;

  const supplierName = collapseWhitespace(objectField(obj, ["supplierName", "supplier_name", "companyName", "company_name", "storeName", "store_name", "manufacturer", "shopName", "shop_name"]));
  const productName = collapseWhitespace(objectField(obj, ["name", "title", "productTitle", "product_title", "subject"]));
  const title = [supplierName, productName].filter(Boolean).join(" — ") || productName || supplierName || url;
  const text = collapseWhitespace(objectScalarText(obj).join(" | ")).slice(0, 1800);
  const score = cardScore(`${title} ${text}`, url) + (supplierName ? 6 : 0) + (productName ? 4 : 0);
  if (score < 6) return null;
  return {
    url,
    title: title.slice(0, 180),
    snippet: text,
    score,
    source: "json-embedded"
  };
}

function collectObjectCandidates(searchUrl, node, out = [], seen = new WeakSet()) {
  if (!node || typeof node !== "object") return out;
  if (seen.has(node)) return out;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) collectObjectCandidates(searchUrl, item, out, seen);
    return out;
  }

  const candidate = candidateFromObject(searchUrl, node);
  if (candidate) out.push(candidate);

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectObjectCandidates(searchUrl, value, out, seen);
  }
  return out;
}

function extractEmbeddedJsonCandidates(searchUrl, html, { maxResults = 40 } = {}) {
  const roots = collectJsonRoots(html);
  const candidates = [];
  for (const root of roots) collectObjectCandidates(searchUrl, root, candidates);
  return dedupeCandidates(candidates, maxResults);
}

function extractSearchCandidates(searchUrl, html, { maxResults = 40 } = {}) {
  const repeated = extractRepeatedContainerCandidates(searchUrl, html, { maxResults });
  const jsonCandidates = extractEmbeddedJsonCandidates(searchUrl, html, { maxResults });
  const anchors = extractAnchorCandidates(searchUrl, html, { maxResults });
  return dedupeCandidates([...repeated, ...jsonCandidates, ...anchors], maxResults);
}

export async function fetchResponse(url, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 SupplierConsoleBatch/6BuildDK",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHtml(url, { timeoutMs = 20000 } = {}) {
  const response = await fetchResponse(url, { timeoutMs });
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  return await response.text();
}

export function parseDocumentText(html, url, { maxChars = 9000 } = {}) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const title = collapseWhitespace($("title").first().text()) || url;
  const metaDescription = collapseWhitespace(
    $("meta[name='description']").attr("content") ||
    $("meta[property='og:description']").attr("content") ||
    ""
  );

  const headings = [...$("h1, h2, h3").map((_, el) => collapseWhitespace($(el).text())).get()]
    .filter(Boolean)
    .slice(0, 25);
  const bodyText = collapseWhitespace($("body").text()).slice(0, maxChars);

  return {
    title,
    rawText: [metaDescription, ...headings, bodyText].filter(Boolean).join("\n\n").slice(0, maxChars),
    htmlPreview: html.slice(0, Math.min(html.length, 12000))
  };
}

function nowIso() {
  return new Date().toISOString();
}

function makeLead({ title, url, sourceSearchUrl = "", rawText = "", htmlPreview = "", snippet = "" }) {
  return {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "new",
    title,
    url,
    sourceSearchUrl,
    rawText,
    htmlPreview,
    snippet,
    contactEmail: "",
    extracted: null,
    drafts: null,
    notes: ""
  };
}

export async function inspectUrl(url, { timeoutMs = 20000, maxResults = 15 } = {}) {
  const response = await fetchResponse(url, { timeoutMs });
  const status = response.status;
  const finalUrl = response.url;
  const contentType = response.headers.get("content-type") || "";
  const html = await response.text();
  const parsed = parseDocumentText(html, finalUrl || url, { maxChars: 4000 });
  const candidates = contentType.includes("html") ? extractSearchCandidates(finalUrl || url, html, { maxResults }) : [];
  return {
    ok: response.ok,
    status,
    finalUrl,
    contentType,
    title: parsed.title,
    textPreview: parsed.rawText.slice(0, 1000),
    candidateCount: candidates.length,
    candidates: candidates.slice(0, maxResults).map((c) => ({
      title: c.title,
      url: c.url,
      score: c.score,
      source: c.source,
      snippet: c.snippet.slice(0, 220)
    }))
  };
}

export async function captureFromUrl(url, { timeoutMs = 20000, maxChars = 9000 } = {}) {
  const html = await fetchHtml(url, { timeoutMs });
  return parseDocumentText(html, url, { maxChars });
}

export function captureFromText(title, rawText) {
  return {
    title: collapseWhitespace(title) || "Manual lead",
    rawText: collapseWhitespace(rawText),
    htmlPreview: ""
  };
}

export async function scanSearchPage(searchUrl, { timeoutMs = 20000, maxResults = 40 } = {}) {
  const html = await fetchHtml(searchUrl, { timeoutMs });
  const candidates = extractSearchCandidates(searchUrl, html, { maxResults });

  return candidates.map((candidate) => makeLead({
    title: candidate.title,
    url: candidate.url,
    sourceSearchUrl: searchUrl,
    rawText: `${candidate.title}\n\n${candidate.snippet}`.slice(0, 9000),
    htmlPreview: html.slice(0, 12000),
    snippet: candidate.snippet
  }));
}

export function scanSearchHtml(html, { baseUrl = "https://example.com/", maxResults = 40 } = {}) {
  const candidates = extractSearchCandidates(baseUrl, html, { maxResults });
  return candidates.map((candidate) => makeLead({
    title: candidate.title,
    url: candidate.url,
    sourceSearchUrl: baseUrl,
    rawText: `${candidate.title}\n\n${candidate.snippet}`.slice(0, 9000),
    htmlPreview: html.slice(0, 12000),
    snippet: candidate.snippet
  }));
}

export async function captureManyUrls(urls, { timeoutMs = 20000, maxChars = 9000 } = {}) {
  const leads = [];
  for (const url of urls) {
    const clean = String(url || "").trim();
    if (!clean) continue;
    try {
      const captured = await captureFromUrl(clean, { timeoutMs, maxChars });
      leads.push(makeLead({
        title: captured.title,
        url: clean,
        rawText: captured.rawText,
        htmlPreview: captured.htmlPreview
      }));
    } catch (error) {
      leads.push(makeLead({
        title: clean,
        url: clean,
        rawText: `Capture failed: ${error.message}`,
        htmlPreview: ""
      }));
    }
  }
  return leads;
}
