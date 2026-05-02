import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import {
  captureFromText,
  captureManyUrls,
  captureFromUrl,
  inspectUrl,
  scanSearchHtml,
  scanSearchPage
} from "./lib/capture.mjs";
import { draftLeadsInBatch, extractLeadsInBatch } from "./lib/openai-client.mjs";
import {
  buildCsv,
  getLead,
  getNextLeadForOutreach,
  getPromptProfile,
  leadStats,
  listLeads,
  saveLead,
  saveManyLeads,
  setPromptProfile,
  updateLead,
  updateManyLeads
} from "./lib/store.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_STATUS = ["new", "reviewed", "draft_ready", "contacted", "replied", "rejected", "accepted"];

function normaliseUrlList(input = "") {
  return String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildLead({ title = "", url = "", rawText = "", htmlPreview = "", sourceSearchUrl = "", snippet = "" }) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    notes: "",
    lastOutreachAt: "",
    outreachChannel: ""
  };
}

function statusTransitionForExtraction(current) {
  return current === "new" ? "reviewed" : current;
}

function statusTransitionForDrafts(current) {
  if (current === "new" || current === "reviewed") return "draft_ready";
  return current;
}

async function runExtractionAndDrafting(promptProfile, leads, minFitScore = 55) {
  const extracted = await extractLeadsInBatch(promptProfile, leads);
  const extractedMap = new Map(extracted.map((item) => [item.lead_id, item]));

  const extractedLeads = [];
  for (const lead of leads) {
    const result = extractedMap.get(lead.id);
    if (!result) continue;
    const updated = updateLead(lead.id, (current) => ({
      ...current,
      extracted: result,
      contactEmail: current.contactEmail || result.contact_email || "",
      status: statusTransitionForExtraction(current.status)
    }));
    if (updated) extractedLeads.push(updated);
  }

  const draftable = extractedLeads.filter((lead) => Number(lead?.extracted?.fit_score || 0) >= Number(minFitScore));
  const drafts = draftable.length ? await draftLeadsInBatch(promptProfile, draftable) : [];
  const draftMap = new Map(drafts.map((item) => [item.lead_id, item]));

  const draftedLeads = [];
  for (const lead of draftable) {
    const result = draftMap.get(lead.id);
    if (!result) continue;
    const updated = updateLead(lead.id, (current) => ({
      ...current,
      drafts: result,
      status: statusTransitionForDrafts(current.status)
    }));
    if (updated) draftedLeads.push(updated);
  }

  return {
    extractedCount: extractedLeads.length,
    draftedCount: draftedLeads.length,
    leads: listLeads()
  };
}

