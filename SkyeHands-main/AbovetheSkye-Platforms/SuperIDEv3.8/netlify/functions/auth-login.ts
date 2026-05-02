import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { hashPassword, ensureUserRecoveryEmailColumn, ensureUserPinColumns, requestSkyeGate, setSkyeGateCookie } from "./_shared/auth";
import { audit } from "./_shared/audit";
import { getOrgRole } from "./_shared/rbac";
import { ensureOrgSeatColumns, ensurePrimaryWorkspace, getOrgSeatSummary } from "./_shared/orgs";
import crypto from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureLocalBridgeUser(email: string, displayName: string | null) {
  const existing = await q(
    "select id,email,recovery_email,pin_hash,org_id from users where lower(email)=lower($1) limit 1",
    [email]
  );
  if (existing.rows.length) return existing.rows[0];

  const placeholderHash = await hashPassword(`skygatefs13:${crypto.randomUUID()}:${Date.now()}`);
  const orgName = String(displayName || "").trim() || `${email.split("@")[0]} Workspace`;
  const inserted = await q(
    `with created_org as (
       insert into orgs(name) values($1) returning id
     )
     insert into users(email,recovery_email,password_hash,org_id)
     select $2, $3, $4, id from created_org
     returning id,email,recovery_email,pin_hash,org_id`,
    [orgName, email, email, placeholderHash]
  );
  const local = inserted.rows[0];
  await q(
    "insert into org_memberships(org_id, user_id, role) values($1,$2,$3) on conflict (org_id, user_id) do nothing",
    [local.org_id, local.id, "owner"]
  );
  return local;
}

export const handler = async (event: any) => {
  try {
    await ensureUserRecoveryEmailColumn();
    await ensureUserPinColumns();
    await ensureOrgSeatColumns();

    const { email, password } = JSON.parse(event.body || "{}");
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) {
      return json(400, { error: "Email and password are required." });
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      return json(400, { error: "Enter a valid email address." });
    }

    const { response, data } = await requestSkyeGate("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password: rawPassword }),
    });
    if (!response.ok) {
      return json(response.status, { error: data?.error || "Invalid credentials." });
    }

    const subject = data?.user?.subject || {};
    const session = data?.session || {};
    const displayName = subject.display_name ? String(subject.display_name) : null;
    const subjectEmail = String(subject.email || normalizedEmail).trim().toLowerCase();
    if (!subjectEmail || !session?.token) return json(502, { error: "SkyeGateFS13 login response was incomplete." });

    const user = await ensureLocalBridgeUser(subjectEmail, displayName);

    if (user.org_id) {
      await q(
        `insert into skymail_accounts(org_id, user_id, mailbox_email, display_name, provider, outbound_enabled, inbound_enabled, metadata)
         values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         on conflict (org_id, user_id) do nothing`,
        [
          user.org_id,
          user.id,
          user.email,
          displayName || user.email,
          "gmail_smtp",
          true,
          true,
          JSON.stringify({ source: "skygatefs13-auth-login-bridge" }),
        ]
      );
    }

    let role: string | null = null;
    let workspace = null;
    let org = null;
    if (user.org_id) {
      role = await getOrgRole(user.org_id, user.id);
      workspace = await ensurePrimaryWorkspace(user.org_id, user.id, role || "member");
      org = await getOrgSeatSummary(user.org_id);
    }

    await audit(user.email, user.org_id, null, "auth.login", {});
    return json(
      200,
      {
        ok: true,
        user: {
          email: user.email,
          recovery_email: user.recovery_email || "",
          org_id: user.org_id,
          workspace_id: workspace?.id || null,
          role: role || subject.role || null,
          has_pin: Boolean(String(user.pin_hash || "").trim()),
        },
        workspace,
        org,
        onboarding: {
          key_required: false,
          pin_configured: Boolean(String(user.pin_hash || "").trim()),
          message: "Identity is now routed through SkyeGateFS13.",
        },
        skygatefs13: {
          issuer: data?.user?.issuer || null,
          subject_id: subject.id || null,
        },
        session: data?.session || null,
        kaixu_token: {
          token: String(session.token || "").trim(),
          locked_email: user.email,
          expires_at: session.expires_at || null,
          scopes: Array.isArray(data?.user?.claims?.scope) ? data.user.claims.scope : ["openid", "profile", "email"],
        },
      },
      { "Set-Cookie": setSkyeGateCookie(String(session.token || "").trim(), session.expires_at || null) }
    );
  } catch (e: any) {
    return json(500, { error: "Login failed." });
  }
};
