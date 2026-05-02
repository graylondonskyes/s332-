import React, { useRef, useState } from "react";
import { downloadText, readFileAsText } from "../lib/storage.js";
import { defaultBrandSettings } from "../lib/templates.js";
import { getKey, setKey, gwPing } from "../lib/gateway.js";

export default function Settings({ state, setState, toast }) {
  const fileRef = useRef(null);
  const brandDefaults = defaultBrandSettings();

  const [appName, setAppName] = useState(state.appName || "NexusForge Studio");
  const [brandName, setBrandName] = useState(state.settings?.brandName || brandDefaults.brandName);
  const [brandSite, setBrandSite] = useState(state.settings?.brandSite || brandDefaults.brandSite);
  const [defaultCity, setDefaultCity] = useState(state.settings?.defaultCity || brandDefaults.defaultCity);
  const [voice, setVoice] = useState(state.settings?.voice || brandDefaults.voice);
  const [ctaPrimary, setCtaPrimary] = useState(state.settings?.ctaPrimary || brandDefaults.ctaPrimary);
  const [ctaSecondary, setCtaSecondary] = useState(state.settings?.ctaSecondary || brandDefaults.ctaSecondary);

  // Gateway key
  const [gwKey, setGwKey] = useState(() => getKey());
  const [gwStatus, setGwStatus] = useState("");
  const [gwTesting, setGwTesting] = useState(false);

  function saveGwKey() {
    setKey(gwKey.trim());
    setGwStatus("");
    toast(gwKey.trim() ? "Key saved ✅" : "Key cleared");
  }

  async function testGateway() {
    setGwTesting(true);
    setGwStatus("Pinging…");
    const ms = await gwPing();
    setGwTesting(false);
    setGwStatus(ms !== null ? `✅ Reachable · ${ms}ms` : "❌ Unreachable — check network");
  }

  function saveAppName() {
    setState(prev => ({
      ...prev,
      appName: appName.trim() || "NexusForge Studio",
      settings: {
        ...(prev.settings || {}),
        brandName: brandName.trim() || brandDefaults.brandName,
        brandSite: brandSite.trim() || brandDefaults.brandSite,
        defaultCity: defaultCity.trim() || brandDefaults.defaultCity,
        voice: voice.trim() || brandDefaults.voice,
        ctaPrimary: ctaPrimary.trim() || brandDefaults.ctaPrimary,
        ctaSecondary: ctaSecondary.trim() || brandDefaults.ctaSecondary,
      },
    }));
    toast("Saved ✅");
  }

  function exportJSON() {
    const text = JSON.stringify(state, null, 2);
    const file = `kaixu-backup-${new Date().toISOString().slice(0,10)}.json`;
    downloadText(file, text, "application/json");
    toast("Backup exported ⬇️");
  }

  async function importJSON(file) {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
      const ok = confirm("Import will replace your current data in this app. Continue?");
      if (!ok) return;
      setState(prev => ({ ...prev, ...parsed }));
      toast("Imported ✅");
    } catch (e) {
      toast("Import failed (bad JSON).");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAll() {
    const ok = confirm("Clear all app data stored in this browser?");
    if (!ok) return;
    setState(prev => ({
      appName: prev.appName || "NexusForge Studio",
      settings: prev.settings || brandDefaults,
      accounts: [],
      drafts: [],
      postLog: [],
      outreachVault: [],
      clusterVault: [],
      activeAccountId: "",
    }));
    toast("Cleared 🧼");
  }

  return (
    <div className="panel">
      <h2 className="h2">Settings</h2>
      <p className="muted">Backup/restore + base knobs you’ll reuse in every app.</p>

      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Brand + defaults</div>
          <label className="label">App display name</label>
          <input className="input" value={appName} onChange={e=>setAppName(e.target.value)} />

          <label className="label">Brand name (signature)</label>
          <input className="input" value={brandName} onChange={e=>setBrandName(e.target.value)} />

          <label className="label">Brand website (used in links)</label>
          <input className="input" value={brandSite} onChange={e=>setBrandSite(e.target.value)} placeholder="SOLEnterprises.org" />

          <label className="label">Default city</label>
          <input className="input" value={defaultCity} onChange={e=>setDefaultCity(e.target.value)} placeholder="Phoenix, AZ" />

          <label className="label">Default voice</label>
          <input className="input" value={voice} onChange={e=>setVoice(e.target.value)} placeholder="editorial, confident, warm, practical" />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">CTA primary</label>
              <input className="input" value={ctaPrimary} onChange={e=>setCtaPrimary(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">CTA secondary</label>
              <input className="input" value={ctaSecondary} onChange={e=>setCtaSecondary(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn primary" type="button" onClick={saveAppName}>Save</button>
            <div className="muted small">Shows in the sidebar/header.</div>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Backup & restore</div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={exportJSON}>Export JSON backup</button>
            <input
              ref={fileRef}
              className="input"
              type="file"
              accept="application/json"
              onChange={(e)=> {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
              }}
              style={{ maxWidth: 260 }}
            />
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>
            Export gives you a portable backup. Import replaces current data in this app.
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn danger" type="button" onClick={clearAll}>Clear local data</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">kAIxU Gateway</div>
        <p className="muted" style={{ marginBottom: 12 }}>Your <strong>kAIxU Server Lane</strong> unlocks AI generation across all NexusForge features. Stored locally, never sent anywhere except the gateway.</p>
        <label className="label">kAIxU Server Lane</label>
        <input
          className="input"
          type="password"
          value={gwKey}
          onChange={e => setGwKey(e.target.value)}
          placeholder="Paste your key here…"
          style={{ fontFamily: "monospace", letterSpacing: ".04em" }}
        />
        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn primary" type="button" onClick={saveGwKey}>Save key</button>
          <button className="btn" type="button" onClick={testGateway} disabled={gwTesting}>Test gateway</button>
          {gwStatus ? <span className="muted small">{gwStatus}</span> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">Your build muscle (memorize this)</div>
        <div className="muted">
          Apps are just screens that read/write a state object. You build a “page” by:
          <ul className="list">
            <li>adding a file in <code>src/pages</code></li>
            <li>adding a nav button in <code>src/App.jsx</code></li>
            <li>updating <code>state</code> via <code>setState(...)</code></li>
          </ul>
          <div className="muted" style={{ marginTop: 10 }}>
            This app adds: <code>accounts</code>, <code>drafts</code>, <code>postLog</code>, and vaults (<code>outreachVault</code>, <code>clusterVault</code>).
          </div>
        </div>
      </div>
    </div>
  );
}
