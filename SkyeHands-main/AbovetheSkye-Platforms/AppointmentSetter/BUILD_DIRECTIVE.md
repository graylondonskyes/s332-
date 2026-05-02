# AI Appointment Setter · Build Directive

Status rule: implemented items receive ✅. Anything not yet implemented stays blank. No X marks are used.

| Status | Lane | Item |
|---|---|---|
| ✅ | Core runtime | Python stdlib HTTP server with static pages and JSON API |
| ✅ | Core runtime | SQLite lead, session, message, appointment, routing, org, outbound, auth, voice, and calendar sync persistence |
| ✅ | Lead intake | Client-facing intake form writes lead record |
| ✅ | Lead intake | Intake data opens a conversation session |
| ✅ | Qualification | Required-field qualification status computation |
| ✅ | Qualification | Conversational field updates from live messages |
| ✅ | Setter | Assistant reply engine with deterministic booking flow |
| ✅ | Setter | Optional OpenAI-compatible response polishing lane |
| ✅ | Scheduling | Live availability generation |
| ✅ | Scheduling | Conflict-aware double-book prevention |
| ✅ | Scheduling | Connected-calendar busy blocking |
| ✅ | Scheduling | Appointment booking endpoint |
| ✅ | Scheduling | Appointment reschedule endpoint |
| ✅ | Scheduling | Appointment cancel endpoint |
| ✅ | CRM | Transcript logging per session |
| ✅ | CRM | Lead table in admin surface |
| ✅ | CRM | Appointment table in admin surface |
| ✅ | CRM | Lead search and status filter in admin lead desk |
| ✅ | CRM | Lead source, rep, and tag filters in admin lead desk |
| ✅ | CRM | Bulk lead actions for status, rep, source, and tag normalization |
| ✅ | CRM | Saved lead views for repeat desk workflows |
| ✅ | CRM | Lead activity timeline across messages, appointments, outbound, and voice |
| ✅ | CRM | Transcript inspection in admin surface |
| ✅ | CRM | Inbound SMS and email inbox queue in admin surface |
| ✅ | CRM | Admin lead create and lead edit lane |
| ✅ | Scheduling | Admin manual booking lane using live availability |
| ✅ | Scheduling | Appointment status actions for confirmed / completed / no-show |
| ✅ | Messaging lane | Reminder preview queue |
| ✅ | Messaging lane | Reminder queue creation into outbound message table |
| ✅ | Messaging lane | Configurable SMS/email webhook dispatch with real-provider only |
| ✅ | Messaging lane | Direct SMTP email delivery option with no vendor lock-in |
| ✅ | Messaging lane | Automatic booking / reschedule / cancellation notices |
| ✅ | Messaging lane | Manual direct outreach from admin with queue-now / send-now control |
| ✅ | Messaging lane | Outreach playbook library with reusable merge-template drafts |
| ✅ | Messaging lane | One-click playbook queue/send for the selected lead |
| ✅ | Messaging lane | Real inbound SMS/email webhook capture into lead sessions |
| ✅ | Messaging lane | Inbound reply intent handling for confirm / cancel / reschedule requests |
| ✅ | Scheduling | Downloadable ICS calendar file for every appointment |
| ✅ | Scheduling | Public self-service appointment lookup by confirmation code |
| ✅ | Scheduling | Public self-service reschedule and cancel flow |
| ✅ | Revenue ops | Intake packet persistence per lead |
| ✅ | Revenue ops | Public intake packet submission and waiver capture |
| ✅ | Revenue ops | Admin intake editor for budget, decision window, need, and prep notes |
| ✅ | Revenue ops | Invoice persistence for deposit / service / fee lanes |
| ✅ | Revenue ops | Manual payment recording with balance roll-down |
| ✅ | Revenue ops | Automatic default deposit invoice on booking when configured |
| ✅ | Revenue ops | Lead-level billing desk with invoice and payment history |
| ✅ | Revenue ops | Admin billing desk UI with invoice lifecycle controls and payment history tables |
| ✅ | Revenue ops | Invoice lifecycle actions for sent / paid / void / write-off / reopen |
| ✅ | Revenue ops | Credit memo lane that reduces open invoice balances without fake payments |
| ✅ | Revenue ops | Installment payment plan lane that expands one commercial approval into scheduled invoices |
| ✅ | Revenue ops | Recurring membership lane with active / paused / cancelled lifecycle |
| ✅ | Revenue ops | Recurring membership invoice generation with bill-now / skip-cycle / resume control |
| ✅ | Revenue ops | Background worker auto-generates due recurring membership invoices |
| ✅ | Revenue ops | Admin portal document desk with required-document create / edit / status controls |
| ✅ | Revenue ops | Proof vault file uploads with admin and client portal access |
| ✅ | Revenue ops | Proof vault lifecycle controls for visibility toggle, live replacement, delete, and version history |
| ✅ | Revenue ops | Proof vault export pack ZIP with manifest and live/archive file payloads |
| ✅ | Revenue ops | Proof vault deleted-item recovery and batch admin actions |
| ✅ | Revenue ops | Public payment commitment lane for outstanding invoices and deposits |
| ✅ | Revenue ops | Public payment commitment history with self-service cancel / reopen controls |
| ✅ | Revenue ops | Admin payment commitment desk with confirm / cancel / reopen controls |
| ✅ | Revenue ops | Payment commitments can be converted into recorded payments directly from the admin desk |
| ✅ | Revenue ops | Quote lifecycle desk with send / duplicate / expire / withdraw controls |
| ✅ | Revenue ops | Public quote response lane for accept / request changes / decline |
| ✅ | Revenue ops | Public quote acceptance receipt with signer title, company, and signature capture |
| ✅ | Revenue ops | Org-level pricing settings for default deposit, default service price, currency, and payment instructions |
| ✅ | Scheduling | Live org booking settings for hours, slot length, buffer, and reminder window |
| ✅ | Commercial catalog | Service and package edit / activation controls in admin desk |
| ✅ | Routing | Round-robin rep assignment |
| ✅ | Routing | Admin rep create / edit lane with commission and target controls |
| ✅ | Routing | Lead editor supports explicit rep assignment override |
| ✅ | Multi-tenant | Multiple organizations with org-scoped routing and filtered data surfaces |
| ✅ | Multi-tenant | Admin organization create lane for additional desks / branches |
| ✅ | Multi-tenant | Desk preset packs for faster branch onboarding without manual rebuilds |
| ✅ | Multi-tenant | Preset packs can seed desk-specific rep templates during rollout |
| ✅ | Multi-tenant | Desk onboarding lane supports founding-operator rep seeding with preset preview |
| ✅ | Multi-tenant | Selected-desk readiness checklist with rollout progress scoring |
| ✅ | Multi-tenant | Selected-desk onboarding wizard with staged launch plan rendering |
| ✅ | Multi-tenant | Selected-desk onboarding plan can be downloaded as a JSON rollout pack |
| ✅ | Multi-tenant | Selected-desk onboarding runbook can be downloaded as Markdown for operator handoff |
| ✅ | Multi-tenant | Selected-desk readiness autopilot can seed preset-backed fixes for missing rollout items |
| ✅ | Analytics | Conversion dashboard and no-show scoring |
| ✅ | Analytics | Rep performance scorecards with revenue, target attainment, and estimated commission |
| ✅ | Analytics | Source attribution board for leads, bookings, completions, and paid revenue |
| ✅ | Voice lane | Outbound AI calling flow |
| ✅ | Voice lane | Inbound voice transcript ingestion |
| ✅ | Voice lane | Provider webhook mode with real-provider only |
| ✅ | Calendar sync | Google Calendar create / update / delete sync |
| ✅ | Calendar sync | Microsoft 365 create / update / delete sync |
| ✅ | Calendar sync | External busy-time reads used during slot generation |
| ✅ | Security | Admin authentication |
| ✅ | Security | Viewer / manager / admin role gating |
| ✅ | Security | Cookie session handling for protected surfaces |
| ✅ | Security | Secure-cookie support for HTTPS deployment |
| ✅ | Security | Forced password rotation on first admin login |
| ✅ | Security | Password policy validation for admin resets |
| ✅ | Security | CSRF protection on authenticated write endpoints |
| ✅ | Security | Login lockout after repeated failures |
| ✅ | Security | Org-bound admin scope enforcement |
| ✅ | Security | Signed inbound voice webhook verification |
| ✅ | Security | Release database reset for clean-room deploy bundles |
| ✅ | Proof | Health endpoint |
| ✅ | Proof | Reminder preview endpoint |
| ✅ | Proof | Smoke test pack for auth, booking, calendar sync, voice, reschedule, cancel, routing, analytics, reminder queue, outbound dispatch, and role gating |
| ✅ | Proof | Smoke test coverage for invoice lifecycle actions, credit memos, and portal document admin controls |
| ✅ | Security | Audit event log for auth, booking, outbound, and voice actions |
| ✅ | Ops | Runtime status endpoint with worker / DB snapshot |
| ✅ | Ops | Background worker for automatic reminder queue and outbound dispatch |
| ✅ | Ops | SQLite busy-timeout, foreign-key, WAL, and index hardening |
| ✅ | Ops | Timestamped backup script for runtime database |

| ✅ | Autonomy | Background autonomy cycle for stale-lead follow-up |
| ✅ | Autonomy | Automatic intake reminders before upcoming appointments |
| ✅ | Autonomy | Automatic outstanding-balance reminders |
| ✅ | Autonomy | Automatic no-show recovery and reschedule outreach |
| ✅ | Autonomy | Manual autonomy run control in admin |
| ✅ | Messaging lane | Inbound auto-reply lane with slot suggestions and manage links |
