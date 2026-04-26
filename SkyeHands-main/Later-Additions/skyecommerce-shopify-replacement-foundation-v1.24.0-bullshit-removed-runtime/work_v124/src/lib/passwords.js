import { sha256Hex } from './utils.js';

const encoder = new TextEncoder();
function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function secureRandomBase64Url(bytes = 18) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64Url(arr);
}
function subjectKey(subject = '', password = '') {
  return `${String(subject || '').trim().toLowerCase()}::${String(password || '')}`;
}
export async function pbkdf2PasswordHash(subject, password, salt = secureRandomBase64Url(18), iterations = 210000) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(subjectKey(subject, password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256);
  return `pbkdf2_sha256$${iterations}$${salt}$${base64Url(new Uint8Array(bits))}`;
}
export async function verifyPbkdf2PasswordHash(subject, password, storedHash = '') {
  const stored = String(storedHash || '');
  if (!stored.startsWith('pbkdf2_sha256$')) return false;
  const [, iterRaw, salt, hash] = stored.split('$');
  const candidate = await pbkdf2PasswordHash(subject, password, salt, Number(iterRaw || 210000));
  return candidate.split('$').pop() === hash;
}
export async function legacyMerchantPasswordHash(email, password) {
  return sha256Hex(`${String(email || '').trim().toLowerCase()}::${String(password || '')}`);
}
export async function legacyCustomerPasswordHash(merchantId, email, password) {
  return sha256Hex(`${String(merchantId || '')}::${String(email || '').trim().toLowerCase()}::${String(password || '')}`);
}
export function merchantPasswordSubject(email = '') {
  return String(email || '').trim().toLowerCase();
}
export function customerPasswordSubject(merchantId = '', email = '') {
  return `${String(merchantId || '').trim()}::${String(email || '').trim().toLowerCase()}`;
}
export async function hashMerchantPassword(email, password) {
  return pbkdf2PasswordHash(merchantPasswordSubject(email), password);
}
export async function verifyMerchantPassword(email, password, storedHash = '') {
  if (String(storedHash || '').startsWith('pbkdf2_sha256$')) return verifyPbkdf2PasswordHash(merchantPasswordSubject(email), password, storedHash);
  return (await legacyMerchantPasswordHash(email, password)) === String(storedHash || '');
}
export async function hashCustomerPassword(merchantId, email, password) {
  return pbkdf2PasswordHash(customerPasswordSubject(merchantId, email), password);
}
export async function verifyCustomerPassword(merchantId, email, password, storedHash = '') {
  if (String(storedHash || '').startsWith('pbkdf2_sha256$')) return verifyPbkdf2PasswordHash(customerPasswordSubject(merchantId, email), password, storedHash);
  return (await legacyCustomerPasswordHash(merchantId, email, password)) === String(storedHash || '');
}
