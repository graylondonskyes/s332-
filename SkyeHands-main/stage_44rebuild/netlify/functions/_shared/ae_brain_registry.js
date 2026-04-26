/**
 * AE Brain Registry — canonical roster of the 13 AE brains
 * Directive section 5.1
 *
 * Each brain entry defines:
 *   - id, name, role, capabilities, providerPreferences, permissionScope
 *
 * The registry does NOT store runtime state (see ae_brain_state.js).
 */

'use strict';

const AE_BRAINS = [
  {
    id: 'ae-onboarding',
    name: 'Onboarding Brain',
    role: 'onboarding',
    description: 'Handles new client intake, account setup, and welcome flows',
    capabilities: ['client-intake', 'account-create', 'welcome-sequence', 'product-intake'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['crm.client.create', 'crm.client.read', 'task.create', 'ae.mesh.handoff'],
    maxHopsOut: 3,
  },
  {
    id: 'ae-growth',
    name: 'Growth Brain',
    role: 'growth',
    description: 'Generates offer positioning, marketing strategies, and growth plans',
    capabilities: ['offer-positioning', 'growth-strategy', 'market-analysis', 'upsell'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['crm.client.read', 'task.create', 'productization.write', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-commerce',
    name: 'Commerce Brain',
    role: 'commerce',
    description: 'Handles pricing setup, product creation, Printful, and storefront management',
    capabilities: ['pricing', 'product-setup', 'printful-integration', 'storefront-update'],
    providerPreferences: { primary: 'openai', fallback: 'anthropic' },
    permissionScope: ['commerce.product.create', 'commerce.order.read', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-appointment',
    name: 'Appointment Brain',
    role: 'appointment',
    description: 'Creates scheduling links, manages calendar integrations, and books consultations',
    capabilities: ['calendar-integration', 'booking-create', 'availability-check', 'reminder-schedule'],
    providerPreferences: { primary: 'openai', fallback: 'anthropic' },
    permissionScope: ['appointment.create', 'appointment.read', 'crm.client.read', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-media-marketing',
    name: 'Media & Marketing Brain',
    role: 'media-marketing',
    description: 'Creates launch content, social posts, marketing assets, and media campaigns',
    capabilities: ['content-generation', 'social-media', 'media-asset-create', 'launch-campaign'],
    providerPreferences: { primary: 'anthropic', fallback: 'gemini' },
    permissionScope: ['media.asset.create', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-support',
    name: 'Support Brain',
    role: 'support',
    description: 'Handles customer support tickets, FAQs, and escalation routing',
    capabilities: ['ticket-triage', 'faq-response', 'escalation-route', 'satisfaction-follow-up'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['crm.client.read', 'task.create', 'task.read', 'ae.mesh.escalation'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-legal',
    name: 'Legal Brain',
    role: 'legal',
    description: 'Reviews contracts, terms, compliance language, and risk flags',
    capabilities: ['contract-review', 'terms-generation', 'compliance-check', 'risk-flag'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['document.read', 'document.create', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 1,
  },
  {
    id: 'ae-finance',
    name: 'Finance Brain',
    role: 'finance',
    description: 'Handles invoicing, revenue tracking, payout eligibility, and billing',
    capabilities: ['invoice-generate', 'revenue-track', 'payout-calculate', 'billing-review'],
    providerPreferences: { primary: 'openai', fallback: 'anthropic' },
    permissionScope: ['billing.read', 'billing.write', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 1,
  },
  {
    id: 'ae-tech',
    name: 'Tech Brain',
    role: 'tech',
    description: 'Handles technical scoping, architecture review, and dev task coordination',
    capabilities: ['tech-scope', 'architecture-review', 'dev-task-create', 'code-review'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['workspace.read', 'task.create', 'deployment.request', 'ae.mesh.consult'],
    maxHopsOut: 3,
  },
  {
    id: 'ae-music',
    name: 'Music Representative Brain',
    role: 'music',
    description: 'Handles artist onboarding, release packaging, and music nexus integration',
    capabilities: ['artist-onboarding', 'release-package', 'storefront-create', 'revenue-split'],
    providerPreferences: { primary: 'openai', fallback: 'anthropic' },
    permissionScope: ['media.asset.create', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-lead',
    name: 'Lead Brain',
    role: 'lead',
    description: 'Qualifies leads, scores opportunities, and hands off to growth or commerce brain',
    capabilities: ['lead-score', 'lead-qualify', 'follow-up-schedule', 'crm-update'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['lead.read', 'lead.write', 'crm.client.read', 'ae.mesh.handoff'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-deployment',
    name: 'Deployment Brain',
    role: 'deployment',
    description: 'Coordinates deployment readiness, env var checks, and platform launch',
    capabilities: ['env-check', 'deployment-request', 'rollback-plan', 'launch-verify'],
    providerPreferences: { primary: 'openai', fallback: 'anthropic' },
    permissionScope: ['deployment.request', 'workspace.read', 'task.create', 'ae.mesh.consult'],
    maxHopsOut: 2,
  },
  {
    id: 'ae-skydexia',
    name: 'SkyDexia Brain',
    role: 'skydexia',
    description: 'Drives code generation, project transformation, and file shipment from SkyDexia',
    capabilities: ['code-generate', 'project-transform', 'file-ship', 'smoke-trigger'],
    providerPreferences: { primary: 'anthropic', fallback: 'openai' },
    permissionScope: ['workspace.write', 'app.generate', 'file.ship', 'smoke.run', 'ae.mesh.consult'],
    maxHopsOut: 3,
  },
];

const BRAIN_MAP = new Map(AE_BRAINS.map(b => [b.id, b]));

function getBrain(id) {
  const brain = BRAIN_MAP.get(id);
  if (!brain) throw new Error(`Unknown brain: ${id}`);
  return brain;
}

function getAllBrains() {
  return [...AE_BRAINS];
}

function getBrainsByRole(role) {
  return AE_BRAINS.filter(b => b.role === role);
}

function brainHasPermission(brainId, permission) {
  const brain = getBrain(brainId);
  return brain.permissionScope.includes(permission);
}

module.exports = { AE_BRAINS, getBrain, getAllBrains, getBrainsByRole, brainHasPermission };
