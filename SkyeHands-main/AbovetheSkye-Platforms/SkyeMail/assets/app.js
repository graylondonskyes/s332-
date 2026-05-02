const API_BASE = "/.netlify/functions";
const API_FUNCTION_PREFIX = "skymail-standalone-";
const APP_ROOT_URL = new URL("./", window.location.href);
const SMV_LOCAL_KEY = "SMV_LOCAL_RUNTIME_V2";
const SMV_LOCAL_MODE_KEY = "SMV_LOCAL_RUNTIME_MODE";

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function smvHref(path = "", searchParams){
  const normalized = String(path || "").replace(/^\/+/, "");
  const next = new URL(normalized || "./", APP_ROOT_URL);
  if(searchParams && typeof searchParams === "object"){
    Object.entries(searchParams).forEach(([key, value]) => {
      if(value === undefined || value === null || value === "") return;
      next.searchParams.set(key, String(value));
    });
  }
  return `${next.pathname}${next.search}${next.hash}`;
}

function smvRedirect(path = "", searchParams){
  location.href = smvHref(path, searchParams);
}

function safeJsonParse(raw, fallback = null){
  try{ return JSON.parse(raw); }catch(_err){ return fallback; }
}

function currentIso(){
  return new Date().toISOString();
}

function makeId(prefix = "smv"){
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function readLocalRuntime(){
  const parsed = safeJsonParse(localStorage.getItem(SMV_LOCAL_KEY), null);
  if(parsed && parsed.version === 2 && parsed.users && parsed.tokens) return parsed;
  const seeded = { version: 2, users: {}, tokens: {} };
  localStorage.setItem(SMV_LOCAL_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeLocalRuntime(state){
  localStorage.setItem(SMV_LOCAL_KEY, JSON.stringify(state));
  localStorage.setItem(SMV_LOCAL_MODE_KEY, "local-demo");
  return state;
}

function getLocalRuntimeMode(){
  return localStorage.getItem(SMV_LOCAL_MODE_KEY) === "local-demo";
}

function setStatus(el, msg, kind=""){
  if(!el) return;
  el.textContent = msg || "";
  el.style.color = kind === "danger" ? "var(--danger)"
    : kind === "ok" ? "var(--ok)"
    : "var(--muted)";
}

function getToken(){ return localStorage.getItem("SMV_TOKEN") || ""; }
function setToken(t){ localStorage.setItem("SMV_TOKEN", t); }
function clearToken(){ localStorage.removeItem("SMV_TOKEN"); }

function getHandle(){ return localStorage.getItem("SMV_HANDLE") || ""; }
function setHandle(h){ localStorage.setItem("SMV_HANDLE", h); }

function localResponse(statusCode, payload = {}){
  return Promise.resolve({ statusCode, body: payload });
}

function localError(statusCode, message, extra = {}){
  const err = new Error(message);
  err.status = statusCode;
  err.data = Object.assign({ error: message }, extra);
  return Promise.reject(err);
}

function parseBody(body){
  if(!body) return {};
  if(typeof body === "string") return safeJsonParse(body, {});
  return body;
}

function normalizeEmail(value){
  return String(value || "").trim().toLowerCase();
}

function demoAliasPack(email, displayName){
  return [
    {
      sendAsEmail: email,
      displayName,
      verificationStatus: "accepted",
      isPrimary: true,
      isDefault: true,
      treatAsAlias: false,
      signature: `<p>${displayName}<br/>Skyes Over London LC</p>`
    },
    {
      sendAsEmail: `ops+${email.replace(/@/g, "-at-")}@skymail.local`,
      displayName: `${displayName} Ops`,
      verificationStatus: "accepted",
      isPrimary: false,
      isDefault: false,
      treatAsAlias: true,
      signature: `<p>${displayName} Ops<br/>Skye Mail Vault</p>`
    }
  ];
}

function seedAccount(handle, email, password, extras = {}){
  const createdAt = currentIso();
  const displayName = extras.display_name || handle;
  const baseMessages = [
    {
      id: makeId("msg"),
      thread_id: "thread_launch",
      internal_date: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      subject: "Welcome to your local SkyeMail vault",
      from: "Ops Desk <ops@skymail.local>",
      to: email,
      snippet: "This local mailbox stays usable even without deployed Netlify Functions.",
      body: {
        text: "This local mailbox stays usable even without deployed Netlify Functions.\n\nYou can search, draft, send, star, archive, and manage contacts entirely in-browser.",
        html: "<p>This local mailbox stays usable even without deployed Netlify Functions.</p><p>You can search, draft, send, star, archive, and manage contacts entirely in-browser.</p>"
      },
      labels: ["INBOX", "IMPORTANT", "UNREAD"],
      attachments: [],
    },
    {
      id: makeId("msg"),
      thread_id: "thread_launch",
      internal_date: new Date(Date.now() - 1000 * 60 * 33).toISOString(),
      subject: "Re: Welcome to your local SkyeMail vault",
      from: `${displayName} <${email}>`,
      to: "Ops Desk <ops@skymail.local>",
      snippet: "Thanks. The local runtime is enough to prove the product honestly.",
      body: {
        text: "Thanks. The local runtime is enough to prove the product honestly.",
        html: "<p>Thanks. The local runtime is enough to prove the product honestly.</p>"
      },
      labels: ["SENT"],
      attachments: [],
    },
    {
      id: makeId("msg"),
      thread_id: "thread_q3",
      internal_date: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      subject: "Q3 outreach draft review",
      from: "Campaign Lead <campaigns@skymail.local>",
      to: email,
      snippet: "Three enterprise targets are warm. Please tighten the opener and send by noon.",
      body: {
        text: "Three enterprise targets are warm. Please tighten the opener and send by noon.",
        html: "<p>Three enterprise targets are warm. Please tighten the opener and send by noon.</p>"
      },
      labels: ["INBOX", "UNREAD"],
      attachments: [],
    },
    {
      id: makeId("msg"),
      thread_id: "thread_spam",
      internal_date: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      subject: "Invoice reset request",
      from: "Unknown Sender <noise@external.invalid>",
      to: email,
      snippet: "Suspicious reset request parked in spam for review.",
      body: {
        text: "Suspicious reset request parked in spam for review.",
        html: "<p>Suspicious reset request parked in spam for review.</p>"
      },
      labels: ["SPAM", "UNREAD"],
      attachments: [],
    }
  ];
  const draftId = makeId("draft");
  return {
    handle,
    email,
    password,
    rsa_public_key_pem: extras.rsa_public_key_pem || "",
    vault_wrap_json: extras.vault_wrap_json || null,
    recovery_enabled: !!extras.recovery_enabled,
    recovery_blob_json: extras.recovery_blob_json || null,
    active_version: 1,
    keys: [{ version: 1, created_at: createdAt, is_active: true }],
    profile: {
      display_name: displayName,
      profile_title: "Mailbox Operator",
      profile_company: "Skyes Over London LC",
      profile_phone: "(480) 469-5416",
      profile_website: "https://SOLEnterprises.org",
      signature_text: `${displayName}\nSkyes Over London LC`,
      signature_html: `<p>${displayName}<br/>Skyes Over London LC</p>`,
      preferred_from_alias: email,
    },
    gmail: {
      connected: true,
      google_email: email,
      mailbox: { google_email: email, watch_status: "demo-ready", sync_version: 3 },
      sendAs: { displayName, sendAsEmail: email, signature: `<p>${displayName}<br/>Skyes Over London LC</p>` },
      aliases: demoAliasPack(email, displayName),
      signature_scope_ready: true,
      scope_note: "Local demo lane active.",
      contacts_last_sync_at: createdAt,
      vacation: {},
      watch_status: "demo-ready",
    },
    contactsSaved: [
      { id: makeId("contact"), email: "b2b@solenterprises.org", full_name: "B2B Desk", company: "Skyes Over London LC", phone: "(480) 469-5416", notes: "Commercial intake lane", favorite: true, source: "other_contact" },
      { id: makeId("contact"), email: "campaigns@skymail.local", full_name: "Campaign Lead", company: "SkyeMail", phone: "", notes: "Outbound review", favorite: false, source: "google_contact" }
    ],
    contactsRecent: [
      { id: makeId("recent"), email: "ops@skymail.local", full_name: "Ops Desk", company: "SkyeMail", phone: "", notes: "", favorite: false, source: "recent_mail" }
    ],
    messages: baseMessages,
    drafts: [
      {
        id: draftId,
        draft_id: draftId,
        thread_id: "",
        internal_date: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
        to: "prospect@example.com",
        cc: "",
        bcc: "",
        from: `${displayName} <${email}>`,
        subject: "Partnership follow-up",
        snippet: "Checking back in with revised rollout language and next steps.",
        body: {
          text: "Checking back in with revised rollout language and next steps.",
          html: "<p>Checking back in with revised rollout language and next steps.</p>"
        },
        attachments: [],
      }
    ],
  };
}

function getAuthedLocalContext(){
  const state = readLocalRuntime();
  const token = getToken();
  const handle = state.tokens[token];
  if(!token || !handle || !state.users[handle]){
    throw Object.assign(new Error("Unauthorized"), { status: 401, data: { error: "Unauthorized" } });
  }
  return { state, token, handle, user: state.users[handle] };
}

function messageHasLabel(message, label){
  return Array.isArray(message.labels) && message.labels.includes(label);
}

function messageViewMatches(message, label){
  if(label === "INBOX") return messageHasLabel(message, "INBOX") && !messageHasLabel(message, "TRASH") && !messageHasLabel(message, "SPAM");
  if(label === "SENT") return messageHasLabel(message, "SENT");
  if(label === "SPAM") return messageHasLabel(message, "SPAM");
  if(label === "TRASH") return messageHasLabel(message, "TRASH");
  if(label) return messageHasLabel(message, label);
  return true;
}

function searchMatches(message, query){
  const q = String(query || "").trim().toLowerCase();
  if(!q) return true;
  const hay = [
    message.subject,
    message.snippet,
    message.from,
    message.to,
    message.body && message.body.text,
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function messageListItem(message){
  return {
    id: message.id,
    thread_id: message.thread_id,
    subject: message.subject,
    from: message.from,
    snippet: message.snippet,
    internal_date: message.internal_date,
    unread: messageHasLabel(message, "UNREAD"),
    starred: messageHasLabel(message, "STARRED"),
    important: messageHasLabel(message, "IMPORTANT"),
    has_attachments: Array.isArray(message.attachments) && message.attachments.length > 0,
  };
}

function updateRecentContacts(user, message){
  const email = normalizeEmail((message.from || "").match(/<([^>]+)>/)?.[1] || message.from || "");
  if(!email) return;
  user.contactsRecent = user.contactsRecent || [];
  const existing = user.contactsRecent.find((item) => normalizeEmail(item.email) === email);
  const row = {
    id: existing?.id || makeId("recent"),
    email,
    full_name: String(message.from || "").replace(/\s*<[^>]+>\s*$/, "").trim() || email,
    company: "Recent Mail",
    phone: "",
    notes: "",
    favorite: false,
    source: "recent_mail"
  };
  user.contactsRecent = [row].concat(user.contactsRecent.filter((item) => item.id !== row.id)).slice(0, 24);
}

async function localDemoResponse(path, opts = {}){
  const url = new URL(path, "https://skymail.local");
  const pathname = url.pathname;
  const method = String(opts.method || "GET").toUpperCase();
  const body = parseBody(opts.body);

  if(pathname === "/auth-signup"){
    if(method !== "POST") return localError(405, "Method Not Allowed");
    const handle = String(body.handle || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if(!/^[a-z0-9][a-z0-9-]{2,31}$/i.test(handle)) return localError(400, "Handle must be 3-32 chars and use letters/numbers/dash only.");
    if(!email.includes("@")) return localError(400, "Valid email required.");
    if(password.length < 10) return localError(400, "Password must be at least 10 characters.");
    const state = readLocalRuntime();
    if(state.users[handle]) return localError(409, "Handle already exists.");
    state.users[handle] = seedAccount(handle, email, password, body);
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, handle, local_demo: true });
  }

  if(pathname === "/auth-login"){
    if(method !== "POST") return localError(405, "Method Not Allowed");
    const ident = normalizeEmail(body.ident || body.handle || "");
    const password = String(body.password || "");
    const state = readLocalRuntime();
    const user = Object.values(state.users).find((row) => normalizeEmail(row.email) === ident || String(row.handle).toLowerCase() === ident);
    if(!user || user.password !== password) return localError(401, "Invalid credentials.");
    const token = makeId("token");
    state.tokens[token] = user.handle;
    writeLocalRuntime(state);
    return localResponse(200, { token, handle: user.handle, local_demo: true });
  }

  if(pathname === "/admin-public-key"){
    return localResponse(200, { public_key_pem: null, local_demo: true });
  }

  let ctx;
  try{
    ctx = getAuthedLocalContext();
  }catch(err){
    return localError(err.status || 401, err.message || "Unauthorized", err.data || {});
  }
  const { state, user, handle } = ctx;

  if(pathname === "/auth-me"){
    return localResponse(200, {
      handle,
      email: user.email,
      active_version: user.active_version || 1,
      keys: user.keys || [],
      local_demo: true
    });
  }

  if(pathname === "/vault-export"){
    return localResponse(200, {
      user: { handle, email: user.email },
      keys: user.keys || [],
      vault_wrap_json: user.vault_wrap_json || null,
      recovery_enabled: !!user.recovery_enabled,
      local_demo: true
    });
  }

  if(pathname === "/vault-restore-keys"){
    const incoming = parseBody(opts.body);
    if(Array.isArray(incoming.keys) && incoming.keys.length){
      user.keys = incoming.keys;
      user.active_version = Number(incoming.keys.find((item) => item.is_active)?.version || incoming.keys[incoming.keys.length - 1].version || 1);
      writeLocalRuntime(state);
    }
    return localResponse(200, { ok: true, active_version: user.active_version || 1, local_demo: true });
  }

  if(pathname === "/keys-rotate"){
    const nextVersion = Number(user.active_version || 1) + 1;
    user.active_version = nextVersion;
    user.rsa_public_key_pem = body.rsa_public_key_pem || user.rsa_public_key_pem;
    user.vault_wrap_json = body.vault_wrap_json || user.vault_wrap_json;
    user.keys = (user.keys || []).map((item) => Object.assign({}, item, { is_active: false }));
    user.keys.push({ version: nextVersion, created_at: currentIso(), is_active: true });
    writeLocalRuntime(state);
    return localResponse(200, { active_version: nextVersion, local_demo: true });
  }

  if(pathname === "/google-status"){
    return localResponse(200, {
      ok: true,
      connected: !!user.gmail?.connected,
      mailbox: Object.assign({ google_email: user.email, watch_status: "demo-ready", sync_version: 3 }, user.gmail?.mailbox || {}),
      local_demo: true
    });
  }

  if(pathname === "/google-oauth-start"){
    user.gmail = user.gmail || {};
    user.gmail.connected = true;
    user.gmail.google_email = user.email;
    user.gmail.mailbox = Object.assign({}, user.gmail.mailbox || {}, { google_email: user.email, watch_status: user.gmail.watch_status || "demo-ready", sync_version: 4 });
    writeLocalRuntime(state);
    return localResponse(200, {
      ok: true,
      url: url.searchParams.get("next") || smvHref("dashboard.html"),
      local_demo: true,
      localDemoConnected: true
    });
  }

  if(pathname === "/google-disconnect"){
    user.gmail.connected = false;
    user.gmail.mailbox = Object.assign({}, user.gmail.mailbox || {}, { watch_status: "disconnected" });
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/gmail-watch"){
    const expiration = Date.now() + 1000 * 60 * 60 * 24;
    user.gmail.watch_status = "demo-active";
    user.gmail.mailbox = Object.assign({}, user.gmail.mailbox || {}, { watch_status: "demo-active", sync_version: Number(user.gmail.mailbox?.sync_version || 0) + 1 });
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, watch: { expiration }, local_demo: true });
  }

  if(pathname === "/gmail-labels"){
    const labels = ["INBOX", "SENT", "DRAFT", "SPAM", "TRASH"];
    const items = labels.map((label) => {
      const source = label === "DRAFT" ? (user.drafts || []) : (user.messages || []).filter((message) => messageViewMatches(message, label));
      const unread = label === "DRAFT" ? 0 : source.filter((message) => messageHasLabel(message, "UNREAD")).length;
      return { id: label, name: label, messagesUnread: unread, messagesTotal: source.length };
    });
    return localResponse(200, { items, local_demo: true });
  }

  if(pathname === "/gmail-list"){
    const label = url.searchParams.get("label") || "INBOX";
    const query = url.searchParams.get("q") || "";
    const items = (user.messages || [])
      .filter((message) => messageViewMatches(message, label))
      .filter((message) => searchMatches(message, query))
      .sort((a, b) => new Date(b.internal_date) - new Date(a.internal_date))
      .map(messageListItem);
    return localResponse(200, { items, mailbox: user.email, nextPageToken: null, local_demo: true });
  }

  if(pathname === "/gmail-get"){
    const id = url.searchParams.get("id") || "";
    const message = (user.messages || []).find((item) => item.id === id);
    if(!message) return localError(404, "Message not found.");
    const headers = {
      subject: message.subject || "",
      from: message.from || "",
      to: message.to || "",
      date: message.internal_date || ""
    };
    return localResponse(200, {
      message: {
        id: message.id,
        thread_id: message.thread_id,
        internal_date: message.internal_date,
        headers,
        labels: message.labels || [],
        body: message.body || { text: "", html: "" },
        attachments: message.attachments || [],
      },
      local_demo: true
    });
  }

  if(pathname === "/gmail-thread-get"){
    const id = url.searchParams.get("id") || "";
    const messages = (user.messages || [])
      .filter((item) => item.thread_id === id || item.id === id)
      .sort((a, b) => new Date(a.internal_date) - new Date(b.internal_date));
    if(!messages.length) return localError(404, "Thread not found.");
    return localResponse(200, {
      thread: {
        id: messages[0].thread_id || messages[0].id,
        subject: messages[messages.length - 1].subject,
        message_count: messages.length,
        participants: Array.from(new Set(messages.flatMap((item) => [item.from, item.to]).filter(Boolean))),
        messages: messages.map((message) => ({
          id: message.id,
          thread_id: message.thread_id,
          internal_date: message.internal_date,
          headers: {
            subject: message.subject || "",
            from: message.from || "",
            to: message.to || "",
            cc: message.cc || "",
            date: message.internal_date || "",
          },
          labels: message.labels || [],
          starred: messageHasLabel(message, "STARRED"),
          body: message.body || { text: "", html: "" },
          attachments: message.attachments || [],
        })),
      },
      local_demo: true
    });
  }

  if(pathname === "/gmail-modify" || pathname === "/gmail-batch-modify"){
    const ids = pathname === "/gmail-modify" ? [body.id] : (body.ids || []);
    const addLabelIds = body.addLabelIds || [];
    const removeLabelIds = body.removeLabelIds || [];
    ids.forEach((id) => {
      const message = (user.messages || []).find((item) => item.id === id);
      if(!message) return;
      const labels = new Set(message.labels || []);
      addLabelIds.forEach((label) => labels.add(label));
      removeLabelIds.forEach((label) => labels.delete(label));
      message.labels = Array.from(labels);
    });
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/gmail-message-trash"){
    (body.ids || []).forEach((id) => {
      const message = (user.messages || []).find((item) => item.id === id);
      if(!message) return;
      const labels = new Set(message.labels || []);
      if(body.action === "untrash"){
        labels.delete("TRASH");
        if(!labels.has("SENT") && !labels.has("SPAM")) labels.add("INBOX");
      }else{
        labels.delete("INBOX");
        labels.add("TRASH");
      }
      message.labels = Array.from(labels);
    });
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/gmail-batch-delete"){
    user.messages = (user.messages || []).filter((item) => !(body.ids || []).includes(item.id));
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/gmail-drafts-list"){
    const query = url.searchParams.get("q") || "";
    const items = (user.drafts || [])
      .filter((draft) => searchMatches({ subject: draft.subject, snippet: draft.snippet, from: draft.from, to: draft.to, body: draft.body }, query))
      .sort((a, b) => new Date(b.internal_date) - new Date(a.internal_date))
      .map((draft) => ({
        draft_id: draft.draft_id,
        subject: draft.subject,
        to: draft.to,
        from: draft.from,
        internal_date: draft.internal_date,
        snippet: draft.snippet,
      }));
    return localResponse(200, { items, mailbox: user.email, nextPageToken: null, local_demo: true });
  }

  if(pathname === "/gmail-draft-get"){
    const id = url.searchParams.get("id") || "";
    const draft = (user.drafts || []).find((item) => item.draft_id === id || item.id === id);
    if(!draft) return localError(404, "Draft not found.");
    return localResponse(200, { draft, mailbox: user.email, local_demo: true });
  }

  if(pathname === "/gmail-draft-save"){
    const id = String(body.id || makeId("draft"));
    const existing = (user.drafts || []).find((item) => item.draft_id === id || item.id === id);
    const draft = existing || { id, draft_id: id, thread_id: body.thread_id || "" };
    draft.to = body.to || "";
    draft.cc = body.cc || "";
    draft.bcc = body.bcc || "";
    draft.from = `${user.profile.display_name || handle} <${body.from_alias || user.email}>`;
    draft.subject = body.subject || "(no subject)";
    draft.internal_date = currentIso();
    draft.snippet = String(body.text || body.html || "").trim().slice(0, 140);
    draft.body = { text: body.text || "", html: body.html || "" };
    draft.attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if(!existing) user.drafts = [draft].concat(user.drafts || []);
    writeLocalRuntime(state);
    return localResponse(200, { draft, mailbox: user.email, local_demo: true });
  }

  if(pathname === "/gmail-draft-delete"){
    user.drafts = (user.drafts || []).filter((item) => item.draft_id !== body.id && item.id !== body.id);
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/gmail-send"){
    const threadId = body.reply_thread_id || body.thread_id || makeId("thread");
    const subject = body.subject || "(no subject)";
    const sent = {
      id: makeId("msg"),
      thread_id: threadId,
      internal_date: currentIso(),
      subject,
      from: `${user.profile.display_name || handle} <${body.from_alias || user.email}>`,
      to: body.to || "",
      cc: body.cc || "",
      bcc: body.bcc || "",
      snippet: String(body.text || body.html || "").trim().slice(0, 140),
      body: { text: body.text || "", html: body.html || "" },
      labels: ["SENT"],
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    };
    user.messages.unshift(sent);
    user.drafts = (user.drafts || []).filter((item) => item.draft_id !== body.id && item.id !== body.id);
    if(normalizeEmail(body.to)){
      user.contactsRecent = user.contactsRecent || [];
      const existing = user.contactsRecent.find((item) => normalizeEmail(item.email) === normalizeEmail(body.to));
      const entry = {
        id: existing?.id || makeId("recent"),
        email: normalizeEmail(body.to),
        full_name: normalizeEmail(body.to),
        company: "Recent Mail",
        phone: "",
        notes: "",
        favorite: false,
        source: "recent_mail"
      };
      user.contactsRecent = [entry].concat(user.contactsRecent.filter((item) => item.id !== entry.id)).slice(0, 24);
    }
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, mailbox: user.email, from_alias: body.from_alias || user.email, message: sent, local_demo: true });
  }

  if(pathname === "/mail-settings-get"){
    return localResponse(200, {
      profile: user.profile || {},
      gmail: Object.assign({}, user.gmail || {}, {
        connected: !!user.gmail?.connected,
        google_email: user.email,
        aliases: user.gmail?.aliases || demoAliasPack(user.email, user.profile?.display_name || handle),
        sendAs: user.gmail?.sendAs || { displayName: user.profile?.display_name || handle, sendAsEmail: user.email, signature: user.profile?.signature_html || "" },
      }),
      local_demo: true
    });
  }

  if(pathname === "/mail-settings-save"){
    user.profile = Object.assign({}, user.profile || {}, {
      display_name: body.display_name || user.profile?.display_name || handle,
      profile_title: body.profile_title || "",
      profile_company: body.profile_company || "",
      profile_phone: body.profile_phone || "",
      profile_website: body.profile_website || "",
      signature_text: body.signature_text || "",
      signature_html: body.signature_html || "",
      preferred_from_alias: body.preferred_from_alias || user.email,
    });
    user.gmail = Object.assign({}, user.gmail || {}, {
      aliases: demoAliasPack(user.email, user.profile.display_name || handle),
      sendAs: { displayName: user.profile.display_name || handle, sendAsEmail: user.email, signature: user.profile.signature_html || "" },
      vacation: {
        enableAutoReply: !!body.vacation_enabled,
        responseSubject: body.vacation_subject || "",
        responseBodyPlainText: body.vacation_response_text || "",
        responseBodyHtml: body.vacation_response_html || "",
        restrictToContacts: !!body.vacation_restrict_contacts,
        restrictToDomain: !!body.vacation_restrict_domain,
        startTime: body.vacation_start ? new Date(body.vacation_start).getTime() : null,
        endTime: body.vacation_end ? new Date(body.vacation_end).getTime() : null,
      }
    });
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, local_demo: true });
  }

  if(pathname === "/contacts-list"){
    const q = normalizeEmail(url.searchParams.get("q") || "");
    const saved = (user.contactsSaved || []).filter((item) => !q || `${item.email} ${item.full_name} ${item.company} ${item.notes}`.toLowerCase().includes(q));
    const recent = (user.contactsRecent || []).filter((item) => !q || `${item.email} ${item.full_name}`.toLowerCase().includes(q));
    return localResponse(200, {
      saved,
      recent,
      sync: {
        connected: !!user.gmail?.connected,
        last_sync_at: user.gmail?.contacts_last_sync_at || null,
        last_sync_count: saved.length,
      },
      local_demo: true
    });
  }

  if(pathname === "/contacts-save"){
    const id = String(body.id || makeId("contact"));
    const contact = {
      id,
      email: normalizeEmail(body.email),
      full_name: body.full_name || normalizeEmail(body.email),
      company: body.company || "",
      phone: body.phone || "",
      notes: body.notes || "",
      favorite: !!body.favorite,
      source: body.sync_google ? "google_contact" : "other_contact"
    };
    user.contactsSaved = [contact].concat((user.contactsSaved || []).filter((item) => item.id !== id));
    writeLocalRuntime(state);
    return localResponse(200, { contact, synced_google: !!body.sync_google, local_demo: true });
  }

  if(pathname === "/contacts-delete"){
    user.contactsSaved = (user.contactsSaved || []).filter((item) => item.id !== body.id);
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, note: "Contact deleted from local demo vault.", local_demo: true });
  }

  if(pathname === "/google-contacts-sync"){
    user.gmail.contacts_last_sync_at = currentIso();
    writeLocalRuntime(state);
    return localResponse(200, { ok: true, synced_count: (user.contactsSaved || []).length, local_demo: true });
  }

  if(pathname === "/gmail-attachment"){
    const messageId = url.searchParams.get("id") || "";
    const attachmentId = url.searchParams.get("attachmentId") || "";
    const message = (user.messages || []).find((item) => item.id === messageId);
    const attachment = (message?.attachments || []).find((item) => item.attachment_id === attachmentId);
    if(!attachment?.data_b64) return localError(404, "Attachment not found.");
    return localResponse(200, {
      attachment_url: `data:${attachment.mime_type || "application/octet-stream"};base64,${attachment.data_b64}`,
      local_demo: true
    });
  }

  return localError(404, `Local demo handler missing for ${pathname}`);
}

