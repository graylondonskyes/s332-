import React from "react";

export default function Dashboard({ state }) {
  const accountCount = (state.accounts || []).length;
  const draftCount = (state.drafts || []).length;
  const postCount = (state.postLog || []).length;
  const newestAccount = [...(state.accounts || [])].sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))[0];
  const newestDraft = [...(state.drafts || [])].sort((a,b)=> (b.createdAt||0)-(a.createdAt||0))[0];

  return (
    <div className="panel">
      <h2 className="h2">Command Center</h2>
      <p className="muted">
        NexusForge is an offline-first “content + outreach” console: store accounts, generate drafts, log posts, and run follow-ups.
      </p>

      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Accounts stored</div>
          <div className="cardBig">{accountCount}</div>
          <div className="muted">Prospects/partners. Stored locally.</div>
        </div>

        <div className="card">
          <div className="cardTitle">Newest account</div>
          <div className="cardBig">{newestAccount ? newestAccount.name || "Unnamed" : "—"}</div>
          <div className="muted">{newestAccount ? (newestAccount.email || newestAccount.phone || newestAccount.website || "No contact info") : "Add one in Business Vault."}</div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="cardTitle">Drafts saved</div>
          <div className="cardBig">{draftCount}</div>
          <div className="muted">Generator Lab → Draft Vault.</div>
        </div>

        <div className="card">
          <div className="cardTitle">Post log entries</div>
          <div className="cardBig">{postCount}</div>
          <div className="muted">Track draft/scheduled/published.</div>
        </div>
      </div>

      {newestDraft ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardTitle">Most recent draft</div>
          <div className="itemTitle">{newestDraft.headline || "Untitled"}</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {newestDraft.accountName ? `${newestDraft.accountName} • ` : ""}{newestDraft.city || ""} • {newestDraft.service || ""}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>{newestDraft.metaDesc || ""}</div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">The play-by-play loop (how this console makes money)</div>
        <ol className="list">
          <li><strong>Business Vault:</strong> capture accounts (prospects/clients) with context.</li>
          <li><strong>Generator Lab:</strong> generate a brief + HTML skeleton + AI prompt pack, then save drafts.</li>
          <li><strong>Post Log:</strong> track output so weekly publishing stays consistent.</li>
          <li><strong>Email Forge:</strong> run a 4-week follow-up cadence that references published work.</li>
          <li><strong>Cluster Map:</strong> plan topic clusters and internal links so posts compound.</li>
        </ol>
      </div>
    </div>
  );
}
