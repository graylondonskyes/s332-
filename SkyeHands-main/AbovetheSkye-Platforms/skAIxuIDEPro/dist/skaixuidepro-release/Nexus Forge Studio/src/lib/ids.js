export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function todayISO() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
