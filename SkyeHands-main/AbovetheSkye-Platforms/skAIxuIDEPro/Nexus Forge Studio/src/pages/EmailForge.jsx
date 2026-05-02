import React, { useMemo, useState } from "react";
import AccountPicker from "../components/AccountPicker.jsx";
import CopyBox from "../components/CopyBox.jsx";
import { uid } from "../lib/ids.js";
import { buildEmailSequence } from "../lib/templates.js";
import { copyText } from "../lib/clipboard.js";
import { safeTrim } from "../lib/text.js";
import { gwChat } from "../lib/gateway.js";

export default function EmailForge({ state, setState, toast }) {
  const accounts = state.accounts || [];
  const active = accounts.find(a => a.id === (state.activeAccountId || "")) || null;
  const settings = state.settings || {};

  const [blogUrl, setBlogUrl] = useState("");
  const [seq, setSeq] = useState(null);
  const [tab, setTab] = useState("week1");
  const [aiLoading, setAiLoading] = useState(false);

  async function aiWrite() {
    const biz = safeTrim(active?.name) || safeTrim(settings.brandName) || "the business";
    const svc = safeTrim(active?.services) || safeTrim(active?.service) || "their services";
    const city = safeTrim(active?.city) || safeTrim(settings.defaultCity) || "";
    const blogRef = safeTrim(blogUrl) ? `Reference this blog post: ${blogUrl}` : "";
    const voice = safeTrim(settings.voice) || "editorial, confident, warm";
    const site  = safeTrim(settings.brandSite) || safeTrim(active?.website) || "";
    const prompt = [
      `Write a 4-week email follow-up sequence for a local business.`,
      `Business: ${biz}${city ? `, ${city}` : ""}. Service: ${svc}.`,
      `Brand voice: ${voice}.`,
      site ? `Website: https://${site}` : "",
      blogRef,
      `Output EXACTLY this JSON structure and nothing else:\n{"emails":[{"key":"week1","subject":"...","body":"..."},{"key":"week2","subject":"...","body":"..."},{"key":"week3","subject":"...","body":"..."},{"key":"week4","subject":"...","body":"..."}]}`,
    ].filter(Boolean).join("\n");
    setAiLoading(true);
    try {
      const raw = await gwChat([{ role: "user", content: prompt }], { maxTokens: 2048 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.emails)) throw new Error("Missing emails array");
      setSeq({ blogUrl: blogUrl || "", emails: parsed.emails });
      setTab("week1");
      toast("AI sequence ready ✦");
    } catch (e) {
      toast(`AI write failed: ${e.message.slice(0, 80)}`);
    } finally {
      setAiLoading(false);
    }
  }

  function generate() {
    const out = buildEmailSequence({ account: active, blogUrl: safeTrim(blogUrl), settings });
    setSeq(out);
    setTab("week1");
    toast("Generated ⚡");
  }

  const vault = useMemo(() => {
    return (state.outreachVault || []).slice().sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }, [state.outreachVault]);

  async function copyAll() {
    if (!seq) return toast("Generate first.");
    const text = (seq.emails || []).map(e => `SUBJECT: ${e.subject}\n\n${e.body}`).join("\n\n---\n\n");
    const ok = await copyText(text);
    toast(ok ? "Copied all ✅" : "Copy failed");
  }

  function saveToVault() {
    if (!seq) return toast("Generate first.");
    const item = {
      id: uid(),
      accountId: active?.id || "",
      accountName: active?.name || "",
      blogUrl: seq.blogUrl,
      emails: seq.emails,
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, outreachVault: [item, ...(prev.outreachVault || [])] }));
    toast("Saved to Outreach Vault ✅");
  }

  function loadVaultItem(v) {
    setBlogUrl(v.blogUrl === "[PASTE BLOG LINK HERE]" ? "" : v.blogUrl);
    setSeq({ blogUrl: v.blogUrl, emails: v.emails });
    setTab("week1");
    toast("Loaded ✅");
  }

  function removeVaultItem(id) {
    const ok = confirm("Delete this saved sequence?");
    if (!ok) return;
    setState(prev => ({ ...prev, outreachVault: (prev.outreachVault || []).filter(x => x.id !== id) }));
    toast("Deleted 🗑️");
  }

  const current = (seq?.emails || []).find(e => e.key === tab) || null;

  return (
    <div className="panel">
      <h2 className="h2">Email Forge</h2>
      <p className="muted">Generate a 4-week follow-up sequence for the active account. Offline. Copy-ready.</p>

      <AccountPicker state={state} setState={setState} toast={toast} />

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="cardTitle">Inputs</div>
          <label className="label">Blog link (optional)</label>
          <input className="input" value={blogUrl} onChange={e=>setBlogUrl(e.target.value)} placeholder="https://... or leave blank" />

          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={generate}>Generate sequence</button>
            <button className="btn ai" type="button" onClick={aiWrite} disabled={aiLoading}>{aiLoading ? "Writing…" : "✦ AI Write"}</button>
            <button className="btn" type="button" onClick={copyAll} disabled={!seq}>Copy all</button>
            <button className="btn" type="button" onClick={saveToVault} disabled={!seq}>Save to vault</button>
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            Uses brand: <span className="mono">{settings.brandName || "—"}</span>
          </div>

          <div className="hr" />

          <div className="cardTitle" style={{ marginBottom: 8 }}>Outreach Vault</div>
          {vault.length === 0 ? (
            <div className="muted">No saved sequences yet.</div>
          ) : (
            <div className="stack">
              {vault.slice(0, 10).map(v => (
                <div key={v.id} className="item">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                    <div>
                      <div className="itemTitle">{v.accountName || "(No account)"}</div>
                      <div className="muted small">{v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}</div>
                      <div className="small" style={{ marginTop: 6 }}>{v.blogUrl}</div>
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
            <div className="cardTitle" style={{ marginBottom: 0 }}>Sequence</div>
            <div className="tabs" style={{ margin: 0 }}>
              <button className={tab==="week1"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("week1")}>Week 1</button>
              <button className={tab==="week2"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("week2")}>Week 2</button>
              <button className={tab==="week3"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("week3")}>Week 3</button>
              <button className={tab==="week4"?"tabBtn active":"tabBtn"} type="button" onClick={()=>setTab("week4")}>Week 4</button>
            </div>
          </div>

          {!seq ? (
            <div className="muted" style={{ marginTop: 12 }}>Generate a sequence to view each email here.</div>
          ) : current ? (
            <div style={{ marginTop: 12 }}>
              <CopyBox
                title={`Subject + body (${tab.toUpperCase()})`}
                value={`SUBJECT: ${current.subject}\n\n${current.body}`}
                toast={toast}
                rows={18}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
