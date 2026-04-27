const { fail, ok } = require('./lib');
const { mintLocalSession, verifyLocalSession } = require('../platform/local-auth');
const now = Date.now();
const session = mintLocalSession({ operator:'Skyes Over London', org:'SOLEnterprises', sessionTtlMinutes:15, gatewayMode:'skye-gateway-only', nowMs:now }, 'sovereign-build-passphrase');
const vectors = [
  { label:'fresh', result: verifyLocalSession(session, 'sovereign-build-passphrase', now+1000), expect:true },
  { label:'expired', result: verifyLocalSession(session, 'sovereign-build-passphrase', session.expires_at+1), expect:false },
  { label:'wrong-passphrase', result: verifyLocalSession(session, 'wrong-passphrase-value', now+1000), expect:false },
  { label:'tampered', result: (()=>{ const copy=JSON.parse(JSON.stringify(session)); copy.org='tampered'; return verifyLocalSession(copy, 'sovereign-build-passphrase', now+1000); })(), expect:false }
];
for (const vector of vectors) if (vector.result.ok !== vector.expect) fail(`[auth-regression] FAIL: ${vector.label}`);
ok(`[auth-regression] PASS (${vectors.length} checks)`);
