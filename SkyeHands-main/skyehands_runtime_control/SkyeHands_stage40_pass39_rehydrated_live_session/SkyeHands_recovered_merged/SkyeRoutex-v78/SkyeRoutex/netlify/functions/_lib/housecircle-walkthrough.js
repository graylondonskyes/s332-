const { clean, compact, nowISO, num } = require('./housecircle-cloud-store');

function defaultSections(){
  return [
    {
      key:'shell_nav',
      title:'Platform shell and navigation spine',
      icon:'🧭',
      summary:'The shell is the command layer that keeps Routex, Platform House Circle, valuation, walkthrough, sync, and operator controls discoverable from one surface.',
      where:['Top navigation / shell buttons','Dashboard and platform-house views','Modal launch surfaces injected by V66 and V67'],
      whatYouCanDo:['Move between Routex and hospitality lanes without changing apps','Open valuation and walkthrough centers directly from the live shell','See discoverable control surfaces that were added in the later V59–V67 passes'],
      code:['index.html','housecircle.integral.v66.js','housecircle.integral.v67.js'],
      outcomes:['Single-stack navigation instead of patchwork apps','Live discoverability for investor and operator materials']
    },
    {
      key:'routex_core',
      title:'Routex core route and field execution engine',
      icon:'🚚',
      summary:'This is the route, stop, dispatch, proof, and field-execution operating spine that makes SkyeRoutexFlow the base platform instead of a hospitality-only add-on.',
      where:['Primary Routex workflow surfaces','Task spillover lanes from hospitality and automation','Proof/export flows'],
      whatYouCanDo:['Create and execute route missions','Push hospitality outcomes into operational work','Write stop results back into shared platform intelligence'],
      code:['readme.md','whiteglove.v39.js through whiteglove.v58.js','housecircle.integral.v59.js'],
      outcomes:['Shared field spine under the full platform','Operational work can originate from multiple product domains']
    },
    {
      key:'proof_exports',
      title:'Proof vault, export, and handoff system',
      icon:'🧾',
      summary:'The codebase carries proof capture, binders, operator exports, receipts, and handoff surfaces so activity turns into evidence instead of disappearing into state only.',
      where:['White glove batches and export surfaces','Investor and operator documentation folders','Download/export helpers in the UI'],
      whatYouCanDo:['Generate auditable output from execution','Prepare handoff materials and deliverables','Carry exported operational evidence forward into live reviews'],
      code:['WHITE_GLOVE_V39 through WHITE_GLOVE_V67','downloadText helpers consumed by valuation/walkthrough centers'],
      outcomes:['Operator evidence is built into the product','The platform explains itself and its work in shipped artifacts']
    },
    {
      key:'ae_crm',
      title:'AE, CRM, and account intelligence lane',
      icon:'📇',
      summary:'The stack is not only dispatch. It carries account intelligence, AE workflow, follow-up motion, and account-facing command behavior.',
      where:['AE FLOW lineage inside the wider project','Shared account intelligence and follow-up surfaces','Routex task spillover and service-case routing'],
      whatYouCanDo:['Track clients, accounts, and follow-up motion','Route hospitality or ops intelligence into account action','Maintain relationship context alongside field work'],
      code:['academy.v38.js','tutorials.v35.js','AE-FLOW corpus in the bundle'],
      outcomes:['The platform can run operator work and account work together','Client handling is part of the stack instead of external']
    },
    {
      key:'house_circle_domain',
      title:'Platform House Circle hospitality domain',
      icon:'🏠',
      summary:'House Circle is now a native domain inside Routex, covering locations, guests, memberships, events, campaigns, drops, referrals, and hospitality state.',
      where:['Platform House command surfaces','Shared platform-house dashboard sections','State and export bundles'],
      whatYouCanDo:['Run hospitality/member operations inside the same product','Track guests, events, and venue intelligence','Turn hospitality events into ops or AE motion'],
      code:['housecircle.integral.v59.js and later','housecircle-cloud-store.js state bundle'],
      outcomes:['House Circle is integral, not bolted on','Hospitality data and route ops can talk to each other']
    },
    {
      key:'join_packets',
      title:'Join packets, QR redemption, and check-in lane',
      icon:'🎟️',
      summary:'The platform can issue packets, redeem them through deep links or QR/manual flow, create/update guest records, and write timeline/audit events.',
      where:['V60 command center surfaces','Packet redemption and scanner flows','Timeline and audit state'],
      whatYouCanDo:['Create join packets for venues or members','Redeem packets through QR or manual fallback','Turn packet redemption into guest/member state'],
      code:['housecircle.integral.v60.js','housecircle.integral.v63.js'],
      outcomes:['Hospitality entry motion is part of the live stack','Check-in has audit and follow-through paths']
    },
    {
      key:'pos_sales',
      title:'POS ingest and sales intelligence lane',
      icon:'💳',
      summary:'POS tickets can be logged manually, imported, or ingested through adapters/webhooks, then used to update spend, visits, revenue, service cases, and route work.',
      where:['V60 POS surfaces','V63 adapter and ingest panels','Cloud POS ingest functions'],
      whatYouCanDo:['Import ticket batches','Track guest spend and location revenue','Escalate spend signals into service cases or Routex tasks'],
      code:['housecircle.integral.v60.js','housecircle.integral.v63.js','netlify/functions/phc-pos-ingest.js'],
      outcomes:['Revenue behavior flows into platform intelligence','Hospitality and ops share sales-derived signals']
    },
    {
      key:'automation_cases',
      title:'Service cases, automation rules, and playbooks',
      icon:'⚙️',
      summary:'The V61 layer introduced real service cases, automation rules, playbooks, and signal runs so the product can move work, not just store records.',
      where:['V61 command surfaces','Service-case exports','Signal execution records'],
      whatYouCanDo:['Create deterministic automation from platform signals','Generate Routex tasks from hospitality events or failures','Run playbooks manually from the command deck'],
      code:['housecircle.integral.v61.js'],
      outcomes:['The stack behaves like an operating system, not a passive dashboard','Signals can create cases and work items automatically']
    },
    {
      key:'execution_mesh',
      title:'Dispatch shifts, assignments, and readiness execution mesh',
      icon:'🗂️',
      summary:'V62 added shifts, assignments, readiness templates, readiness runs, escalation rules, and mergeable replica bundles for operational execution.',
      where:['Execution-mesh surfaces','Readiness run controls','Replica export/import and merge preview tools'],
      whatYouCanDo:['Build dispatch waves from unresolved cases','Run venue/event readiness checklists','Escalate failed readiness into cases and tasks'],
      code:['housecircle.integral.v62.js'],
      outcomes:['Execution planning is native to the stack','Readiness failures automatically create real operational follow-through']
    },
    {
      key:'live_ops_mesh',
      title:'Scanner, adapters, webhook inbox, jobs, and replay mesh',
      icon:'📡',
      summary:'V63 expanded the product into a live-ops mesh with QR scanning, adapter lanes, webhook inboxes, job queues, dead-letter replay, and local realtime sync patterns.',
      where:['Live ops mesh control panels','Webhook/job surfaces','Scanner and replay UI'],
      whatYouCanDo:['Use QR camera scanning where supported','Ingest vendor-style data through adapter lanes','Replay failed jobs and inspect webhook/journal traffic'],
      code:['housecircle.integral.v63.js','netlify/functions/phc-webhook-square.js','netlify/functions/phc-job-drain.js'],
      outcomes:['The platform has live-ingest and repair paths','Operational durability moved deeper than local-only records']
    },
    {
      key:'cloud_sync',
      title:'Cloud sync mesh and server-side control plane',
      icon:'☁️',
      summary:'V64 introduced signed sessions, snapshot push/pull, frame ingest, cloud sync, outbox replay, and server-side sync functions so the product could coordinate beyond one device.',
      where:['Cloud control surfaces in the shell','Netlify functions under phc-sync-*','Health and cloud status views'],
      whatYouCanDo:['Push/pull the working state','Run auto-sync ticks','Coordinate state through the built-in server lane'],
      code:['housecircle.integral.v64.js','phc-sync-state.js','phc-sync-frame.js','phc-health.js'],
      outcomes:['The platform now has a shipped cloud coordination lane','The app can surface its server truth and sync status when live']
    },
    {
      key:'neon_backup',
      title:'Neon enterprise backup lane',
      icon:'🗄️',
      summary:'V69 adds an additional enterprise-grade SQL lane without replacing the shipped file-backed persistence: schema, snapshot backup push/pull handlers, health reporting, restore flow, and a discoverable UI control surface.',
      where:['Neon lane toolbar/card in the live shell','Netlify functions phc-neon-*','neon/ schema and deploy guide artifacts'],
      whatYouCanDo:['Push the current server state into Neon as a durable snapshot','Pull the latest Neon snapshot back into the shipped platform state','Inspect Neon readiness, schema, and last snapshot metadata from the live product'],
      code:['housecircle.integral.v69.js','netlify/functions/_lib/housecircle-neon-store.js','netlify/functions/phc-neon-backup-push.js','netlify/functions/phc-neon-backup-pull.js','netlify/functions/phc-neon-health.js','neon/PHC_NEON_SCHEMA_V69.sql'],
      outcomes:['Enterprise-grade backup and restore exists as an additional lane','The platform can keep its shipped file-backed lane while adding SQL-grade resilience']
    },
    {
      key:'security_coordination',
      title:'MFA, recovery, trusted devices, locks, and event feed',
      icon:'🔐',
      summary:'V65 added operator MFA enrollment, TOTP verification, recovery codes, trusted devices, resource lock leasing, release flow, and event feed coordination.',
      where:['Security and coordination control surfaces','Device registry and lock controls','Cloud event feed'],
      whatYouCanDo:['Enroll MFA and verify operators','Trust devices and reduce friction for known operators','Protect concurrent resources with lock leasing'],
      code:['housecircle.integral.v65.js','phc-auth-mfa-enroll.js','phc-auth-mfa-verify.js','phc-device-register.js','phc-lock-acquire.js','phc-lock-release.js','phc-event-feed.js'],
      outcomes:['Operator security is part of the shipped stack','Concurrency protection exists in-code, not as hand-waving']
    },
    {
      key:'valuation_center',
      title:'Investor valuation center',
      icon:'📈',
      summary:'V66 made the valuation a native product surface with exported HTML/MD/JSON artifacts, a cloud sync endpoint, a health-reported snapshot, and discoverable shell access.',
      where:['Valuation toolbar/nav button','Valuation card in platform views','Investor folder and cloud valuation endpoint'],
      whatYouCanDo:['Open the current codebase valuation inside the product','Export the valuation as JSON/MD/HTML','Keep the valuation synced and discoverable when the platform is live'],
      code:['housecircle.integral.v66.js','phc-valuation.js','investor/SKYEROUTEXFLOW_V66_2026_ENTERPRISE_VALUATION.*'],
      outcomes:['The codebase can expose its current enterprise number from inside the app','Investor materials ship with the repo and the live product']
    },
    {
      key:'walkthrough_center',
      title:'Master walkthrough center',
      icon:'📘',
      summary:'V67 closes the documentation gap by shipping one end-to-end master walkthrough that explains the full product lane by lane and keeps that record discoverable from the live shell.',
      where:['Walkthrough toolbar/nav button','Walkthrough card in platform views','operator/ walkthrough artifact folder and cloud walkthrough endpoint'],
      whatYouCanDo:['Open a deep product walkthrough from inside the app','Export the full walkthrough as JSON/MD/HTML','Sync the walkthrough record to the platform cloud store'],
      code:['housecircle.integral.v67.js','phc-walkthrough.js','operator/SKYEROUTEXFLOW_V67_MASTER_WALKTHROUGH.*'],
      outcomes:['One deep operator bible now exists instead of scattered pieces','Live discoverability of the walkthrough is part of the product']
    },
    {
      key:'docs_guides',
      title:'Docs, directives, deploy guides, and smoke receipts',
      icon:'🧪',
      summary:'The repo includes layered implementation directives, deploy guides, status files, smoke receipts, and white-glove documentation across the upgrade passes.',
      where:['WHITE_GLOVE_V64 through V67','Implementation directive files','NEW-SHIT2 guidance corpus'],
      whatYouCanDo:['Read what was added in each pass','Review smoke outputs and shipped status','Use deploy guides to wire the live environment'],
      code:['PLATFORM_HOUSE_CIRCLE_INTEGRATION_DIRECTIVE_V59–V67','WHITE_GLOVE_V64–V67'],
      outcomes:['The codebase explains its own build history','Proof of implementation is shipped with the repo']
    },
    {
      key:'imports_exports',
      title:'Import, export, replica, merge, and portability lanes',
      icon:'🧳',
      summary:'The stack supports export/import bundles, replica previews, merge logic, local carry, and portable records across multiple domains.',
      where:['Execution mesh and cloud sync tools','Export/import helpers','Stored bundle structures in the cloud store'],
      whatYouCanDo:['Export state for carry or review','Preview and merge incoming replica bundles','Move bundles through live or semi-live operating flows'],
      code:['housecircle.integral.v62.js','housecircle-cloud-store.js'],
      outcomes:['The platform is portable and recoverable','Cross-device or cross-environment movement is part of the design']
    },
    {
      key:'deployment_boundary',
      title:'What is finished versus what still needs live environment work',
      icon:'🧱',
      summary:'The codebase-side architecture is largely closed. The remaining gap is mostly live deployment, real credentials, and choosing the final permanent store for production.',
      where:['Deploy guides','Health surface','White-glove status docs'],
      whatYouCanDo:['Distinguish codebase completeness from environment wiring','See which remaining steps are yours versus shipped in code','Plan the final live deployment cleanly'],
      code:['DEPLOY_GUIDE_V64.md','DEPLOY_GUIDE_V65.md','IMPLEMENTATION_STATUS_V66.md','IMPLEMENTATION_STATUS_V67.md'],
      outcomes:['Completion status is honest and concrete','The product is not pretending live credentials already exist']
    }
  ];
}

