import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const storePath = path.join(root, "runtime", "store.json");
const indexPath = path.join(root, "index.html");

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function createEntryId() {
  return `spc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultStore() {
  return {
    worksheet: {
      business: "",
      period: "",
      revenue: 0,
      expenses: 0,
      reconciled: 0,
      outstanding: 0,
      notes: "",
      savedAt: null
    },
    ledger: [],
    updatedAt: null
  };
}

function normalizeWorksheet(input = {}) {
  return {
    business: typeof input.business === "string" ? input.business : "",
    period: typeof input.period === "string" ? input.period : "",
    revenue: Number.isFinite(Number(input.revenue)) ? Number(input.revenue) : 0,
    expenses: Number.isFinite(Number(input.expenses)) ? Number(input.expenses) : 0,
    reconciled: Number.isFinite(Number(input.reconciled)) ? Number(input.reconciled) : 0,
    outstanding: Number.isFinite(Number(input.outstanding)) ? Number(input.outstanding) : 0,
    notes: typeof input.notes === "string" ? input.notes : "",
    savedAt: typeof input.savedAt === "string" && input.savedAt ? input.savedAt : new Date().toISOString()
  };
}

function normalizeEntry(entry = {}) {
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createEntryId(),
    type: typeof entry.type === "string" && entry.type ? entry.type : "invoice",
    date: typeof entry.date === "string" && entry.date ? entry.date : todayValue(),
    party: typeof entry.party === "string" ? entry.party : "",
    reference: typeof entry.reference === "string" ? entry.reference : "",
    category: typeof entry.category === "string" ? entry.category : "",
    amount: Number.isFinite(Number(entry.amount)) ? Number(entry.amount) : 0,
    status: typeof entry.status === "string" && entry.status ? entry.status : "open",
    matchRef: typeof entry.matchRef === "string" ? entry.matchRef : "",
    notes: typeof entry.notes === "string" ? entry.notes : "",
    createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString()
  };
}

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function loadStore() {
  ensureStoreDir();
  if (!fs.existsSync(storePath)) {
    const initial = defaultStore();
    fs.writeFileSync(storePath, `${JSON.stringify(initial, null, 2)}\n`);
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return {
      worksheet: normalizeWorksheet(parsed.worksheet || {}),
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger.map(normalizeEntry) : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    const reset = defaultStore();
    fs.writeFileSync(storePath, `${JSON.stringify(reset, null, 2)}\n`);
    return reset;
  }
}

function saveStore(store) {
  ensureStoreDir();
  const next = {
    worksheet: normalizeWorksheet(store.worksheet),
    ledger: Array.isArray(store.ledger) ? store.ledger.map(normalizeEntry) : [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(storePath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function text(res, status, payload, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function computeLedgerMetrics(entries) {
  const metrics = {
    invoiceTotal: 0,
    cashIn: 0,
    expenses: 0,
    cashProfit: 0,
    openInvoices: 0,
    unreconciledDeposits: 0,
    collectionRate: 0,
    auditFlags: []
  };
  const invoiceRefs = new Set();
  const depositRefs = new Set();

  for (const entry of entries) {
    if (entry.type === "invoice") {
      metrics.invoiceTotal += entry.amount;
      invoiceRefs.add(entry.reference);
      if (!["paid", "reconciled"].includes(entry.status)) metrics.openInvoices += entry.amount;
    }
    if (entry.type === "payment") {
      metrics.cashIn += entry.amount;
      if (!entry.matchRef) metrics.auditFlags.push(`Payment ${entry.reference || entry.id} is missing a matched invoice reference.`);
    }
    if (entry.type === "deposit") {
      depositRefs.add(entry.reference);
      metrics.cashIn += entry.amount;
      if (entry.status !== "reconciled" && !entry.matchRef) {
        metrics.unreconciledDeposits += entry.amount;
        metrics.auditFlags.push(`Deposit ${entry.reference || entry.id} is not reconciled.`);
      }
    }
    if (entry.type === "expense") metrics.expenses += entry.amount;
  }

  metrics.cashProfit = metrics.cashIn - metrics.expenses;
  metrics.collectionRate = metrics.invoiceTotal > 0 ? (metrics.cashIn / metrics.invoiceTotal) * 100 : 0;

  if (metrics.invoiceTotal > 0 && metrics.cashIn === 0) {
    metrics.auditFlags.push("Invoices exist but no cash-in entries are recorded.");
  }
  if (metrics.cashIn > 0 && metrics.expenses === 0) {
    metrics.auditFlags.push("Cash-in is recorded without any expenses; margin may be overstated.");
  }
  for (const entry of entries) {
    if (entry.matchRef && !invoiceRefs.has(entry.matchRef) && !depositRefs.has(entry.matchRef)) {
      metrics.auditFlags.push(`Match reference ${entry.matchRef} does not correspond to another local ledger reference.`);
    }
  }

  return metrics;
}

function serveIndex(res) {
  text(res, 200, fs.readFileSync(indexPath, "utf8"), "text/html; charset=utf-8");
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      serveIndex(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      const store = loadStore();
      json(res, 200, {
        ok: true,
        app: "Skye Profit Console",
        mode: "local-runtime",
        ledger_entries: store.ledger.length,
        updated_at: store.updatedAt
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/runtime-info") {
      json(res, 200, {
        ok: true,
        mode: "local-runtime",
        store_path: path.relative(root, storePath),
        capabilities: ["worksheet", "ledger", "metrics", "reset"]
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/worksheet") {
      const store = loadStore();
      json(res, 200, { ok: true, worksheet: store.worksheet, updated_at: store.updatedAt });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/worksheet") {
      const body = await readBody(req).catch(() => null);
      if (!body) {
        json(res, 400, { ok: false, error: "invalid_json" });
        return;
      }
      const store = loadStore();
      store.worksheet = normalizeWorksheet(body.worksheet || body);
      const saved = saveStore(store);
      json(res, 200, { ok: true, worksheet: saved.worksheet, updated_at: saved.updatedAt });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ledger") {
      const store = loadStore();
      json(res, 200, {
        ok: true,
        ledger: store.ledger,
        metrics: computeLedgerMetrics(store.ledger),
        updated_at: store.updatedAt
      });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/ledger") {
      const body = await readBody(req).catch(() => null);
      if (!body) {
        json(res, 400, { ok: false, error: "invalid_json" });
        return;
      }
      const nextLedger = Array.isArray(body.ledger) ? body.ledger.map(normalizeEntry) : null;
      if (!nextLedger) {
        json(res, 400, { ok: false, error: "invalid_ledger" });
        return;
      }
      const store = loadStore();
      store.ledger = nextLedger;
      const saved = saveStore(store);
      json(res, 200, {
        ok: true,
        ledger: saved.ledger,
        metrics: computeLedgerMetrics(saved.ledger),
        updated_at: saved.updatedAt
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ledger") {
      const body = await readBody(req).catch(() => null);
      if (!body) {
        json(res, 400, { ok: false, error: "invalid_json" });
        return;
      }
      const store = loadStore();
      const entry = normalizeEntry(body.entry || body);
      if (!(entry.amount > 0)) {
        json(res, 400, { ok: false, error: "invalid_amount" });
        return;
      }
      store.ledger.push(entry);
      const saved = saveStore(store);
      json(res, 201, {
        ok: true,
        entry,
        ledger: saved.ledger,
        metrics: computeLedgerMetrics(saved.ledger),
        updated_at: saved.updatedAt
      });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/ledger/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/ledger/".length));
      const store = loadStore();
      const nextLedger = store.ledger.filter((entry) => entry.id !== id);
      if (nextLedger.length === store.ledger.length) {
        json(res, 404, { ok: false, error: "not_found" });
        return;
      }
      store.ledger = nextLedger;
      const saved = saveStore(store);
      json(res, 200, {
        ok: true,
        ledger: saved.ledger,
        metrics: computeLedgerMetrics(saved.ledger),
        updated_at: saved.updatedAt
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ledger/reset") {
      const store = loadStore();
      store.ledger = [];
      const saved = saveStore(store);
      json(res, 200, { ok: true, ledger: saved.ledger, metrics: computeLedgerMetrics(saved.ledger), updated_at: saved.updatedAt });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/snapshot") {
      const store = loadStore();
      json(res, 200, {
        ok: true,
        worksheet: store.worksheet,
        ledger: store.ledger,
        metrics: computeLedgerMetrics(store.ledger),
        updated_at: store.updatedAt
      });
      return;
    }

    json(res, 404, { ok: false, error: "not_found", path: url.pathname });
  });
}

export async function startServer({ port = 4326, host = "127.0.0.1" } = {}) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  return { server, address };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const portArgIndex = process.argv.indexOf("--port");
  const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : Number(process.env.PORT || 4326);
  const host = process.env.HOST || "127.0.0.1";
  const { address } = await startServer({ port, host });
  process.stdout.write(`${JSON.stringify({ ok: true, port: address.port, host, mode: "local-runtime" })}\n`);
}
