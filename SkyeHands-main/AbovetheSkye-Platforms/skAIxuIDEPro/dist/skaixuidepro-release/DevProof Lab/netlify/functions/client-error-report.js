/**
 * /.netlify/functions/client-error-report
 * Receives client-side errors (before the request hits the gateway).
 * Logs to Netlify function logs. Optional forward via ERROR_SINK_URL.
 */
export async function handler(event) {
  const headers = event.headers || {};
  const method = (event.httpMethod || "GET").toUpperCase();

  if (method === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ok: true,
        fn: "client-error-report",
        received: "Use POST with JSON {type,message,stack,context,time,...}",
        kaixu: { app: headers["x-kaixu-app"] || null, build: headers["x-kaixu-build"] || null }
      })
    };
  }

  if (method !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = null;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    payload = { _parse_error: true, raw: (event.body || "").slice(0, 4000) };
  }

  const record = {
    received_at: new Date().toISOString(),
    ip: headers["x-nf-client-connection-ip"] || headers["client-ip"] || null,
    ua: headers["user-agent"] || null,
    kaixu: { app: headers["x-kaixu-app"] || null, build: headers["x-kaixu-build"] || null },
    payload
  };

  console.log("[client-error-report]", JSON.stringify(record));

  // Optional forward (if you configure ERROR_SINK_URL)
  const sink = process.env.ERROR_SINK_URL;
  if (sink) {
    try {
      await fetch(sink, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.log("[client-error-report] forward_failed", String(e));
    }
  }

  return {
    statusCode: 204,
    headers: { "Cache-Control": "no-store" },
    body: ""
  };
}
