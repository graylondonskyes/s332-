#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server/create-server.cjs");

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "superidev3-api-smoke-"));
const statePath = path.join(tempDir, "server-state.json");
const webhookSecret = "whsec_superidev3_api_smoke";
const passphrase = "sovereign-build-passphrase";
const outPath = path.join(root, "artifacts", "api-smoke.json");

const env = {
  ...process.env,
  SKYE_RUNTIME_MODE: "development",
  SKYE_AUTH_SECRET: "superidev3-api-smoke-secret-not-default",
  SKYE_OPERATOR_PASSPHRASE: passphrase,
  STRIPE_SECRET_KEY: "sk_test_superidev3_api_smoke",
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  SKYE_RUNTIME_STATE_PATH: statePath,
  SKYE_SUBMIT_APPLE_URL: "https://submissions.internal.invalid/apple-books",
  SKYE_SUBMIT_KOBO_URL: "https://submissions.internal.invalid/kobo",
  SKYE_SUBMIT_KDP_EBOOK_URL: "https://submissions.internal.invalid/kdp-ebook",
  SKYE_SUBMIT_KDP_PRINT_URL: "https://submissions.internal.invalid/kdp-print",
  SKYE_PORTAL_AUTOMATION_ENABLE: "1",
};

function signStripePayload(rawBody) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(base, method, route, body, token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined && !headers["content-type"]) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { method, route, status: response.status, ok: response.ok, data };
  } catch (error) {
    return { method, route, status: 0, ok: false, data: { error: String(error?.message || error) } };
  } finally {
    clearTimeout(timeout);
  }
}

function writeProgress(readiness, results, ok, error = null) {
  const payload = {
    generated_at: new Date().toISOString(),
    ok,
    readiness,
    checks_total: results.length,
    checks_failed: results.filter((item) => !item.ok).length,
    ...(error ? { error: String(error?.message || error) } : {}),
    results,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function expect(results, readiness, name, promise, predicate) {
  const started = Date.now();
  try {
    const result = await promise;
    const ok = predicate ? Boolean(predicate(result)) : result.ok;
    results.push({
      name,
      method: result.method,
      route: result.route,
      status: result.status,
      ok,
      ms: Date.now() - started,
      summary: result.data?.error || result.data?.schema || result.data?.ok === true ? "typed-json" : "checked",
    });
    writeProgress(readiness, results, false);
    if (!ok) throw new Error(`${name} failed: ${result.method} ${result.route} -> ${result.status}`);
    return result;
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: String(error?.message || error) });
    writeProgress(readiness, results, false, error);
    throw error;
  }
}

