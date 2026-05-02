const { createServer } = require("./create-server.cjs");

const port = Number(process.env.PORT || 4318);
const host = process.env.HOST || "127.0.0.1";

const { server, readiness } = createServer(process.env);

server.listen(port, host, () => {
  const status = readiness.ok ? "ready" : "blocked";
  console.log(`[superidev3.8] api server listening on http://${host}:${port} (${status})`);
  if (!readiness.ok) {
    console.log(`[superidev3.8] readiness blockers: ${readiness.blockers.join(", ")}`);
  }
});
