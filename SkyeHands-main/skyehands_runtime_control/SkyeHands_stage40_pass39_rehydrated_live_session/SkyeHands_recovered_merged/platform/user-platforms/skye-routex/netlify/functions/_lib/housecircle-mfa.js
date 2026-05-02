const crypto = require('crypto');
const { clean, compact, nowISO, uid, listify } = require('./housecircle-cloud-store');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomBase32(length){
  let out = '';
  while(out.length < length){
    const buf = crypto.randomBytes(length);
    for(let i=0;i<buf.length && out.length < length;i += 1){
      out += ALPHABET[buf[i] % ALPHABET.length];
    }
  }
  return out;
}
function base32ToBuffer(input){
  const raw = clean(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for(const ch of raw){
    const idx = ALPHABET.indexOf(ch);
    if(idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for(let i=0;i + 8 <= bits.length;i += 8){ bytes.push(parseInt(bits.slice(i, i + 8), 2)); }
  return Buffer.from(bytes);
}
function hotp(secret, counter, digits){
  const key = base32ToBuffer(secret);
  const buf = Buffer.alloc(8);
  let n = BigInt(counter);
  for(let i = 7; i >= 0; i -= 1){ buf[i] = Number(n & 0xffn); n >>= 8n; }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const size = Math.pow(10, digits || 6);
  return String(code % size).padStart(digits || 6, '0');
}
function totp(secret, atMs, stepSec, digits){
  const step = Math.max(15, Number(stepSec || 30));
  const counter = Math.floor((Number(atMs || Date.now())) / 1000 / step);
  return hotp(secret, counter, digits || 6);
}
function verifyTotp(secret, code, opts){
  opts = opts || {};
  const input = clean(code).replace(/\s+/g, '');
  const digits = Number(opts.digits || 6);
  const step = Math.max(15, Number(opts.stepSec || 30));
  const windowSize = Math.max(0, Number(opts.window || 1));
  const now = Number(opts.atMs || Date.now());
  for(let offset = -windowSize; offset <= windowSize; offset += 1){
    const candidate = totp(secret, now + (offset * step * 1000), step, digits);
    if(candidate === input){ return { ok:true, offset, code: candidate }; }
  }
  return { ok:false };
}
function recoveryCode(){
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}
function generateRecoveryCodes(count){
  const plain = [];
  for(let i = 0; i < Math.max(4, Number(count || 8)); i += 1) plain.push(recoveryCode());
  const hashes = plain.map(hashRecoveryCode);
  return { plain, hashes };
}
function hashRecoveryCode(code){
  return crypto.createHash('sha256').update(clean(code).toUpperCase()).digest('hex');
}
function buildOtpAuthUrl(input){
  const issuer = encodeURIComponent(compact(input.issuer || 'SkyeRoutexFlow'));
  const label = encodeURIComponent(compact(input.label || 'Platform House Operator'));
  const secret = encodeURIComponent(clean(input.secret));
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
function ensureMfaStore(state){
  if(!state.mfa || typeof state.mfa !== 'object' || Array.isArray(state.mfa)) state.mfa = {};
  return state.mfa;
}
function upsertMfaRecord(state, record){
  const store = ensureMfaStore(state);
  const operatorId = clean(record && record.operatorId) || 'founder-admin';
  const next = { ...(store[operatorId] || {}), ...(record || {}), operatorId, updatedAt: nowISO() };
  if(!next.createdAt) next.createdAt = next.updatedAt;
  store[operatorId] = next;
  return next;
}
function sanitizeMfaRecord(record){
  if(!record) return null;
  const clone = { ...record };
  delete clone.secret;
  delete clone.recoveryHashes;
  return clone;
}
function verifyRecoveryCode(record, code){
  const target = hashRecoveryCode(code);
  const hashes = listify(record && record.recoveryHashes);
  const used = listify(record && record.recoveryUsed);
  const index = hashes.indexOf(target);
  if(index < 0) return { ok:false };
  if(used.includes(target)) return { ok:false, used:true };
  return { ok:true, hash: target };
}

module.exports = {
  randomBase32,
  hotp,
  totp,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  buildOtpAuthUrl,
  ensureMfaStore,
  upsertMfaRecord,
  sanitizeMfaRecord,
  verifyRecoveryCode
};
