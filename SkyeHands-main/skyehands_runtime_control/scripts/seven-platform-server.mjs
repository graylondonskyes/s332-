#!/usr/bin/env node
import { BRAND, createSevenPlatformServer } from '../platform/seven-donor-platform/seven-platform-runtime.mjs';

const port = Number(process.env.PORT || 4329);
const host = process.env.HOST || '127.0.0.1';
const server = createSevenPlatformServer();

server.listen(port, host, () => {
  console.log(JSON.stringify({
    ok: true,
    service: BRAND.systemName,
    productName: BRAND.productName,
    tagline: BRAND.tagline,
    url: `http://${host}:${port}`
  }, null, 2));
});