async function main() {
  const { server, readiness } = createServer(env);
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  const results = [];

  try {
    await expect(results, readiness, "health", request(base, "GET", "/api/health"), (r) => r.status === 200 && r.data.ok === true);
    await expect(results, readiness, "readiness", request(base, "GET", "/api/runtime/readiness"), (r) => r.status === 200 && r.data.ok === true);
    await expect(results, readiness, "verify rejects missing token", request(base, "GET", "/api/auth/verify"), (r) => r.status === 401 && r.data.ok === false);
    await expect(results, readiness, "login rejects bad passphrase", request(base, "POST", "/api/auth/login", { passphrase: "wrong" }), (r) => r.status === 401);
    const login = await expect(results, readiness, "login accepts configured passphrase", request(base, "POST", "/api/auth/login", { passphrase }), (r) => r.status === 200 && r.data.access_token);
    let token = login.data.access_token;
    const refreshToken = login.data.refresh_token;
    await expect(results, readiness, "verify accepts session", request(base, "GET", "/api/auth/verify", undefined, token), (r) => r.status === 200 && r.data.ok === true);
    const refreshed = await expect(results, readiness, "refresh rotates session", request(base, "POST", "/api/auth/refresh", { refresh_token: refreshToken }), (r) => r.status === 200 && r.data.access_token);
    token = refreshed.data.access_token;

    await expect(results, readiness, "catalog list", request(base, "GET", "/api/catalog/titles", undefined, token), (r) => r.status === 200 && r.data.catalog);
    await expect(results, readiness, "catalog upsert", request(base, "POST", "/api/catalog/titles", { title_id: "title_api_smoke", title_name: "API Smoke Title", files: { "manuscript.md": "# API Smoke" } }, token), (r) => r.status === 200 && r.data.summary);
    await expect(results, readiness, "commerce library", request(base, "GET", "/api/commerce/library", undefined, token), (r) => r.status === 200 && Array.isArray(r.data.library));
    await expect(results, readiness, "release history", request(base, "GET", "/api/release-history", undefined, token), (r) => r.status === 200 && r.data.history);

    const created = await expect(results, readiness, "skydocxmax create document", request(base, "POST", "/api/skydocxmax/documents", {
      title: "API Smoke Document",
      content: "# API Smoke Document\n\nRoute proof.",
      metadata: { author: "Skyes Over London", slug: "api-smoke-document", priceUsd: 49 },
    }, token), (r) => r.status === 200 && r.data.document?.document_id);
    const documentId = created.data.document.document_id;
    await expect(results, readiness, "skydocxmax list documents", request(base, "GET", "/api/skydocxmax/documents", undefined, token), (r) => r.status === 200 && r.data.count >= 1);
    await expect(results, readiness, "skydocxmax export", request(base, "POST", "/api/skydocxmax/export", { document_id: documentId, formats: ["md", "json"] }, token), (r) => r.status === 200 && r.data.export_receipt);
    await expect(results, readiness, "skydocxmax share", request(base, "POST", "/api/skydocxmax/share", { document_id: documentId, channel: "internal", recipient: "operator@skye.local" }, token), (r) => r.status === 200 && r.data.share_receipt);
    await expect(results, readiness, "skydocxmax publish", request(base, "POST", "/api/skydocxmax/publish", { document_id: documentId, run_id: "api-smoke" }, token), (r) => r.status === 200 && r.data.package);
    await expect(results, readiness, "skydocxmax import", request(base, "POST", "/api/skydocxmax/import", { document: { document_id: documentId, title: "API Smoke Document", content: "# Imported", metadata: { slug: "api-smoke-document" } } }, token), (r) => r.status === 200 && r.data.imported);

    await expect(results, readiness, "publishing package", request(base, "POST", "/api/publishing/package", { run_id: "api-smoke" }, token), (r) => r.status === 200 && r.data.package);
    await expect(results, readiness, "publishing binaries", request(base, "POST", "/api/publishing/binaries", {}, token), (r) => r.status === 200 && r.data.manifest);
    await expect(results, readiness, "publishing packages", request(base, "GET", "/api/publishing/packages", undefined, token), (r) => r.status === 200 && r.data.manifest);

    await expect(results, readiness, "payment checkout protected", request(base, "POST", "/api/payments/checkout/session", { amount_usd: 49 }), (r) => r.status === 401);
    const webhookEvent = {
      id: "evt_api_smoke",
      type: "checkout.session.completed",
      data: { object: { id: "cs_api_smoke", customer_email: "buyer@skye.local" } },
    };
    const webhookRaw = JSON.stringify(webhookEvent);
    await expect(results, readiness, "stripe webhook verifies signature", request(base, "POST", "/api/payments/webhook/stripe", webhookRaw, null, {
      "content-type": "application/json",
      "stripe-signature": signStripePayload(webhookRaw),
    }), (r) => r.status === 200 && r.data.verification?.ok === true);
    await expect(results, readiness, "payment reconcile fails loudly without session", request(base, "POST", "/api/payments/session/reconcile", {}, token), (r) => r.status === 400 && r.data.error === "missing-session-id");

    await expect(results, readiness, "evidence release gates", request(base, "GET", "/api/evidence/release-gates", undefined, token), (r) => r.status === 200 && r.data.gates);
    await expect(results, readiness, "evidence artifacts", request(base, "GET", "/api/evidence/artifacts", undefined, token), (r) => r.status === 200);
    await expect(results, readiness, "evidence smoke", request(base, "GET", "/api/evidence/smoke", undefined, token), (r) => r.status === 200 && r.data.smoke);

    await expect(results, readiness, "submission jobs list", request(base, "GET", "/api/submissions/jobs", undefined, token), (r) => r.status === 200 && Array.isArray(r.data.jobs));
    const packagePath = path.join(root, "public", "SkyeDocxMax", "SkyeDocxMax_RELEASE_READY_v1.zip");
    const job = await expect(results, readiness, "submission job create", request(base, "POST", "/api/submissions/jobs", {
      channel: "apple_books",
      package_path: packagePath,
      title: "API Smoke Submission",
      slug: "api-smoke-submission",
    }, token), (r) => r.status === 200 && r.data.job?.job_id);
    await expect(results, readiness, "submission dispatch fails loudly without job id", request(base, "POST", "/api/submissions/dispatch", {}, token), (r) => r.status === 400 && r.data.error === "missing-job-id");
    await expect(results, readiness, "submission status fails loudly without job id", request(base, "POST", "/api/submissions/status", {}, token), (r) => r.status === 400 && r.data.error === "missing-job-id");
    await expect(results, readiness, "submission cancel fails loudly without job id", request(base, "POST", "/api/submissions/cancel", {}, token), (r) => r.status === 400 && r.data.error === "missing-job-id");
    await expect(results, readiness, "submission job get", request(base, "GET", `/api/submissions/jobs/${job.data.job.job_id}`, undefined, token), (r) => r.status === 200 && r.data.job);

    await expect(results, readiness, "logout revokes session", request(base, "POST", "/api/auth/logout", {}, token), (r) => r.status === 200 && r.data.ok === true);

    const payload = {
      generated_at: new Date().toISOString(),
      ok: true,
      readiness,
      checks_total: results.length,
      checks_failed: 0,
      results,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`[api-smoke] PASS checks=${results.length} wrote ${path.relative(root, outPath)}`);
  } catch (error) {
    const payload = {
      generated_at: new Date().toISOString(),
      ok: false,
      readiness,
      checks_total: results.length,
      checks_failed: results.filter((item) => !item.ok).length,
      error: String(error?.message || error),
      results,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.error(`[api-smoke] FAIL ${payload.error}`);
    process.exitCode = 1;
  } finally {
    await close(server);
  }
}

main().catch((error) => {
  console.error(`[api-smoke] Fatal: ${String(error?.message || error)}`);
  process.exit(1);
});
