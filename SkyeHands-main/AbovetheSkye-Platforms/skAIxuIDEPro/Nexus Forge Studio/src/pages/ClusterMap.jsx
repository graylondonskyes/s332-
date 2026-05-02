import React, { useMemo, useState } from "react";
import CopyBox from "../components/CopyBox.jsx";
import { uid } from "../lib/ids.js";
import { buildClusterPlan } from "../lib/templates.js";
import { rowsToCSV } from "../lib/csv.js";
import { downloadText } from "../lib/storage.js";
import { safeTrim } from "../lib/text.js";

export default function ClusterMap({ state, setState, toast }) {
  const settings = state.settings || {};
  const [rootTopic, setRootTopic] = useState("Local service");
  const [city, setCity] = useState(settings.defaultCity || "Phoenix, AZ");
  const [service, setService] = useState("");
  const [count, setCount] = useState(13);
  const [plan, setPlan] = useState(null);
  const [tab, setTab] = useState("topics");

  function generate() {
    const out = buildClusterPlan({ rootTopic, city, service, count: Number(count) || 13 });
    setPlan(out);
    setTab("topics");
    toast("Generated ⚡");
  }

  const vault = useMemo(() => {
    return (state.clusterVault || []).slice().sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }, [state.clusterVault]);

  function exportCSV() {
    if (!plan) return toast("Generate first.");
    const rows = [
      ["order","title","keyword","slug","intent","pillar"],
      ...(plan.items || []).map(it => [
        it.order,
        it.title,
        it.keyword,
        it.slug,
        it.intent,
        plan.pillar?.slug || "",
      ]),
    ];
    const csv = rowsToCSV(rows);
    const file = `nexusforge-cluster-${new Date().toISOString().slice(0,10)}.csv`;
    downloadText(file, csv, "text/csv");
    toast("CSV exported ⬇️");
  }

  function saveToVault() {
    if (!plan) return toast("Generate first.");
    const item = {
      id: uid(),
      rootTopic: safeTrim(rootTopic),
      city: safeTrim(city),
      service: safeTrim(service),
      plan,
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, clusterVault: [item, ...(prev.clusterVault || [])] }));
    toast("Saved ✅");
  }

  function loadVaultItem(v) {
    setRootTopic(v.rootTopic || "");
    setCity(v.city || "");
    setService(v.service || "");
    setPlan(v.plan || null);
    setTab("topics");
    toast("Loaded ✅");
  }

  function removeVaultItem(id) {
    const ok = confirm("Delete this saved cluster plan?");
    if (!ok) return;
    setState(prev => ({ ...prev, clusterVault: (prev.clusterVault || []).filter(x => x.id !== id) }));
    toast("Deleted 🗑️");
  }

  const linkMapText = useMemo(() => {
    if (!plan) return "";
    const lines = [];
    lines.push(`PILLAR: ${plan.pillar?.slug || ""}`);
    lines.push("");
    (plan.linkMap || []).forEach(m => {
      lines.push(`${m.from} -> ${m.to.join(", ")}`);
    });
    return lines.join("\n");
  }, [plan]);

  return (
    <div className="panel">
      <h2 className="h2">Cluster Map</h2>
      <p className="muted">Generate a topic cluster + a simple internal-link map. Offline, exportable, repeatable.</p>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="cardTitle">Inputs</div>
          <label className="label">Root topic</label>
          <input className="input" value={rootTopic} onChange={e=>setRootTopic(e.target.value)} placeholder="Web design" />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">City</label>
              <input className="input" value={city} onChange={e=>setCity(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Service (optional)</label>
              <input className="input" value={service} onChange={e=>setService(e.target.value)} placeholder="SEO" />
            </div>
          </div>

          <label className="label">How many topics</label>
          <input className="input" type="number" min={5} max={25} value={count} onChange={e=>setCount(e.target.value)} />

          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={generate}>Generate</button>
            <button className="btn" type="button" onClick={exportCSV} disabled={!plan}>Export CSV</button>
            <button className="btn" type="button" onClick={saveToVault} disabled={!plan}>Save</button>
          </div>

          <div className="hr" />
          <div className="cardTitle" style={{ marginBottom: 8 }}>Saved plans</div>
          {vault.length === 0 ? (
            <div className="muted">Nothing saved yet.</div>
          ) : (
            <div className="stack">
              {vault.slice(0, 10).map(v => (
                <div key={v.id} className="item">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                    <div>
                      <div className="itemTitle">{v.rootTopic || "(Untitled)"}</div>
                      <div className="muted small">{v.city || ""}{v.service ? ` • ${v.service}` : ""}</div>
                      <div className="muted small">{v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}</div>
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn" type="button" onClick={()=>loadVaultItem(v)}>Load</button>
                      <button className="btn danger" type="button" onClick={()=>removeVaultItem(v.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="cardTitle" style={{ marginBottom: 2 }}>Output</div>
              {plan ? <div className="muted small">Pillar slug: <span className="mono">{plan.pillar?.slug}</span></div> : <div className="muted small">Generate to see topics + link map.</div>}
            </div>
            <div className="tabs" style={{ margin: 0 }}>
              <button className={tab==="topics"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("topics")}>Topics</button>
              <button className={tab==="links"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("links")}>Link Map</button>
            </div>
          </div>

          {!plan ? (
            <div className="muted" style={{ marginTop: 12 }}>No plan yet.</div>
          ) : tab === "topics" ? (
            <div style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {(plan.items || []).map(it => (
                    <tr key={it.slug}>
                      <td className="mono">{it.order}</td>
                      <td>{it.title}</td>
                      <td className="mono">{it.slug}</td>
                      <td><span className="pill">{it.intent}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <CopyBox title="Internal link map" value={linkMapText} toast={toast} rows={16} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
