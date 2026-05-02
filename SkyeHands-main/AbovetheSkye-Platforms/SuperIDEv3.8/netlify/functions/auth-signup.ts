import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { ensureUserRecoveryEmailColumn, ensureUserPinColumns, requestSkyeGate, setSkyeGateCookie } from "./_shared/auth";
import { audit } from "./_shared/audit";
import { ensureOrgSeatColumns, ensurePrimaryWorkspace, getOrgSeatSummary } from "./_shared/orgs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler = async (event: any) => {
  try {
    await ensureUserRecoveryEmailColumn();
    await ensureUserPinColumns();
    await ensureOrgSeatColumns();

    const { email, password, orgName, recoveryEmail, recovery_email } = JSON.parse(event.body || "{}");
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRecoveryEmail = String(recoveryEmail || recovery_email || "").trim().toLowerCase();
    const normalizedOrg = String(orgName || "").trim();
    const rawPassword = String(password || "");

    if (!normalizedEmail || !normalizedRecoveryEmail || !rawPassword || !normalizedOrg) {
      return json(400, { error: "Primary SKYEMAIL login, recovery email, password, and organization name are required." });
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      return json(400, { error: "Enter a valid SKYEMAIL login address." });
    }

    if (!EMAIL_RE.test(normalizedRecoveryEmail)) {
      return json(400, { error: "Enter a valid third-party recovery email." });
    }

    if (normalizedRecoveryEmail === normalizedEmail) {
      return json(400, { error: "Recovery email must be different from the SKYEMAIL primary login." });
    }

    if (rawPassword.length < 8) {
      return json(400, { error: "Password must be at least 8 characters." });
    }

    if (normalizedOrg.length < 2) {
      return json(400, { error: "Organization name must be at least 2 characters." });
    }

    const existing = await q("select id from users where email=$1 limit 1", [normalizedEmail]);
    if (existing.rows.length) {
      return json(409, { error: "Account already exists. Sign in instead." });
    }

    const { response, data } = await requestSkyeGate("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password: rawPassword,
        display_name: normalizedOrg,
        profile: {
          superide_org_name: normalizedOrg,
          recovery_email: normalizedRecoveryEmail,
        },
      }),
    });
    if (!response.ok) {
      return json(response.status, { error: data?.error || "Signup failed." });
    }

    const userRow = await q(
      `with created_org as (
         insert into orgs(name) values($1) returning id
       )
       insert into users(email,recovery_email,password_hash,org_id)
       select $2, $3, $4, id from created_org
       returning id,email,recovery_email,org_id`,
      [normalizedOrg, normalizedEmail, normalizedRecoveryEmail, `skygatefs13-bridge:${data?.user?.id || normalizedEmail}`]
    );

    const orgId = userRow.rows[0].org_id;
    const userId = userRow.rows[0].id;

    await q(
      "insert into org_memberships(org_id, user_id, role) values($1,$2,$3) on conflict (org_id, user_id) do nothing",
      [orgId, userId, "owner"]
    );

    const workspace = await ensurePrimaryWorkspace(orgId, userId, "owner");

    await q(
      `insert into skymail_accounts(org_id, user_id, mailbox_email, display_name, provider, outbound_enabled, inbound_enabled, metadata)
       values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict (org_id, user_id)
       do update set
         mailbox_email=excluded.mailbox_email,
         display_name=excluded.display_name,
         provider=excluded.provider,
         outbound_enabled=excluded.outbound_enabled,
         inbound_enabled=excluded.inbound_enabled,
         updated_at=now()`,
      [
        orgId,
        userId,
        normalizedEmail,
        normalizedOrg,
        "gmail_smtp",
        true,
        true,
          JSON.stringify({ source: "skygatefs13-auth-signup-bridge" }),
      ]
    );
    const orgSummary = await getOrgSeatSummary(orgId);

    await audit(normalizedEmail, orgId, null, "auth.signup", {
      org: normalizedOrg,
      recovery_email: normalizedRecoveryEmail,
      default_workspace_id: workspace.id,
      default_workspace_name: workspace.name,
      skymail_account_provisioned: true,
      central_identity: "SkyeGateFS13",
    });

    return json(
      200,
      {
        ok: true,
        session: data?.session || null,
        kaixu_token: {
          token: String(data?.session?.token || "").trim(),
          label: "skygatefs13-primary-session",
          locked_email: normalizedEmail,
          scopes: Array.isArray(data?.user?.claims?.scope) ? data.user.claims.scope : ["openid", "profile", "email"],
          expires_at: data?.session?.expires_at || null,
        },
        user: {
          email: normalizedEmail,
          recovery_email: normalizedRecoveryEmail,
          org_id: orgId,
          workspace_id: workspace.id,
          role: "owner",
          has_pin: false,
        },
        org: orgSummary,
        workspace,
        warning: "SkyeGateFS13 session is shown to the client bridge for compatibility.",
      },
      { "Set-Cookie": setSkyeGateCookie(String(data?.session?.token || "").trim(), data?.session?.expires_at || null) }
    );
  } catch (e: any) {
    if (String(e?.code || "") === "23505") {
      return json(409, { error: "Account already exists. Sign in instead." });
    }
    return json(500, { error: "Signup failed." });
  }
};
