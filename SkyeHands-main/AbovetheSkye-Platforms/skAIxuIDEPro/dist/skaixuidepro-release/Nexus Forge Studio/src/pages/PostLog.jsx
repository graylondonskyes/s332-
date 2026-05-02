import React, { useMemo, useState } from "react";
import AccountPicker from "../components/AccountPicker.jsx";
import { uid } from "../lib/ids.js";
import { rowsToCSV } from "../lib/csv.js";
import { downloadText } from "../lib/storage.js";
import { joinNonEmpty, safeTrim } from "../lib/text.js";

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  title: "",
  url: "",
  keyword: "",
  city: "",
  service: "",
  status: "draft",
};

export default function PostLog({ state, setState, toast }) {
  const accounts = state.accounts || [];
  const active = accounts.find(a => a.id === (state.activeAccountId || "")) || null;

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY);

  const items = state.postLog || [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter(p => {
      if (statusFilter !== "all" && (p.status || "draft") !== statusFilter) return false;
      if (!needle) return true;
      const blob = [p.title, p.url, p.keyword, p.city, p.service, p.accountName, p.status].join(" ").toLowerCase();
      return blob.includes(needle);
    });
    const cmp =
      sort === "newest" ? (a,b)=> (b.createdAt||0)-(a.createdAt||0) :
      sort === "oldest" ? (a,b)=> (a.createdAt||0)-(b.createdAt||0) :
      sort === "dateDesc" ? (a,b)=> String(b.date||"").localeCompare(String(a.date||"")) :
      (a,b)=> String(a.date||"").localeCompare(String(b.date||""));
    return list.sort(cmp);
  }, [items, q, sort, statusFilter]);

  const kpi = useMemo(() => {
    const total = items.length;
    const published = items.filter(x => x.status === "published").length;
    const scheduled = items.filter(x => x.status === "scheduled").length;
    return { total, published, scheduled };
  }, [items]);

  function update(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
  }

  function autoFill() {
    setForm(prev => ({
      ...prev,
      city: safeTrim(prev.city) || safeTrim(active?.city) || "",
      service: safeTrim(prev.service) || safeTrim(active?.services) || "",
    }));
    toast("Auto-filled ✅");
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      date: p.date || new Date().toISOString().slice(0, 10),
      title: p.title || "",
      url: p.url || "",
      keyword: p.keyword || "",
      city: p.city || "",
      service: p.service || "",
      status: p.status || "draft",
    });
  }

  function save(e) {
    e.preventDefault();
    const title = safeTrim(form.title);
    if (!title) return toast("Title required.");
    const entry = {
      date: safeTrim(form.date),
      title,
      url: safeTrim(form.url),
      keyword: safeTrim(form.keyword),
      city: safeTrim(form.city),
      service: safeTrim(form.service),
      status: safeTrim(form.status) || "draft",
      accountId: active?.id || "",
      accountName: active?.name || "",
    };

    if (!editingId) {
      setState(prev => ({ ...prev, postLog: [{ id: uid(), ...entry, createdAt: Date.now() }, ...(prev.postLog || [])] }));
      toast("Added ✅");
      resetForm();
      return;
    }

    setState(prev => ({
      ...prev,
      postLog: (prev.postLog || []).map(p => p.id === editingId ? { ...p, ...entry } : p),
    }));
    toast("Updated ✅");
    resetForm();
  }

  function remove(id) {
    const ok = confirm("Delete this post log entry?");
    if (!ok) return;
    setState(prev => ({ ...prev, postLog: (prev.postLog || []).filter(p => p.id !== id) }));
    toast("Deleted 🗑️");
    if (editingId === id) resetForm();
  }

  function exportCSV() {
    const rows = [
      ["date","account","title","url","keyword","city","service","status"],
      ...(items || []).map(p => [
        p.date || "",
        p.accountName || "",
        p.title || "",
        p.url || "",
        p.keyword || "",
        p.city || "",
        p.service || "",
        p.status || "",
      ]),
    ];
    const csv = rowsToCSV(rows);
    const file = `nexusforge-post-log-${new Date().toISOString().slice(0,10)}.csv`;
    downloadText(file, csv, "text/csv");
    toast("CSV exported ⬇️");
  }

  return (
    <div className="panel">
      <h2 className="h2">Post Log</h2>
      <p className="muted">Track drafts/scheduled/published posts so you don’t duplicate work. Exportable for contractors.</p>

      <AccountPicker state={state} setState={setState} toast={toast} label="Active account (optional)" />

      <div className="grid2" style={{ alignItems: "start" }}>
        <form className="card" onSubmit={save}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="cardTitle" style={{ marginBottom: 0 }}>{editingId ? "Edit entry" : "Add entry"}</div>
            <span className="pill">{active?.name ? `For: ${active.name}` : "No account"}</span>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e=>update("date", e.target.value)} />
            </div>
            <div style={{ width: 190 }}>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>update("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={e=>update("title", e.target.value)} placeholder="Blog post title" />

          <label className="label">URL (when live)</label>
          <input className="input" value={form.url} onChange={e=>update("url", e.target.value)} placeholder="https://..." />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Keyword</label>
              <input className="input" value={form.keyword} onChange={e=>update("keyword", e.target.value)} placeholder="keyword" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e=>update("city", e.target.value)} placeholder="Phoenix, AZ" />
            </div>
          </div>

          <label className="label">Service</label>
          <input className="input" value={form.service} onChange={e=>update("service", e.target.value)} placeholder="SEO" />

          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" type="submit">{editingId ? "Save" : "Add"}</button>
            <button className="btn" type="button" onClick={autoFill} disabled={!active}>Auto-fill from account</button>
            <button className="btn" type="button" onClick={resetForm}>Clear</button>
          </div>
        </form>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="cardTitle" style={{ marginBottom: 2 }}>Entries</div>
              <div className="muted small">Total: {kpi.total} • Published: {kpi.published} • Scheduled: {kpi.scheduled}</div>
            </div>
            <button className="btn" type="button" onClick={exportCSV}>Export CSV</button>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." />
            <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
            <select className="input" value={sort} onChange={e=>setSort(e.target.value)} style={{ maxWidth: 170 }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="dateDesc">Date ↓</option>
              <option value="dateAsc">Date ↑</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div className="muted">No entries yet.</div>
            ) : (
              <div className="stack">
                {filtered.map(p => {
                  const sub = joinNonEmpty([
                    p.date,
                    p.city,
                    p.service,
                    p.keyword,
                    p.accountName,
                    p.status,
                  ]);
                  return (
                    <div key={p.id} className="item">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                            <div className="itemTitle">{p.title}</div>
                            <span className="pill">{p.status || "draft"}</span>
                          </div>
                          <div className="muted small">{sub || "—"}</div>
                          {p.url ? (
                            <div className="small" style={{ marginTop: 6 }}>
                              <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                            </div>
                          ) : null}
                        </div>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button className="btn" type="button" onClick={()=>startEdit(p)}>Edit</button>
                          <button className="btn danger" type="button" onClick={()=>remove(p.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