function smvApiUrl(path = ""){
  const normalized = String(path || "");
  if(/^https?:\/\//i.test(normalized)) return normalized;
  if(getLocalRuntimeMode() && normalized.startsWith("/gmail-attachment")){
    try{
      const ctx = getAuthedLocalContext();
      const url = new URL(normalized, "https://skymail.local");
      const message = (ctx.user.messages || []).find((item) => item.id === url.searchParams.get("id"));
      const attachment = (message?.attachments || []).find((item) => item.attachment_id === url.searchParams.get("attachmentId"));
      if(attachment?.data_b64){
        return `data:${attachment.mime_type || "application/octet-stream"};base64,${attachment.data_b64}`;
      }
    }catch(_err){}
  }
  const parsed = new URL(normalized.startsWith("/") ? normalized : `/${normalized}`, "https://skymail.local");
  const functionName = `${API_FUNCTION_PREFIX}${parsed.pathname.replace(/^\/+/, "")}`;
  return `${API_BASE}/${functionName}${parsed.search}${parsed.hash}`;
}

async function apiFetch(path, opts = {}){
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers || {});
  const token = getToken();
  if(token) headers.Authorization = "Bearer " + token;

  if(getLocalRuntimeMode()){
    const local = await localDemoResponse(path, Object.assign({}, opts, { headers }));
    if(local.statusCode >= 400){
      const err = new Error((local.body && local.body.error) ? local.body.error : ("HTTP " + local.statusCode));
      err.status = local.statusCode;
      err.data = local.body;
      throw err;
    }
    return local.body;
  }

  const res = await fetch(smvApiUrl(path), Object.assign({}, opts, { headers }));
  const text = await res.text();
  let data = null;
  try{
    data = text ? JSON.parse(text) : null;
  }catch(_err){
    const looksHtml = /<\s*!doctype\s+html/i.test(text || "");
    data = looksHtml ? { error: "Server functions not found. Falling back to local demo runtime.", raw: text, local_demo: true } : { error: "Non-JSON response", raw: text };
  }

  if(res.ok) return data;

  const shouldFallback = res.status === 404 && data && data.local_demo;
  if(shouldFallback){
    const local = await localDemoResponse(path, Object.assign({}, opts, { headers }));
    if(local.statusCode >= 400){
      const err = new Error((local.body && local.body.error) ? local.body.error : ("HTTP " + local.statusCode));
      err.status = local.statusCode;
      err.data = local.body;
      throw err;
    }
    return local.body;
  }

  const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
  err.status = res.status;
  err.data = data;
  throw err;
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch(_err){ return iso; }
}

