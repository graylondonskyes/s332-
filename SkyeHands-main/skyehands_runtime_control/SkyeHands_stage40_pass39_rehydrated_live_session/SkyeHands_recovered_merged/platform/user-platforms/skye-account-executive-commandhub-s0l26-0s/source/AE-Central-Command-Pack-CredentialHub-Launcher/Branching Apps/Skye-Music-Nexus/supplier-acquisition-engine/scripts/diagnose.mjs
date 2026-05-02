import { inspectUrl } from "../lib/capture.mjs";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/diagnose.mjs <url>");
  process.exit(1);
}

try {
  const report = await inspectUrl(url, { timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000), maxResults: 12 });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message || String(error) }, null, 2));
  process.exit(1);
}
