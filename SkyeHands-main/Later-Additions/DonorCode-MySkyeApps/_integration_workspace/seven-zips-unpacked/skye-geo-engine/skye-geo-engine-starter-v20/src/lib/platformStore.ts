import { createId } from './id.ts';
import { nowIso } from './time.ts';
import { cloneJson } from './json.ts';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type OrgSettingsRecord = {
  orgId: string;
  displayName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  customDomain: string | null;
  quotas: {
    articleDraftsPerMonth: number;
    replayRunsPerMonth: number;
    publishExecPerMonth: number;
  };
  pricing: {
    articleDraftUnitCents: number;
    replayRunUnitCents: number;
    publishExecUnitCents: number;
    backlinkPlacementUnitCents: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyRecord = {
  id: string;
  orgId: string;
  label: string;
  role: UserRole;
  keyPrefix: string;
  secret: string;
  isActive: boolean;
  createdAt: string;
};

export type SeatRecord = {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  status: 'invited' | 'active' | 'disabled';
  clientId: string | null;
  createdAt: string;
};

export type ClientRecord = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  brandName: string | null;
  status: 'active' | 'paused';
  createdAt: string;
};

export type UsageEventRecord = {
  id: string;
  orgId: string;
  workspaceId: string | null;
  projectId: string | null;
  metric: string;
  units: number;
  meta: Record<string, unknown>;
  periodKey: string;
  createdAt: string;
};

export type InvoiceExportRecord = {
  id: string;
  orgId: string;
  periodKey: string;
  totals: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type PartnerSiteRecord = {
  id: string;
  orgId: string;
  domain: string;
  siteName: string;
  topicalTags: string[];
  languages: string[];
  countries: string[];
  monthlyTraffic: number;
  organicKeywords: number;
  domainRating: number;
  sponsoredRatio: number;
  outboundLinksPerMonth: number;
  ownerFingerprint: string | null;
  qualityScore: number;
  policyStatus: 'approved' | 'review' | 'rejected';
  flags: string[];
  createdAt: string;
};

export type PlacementRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  partnerSiteId: string;
  targetUrl: string;
  targetKeyword: string;
  anchorText: string;
  relevanceScore: number;
  anchorDiversityScore: number;
  status: 'queued' | 'live' | 'rejected' | 'flagged';
  liveUrl: string | null;
  flags: string[];
  createdAt: string;
  reconciledAt: string | null;
};

type Store = {
  orgSettings: OrgSettingsRecord[];
  apiKeys: ApiKeyRecord[];
  seats: SeatRecord[];
  clients: ClientRecord[];
  usageEvents: UsageEventRecord[];
  invoiceExports: InvoiceExportRecord[];
  partnerSites: PartnerSiteRecord[];
  placements: PlacementRecord[];
};

function getPeriodKey(value = new Date()): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function createEmptyStore(): Store {
  return { orgSettings: [], apiKeys: [], seats: [], clients: [], usageEvents: [], invoiceExports: [], partnerSites: [], placements: [] };
}

function getStore(): Store {
  const key = '__SKYE_GEO_PLATFORM_STORE__';
  const target = globalThis as typeof globalThis & { [key: string]: Store | undefined };
  if (!target[key]) target[key] = createEmptyStore();
  return target[key]!;
}

function defaultSettings(orgId: string): OrgSettingsRecord {
  const timestamp = nowIso();
  return {
    orgId,
    displayName: orgId,
    primaryColor: null,
    logoUrl: null,
    customDomain: null,
    quotas: { articleDraftsPerMonth: 30, replayRunsPerMonth: 150, publishExecPerMonth: 75 },
    pricing: { articleDraftUnitCents: 700, replayRunUnitCents: 40, publishExecUnitCents: 50, backlinkPlacementUnitCents: 900 },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function normalizeTagList(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client';
}

function pickAnchor(anchorOptions: string[], existingPlacements: PlacementRecord[]): { anchorText: string; diversity: number } {
  const uniqueAnchors = Array.from(new Set(anchorOptions.map((item) => item.trim()).filter(Boolean)));
  const anchors = uniqueAnchors.length ? uniqueAnchors : ['learn more'];
  let best = anchors[0];
  let bestScore = -1;
  for (const anchor of anchors) {
    const used = existingPlacements.filter((item) => item.anchorText.toLowerCase() === anchor.toLowerCase()).length;
    const score = Math.max(0, 100 - used * 25);
    if (score > bestScore) {
      best = anchor;
      bestScore = score;
    }
  }
  return { anchorText: best, diversity: bestScore };
}

function computeTopicalRelevance(siteTags: string[], keyword: string, targetTags: string[]): number {
  const keywordTerms = normalizeTagList(keyword.split(/[^a-z0-9]+/i));
  const allTarget = new Set([...normalizeTagList(targetTags), ...keywordTerms]);
  if (!allTarget.size) return 35;
  const siteSet = new Set(siteTags);
  const overlap = Array.from(allTarget).filter((item) => siteSet.has(item)).length;
  return Math.min(100, Math.round((overlap / allTarget.size) * 100));
}

function computeSitePolicy(input: {
  domainRating: number;
  monthlyTraffic: number;
  organicKeywords: number;
  sponsoredRatio: number;
  outboundLinksPerMonth: number;
  topicalTags: string[];
  ownerFingerprint: string | null;
  duplicateOwnerCount: number;
}): { qualityScore: number; policyStatus: PartnerSiteRecord['policyStatus']; flags: string[] } {
  const flags: string[] = [];
  const drScore = Math.min(100, Math.max(0, input.domainRating));
  const trafficScore = Math.min(100, Math.round(input.monthlyTraffic / 1500));
  const keywordScore = Math.min(100, Math.round(input.organicKeywords / 120));
  const linkPenalty = Math.min(45, Math.round(input.outboundLinksPerMonth / 6));
  const sponsoredPenalty = Math.round(input.sponsoredRatio * 65);
  const topicalBonus = Math.min(12, input.topicalTags.length * 2);
  const duplicatePenalty = input.duplicateOwnerCount > 0 ? 18 : 0;

  if (input.sponsoredRatio > 0.45) flags.push('high_sponsored_ratio');
  if (input.outboundLinksPerMonth > 140) flags.push('link_farm_risk');
  if (input.domainRating < 18) flags.push('weak_authority');
  if (input.monthlyTraffic < 2500) flags.push('thin_traffic');
  if (input.duplicateOwnerCount > 0) flags.push('duplicate_owner_cluster');
  if (input.topicalTags.length < 2) flags.push('thin_topical_profile');

  const qualityScore = Math.max(0, Math.min(100, Math.round((drScore * 0.35) + (trafficScore * 0.2) + (keywordScore * 0.2) + topicalBonus - linkPenalty - sponsoredPenalty - duplicatePenalty)));
  let policyStatus: PartnerSiteRecord['policyStatus'] = 'approved';
  if (flags.includes('link_farm_risk') || flags.includes('high_sponsored_ratio') || qualityScore < 30) policyStatus = 'rejected';
  else if (flags.length >= 2 || qualityScore < 55) policyStatus = 'review';
  return { qualityScore, policyStatus, flags };
}

export function resetPlatformStore(): void {
  const key = '__SKYE_GEO_PLATFORM_STORE__';
  const target = globalThis as typeof globalThis & { [key: string]: Store | undefined };
  target[key] = createEmptyStore();
}

export function snapshotPlatformStoreForTests(): Record<string, unknown> {
  return cloneJson(getStore());
}

export function loadPlatformStoreSnapshotForTests(snapshot: unknown): void {
  const key = '__SKYE_GEO_PLATFORM_STORE__';
  const target = globalThis as typeof globalThis & { [key: string]: Store | undefined };
  const value = cloneJson(snapshot || createEmptyStore()) as Store;
  target[key] = {
    orgSettings: Array.isArray(value.orgSettings) ? value.orgSettings : [],
    apiKeys: Array.isArray(value.apiKeys) ? value.apiKeys : [],
    seats: Array.isArray(value.seats) ? value.seats : [],
    clients: Array.isArray(value.clients) ? value.clients : [],
    usageEvents: Array.isArray(value.usageEvents) ? value.usageEvents : [],
    invoiceExports: Array.isArray(value.invoiceExports) ? value.invoiceExports : [],
    partnerSites: Array.isArray(value.partnerSites) ? value.partnerSites : [],
    placements: Array.isArray(value.placements) ? value.placements : []
  };
}

export function getOrgSettings(orgId: string): OrgSettingsRecord {
  const store = getStore();
  let row = store.orgSettings.find((item) => item.orgId === orgId);
  if (!row) {
    row = defaultSettings(orgId);
    store.orgSettings.push(row);
  }
  return cloneJson(row);
}

export function upsertOrgSettings(orgId: string, input: Partial<Pick<OrgSettingsRecord, 'displayName' | 'primaryColor' | 'logoUrl' | 'customDomain'>> & { quotas?: Partial<OrgSettingsRecord['quotas']>; pricing?: Partial<OrgSettingsRecord['pricing']> }): OrgSettingsRecord {
  const store = getStore();
  let row = store.orgSettings.find((item) => item.orgId === orgId);
  if (!row) {
    row = defaultSettings(orgId);
    store.orgSettings.push(row);
  }
  row.displayName = input.displayName?.trim() || row.displayName;
  row.primaryColor = input.primaryColor?.trim() || row.primaryColor;
  row.logoUrl = input.logoUrl?.trim() || row.logoUrl;
  row.customDomain = input.customDomain?.trim() || row.customDomain;
  row.quotas = {
    articleDraftsPerMonth: input.quotas?.articleDraftsPerMonth ?? row.quotas.articleDraftsPerMonth,
    replayRunsPerMonth: input.quotas?.replayRunsPerMonth ?? row.quotas.replayRunsPerMonth,
    publishExecPerMonth: input.quotas?.publishExecPerMonth ?? row.quotas.publishExecPerMonth
  };
  row.pricing = {
    articleDraftUnitCents: input.pricing?.articleDraftUnitCents ?? row.pricing.articleDraftUnitCents,
    replayRunUnitCents: input.pricing?.replayRunUnitCents ?? row.pricing.replayRunUnitCents,
    publishExecUnitCents: input.pricing?.publishExecUnitCents ?? row.pricing.publishExecUnitCents,
    backlinkPlacementUnitCents: input.pricing?.backlinkPlacementUnitCents ?? row.pricing.backlinkPlacementUnitCents
  };
  row.updatedAt = nowIso();
  return cloneJson(row);
}

export function listApiKeys(orgId: string): Array<Omit<ApiKeyRecord, 'secret'>> {
  const store = getStore();
  return cloneJson(store.apiKeys.filter((item) => item.orgId === orgId).map(({ secret: _secret, ...rest }) => rest));
}

export function createApiKey(orgId: string, input: { label: string; role: UserRole }): { apiKey: Omit<ApiKeyRecord, 'secret'>; secret: string } {
  const store = getStore();
  const randomPart = Math.random().toString(36).slice(2, 10);
  const secret = `skg_${orgId}_${randomPart}`;
  const row: ApiKeyRecord = {
    id: createId('key'),
    orgId,
    label: input.label.trim(),
    role: input.role,
    keyPrefix: secret.slice(0, 14),
    secret,
    isActive: true,
    createdAt: nowIso()
  };
  store.apiKeys.push(row);
  const { secret: hidden, ...apiKey } = row;
  return { apiKey: cloneJson(apiKey), secret: hidden };
}

export function validateApiKey(orgId: string, secret: string): ApiKeyRecord | null {
  const store = getStore();
  const row = store.apiKeys.find((item) => item.orgId === orgId && item.secret === secret && item.isActive);
  return row ? cloneJson(row) : null;
}

export function listSeats(orgId: string): SeatRecord[] {
  return cloneJson(getStore().seats.filter((item) => item.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function createSeat(orgId: string, input: { email: string; role: UserRole; status?: SeatRecord['status']; clientId?: string | null }): SeatRecord {
  const row: SeatRecord = { id: createId('seat'), orgId, email: input.email.trim().toLowerCase(), role: input.role, status: input.status || 'invited', clientId: input.clientId || null, createdAt: nowIso() };
  getStore().seats.push(row);
  return cloneJson(row);
}

export function listClients(orgId: string): ClientRecord[] {
  return cloneJson(getStore().clients.filter((item) => item.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function createClient(orgId: string, input: { name: string; contactEmail?: string | null; brandName?: string | null; status?: ClientRecord['status'] }): ClientRecord {
  const row: ClientRecord = { id: createId('client'), orgId, name: input.name.trim(), slug: slugify(input.name), contactEmail: input.contactEmail?.trim().toLowerCase() || null, brandName: input.brandName?.trim() || null, status: input.status || 'active', createdAt: nowIso() };
  getStore().clients.push(row);
  return cloneJson(row);
}

export function recordUsage(orgId: string, input: { workspaceId?: string | null; projectId?: string | null; metric: string; units?: number; meta?: Record<string, unknown> }): UsageEventRecord {
  const row: UsageEventRecord = { id: createId('usage'), orgId, workspaceId: input.workspaceId || null, projectId: input.projectId || null, metric: input.metric, units: input.units ?? 1, meta: cloneJson(input.meta || {}), periodKey: getPeriodKey(), createdAt: nowIso() };
  getStore().usageEvents.push(row);
  return cloneJson(row);
}

export function listUsage(orgId: string, periodKey?: string): UsageEventRecord[] {
  return cloneJson(getStore().usageEvents.filter((item) => item.orgId === orgId && (!periodKey || item.periodKey === periodKey)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function summarizeUsage(orgId: string, periodKey = getPeriodKey()): { periodKey: string; totals: Record<string, number>; estimatedCents: number } {
  const settings = getOrgSettings(orgId);
  const totals: Record<string, number> = {};
  for (const item of listUsage(orgId, periodKey)) totals[item.metric] = (totals[item.metric] || 0) + item.units;
  const estimatedCents = (totals.articleDraftsPerMonth || 0) * settings.pricing.articleDraftUnitCents
    + (totals.replayRunsPerMonth || 0) * settings.pricing.replayRunUnitCents
    + (totals.publishExecPerMonth || 0) * settings.pricing.publishExecUnitCents
    + (totals.backlinkPlacements || 0) * settings.pricing.backlinkPlacementUnitCents;
  return { periodKey, totals, estimatedCents };
}

export function checkQuota(orgId: string, metric: keyof OrgSettingsRecord['quotas'], requestedUnits = 1): { allowed: boolean; used: number; limit: number; requestedUnits: number } {
  const settings = getOrgSettings(orgId);
  const periodKey = getPeriodKey();
  const used = listUsage(orgId, periodKey).filter((item) => item.metric === metric).reduce((sum, item) => sum + item.units, 0);
  const limit = settings.quotas[metric];
  return { allowed: used + requestedUnits <= limit, used, limit, requestedUnits };
}

export function createInvoiceExport(orgId: string, periodKey = getPeriodKey()): InvoiceExportRecord {
  const summary = summarizeUsage(orgId, periodKey);
  const settings = getOrgSettings(orgId);
  const payload = { settings, summary, usage: listUsage(orgId, periodKey) } as Record<string, unknown>;
  const row: InvoiceExportRecord = { id: createId('invoice'), orgId, periodKey, totals: summary as unknown as Record<string, unknown>, payload, createdAt: nowIso() };
  getStore().invoiceExports.push(row);
  return cloneJson(row);
}

export function listInvoiceExports(orgId: string): InvoiceExportRecord[] {
  return cloneJson(getStore().invoiceExports.filter((item) => item.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function listPartnerSites(orgId: string): PartnerSiteRecord[] {
  return cloneJson(getStore().partnerSites.filter((item) => item.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function createPartnerSite(orgId: string, input: {
  domain: string;
  siteName: string;
  topicalTags?: string[];
  languages?: string[];
  countries?: string[];
  monthlyTraffic?: number;
  organicKeywords?: number;
  domainRating?: number;
  sponsoredRatio?: number;
  outboundLinksPerMonth?: number;
  ownerFingerprint?: string | null;
}): PartnerSiteRecord {
  const store = getStore();
  const ownerFingerprint = input.ownerFingerprint?.trim() || null;
  const duplicateOwnerCount = ownerFingerprint ? store.partnerSites.filter((item) => item.orgId === orgId && item.ownerFingerprint === ownerFingerprint).length : 0;
  const topicalTags = normalizeTagList(input.topicalTags);
  const policy = computeSitePolicy({
    domainRating: Number(input.domainRating ?? 0),
    monthlyTraffic: Number(input.monthlyTraffic ?? 0),
    organicKeywords: Number(input.organicKeywords ?? 0),
    sponsoredRatio: Number(input.sponsoredRatio ?? 0),
    outboundLinksPerMonth: Number(input.outboundLinksPerMonth ?? 0),
    topicalTags,
    ownerFingerprint,
    duplicateOwnerCount
  });
  const row: PartnerSiteRecord = {
    id: createId('site'),
    orgId,
    domain: input.domain.trim().toLowerCase(),
    siteName: input.siteName.trim(),
    topicalTags,
    languages: normalizeTagList(input.languages),
    countries: normalizeTagList(input.countries),
    monthlyTraffic: Number(input.monthlyTraffic ?? 0),
    organicKeywords: Number(input.organicKeywords ?? 0),
    domainRating: Number(input.domainRating ?? 0),
    sponsoredRatio: Number(input.sponsoredRatio ?? 0),
    outboundLinksPerMonth: Number(input.outboundLinksPerMonth ?? 0),
    ownerFingerprint,
    qualityScore: policy.qualityScore,
    policyStatus: policy.policyStatus,
    flags: policy.flags,
    createdAt: nowIso()
  };
  store.partnerSites.push(row);
  return cloneJson(row);
}

export function listPlacements(orgId: string, workspaceId?: string | null): PlacementRecord[] {
  return cloneJson(getStore().placements.filter((item) => item.orgId === orgId && (!workspaceId || item.workspaceId === workspaceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function queuePlacements(orgId: string, input: { workspaceId: string; projectId?: string | null; partnerSiteIds: string[]; targetUrl: string; targetKeyword: string; targetTags?: string[]; anchorOptions?: string[] }): { queued: PlacementRecord[]; rejected: PlacementRecord[] } {
  const store = getStore();
  const sites = store.partnerSites.filter((item) => item.orgId === orgId && input.partnerSiteIds.includes(item.id));
  const existingPlacements = store.placements.filter((item) => item.orgId === orgId);
  const queued: PlacementRecord[] = [];
  const rejected: PlacementRecord[] = [];
  for (const site of sites) {
    const relevanceScore = computeTopicalRelevance(site.topicalTags, input.targetKeyword, input.targetTags || []);
    const anchorPick = pickAnchor(input.anchorOptions || [], existingPlacements.concat(queued));
    const flags = [...site.flags];
    if (relevanceScore < 30) flags.push('weak_topical_relevance');
    const status: PlacementRecord['status'] = site.policyStatus === 'approved' && relevanceScore >= 30 ? 'queued' : (site.policyStatus === 'rejected' ? 'rejected' : 'flagged');
    const row: PlacementRecord = {
      id: createId('place'),
      orgId,
      workspaceId: input.workspaceId,
      projectId: input.projectId || null,
      partnerSiteId: site.id,
      targetUrl: input.targetUrl.trim(),
      targetKeyword: input.targetKeyword.trim(),
      anchorText: anchorPick.anchorText,
      relevanceScore,
      anchorDiversityScore: anchorPick.diversity,
      status,
      liveUrl: null,
      flags,
      createdAt: nowIso(),
      reconciledAt: null
    };
    store.placements.push(row);
    if (status === 'queued') queued.push(cloneJson(row)); else rejected.push(cloneJson(row));
  }
  return { queued, rejected };
}

export function reconcilePlacement(orgId: string, placementId: string, input: { status: PlacementRecord['status']; liveUrl?: string | null; flags?: string[] }): PlacementRecord {
  const store = getStore();
  const row = store.placements.find((item) => item.orgId === orgId && item.id === placementId);
  if (!row) throw new Error('placement_not_found');
  row.status = input.status;
  row.liveUrl = input.liveUrl?.trim() || row.liveUrl;
  row.flags = Array.from(new Set([...(row.flags || []), ...((input.flags || []).map((item) => item.trim()).filter(Boolean))]));
  row.reconciledAt = nowIso();
  return cloneJson(row);
}

export function summarizeBacklinkNetwork(orgId: string, workspaceId?: string | null): Record<string, unknown> {
  const sites = listPartnerSites(orgId);
  const placements = listPlacements(orgId, workspaceId);
  const averageQuality = sites.length ? Math.round(sites.reduce((sum, item) => sum + item.qualityScore, 0) / sites.length) : 0;
  const approvedSites = sites.filter((item) => item.policyStatus === 'approved').length;
  const flaggedSites = sites.filter((item) => item.flags.length > 0).length;
  const livePlacements = placements.filter((item) => item.status === 'live').length;
  const queuedPlacements = placements.filter((item) => item.status === 'queued').length;
  const distinctAnchors = new Set(placements.map((item) => item.anchorText.toLowerCase())).size;
  const averageAnchorDiversity = placements.length ? Math.round(placements.reduce((sum, item) => sum + item.anchorDiversityScore, 0) / placements.length) : 0;
  return { totalSites: sites.length, approvedSites, flaggedSites, averageQuality, livePlacements, queuedPlacements, averageAnchorDiversity, distinctAnchors };
}