export function createApp() {
  const app = express();
  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
  const maxChars = Number(process.env.MAX_CAPTURE_CHARS || 9000);
  const maxResults = Number(process.env.MAX_SCAN_RESULTS || 40);

  app.use(cors());
  app.use(express.json({ limit: "6mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_MOCK === "1"),
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      stats: leadStats()
    });
  });

  app.get("/api/prompt", (_req, res) => {
    res.json({ promptProfile: getPromptProfile() });
  });

  app.put("/api/prompt", (req, res) => {
    const promptProfile = String(req.body?.promptProfile || "").trim();
    if (!promptProfile) return res.status(400).json({ error: "promptProfile is required." });
    res.json({ promptProfile: setPromptProfile(promptProfile) });
  });

  app.get("/api/leads", (req, res) => {
    const status = String(req.query?.status || "").trim();
    const leads = listLeads().filter((lead) => !status || lead.status === status);
    res.json({ leads, stats: leadStats() });
  });

  app.get("/api/leads/next-draft-ready", (_req, res) => {
    const lead = getNextLeadForOutreach();
    res.json({ lead });
  });

  app.get("/api/leads/:id", (req, res) => {
    const lead = getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    res.json({ lead });
  });

  app.patch("/api/leads/:id", (req, res) => {
    const updated = updateLead(req.params.id, (current) => {
      const next = { ...current };
      if (typeof req.body?.status === "string" && ALLOWED_STATUS.includes(req.body.status)) next.status = req.body.status;
      if (typeof req.body?.notes === "string") next.notes = req.body.notes;
      if (typeof req.body?.contactEmail === "string") next.contactEmail = req.body.contactEmail.trim();
      return next;
    });
    if (!updated) return res.status(404).json({ error: "Lead not found." });
    res.json({ lead: updated, stats: leadStats() });
  });

  app.post("/api/leads/mark-contacted", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const channel = String(req.body?.channel || "manual").trim() || "manual";
    if (!ids.length) return res.status(400).json({ error: "ids are required." });
    const updated = updateManyLeads(ids, (current) => ({
      ...current,
      status: "contacted",
      outreachChannel: channel,
      lastOutreachAt: new Date().toISOString()
    }));
    res.json({ updatedCount: updated.length, leads: updated, stats: leadStats() });
  });

  app.post("/api/capture/manual", async (req, res) => {
    try {
      const title = String(req.body?.title || "").trim();
      const url = String(req.body?.url || "").trim();
      const rawText = String(req.body?.rawText || "").trim();
      if (!url && !rawText) return res.status(400).json({ error: "Provide a URL or rawText." });
      const captured = url ? await captureFromUrl(url, { timeoutMs, maxChars }) : captureFromText(title, rawText);
      const lead = buildLead({
        title: title || captured.title,
        url,
        rawText: captured.rawText,
        htmlPreview: captured.htmlPreview,
        sourceSearchUrl: ""
      });
      const saved = saveLead(lead);
      res.status(201).json({ lead: saved, stats: leadStats() });
    } catch (error) {
      res.status(500).json({ error: error.message || "Manual capture failed." });
    }
  });

  app.post("/api/scan/search", async (req, res) => {
    try {
      const searchUrl = String(req.body?.searchUrl || "").trim();
      if (!searchUrl) return res.status(400).json({ error: "searchUrl is required." });
      const leads = await scanSearchPage(searchUrl, { timeoutMs, maxChars, maxResults });
      const saved = saveManyLeads(leads);
      res.status(201).json({ created: saved.length, leads: saved, stats: leadStats() });
    } catch (error) {
      res.status(500).json({ error: error.message || "Search scan failed." });
    }
  });

  app.post("/api/scan/search-html", async (req, res) => {
    try {
      const html = String(req.body?.html || "").trim();
      const baseUrl = String(req.body?.baseUrl || "https://example.com/").trim() || "https://example.com/";
      if (!html) return res.status(400).json({ error: "html is required." });
      const leads = scanSearchHtml(html, { baseUrl, maxResults });
      const saved = saveManyLeads(leads);
      res.status(201).json({ created: saved.length, leads: saved, stats: leadStats() });
    } catch (error) {
      res.status(500).json({ error: error.message || "Search HTML scan failed." });
    }
  });

  app.post("/api/scan/urls", async (req, res) => {
    try {
      const urls = normaliseUrlList(req.body?.urlsText || "");
      if (!urls.length) return res.status(400).json({ error: "urlsText is required." });
      const leads = await captureManyUrls(urls, { timeoutMs, maxChars });
      const saved = saveManyLeads(leads);
      res.status(201).json({ created: saved.length, leads: saved, stats: leadStats() });
    } catch (error) {
      res.status(500).json({ error: error.message || "URL import failed." });
    }
  });

  app.post("/api/diagnostics/url", async (req, res) => {
    try {
      const targetUrl = String(req.body?.url || "").trim();
      if (!targetUrl) return res.status(400).json({ error: "url is required." });
      const report = await inspectUrl(targetUrl, { timeoutMs, maxResults: 12 });
      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: error.message || "URL diagnostics failed." });
    }
  });

  app.post("/api/batch/extract", async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const leads = ids.length ? listLeads().filter((lead) => ids.includes(lead.id)) : listLeads();
      if (!leads.length) return res.status(400).json({ error: "No leads available for extraction." });
      const promptProfile = getPromptProfile();
      const extracted = await extractLeadsInBatch(promptProfile, leads);
      const resultMap = new Map(extracted.map((item) => [item.lead_id, item]));
      const updated = [];
      for (const lead of leads) {
        const result = resultMap.get(lead.id);
        if (!result) continue;
        const next = updateLead(lead.id, (current) => ({
          ...current,
          extracted: result,
          contactEmail: current.contactEmail || result.contact_email || "",
          status: statusTransitionForExtraction(current.status)
        }));
        if (next) updated.push(next);
      }
      res.json({ updatedCount: updated.length, leads: updated, stats: leadStats() });
    } catch (error) {
      const status = /OPENAI_API_KEY/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: error.message || "Batch extraction failed." });
    }
  });

  app.post("/api/batch/draft", async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const minFitScore = Number(req.body?.minFitScore ?? 55);
      const base = ids.length ? listLeads().filter((lead) => ids.includes(lead.id)) : listLeads();
      const leads = base.filter((lead) => lead.extracted && Number(lead.extracted.fit_score || 0) >= minFitScore);
      if (!leads.length) return res.status(400).json({ error: "No extracted leads met the draft threshold." });
      const results = await draftLeadsInBatch(getPromptProfile(), leads);
      const resultMap = new Map(results.map((item) => [item.lead_id, item]));
      const updated = [];
      for (const lead of leads) {
        const drafts = resultMap.get(lead.id);
        if (!drafts) continue;
        const next = updateLead(lead.id, (current) => ({
          ...current,
          drafts,
          status: statusTransitionForDrafts(current.status)
        }));
        if (next) updated.push(next);
      }
      res.json({ updatedCount: updated.length, leads: updated, stats: leadStats() });
    } catch (error) {
      const status = /OPENAI_API_KEY/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: error.message || "Batch draft generation failed." });
    }
  });

  app.post("/api/pipeline/search", async (req, res) => {
    try {
      const searchUrl = String(req.body?.searchUrl || "").trim();
      const minFitScore = Number(req.body?.minFitScore ?? 55);
      if (!searchUrl) return res.status(400).json({ error: "searchUrl is required." });
      const scanned = await scanSearchPage(searchUrl, { timeoutMs, maxChars, maxResults });
      const saved = saveManyLeads(scanned);
      const pipeline = await runExtractionAndDrafting(getPromptProfile(), saved, minFitScore);
      res.status(201).json({
        created: saved.length,
        extractedCount: pipeline.extractedCount,
        draftedCount: pipeline.draftedCount,
        leads: pipeline.leads,
        stats: leadStats()
      });
    } catch (error) {
      const status = /OPENAI_API_KEY/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: error.message || "Search pipeline failed." });
    }
  });

  app.post("/api/pipeline/search-html", async (req, res) => {
    try {
      const html = String(req.body?.html || "").trim();
      const baseUrl = String(req.body?.baseUrl || "https://example.com/").trim() || "https://example.com/";
      const minFitScore = Number(req.body?.minFitScore ?? 55);
      if (!html) return res.status(400).json({ error: "html is required." });
      const scanned = scanSearchHtml(html, { baseUrl, maxResults });
      const saved = saveManyLeads(scanned);
      const pipeline = await runExtractionAndDrafting(getPromptProfile(), saved, minFitScore);
      res.status(201).json({
        created: saved.length,
        extractedCount: pipeline.extractedCount,
        draftedCount: pipeline.draftedCount,
        leads: pipeline.leads,
        stats: leadStats()
      });
    } catch (error) {
      const status = /OPENAI_API_KEY/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: error.message || "Search HTML pipeline failed." });
    }
  });

  app.post("/api/pipeline/urls", async (req, res) => {
    try {
      const urls = normaliseUrlList(req.body?.urlsText || "");
      const minFitScore = Number(req.body?.minFitScore ?? 55);
      if (!urls.length) return res.status(400).json({ error: "urlsText is required." });
      const scanned = await captureManyUrls(urls, { timeoutMs, maxChars });
      const saved = saveManyLeads(scanned);
      const pipeline = await runExtractionAndDrafting(getPromptProfile(), saved, minFitScore);
      res.status(201).json({
        created: saved.length,
        extractedCount: pipeline.extractedCount,
        draftedCount: pipeline.draftedCount,
        leads: pipeline.leads,
        stats: leadStats()
      });
    } catch (error) {
      const status = /OPENAI_API_KEY/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: error.message || "URL pipeline failed." });
    }
  });

  app.get("/api/export.csv", (_req, res) => {
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="supplier-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(buildCsv());
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  return app;
}

const shouldStart = process.argv[1] === __filename;
if (shouldStart) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Supplier acquisition engine running at http://localhost:${port}`);
  });
}
