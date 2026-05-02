# AI Appointment Setter Repo

Open `DEPLOYMENT_GUIDE_FOR_DUMMIES.pdf` first for the detailed operator handoff path. For investor-facing truth and component values, open `INVESTOR_VALUATION_REPORT.pdf` or `PRODUCT_TRUTH_AND_2026_COMPONENT_VALUATION.pdf`. For the updated whole-bundle valuation, open `DETAILED_ZIP_VALUATION_2026.pdf` or `DETAILED_ZIP_VALUATION_2026.md`. For the seven-figure roadmap, open `MILLION_DOLLAR_UPGRADE_DIRECTIVE.pdf`.

This repo ships four working surfaces:

- `static/index.html` — public intake, AI setter flow, and booking
- `static/admin/index.html` — lead board, appointment control, routing, outbound queue, voice actions, calendar sync
- `static/diagnostics/index.html` — health, analytics, reminder preview, outbound history, voice history, calendar logs
- `static/auth/login.html` — admin login and forced first-login password rotation

It stays dependency-light and runs on the Python standard library only.

## Implemented lanes

- Lead intake with qualification capture
- Conversation sessions and transcript logging
- Deterministic appointment-setter flow with optional OpenAI-compatible reply polishing
- Live availability with local conflict checks and connected-calendar busy blocking
- Booking, reschedule, and cancel flows
- Google Calendar and Microsoft 365 sync for create, update, delete, and busy-time reads
- Round-robin rep assignment
- Organization-scoped routing and filtered admin surfaces
- Reminder preview, queueing, and outbound dispatch
- Automatic confirmation / reschedule / cancellation notice queueing
- Downloadable ICS calendar files for every appointment
- Self-service appointment management by confirmation code
- Live admin settings editor for hours, slot length, buffer, reminder window, and booking note
- Admin lead editor with quick-create lane
- Intake packet + waiver capture for each lead
- Billing desk with deposit / service / fee invoices and payment roll-down
- Billing desk UI with invoice lifecycle controls for sent / paid / void / write-off / reopen
- Credit memo lane that reduces open balances without pretending a payment happened
- Admin portal document desk for required forms, prep docs, and signature-controlled records
- Automatic booking deposit invoice when default deposit is configured
- Admin lead search/filter lane for faster desk-side cleanup
- Lead source + tag editing for better routing, cleanup, and attribution
- Bulk lead actions for status, rep assignment, source normalization, and tag sweeps
- Saved lead views so the desk can reload common filter combinations instantly
- Outreach playbook library with reusable SMS/email templates and merge tokens
- One-click playbook queue/send against the selected lead and next live appointment
- Lead activity timeline that combines messages, appointment movement, outbound sends, and voice events
- Admin manual booking lane using live availability
- Appointment status controls for confirmed, completed, and no-show
- Generic SMTP email delivery option with no vendor lock-in
- Voice outbound and inbound capture
- Real inbound SMS and email reply capture through signed or secret-protected webhook endpoints
- Admin inbox queue for live inbound replies with open + reply shortcuts
- Rep performance scorecards with paid revenue, booked/completed counts, target attainment, and estimated commission
- Source attribution board showing which lead sources produce bookings, completions, and paid revenue
- Admin desk creation lane for spinning up additional org/location desks
- Desk preset packs for consulting, home services, and white-glove chauffeur rollout
- Admin rep editor with commission percentage and monthly target controls
- Inbound reply intent handling for confirm / cancel / reschedule requests
- Admin authentication, viewer / manager / admin gating, and cookie sessions
- Smoke test pack covering the implemented lanes

## Hardening added in this pass

- First-login password rotation is enforced for bootstrap accounts
- Password policy validation is enforced on admin resets
- Login lockout is applied after repeated failures
- CSRF protection is applied to authenticated write endpoints
- Secure-cookie mode is supported for HTTPS deployment
- Admin users are bound to an org scope for filtered access
- Inbound voice webhooks require a signed payload when a webhook secret is configured
- Release bundle ships with a clean database instead of smoke/demo runtime records

## Quick start

```bash
cd ai_appointment_setter_repo
cp .env.example .env
python3 server.py
```

Open:

- `http://127.0.0.1:8018/`
- `http://127.0.0.1:8018/auth/login.html`
- `http://127.0.0.1:8018/admin/index.html`
- `http://127.0.0.1:8018/diagnostics/index.html`

## First boot notes

Bootstrap accounts are created automatically if the database is empty.
They are **forced** to change password on first login.

Default local bootstrap accounts:

- Admin: `owner@example.com` / `change-me-now`
- Manager: `ops@example.com` / `change-me-now`
- Viewer: `viewer@example.com` / `change-me-now`

Override them in `.env` before any serious deployment.

## Production settings that matter

Set these before public deployment:

```bash
APP_ENV=production
SESSION_COOKIE_SECURE=true
VOICE_WEBHOOK_SECRET=replace-with-a-long-random-secret
SMS_INBOUND_SECRET=replace-with-a-long-random-secret
EMAIL_INBOUND_SECRET=replace-with-a-long-random-secret
```

Also provide the real transport and calendar credentials you plan to use:

```bash
SMS_WEBHOOK_URL=https://your-sms-adapter.example/send
EMAIL_WEBHOOK_URL=https://your-email-adapter.example/send

# Or use direct SMTP instead of an email webhook
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=mailer@example.com
SMTP_PASSWORD=replace-me
SMTP_FROM_EMAIL=mailer@example.com
SMTP_FROM_NAME=Appointment Setter
APP_BASE_URL=https://your-domain.example
VOICE_WEBHOOK_URL=https://your-voice-adapter.example/calls
# Point your inbound rails at the app itself
# POST /api/inbound/sms with X-Inbound-Secret or signed webhook headers
# POST /api/inbound/email with X-Inbound-Secret or signed webhook headers
GOOGLE_CALENDAR_ACCESS_TOKEN=...
MICROSOFT_CALENDAR_ACCESS_TOKEN=...
```

