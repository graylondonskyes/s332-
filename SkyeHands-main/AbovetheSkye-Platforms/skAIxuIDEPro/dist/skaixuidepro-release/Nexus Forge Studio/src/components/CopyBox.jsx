import React from "react";
import { copyText } from "../lib/clipboard.js";

export default function CopyBox({ title, value, toast, rows = 10, actions = null }) {
  async function doCopy() {
    const ok = await copyText(value);
    if (toast) toast(ok ? "Copied ✅" : "Copy failed");
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div className="cardTitle" style={{ marginBottom: 0 }}>{title}</div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {actions}
          <button className="btn" type="button" onClick={doCopy}>Copy</button>
        </div>
      </div>
      <textarea className="input mono" value={value} readOnly rows={rows} style={{ marginTop: 10 }} />
    </div>
  );
}
