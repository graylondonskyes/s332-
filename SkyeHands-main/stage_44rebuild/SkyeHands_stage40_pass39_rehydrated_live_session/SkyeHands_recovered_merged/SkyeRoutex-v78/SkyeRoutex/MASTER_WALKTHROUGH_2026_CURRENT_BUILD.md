# SkyeRoutexFlow + Platform House Circle — Master Walkthrough

**As of:** 2026-04-04 America/Phoenix  \
**Version:** 69.0.0  \
**Sections:** 18

This is the full end-to-end walkthrough for the current SkyeRoutexFlow codebase, covering shell navigation, Routex core operations, Platform House Circle hospitality, automation, execution mesh, live ops, cloud sync, security, valuation, walkthrough discoverability, docs, portability, and the remaining live-environment boundary. The current build also includes an additive Neon enterprise backup lane for SQL-grade snapshot durability and restore.

## 🧩 Platform shell and navigation spine

One shell now exposes Routex, Platform House Circle, valuation, walkthrough, sync, and operator-control surfaces instead of hiding them as side files.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Routex core route and field execution engine

The Routex core remains the operating spine for route creation, stop execution, proof motion, and task spillover from integrated domains.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Proof vault, export, and handoff system

The stack turns activity into evidence with exports, handoff packets, receipts, proof lanes, and white-glove delivery artifacts.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 AE, CRM, and account intelligence lane

The platform also carries client/account motion and follow-up logic, so it is not only a route runner.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Platform House Circle hospitality domain

House Circle now lives inside the same stack as a first-class hospitality/member/event/campaign/POS domain.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Join packets, QR redemption, and check-in lane

The platform can issue join packets, redeem them through QR or manual flow, and write guest/member/timeline/audit updates.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 POS ingest and sales intelligence lane

Sales data can be logged or ingested, then used to update revenue, guest spend, service cases, and operational follow-through.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Service cases, automation rules, and playbooks

Signals can create service cases and Routex tasks through automation rules and playbooks instead of sitting idle in records.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Dispatch shifts, assignments, and readiness execution mesh

V62 added shifts, assignments, readiness templates/runs, and escalation behavior, plus replica export/import and merge preview.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Scanner, adapters, webhook inbox, jobs, and replay mesh

V63 moved the product into live-ops territory with scanning, adapters, webhooks, queues, dead-letter replay, and local realtime sync behavior.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Cloud sync mesh and server-side control plane

V64 introduced signed sessions, state push/pull, frame ingest, cloud sync, and outbox replay so the platform could coordinate beyond one device.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 MFA, recovery, trusted devices, locks, and event feed

V65 added operator MFA, recovery codes, trusted devices, resource locks, release flow, and event-feed coordination.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Investor valuation center

V66 made the valuation a live product surface with HTML/MD/JSON exports, cloud sync, health reporting, and nav discoverability.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Master walkthrough center

V67 closes the “pieces not one whole” gap with one deep master walkthrough that explains the entire codebase lane by lane.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Docs, deploy guides, directives, and smoke receipts

The repo ships layered implementation directives, deploy guides, status files, and smoke outputs across the upgrade passes.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 Import, export, replica, merge, and portability lanes

The stack supports portable bundles, replica previews, merge logic, and cross-environment carry instead of only one locked local state.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🧩 What is finished versus what still needs live environment work

The remaining gap is mostly live deployment, real credentials, and final production storage choice, not missing major codebase architecture.

**Where it lives**



**What you can do**



**Code**



**Outcomes**



## 🗄️ Neon enterprise backup lane

V69 adds an additional enterprise-grade SQL lane without replacing the shipped file-backed persistence: schema, snapshot backup push/pull handlers, health reporting, restore flow, and a discoverable UI control surface.

**Where it lives**

- Neon lane toolbar/card in the live shell
- Netlify functions phc-neon-*
- neon/ schema and deploy guide artifacts

**What you can do**

- Push the current server state into Neon as a durable snapshot
- Pull the latest Neon snapshot back into the platform
- Inspect Neon readiness, schema, and last snapshot metadata from the live product

**Code**

- housecircle.integral.v69.js
- netlify/functions/_lib/housecircle-neon-store.js
- netlify/functions/phc-neon-backup-push.js
- netlify/functions/phc-neon-backup-pull.js
- netlify/functions/phc-neon-health.js
- neon/PHC_NEON_SCHEMA_V69.sql

**Outcomes**

- Enterprise-grade backup and restore exists as an additional lane
- The platform keeps its shipped file-backed lane while adding SQL-grade resilience

