import { describe, expect, it } from "vitest";

function scopeByAccount<T extends { accountId: string }>(rows: T[], accountId: string) {
  return rows.filter((row) => row.accountId === accountId);
}

describe("tenant scoping contract", () => {
  it("only returns records for the requested account", () => {
    const rows = [
      { id: "lead_a", accountId: "account_a" },
      { id: "lead_b", accountId: "account_b" },
    ];
    expect(scopeByAccount(rows, "account_a")).toEqual([{ id: "lead_a", accountId: "account_a" }]);
  });
});
