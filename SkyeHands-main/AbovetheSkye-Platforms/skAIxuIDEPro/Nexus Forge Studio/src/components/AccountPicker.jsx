import React, { useMemo } from "react";

export default function AccountPicker({ state, setState, toast, label = "Active account" }) {
  const accounts = state.accounts || [];

  const options = useMemo(() => {
    return accounts
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
      );
  }, [accounts]);

  const activeId = state.activeAccountId || "";
  const active = accounts.find(a => a.id === activeId) || null;

  function setActive(id) {
    setState(prev => ({ ...prev, activeAccountId: id || "" }));
    if (toast) toast(id ? "Active set ✅" : "No active account");
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div className="cardTitle" style={{ marginBottom: 2 }}>{label}</div>
          <div className="muted small">
            {active ? (active.name || "Unnamed") : "Pick an account to personalize generators."}
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <select
            className="input"
            value={activeId}
            onChange={e => setActive(e.target.value)}
            style={{ minWidth: 240 }}
          >
            <option value="">— None —</option>
            {options.map(a => (
              <option key={a.id} value={a.id}>{a.name || "Unnamed"}</option>
            ))}
          </select>
          <button className="btn" type="button" onClick={() => setActive("")}>Clear</button>
        </div>
      </div>
    </div>
  );
}
