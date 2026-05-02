import { STORAGE_KEY, defaultState, clone } from './autonomous-store.mjs';
import { STORE_SYSTEM_SEED } from '../data/system-seed.mjs';

export async function loadState() {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return defaultState(JSON.parse(raw));
    } catch {
      return resetState();
    }
  }
  return resetState();
}

export function saveState(state) {
  const normalized = defaultState(clone(state));
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetState() {
  const seeded = defaultState(STORE_SYSTEM_SEED);
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
