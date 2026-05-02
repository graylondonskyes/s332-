import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Dashboard from "./pages/Dashboard.jsx";
import BusinessVault from "./pages/BusinessVault.jsx";
import GeneratorLab from "./pages/GeneratorLab.jsx";
import EmailForge from "./pages/EmailForge.jsx";
import ClusterMap from "./pages/ClusterMap.jsx";
import PostLog from "./pages/PostLog.jsx";
import Settings from "./pages/Settings.jsx";
import { loadState, saveState } from "./lib/storage.js";
import { defaultBrandSettings } from "./lib/templates.js";

const DEFAULT_STATE = {
  appName: "NexusForge Studio",
  settings: defaultBrandSettings(),
  accounts: [],
  activeAccountId: "",
  drafts: [],
  postLog: [],
  outreachVault: [],
  clusterVault: [],
};

const NAV = [
  { key: "dashboard", label: "Command Center", icon: "⎈" },
  { key: "vault", label: "Business Vault", icon: "✦" },
  { key: "generator", label: "Generator Lab", icon: "⚡" },
  { key: "emails", label: "Email Forge", icon: "✉" },
  { key: "clusters", label: "Cluster Map", icon: "🧭" },
  { key: "postlog", label: "Post Log", icon: "☷" },
  { key: "settings", label: "Settings", icon: "⚙︎" },
];

function nowHHMM() {
  try {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [state, setState] = useState(() => {
    const s = loadState(DEFAULT_STATE);
    // One-time migration from older chassis versions
    if (Array.isArray(s.leads) && !Array.isArray(s.accounts)) {
      s.accounts = s.leads;
    }
    if (!s.settings) s.settings = defaultBrandSettings();
    return s;
  });

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }

  // Persist to localStorage (debounced)
  const persistTimer = useRef(null);
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveState(state);
    }, 200);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state]);

  const title = state.appName || "Kaixu App";
  const activeName = (state.accounts || []).find(a => a.id === (state.activeAccountId || ""))?.name || "";

  const content = useMemo(() => {
    if (view === "dashboard") return <Dashboard state={state} />;
    if (view === "vault") return <BusinessVault state={state} setState={setState} toast={toast} />;
    if (view === "generator") return <GeneratorLab state={state} setState={setState} toast={toast} />;
    if (view === "emails") return <EmailForge state={state} setState={setState} toast={toast} />;
    if (view === "clusters") return <ClusterMap state={state} setState={setState} toast={toast} />;
    if (view === "postlog") return <PostLog state={state} setState={setState} toast={toast} />;
    if (view === "settings") return <Settings state={state} setState={setState} toast={toast} />;
    return <Dashboard state={state} />;
  }, [view, state]);

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="brandMark">N</div>
          <div className="brandText">
            <div className="brandName">{title}</div>
            <div className="brandSub">Content + outreach engine</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(n => (
            <button
              key={n.key}
              className={n.key === view ? "navBtn active" : "navBtn"}
              onClick={() => setView(n.key)}
              type="button"
            >
              <span className="navIcon">{n.icon}</span>
              <span className="navLabel">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sideFoot">
          <div className="muted small">Saved locally • {nowHHMM()}</div>
          <div className="muted small" style={{ marginTop: 6, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%",
              background: 'server-managed' ? "#10b981" : "#64748b" }}
            />
            {'server-managed' ? "Gateway key set" : "No gateway key — see Settings"}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div className="topLeft">
            <div className="h1">{NAV.find(x=>x.key===view)?.label ?? "App"}</div>
            <div className="muted small">
              {activeName ? <>Active: <strong>{activeName}</strong> • </> : null}
              Offline-first, copy-ready outputs.
            </div>
          </div>

          <div className="topRight">
            <button className="btn" type="button" onClick={() => toast("Saved locally ✅")}>Test Toast</button>
          </div>
        </header>

        <section className="content">
          {content}
        </section>

        {toastMsg ? (
          <div className="toast">{toastMsg}</div>
        ) : null}
      </main>
    </div>
  );
}
