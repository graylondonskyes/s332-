export function createId(prefix: string): string {
  const entropy = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${entropy.replace(/-/g, '')}`;
}
