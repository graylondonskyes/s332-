import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { buildBatchDraftPrompt, buildBatchExtractionPrompt } from "./prompts.mjs";
import { DraftBatchSchema, LeadBatchExtractionSchema } from "./schemas.mjs";

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function inferFocus(text = "") {
  const hay = String(text).toLowerCase();
  if (/jacket/.test(hay)) return "jackets and outerwear";
  if (/hoodie/.test(hay)) return "hoodies and tops";
  if (/pants|cargo/.test(hay)) return "pants and utility bottoms";
  return "dark streetwear and techwear apparel";
}

function inferPrice(text = "") {
  const match = String(text).match(/\$\s?\d+(?:\.\d+)?(?:\s*[-–to]+\s*\$?\d+(?:\.\d+)?)?/i);
  return match ? match[0].replace(/\s+/g, " ") : "not clearly shown";
}

function inferMoq(text = "") {
  const match = String(text).match(/MOQ[^\n\r]{0,50}|min(?:imum)? order[^\n\r]{0,50}|\b\d+\s*(pcs|pieces|units)\b/i);
  return match ? match[0].trim() : "not clearly shown";
}

function fitScore(text = "") {
  const hay = String(text).toLowerCase();
  let score = 40;
  if (/techwear|punk|goth|dark|cyberpunk|streetwear/.test(hay)) score += 20;
  if (/oem|odm|custom|private label|manufacturer|factory/.test(hay)) score += 20;
  if (/sample|small order|low moq|1 piece|2 pieces/.test(hay)) score += 10;
  if (/women lingerie|kids toy|kitchen/.test(hay)) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function mockExtract(leads) {
  return leads.map((lead) => {
    const text = `${lead.title}\n${lead.rawText}`;
    const score = fitScore(text);
    return {
      lead_id: lead.id,
      supplier_name: lead.title || "Unknown supplier",
      company_type: /manufacturer|factory/i.test(text) ? "manufacturer" : "supplier",
      product_focus: inferFocus(text),
      visible_moq: inferMoq(text),
      visible_price_range: inferPrice(text),
      unit_quote_possible: /low moq|sample|custom|oem|odm|manufacturer/i.test(text) ? "likely" : "possible",
      oem_odm_signals: ["Captured listing text reviewed"],
      style_fit: score >= 75 ? "strong" : score >= 60 ? "moderate" : score >= 40 ? "weak" : "bad_fit",
      warehouse_fit: score >= 70 ? "strong" : score >= 55 ? "moderate" : score >= 40 ? "weak" : "bad_fit",
      storefront_fit: score >= 65 ? "strong" : score >= 50 ? "moderate" : score >= 40 ? "weak" : "bad_fit",
      risk_flags: /not clearly shown/i.test(inferMoq(text)) ? ["MOQ not clearly shown"] : [],
      contact_email: "",
      reason_to_contact: score >= 60
        ? "Strong enough style and supplier signals for partnership outreach."
        : "Needs manual review before outreach.",
      concise_summary: `Scanned lead for ${inferFocus(text)} with score ${score}.`,
      fit_score: score,
      confidence: 72
    };
  });
}

function mockDraft(leads) {
  return leads.map((lead) => {
    const supplier = lead.extracted?.supplier_name || lead.title || "your company";
    const focus = lead.extracted?.product_focus || "dark streetwear";
    return {
      lead_id: lead.id,
      alibaba_opener: `Hello, I am reaching out because your ${focus} offer looks aligned with what we are building for the U.S. market. We are looking for a direct partnership and need a per-unit quote plus per-unit shipping to the United States, even if your listing normally uses MOQ pricing.`,
      email_subject: `Partnership inquiry for ${supplier}`,
      email_body: `Hello,\n\nI am reaching out because your ${focus} products look like a fit for our U.S. partnership lane. We are not approaching you as a normal bulk buyer. We are opening a new marketplace and distribution channel and need a per-unit quote plus per-unit shipping to the United States, even if your listing is built around MOQ pricing.\n\nIf your company is open to that structure, send your per-unit quote, shipping estimate, and your best qualifying products for this style lane.\n\nThank you.`,
      followup_1: `Following up on my earlier message. If your team can provide a per-unit quote plus per-unit shipping to the United States, I can review your products quickly for partnership fit.`,
      moq_reply: `Understood on MOQ. For our review process, we still need your per-unit quote plus the per-unit shipping cost to the United States so we can evaluate the partnership correctly.`,
      short_reason: `Drafted from captured supplier text for ${focus}.`
    };
  });
}

export async function extractLeadsInBatch(promptProfile, leads) {
  if (process.env.OPENAI_MOCK === "1") {
    return mockExtract(leads);
  }
  const client = getClient();
  const chunks = chunkArray(leads, 8);
  const results = [];
  for (const chunk of chunks) {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      input: [{ role: "user", content: buildBatchExtractionPrompt(promptProfile, chunk) }],
      text: { format: zodTextFormat(LeadBatchExtractionSchema, "lead_batch_extraction") }
    });
    if (response.output_parsed?.results) results.push(...response.output_parsed.results);
  }
  return results;
}

export async function draftLeadsInBatch(promptProfile, leads) {
  if (process.env.OPENAI_MOCK === "1") {
    return mockDraft(leads);
  }
  const client = getClient();
  const chunks = chunkArray(leads, 6);
  const results = [];
  for (const chunk of chunks) {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      input: [{ role: "user", content: buildBatchDraftPrompt(promptProfile, chunk) }],
      text: { format: zodTextFormat(DraftBatchSchema, "lead_batch_drafts") }
    });
    if (response.output_parsed?.results) results.push(...response.output_parsed.results);
  }
  return results;
}
