const { clean, compact, nowISO, num } = require('./housecircle-cloud-store');
const DEFAULT_TOTAL = 5950000;
function defaultComponents(){
  return [
    { key:'core_dispatch', label:'Core route, dispatch, field execution, and offline operating spine', value:1350000, rationale:'The Routex core already covers route creation, stop execution, proof capture, route economics, offline persistence, PWA behavior, and operator-grade dispatch usage.' },
    { key:'proof_stack', label:'Proof vault, exports, binders, handoff packets, and operator evidence surfaces', value:650000, rationale:'The codebase contains multiple export, proof, closure, handoff, and launch-board lanes that convert activity into auditable deliverables instead of raw app state only.' },
    { key:'crm_ae_ops', label:'AE/CRM, account intelligence, follow-up motion, and command workflow layers', value:600000, rationale:'The platform already ships operational sales and account intelligence behavior rather than stopping at delivery/dispatch mechanics.' },
    { key:'house_circle_domain', label:'Platform House Circle hospitality, guest/member, events, campaigns, packets, and POS domain', value:1050000, rationale:'This is now a first-class domain inside the stack with venue intelligence, check-in, loyalty-style motion, event/readiness behavior, and service-case creation.' },
    { key:'live_ops_mesh', label:'Live ops mesh: QR, adapter lanes, webhook inbox, job queue, cloud sync, and security coordination', value:1150000, rationale:'The V63–V65 work materially expanded the codebase into cloud-coordinated, security-aware, multi-operator control instead of a single-device-only tool.' },
    { key:'neon_backup_lane', label:'Enterprise-grade Neon backup lane, SQL schema, snapshot replication, restore, and dual-persistence hardening', value:500000, rationale:'V69 adds an additional enterprise storage lane without replacing existing flows: Neon schema, backup push/pull handlers, health reporting, and a discoverable UI control surface strengthen resilience, recoverability, and production-grade data posture.' },
    { key:'productization', label:'Packaging, PWA shell, documentation, branding, investor discoverability, master walkthrough, and operator education polish', value:650000, rationale:'The app now ships with a deeper operator enablement layer, master walkthrough center, synced guidance artifacts, deploy docs, smoke outputs, and live-discoverable investor materials that materially strengthen handoff and enterprise readiness.' }
  ];
}
function defaultValuationRecord(input){
  input = input || {};
  const components = Array.isArray(input.components) && input.components.length ? input.components : defaultComponents();
  const total = num(input.totalValue || components.reduce((sum, row) => sum + num(row.value), 0) || DEFAULT_TOTAL);
  return {
    type: 'skye-routexflow-codebase-valuation-v69',
    version: compact(input.version || '69.0.0'),
    title: compact(input.title || 'SkyeRoutexFlow + Platform House Circle — 2026 Codebase Valuation'),
    asOf: compact(input.asOf || '2026-04-04 America/Phoenix'),
    currency: compact(input.currency || 'USD'),
    totalValue: total,
    generatedAt: nowISO(),
    status: compact(input.status || 'Current codebase enterprise valuation'),
    valuationMethod: compact(input.valuationMethod || 'Enterprise replacement-cost-plus productization premium'),
    summary: compact(input.summary || 'This valuation reflects the full current codebase: route and dispatch operations, proof/export infrastructure, AE/CRM layers, integrated Platform House Circle hospitality domain, live-ops mesh, cloud sync, MFA/device trust, locking, event-feed coordination, investor discoverability, master walkthrough/operator enablement surfaces, and the new enterprise-grade Neon backup lane.'),
    discoverability: {
      relativeHtmlPath: './investor/SKYEROUTEXFLOW_V69_2026_ENTERPRISE_VALUATION.html',
      relativeMarkdownPath: './investor/SKYEROUTEXFLOW_V69_2026_ENTERPRISE_VALUATION.md',
      relativeJsonPath: './investor/SKYEROUTEXFLOW_V69_2026_ENTERPRISE_VALUATION.json'
    },
    components,
    includedModules: [
      'SkyeRoutexFlow core route and dispatch system',
      'Proof vault, exports, binders, receipts, and handoff surfaces',
      'AE/CRM account lanes and follow-up control surfaces',
      'Platform House Circle hospitality/member/event/campaign/POS domain',
      'Live ops mesh: QR, webhook, jobs, adapters, sync, and replay',
      'Cloud sync mesh, signed sessions, MFA, trusted devices, locks, and event feed',
      'Discoverable investor valuation center and exportable valuation artifacts',
      'Master walkthrough center, operator education surfaces, and synced product guidance artifacts',
      'Neon enterprise backup lane with SQL schema, snapshot replication, restore, and health reporting'
    ],
    notes: [
      'Value reflects the current shipped codebase and integrated architecture, not a stripped-down MVP reading.',
      'Number assumes enterprise-grade replacement cost, operational productization value, and the premium of a multi-domain stack already collapsed into one operator system.',
      'The Neon lane is additive: file-backed serverless persistence remains intact while a separate SQL-grade backup and restore path is now wired into the platform.'
    ]
  };
}
module.exports = { DEFAULT_TOTAL, defaultComponents, defaultValuationRecord };