function defaultWalkthroughRecord(input){
  input = input || {};
  const sections = Array.isArray(input.sections) && input.sections.length ? input.sections : defaultSections();
  return {
    type: 'skye-routexflow-master-walkthrough-v69',
    version: compact(input.version || '69.0.0'),
    title: compact(input.title || 'SkyeRoutexFlow + Platform House Circle — Master Walkthrough'),
    asOf: compact(input.asOf || '2026-04-04 America/Phoenix'),
    generatedAt: nowISO(),
    sectionCount: num(input.sectionCount || sections.length),
    summary: compact(input.summary || 'This is the full end-to-end walkthrough for the current SkyeRoutexFlow codebase, covering shell navigation, Routex core operations, Platform House Circle hospitality, automation, execution mesh, live ops, cloud sync, security, valuation, walkthrough discoverability, docs, portability, and remaining live-environment boundaries.'),
    discoverability: {
      relativeHtmlPath: './operator/SKYEROUTEXFLOW_V69_MASTER_WALKTHROUGH.html',
      relativeMarkdownPath: './operator/SKYEROUTEXFLOW_V69_MASTER_WALKTHROUGH.md',
      relativeJsonPath: './operator/SKYEROUTEXFLOW_V69_MASTER_WALKTHROUGH.json'
    },
    sections,
    notes: [
      'This walkthrough is meant to replace scattered explanation across many files with one operator-readable master record.',
      'The record is designed to be discoverable inside the live shell and exportable as static artifacts from the repo, including the new Neon backup lane.',
      'Live deployment, external credentials, and final production storage choices still sit outside the shipped codebase walkthrough itself.'
    ]
  };
}

module.exports = { defaultSections, defaultWalkthroughRecord };