## Smoke tests

```bash
cd ai_appointment_setter_repo
python3 smoke/smoke_test.py
```

The smoke script writes JSON proof to `smoke/last_smoke_report.json`.

## File map

```text
app/
  ai.py
  auth.py
  calendar_sync.py
  db.py
  logic.py
  security.py
  voice.py
static/
  auth/login.html
  admin/index.html
  diagnostics/index.html
  index.html
  css/styles.css
  js/shared.js
  js/index.js
  js/admin.js
  js/diagnostics.js
  js/auth.js
smoke/
  smoke_test.py
  last_smoke_report.json
server.py
BUILD_DIRECTIVE.md
README.md
.env.example
DEPLOYMENT_GUIDE_FOR_DUMMIES.pdf
INVESTOR_VALUATION_REPORT.pdf
PRODUCT_TRUTH_AND_2026_COMPONENT_VALUATION.pdf
MILLION_DOLLAR_UPGRADE_DIRECTIVE.pdf
run_local.sh
```


## New functional additions in this pass

- The admin surface now exposes the intake packet and billing lanes that were already wired in the backend, so operators can actually use them without hidden controls
- Billing now supports lifecycle actions for mark sent, mark paid, write-off, void, reopen, and credit memo creation
- Payment history now renders directly in the admin desk instead of staying trapped in the API only
- Portal documents now have a real admin desk for create, edit, required/optional control, and status movement before the public signing flow

- Public self-service manage page for lookup, reschedule, and cancellation by confirmation code
- Public quote acceptance receipt download with signer name, title, company, and signature text capture
- Admin proof-pack ZIP export with manifest for the selected lead vault
- Desk onboarding runbook Markdown export for operator handoff
- Every confirmation, reschedule, and cancellation notice now includes a manage link plus the calendar-file link
- Live admin settings editor for support contact, timezone, open days, open/close hours, slot length, buffer, reminder window, and booking note
- Availability generation and appointment duration now obey the saved org-level settings instead of fixed hardcoded hours
- Admin lead create and lead update lanes for real desk-side lead cleanup
- Admin lead search/filter lane so larger lead boards stay workable without fake CRM chrome
- Lead activity timeline panel so the selected lead shows actual movement instead of disconnected tables
- Admin quick-book lane that books the selected lead into a live opening without using the public conversation flow
- Appointment status actions in admin for confirmed, completed, and no-show tracking

## Scale + auditability added in this pass

- SQLite runtime now enables foreign keys, busy-timeout handling, WAL mode, and query indexes for heavier admin and booking reads
- A background worker can auto-queue reminders and auto-dispatch pending outbound messages
- Persistent audit events now record login attempts, password changes, lead intake, booking actions, voice actions, queue/dispatch actions, and role/CSRF denials
- Admin and diagnostics APIs now expose runtime state and audit history
- `scripts/backup_runtime.py` creates timestamped SQLite backups


## Million-dollar forward build added in this pass

- New revenue-ops lane with per-lead intake packets, waiver capture, and prep notes
- Public manage surface can now save the intake packet directly from the confirmation-code lane
- New billing lane with invoices, payments, outstanding balances, and manual money tracking
- Booking now auto-creates a deposit invoice when the desk default deposit is configured
- Org settings now include default deposit, default service price, currency, and payment instructions
- Smoke tests now cover admin intake updates, invoice creation, payment recording, public intake submission, and auto-created booking deposit invoices


## Commercial-control additions in this pass

- Admin can create additional desks/orgs directly from the control plane
- Admin can create and tune rep desks with commission rate, target, and payout notes
- Lead editor now supports explicit rep assignment instead of only auto-routing
- Analytics now includes rep scorecards and source attribution surfaces

## Autonomous desk additions in this pass

- Background autonomy cycle for stale-lead follow-up after inactivity
- Automatic intake reminders for upcoming appointments with unfinished intake / waiver packets
- Automatic outstanding-balance reminders when invoices stay open
- Automatic no-show recovery that marks the appointment and sends a reschedule path
- Inbound auto-reply lane so SMS/email replies can get slot suggestions or a manage link without human intervention
- Manual “Run autonomy now” control in admin so the operator can force an autonomous sweep after setup changes


## Operator upgrades added in this pass

- Lead editor now supports explicit source values and comma-separated CRM tags
- Admin lead board now supports source, rep, and tag filters on top of text/status filtering
- Operators can save desk-side filter presets as reusable lead views
- Operators can select multiple leads and apply bulk status / rep / source / tag updates in one pass
- Outreach playbooks can be stored, edited, loaded into the manual draft lane, queued, or sent immediately
- Playbook merge tokens support lead + appointment context such as `{lead_name}`, `{first_name}`, `{service_interest}`, `{manage_url}`, `{appointment_time}`, and `{outstanding_balance}`

## Honest deployment verdict

This is now worth deploying when you want a low-admin appointment setter that can keep nudging leads, protect appointment movement, recover no-shows, chase incomplete intake, and remind on open balances without somebody babysitting the desk all day.

It is still intentionally lean. It is not a giant enterprise back end, and it is not a fake all-things-to-all-people SaaS. It is a focused autonomous appointment desk that can run itself after setup as long as your real outbound/inbound rails are configured.


## Evidence + approval additions in this pass

- Proof-vault uploads now exist on both the admin side and the public manage portal, with file metadata persistence and secure download routes
- Public quote handling now supports accept, request-changes, and decline flows instead of only one-way acceptance
- Uploaded proof files can be be marked client-visible or internal-only from the operator desk
