import { getMonthRollup, customerCapCents, keyCapCents } from "./authz.js";

export async function getWalletStatus(keyRow, month) {
  const customerRollup = await getMonthRollup(keyRow.customer_id, month);
  return {
    customer_cap_cents: customerCapCents(keyRow, customerRollup),
    customer_spent_cents: customerRollup.spent_cents || 0,
    key_cap_cents: keyCapCents(keyRow, customerRollup),
    key_spent_cents: 0
  };
}

export async function reserveUsage() {
  return { ok: true, mode: "compat" };
}

export async function finalizeUsage() {
  return { ok: true, mode: "compat" };
}

export async function refundUsage() {
  return { ok: true, mode: "compat" };
}