function requireAuthOrRedirect(){
  const token = getToken();
  if(!token){
    smvRedirect("login.html");
    return false;
  }
  return true;
}

function logout(){
  clearToken();
  smvRedirect("index.html");
}

function safe(s){ return (s || "").replace(/[<>&"]/g, (c) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c])); }

// Stores decrypted subjects/snippets locally so the user can search without server plaintext.
(function(){
  const KEY = "smv_search_index_v1";
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_err){ return []; }
  }
  function save(arr){
    try{
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 2000)));
    }catch(_err){}
  }
  function upsert(item){
    const arr = load();
    const i = arr.findIndex((x) => x.id === item.id);
    if(i >= 0) arr[i] = { ...arr[i], ...item };
    else arr.unshift(item);
    const seen = new Set();
    const out = [];
    for(const x of arr){
      if(!x || !x.id || seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
    save(out);
  }
  function search(q){
    q = String(q || "").trim().toLowerCase();
    if(!q) return load();
    const arr = load();
    return arr.filter((x) => {
      const hay = `${x.subject || ""} ${x.snippet || ""} ${x.from_email || ""} ${x.from_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  function clear(){ try{ localStorage.removeItem(KEY); }catch(_err){} }
  window.SMVSearchIndex = { load, upsert, search, clear };
})();

window.SMVRuntime = {
  apiBase: API_BASE,
  apiUrl: smvApiUrl,
  appRoot: APP_ROOT_URL.pathname,
  href: smvHref,
  redirect: smvRedirect,
  localMode: getLocalRuntimeMode,
  localDemoResponse,
};
