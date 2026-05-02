import React, { useMemo, useState } from "react";
import AccountPicker from "../components/AccountPicker.jsx";
import CopyBox from "../components/CopyBox.jsx";
import { uid } from "../lib/ids.js";
import { buildBlogBrief } from "../lib/templates.js";
import { safeTrim } from "../lib/text.js";
import { gwChat } from "../lib/gateway.js";

const DEFAULT_FORM = {
  keyword: "",
  city: "",
  service: "",
  angle: "Local success case study",
};

export default function GeneratorLab({ state, setState, toast }) {
  const accounts = state.accounts || [];
  const active = accounts.find(a => a.id === (state.activeAccountId || "")) || null;

  const [tab, setTab] = useState("brief");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [last, setLast] = useState(null);
  const [aiArticle, setAiArticle] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function aiWrite() {
    if (!last) return toast("Generate a brief first.");
    setAiLoading(true);
    setTab("ai");
    setAiArticle("");
    try {
      const systemMsg = {
        role: "user",
        content:
          `You are an expert editorial writer. Write a full, publish-ready SEO article (800-1200 words) ` +
          `using the brief below. Use clear headings, natural language, zero fluff. Do not include meta tags or HTML — plain markdown only.\n\n` +
          last.prompt,
      };
      const result = await gwChat([systemMsg], { maxTokens: 2048 });
      setAiArticle(result);
      toast("AI article ready ✦");
    } catch (e) {
      setAiArticle(`Error: ${e.message}`);
      toast("AI write failed — check your key in Settings.");
    } finally {
      setAiLoading(false);
    }
  }

  const settings = state.settings || {};

  function update(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  const autoCity = safeTrim(form.city) || safeTrim(active?.city) || safeTrim(settings.defaultCity) || "";
  const autoService = safeTrim(form.service) || safeTrim(active?.services) || "";

  function generate() {
    const out = buildBlogBrief({
      account: active,
      keyword: form.keyword,
      city: autoCity,
      service: autoService,
      angle: form.angle,
      settings,
    });
    setLast(out);
    setTab("brief");
    toast("Generated ⚡");
  }

  function saveDraft() {
    if (!last) return toast("Generate something first.");
    const d = {
      id: uid(),
      accountId: active?.id || "",
      accountName: active?.name || "",
      headline: last.headline,
      metaTitle: last.metaTitle,
      metaDesc: last.metaDesc,
      slug: last.slug,
      keyword: last.keyword,
      city: last.city,
      service: last.service,
      angle: last.angle,
      html: last.html,
      prompt: last.prompt,
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, drafts: [d, ...(prev.drafts || [])] }));
    toast("Saved to Draft Vault ✅");
    setTab("vault");
  }

  function addToPostLog() {
    if (!last) return toast("Generate something first.");
    const entry = {
      id: uid(),
      accountId: active?.id || "",
      accountName: active?.name || "",
      date: new Date().toISOString().slice(0, 10),
      title: last.headline,
      url: "",
      keyword: last.keyword,
      city: last.city,
      service: last.service,
      status: "draft",
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, postLog: [entry, ...(prev.postLog || [])] }));
    toast("Added to Post Log ✅");
  }

  const vault = useMemo(() => {
    const items = (state.drafts || []).slice();
    return items.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }, [state.drafts]);

  function loadDraft(d) {
    setLast({
      headline: d.headline,
      metaTitle: d.metaTitle,
      metaDesc: d.metaDesc,
      slug: d.slug,
      keyword: d.keyword,
      city: d.city,
      service: d.service,
      angle: d.angle,
      html: d.html,
      prompt: d.prompt,
      outline: [],
      faq: [],
      internalLinks: [],
    });
    toast("Loaded draft ✅");
    setTab("brief");
  }

  function removeDraft(id) {
    const ok = confirm("Delete this draft?");
    if (!ok) return;
    setState(prev => ({ ...prev, drafts: (prev.drafts || []).filter(x => x.id !== id) }));
    toast("Deleted 🗑️");
  }

  return (
    <div className="panel">
      <h2 className="h2">Generator Lab</h2>
      <p className="muted">Offline content engine: generate an editorial brief + HTML skeleton + an AI prompt pack. Save outputs to Draft Vault.</p>

      <AccountPicker state={state} setState={setState} toast={toast} />

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="cardTitle">Inputs</div>

          <label className="label">Primary keyword (optional)</label>
          <input className="input" value={form.keyword} onChange={e=>update("keyword", e.target.value)} placeholder="plumber phoenix" />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e=>update("city", e.target.value)} placeholder={settings.defaultCity || "Phoenix, AZ"} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Service</label>
              <input className="input" value={form.service} onChange={e=>update("service", e.target.value)} placeholder="web design" />
            </div>
          </div>

          <label className="label">Angle</label>
          <select className="input" value={form.angle} onChange={e=>update("angle", e.target.value)}>
            <option>Local success case study</option>
            <option>Service explainer + buyer checklist</option>
            <option>Best-of local guide</option>
            <option>Pricing + what to expect</option>
            <option>Common mistakes + fixes</option>
          </select>

          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" type="button" onClick={generate}>Generate brief</button>
            <button className="btn ai" type="button" onClick={aiWrite} disabled={!last||aiLoading}>{aiLoading?"Writing…":"✦ AI Write"}</button>
            <button className="btn" type="button" onClick={() => { setForm(DEFAULT_FORM); toast("Cleared"); }}>Reset</button>
            <span className="pill">Auto city: {autoCity || "—"}</span>
          </div>

          <div className="hr" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={saveDraft} disabled={!last}>Save to Draft Vault</button>
            <button className="btn" type="button" onClick={addToPostLog} disabled={!last}>Add to Post Log</button>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>
            Tip: Set an active account in Business Vault to auto-personalize headlines.
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="cardTitle" style={{ marginBottom: 0 }}>Output</div>
            <div className="tabs" style={{ margin: 0 }}>
              <button className={tab === "brief" ? "tabBtn active" : "tabBtn"} type="button" onClick={()=>setTab("brief")}>Brief</button>
              <button className={tab === "html" ? "tabBtn active" : "tabBtn"} type="button" onClick={()=>setTab("html")}>HTML</button>
              <button className={tab === "prompt" ? "tabBtn active" : "tabBtn"} type="button" onClick={()=>setTab("prompt")}>Prompt Pack</button>
              <button className={tab === "ai" ? "tabBtn active" : "tabBtn"} type="button" onClick={()=>setTab("ai")}>✦ AI Article</button>
              <button className={tab === "vault" ? "tabBtn active" : "tabBtn"} type="button" onClick={()=>setTab("vault")}>Draft Vault</button>
            </div>
          </div>

          {!last && tab !== "vault" ? (
            <div className="muted" style={{ marginTop: 12 }}>Generate your first brief to see outputs here.</div>
          ) : null}

          {tab === "brief" && last ? (
            <div style={{ marginTop: 12 }}>
              <div className="item">
                <div className="itemTitle">Headline</div>
                <div className="muted">{last.headline}</div>
              </div>

              <div className="grid2" style={{ marginTop: 10 }}>
                <div className="item">
                  <div className="itemTitle">Meta title</div>
                  <div className="muted">{last.metaTitle}</div>
                </div>
                <div className="item">
                  <div className="itemTitle">Slug</div>
                  <div className="muted mono">/{last.slug}</div>
                </div>
              </div>

              <div className="item" style={{ marginTop: 10 }}>
                <div className="itemTitle">Meta description</div>
                <div className="muted">{last.metaDesc}</div>
              </div>

              <div className="item" style={{ marginTop: 10 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="itemTitle">Outline</div>
                  <span className="pill">Keyword: {last.keyword}</span>
                </div>
                <ol className="list">
                  {(last.outline || []).map((x, i) => <li key={i}>{x}</li>)}
                </ol>
              </div>
            </div>
          ) : null}

          {tab === "html" && last ? (
            <div style={{ marginTop: 12 }}>
              <CopyBox title="HTML skeleton" value={last.html} toast={toast} rows={14} />
            </div>
          ) : null}

          {tab === "prompt" && last ? (
            <div style={{ marginTop: 12 }}>
              <CopyBox title="AI prompt pack" value={last.prompt} toast={toast} rows={14} />
            </div>
          ) : null}

          {tab === "ai" ? (
            <div style={{ marginTop: 12 }}>
              {aiLoading ? (
                <div className="muted" style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span className="spin" style={{ display:"inline-block" }} />
                  Writing your article via kAIxU Gateway…
                </div>
              ) : aiArticle ? (
                <CopyBox title="AI-written article (markdown)" value={aiArticle} toast={toast} rows={18} />
              ) : (
                <div className="muted">Click <strong>✦ AI Write</strong> in the Inputs panel to generate a full article from the brief.</div>
              )}
            </div>
          ) : null}

          {tab === "vault" ? (
            <div style={{ marginTop: 12 }}>
              {vault.length === 0 ? (
                <div className="muted">No drafts saved yet. Generate then “Save to Draft Vault”.</div>
              ) : (
                <div className="stack">
                  {vault.slice(0, 30).map(d => (
                    <div key={d.id} className="item">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="itemTitle">{d.headline || "Untitled"}</div>
                          <div className="muted small">
                            {(d.accountName ? `${d.accountName} • ` : "")}{d.city || ""} • {d.service || ""}
                            {d.createdAt ? ` • ${new Date(d.createdAt).toLocaleString()}` : ""}
                          </div>
                          <div className="muted" style={{ marginTop: 6 }}>{d.metaDesc || ""}</div>
                        </div>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button className="btn" type="button" onClick={() => loadDraft(d)}>Load</button>
                          <button className="btn danger" type="button" onClick={() => removeDraft(d.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
