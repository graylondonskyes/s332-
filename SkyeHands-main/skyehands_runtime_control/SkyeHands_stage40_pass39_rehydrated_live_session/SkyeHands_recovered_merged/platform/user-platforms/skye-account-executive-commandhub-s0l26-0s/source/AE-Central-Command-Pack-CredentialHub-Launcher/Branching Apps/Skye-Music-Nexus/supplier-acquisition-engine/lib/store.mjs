import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "..", "data", "db.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ promptProfile: "", leads: [] }, null, 2), "utf8");
  }
}

function normaliseUrl(url = "") {
  return String(url || "").trim().replace(/\/$/, "");
}

export function resetDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify({ promptProfile: "", leads: [] }, null, 2), "utf8");
}

export function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

export function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  return db;
}

export function getDefaultPromptProfile() {
  return [
    "You are the outreach intelligence layer for a private internal supplier acquisition app.",
    "Business context:",
    "- We are sourcing techwear, dark streetwear, punk-adjacent, cyberpunk, gothic, distressed, utility, and edgy fashion suppliers.",
    "- We are not acting like a normal buyer. We are opening business partnership channels.",
    "- We require a per-unit quote plus per-unit shipping to the United States even when the listing shows MOQ pricing only.",
    "- Public product listing markup is handled on our side at 31 percent. Do not mention the percentage in outreach.",
    "- Our company can offer a U.S. marketplace lane, free launch/editorial support, optional warehousing in Phoenix, Houston, Chicago, Denver, New York, and Albuquerque, and optional storefront or display expansion later.",
    "- Customer support is handled on our side.",
    "- Tone must be direct, transparent, commercially serious, founder-led, and respectful.",
    "- Do not invent contact names, capabilities, credentials, pricing, or promises not grounded in the captured source.",
    "- If a supplier looks like a poor fit, say so clearly."
  ].join("\n");
}

export function getPromptProfile() {
  const db = readDb();
  return db.promptProfile || getDefaultPromptProfile();
}

export function setPromptProfile(promptProfile) {
  const db = readDb();
  db.promptProfile = String(promptProfile || "").trim() || getDefaultPromptProfile();
  writeDb(db);
  return db.promptProfile;
}

export function listLeads() {
  const db = readDb();
  return [...db.leads].sort((a, b) => {
    const scoreA = Number(a?.extracted?.fit_score || -1);
    const scoreB = Number(b?.extracted?.fit_score || -1);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
}

export function getLead(id) {
  const db = readDb();
  return db.leads.find((lead) => lead.id === id) || null;
}

export function findExistingLead(db, lead) {
  const url = normaliseUrl(lead.url);
  if (url) {
    const existingByUrl = db.leads.find((item) => normaliseUrl(item.url) === url);
    if (existingByUrl) return existingByUrl;
  }
  const title = String(lead.title || "").trim().toLowerCase();
  if (title) {
    const existingByTitle = db.leads.find((item) => String(item.title || "").trim().toLowerCase() === title);
    if (existingByTitle) return existingByTitle;
  }
  return null;
}

export function saveLead(lead) {
  const db = readDb();
  const existing = findExistingLead(db, lead);
  if (existing) {
    const i = db.leads.findIndex((x) => x.id === existing.id);
    db.leads[i] = {
      ...existing,
      ...lead,
      id: existing.id,
      createdAt: existing.createdAt || lead.createdAt,
      updatedAt: new Date().toISOString(),
      notes: typeof lead.notes === "string" ? lead.notes : existing.notes || "",
      contactEmail: lead.contactEmail || existing.contactEmail || "",
      extracted: lead.extracted ?? existing.extracted ?? null,
      drafts: lead.drafts ?? existing.drafts ?? null
    };
    writeDb(db);
    return db.leads[i];
  }
  db.leads.push(lead);
  writeDb(db);
  return lead;
}

export function saveManyLeads(leads) {
  return leads.map((lead) => saveLead(lead));
}

export function updateLead(id, mutator) {
  const db = readDb();
  const i = db.leads.findIndex((x) => x.id === id);
  if (i === -1) return null;
  const next = mutator(structuredClone(db.leads[i]));
  next.updatedAt = new Date().toISOString();
  db.leads[i] = next;
  writeDb(db);
  return next;
}

export function updateManyLeads(ids, mutator) {
  const db = readDb();
  const set = new Set(ids);
  const updated = [];
  db.leads = db.leads.map((lead) => {
    if (!set.has(lead.id)) return lead;
    const next = mutator(structuredClone(lead));
    next.updatedAt = new Date().toISOString();
    updated.push(next);
    return next;
  });
  writeDb(db);
  return updated;
}

export function getNextLeadForOutreach() {
  const leads = listLeads().filter((lead) => lead.status === "draft_ready");
  return leads[0] || null;
}

export function leadStats() {
  const leads = listLeads();
  const stats = {
    total: leads.length,
    new: 0,
    reviewed: 0,
    draft_ready: 0,
    contacted: 0,
    replied: 0,
    rejected: 0,
    accepted: 0,
    withDrafts: 0,
    withEmails: 0
  };
  for (const lead of leads) {
    if (stats[lead.status] !== undefined) stats[lead.status] += 1;
    if (lead.drafts) stats.withDrafts += 1;
    if (lead.contactEmail || lead?.extracted?.contact_email) stats.withEmails += 1;
  }
  return stats;
}

export function escapeCsv(value) {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

export function buildCsv() {
  const headers = [
    "id","status","createdAt","updatedAt","title","url","sourceSearchUrl","contactEmail",
    "supplierName","companyType","productFocus","visibleMoq","visiblePriceRange","fitScore",
    "styleFit","warehouseFit","storefrontFit","unitQuotePossible","reasonToContact",
    "alibabaOpener","emailSubject","emailBody","followup1","moqReply","notes"
  ];
  const rows = listLeads().map((lead) => {
    const ex = lead.extracted || {};
    const dr = lead.drafts || {};
    return [
      lead.id, lead.status, lead.createdAt, lead.updatedAt, lead.title, lead.url,
      lead.sourceSearchUrl, lead.contactEmail || ex.contact_email || "",
      ex.supplier_name, ex.company_type, ex.product_focus, ex.visible_moq, ex.visible_price_range,
      ex.fit_score, ex.style_fit, ex.warehouse_fit, ex.storefront_fit, ex.unit_quote_possible,
      ex.reason_to_contact, dr.alibaba_opener, dr.email_subject, dr.email_body, dr.followup_1, dr.moq_reply, lead.notes
    ].map(escapeCsv).join(",");
  });
  return [headers.map(escapeCsv).join(","), ...rows].join("\n");
}
