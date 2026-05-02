import React, { useMemo, useState } from "react";
import { rowsToCSV } from "../lib/csv.js";
import { downloadText } from "../lib/storage.js";
import { uid } from "../lib/ids.js";
import { joinNonEmpty, safeTrim } from "../lib/text.js";

const EMPTY = {
  name: "",
  website: "",
  city: "",
  services: "",
  contactName: "",
  email: "",
  phone: "",
  socials: "",
  status: "prospect",
  notes: "",
};

export default function BusinessVault({ state, setState, toast }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY);

  const accounts = state.accounts || [];
  const activeId = state.activeAccountId || "";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = accounts.filter(a => {
      if (!needle) return true;
      const blob = [
        a.name,
        a.website,
        a.city,
        a.services,
        a.contactName,
        a.email,
        a.phone,
        a.socials,
        a.status,
        a.notes,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });

    const cmp =
      sort === "newest" ? (a, b) => (b.createdAt || 0) - (a.createdAt || 0) :
      sort === "oldest" ? (a, b) => (a.createdAt || 0) - (b.createdAt || 0) :
      sort === "nameAZ" ? (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }) :
      (a, b) => String(b.name || "").localeCompare(String(a.name || ""), undefined, { sensitivity: "base" });

    return items.sort(cmp);
  }, [accounts, q, sort]);

  function update(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function resetForm() {
    setEditingId("");
    setForm(EMPTY);
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({
      name: a.name || "",
      website: a.website || "",
      city: a.city || "",
      services: a.services || "",
      contactName: a.contactName || "",
      email: a.email || "",
      phone: a.phone || "",
      socials: a.socials || "",
      status: a.status || "prospect",
      notes: a.notes || "",
    });
  }

  function save(e) {
    e.preventDefault();
    const name = safeTrim(form.name);
    const website = safeTrim(form.website);
    const email = safeTrim(form.email);
    const phone = safeTrim(form.phone);

    if (!name && !website && !email && !phone) {
      toast("Add at least a name, website, email, or phone.");
      return;
    }

    if (!editingId) {
      const a = {
        id: uid(),
        ...form,
        name,
        website,
        email,
        phone,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setState(prev => ({ ...prev, accounts: [a, ...(prev.accounts || [])] }));
      toast("Account saved ✅");
      resetForm();
      return;
    }

    setState(prev => ({
      ...prev,
      accounts: (prev.accounts || []).map(a =>
        a.id === editingId
          ? { ...a, ...form, name, website, email, phone, updatedAt: Date.now() }
          : a
      ),
    }));
    toast("Updated ✅");
    resetForm();
  }

  function remove(id) {
    const ok = confirm("Delete this account?");
    if (!ok) return;
    setState(prev => ({
      ...prev,
      accounts: (prev.accounts || []).filter(a => a.id !== id),
      activeAccountId: prev.activeAccountId === id ? "" : prev.activeAccountId,
    }));
    toast("Deleted 🗑️");
    if (editingId === id) resetForm();
  }

  function setActive(id) {
    setState(prev => ({ ...prev, activeAccountId: id }));
    toast("Active account set ✅");
  }

  function exportCSV() {
    const rows = [
      ["name","website","city","services","contactName","email","phone","socials","status","notes","createdAt"],
      ...(accounts || []).map(a => [
        a.name || "",
        a.website || "",
        a.city || "",
        a.services || "",
        a.contactName || "",
        a.email || "",
        a.phone || "",
        a.socials || "",
        a.status || "",
        a.notes || "",
        a.createdAt ? new Date(a.createdAt).toISOString() : "",
      ]),
    ];
    const csv = rowsToCSV(rows);
    const file = `nexusforge-accounts-${new Date().toISOString().slice(0,10)}.csv`;
    downloadText(file, csv, "text/csv");
    toast("CSV exported ⬇️");
  }

  return (
    <div className="panel">
      <h2 className="h2">Business Vault</h2>
      <p className="muted">Store accounts (prospects/partners). Pick an active account to auto-personalize generators.</p>

      <div className="grid2" style={{ alignItems: "start" }}>
        <form className="card" onSubmit={save}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="cardTitle" style={{ marginBottom: 0 }}>{editingId ? "Edit account" : "Add account"}</div>
            {editingId ? <span className="pill">Editing</span> : <span className="pill">New</span>}
          </div>

          <label className="label">Business name</label>
          <input className="input" value={form.name} onChange={e=>update("name", e.target.value)} placeholder="Desert Bloom Plumbing" />

          <label className="label">Website</label>
          <input className="input" value={form.website} onChange={e=>update("website", e.target.value)} placeholder="https://..." />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e=>update("city", e.target.value)} placeholder="Phoenix, AZ" />
            </div>
            <div style={{ width: 170 }}>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e=>update("status", e.target.value)}>
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="partner">Partner</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <label className="label">Services (comma separated)</label>
          <input className="input" value={form.services} onChange={e=>update("services", e.target.value)} placeholder="Web builds, video, SEO" />

          <label className="label">Contact name</label>
          <input className="input" value={form.contactName} onChange={e=>update("contactName", e.target.value)} placeholder="Owner / Manager" />

          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={e=>update("email", e.target.value)} placeholder="owner@biz.com" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e=>update("phone", e.target.value)} placeholder="(602) 555-1234" />
            </div>
          </div>

          <label className="label">Socials</label>
          <input className="input" value={form.socials} onChange={e=>update("socials", e.target.value)} placeholder="IG / FB / TikTok links" />

          <label className="label">Notes</label>
          <textarea className="input" rows={4} value={form.notes} onChange={e=>update("notes", e.target.value)} placeholder="What they need, next step, objections, timeline..." />

          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" type="submit">{editingId ? "Save changes" : "Save account"}</button>
            <button className="btn" type="button" onClick={resetForm}>Clear</button>
          </div>
        </form>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="cardTitle" style={{ marginBottom: 2 }}>Account list</div>
              <div className="muted small">Active account drives Blog Forge + Email Forge personalization.</div>
            </div>
            <button className="btn" type="button" onClick={exportCSV}>Export CSV</button>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 10 }}>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search accounts..." />
            <select className="input" value={sort} onChange={e=>setSort(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="nameAZ">Name A→Z</option>
              <option value="nameZA">Name Z→A</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div className="muted">No accounts yet. Add one on the left.</div>
            ) : (
              <div className="stack">
                {filtered.map(a => {
                  const isActive = a.id === activeId;
                  const sub = joinNonEmpty([
                    a.city,
                    a.services,
                    a.email || a.phone,
                    a.status,
                  ]);
                  return (
                    <div key={a.id} className="item">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                            <div className="itemTitle">{a.name || "Unnamed"}</div>
                            {isActive ? <span className="pill">Active</span> : null}
                          </div>
                          <div className="muted small">{sub || "—"}</div>
                          {a.website ? <div className="small" style={{ marginTop: 6 }}><a href={a.website} target="_blank" rel="noreferrer">{a.website}</a></div> : null}
                        </div>

                        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button className={isActive ? "btn primary" : "btn"} type="button" onClick={()=>setActive(a.id)}>{isActive ? "Active" : "Set active"}</button>
                          <button className="btn" type="button" onClick={()=>startEdit(a)}>Edit</button>
                          <button className="btn danger" type="button" onClick={()=>remove(a.id)}>Delete</button>
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
