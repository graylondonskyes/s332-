import type { WorkspaceHistory, EvidenceExportRecord } from './db.ts';
import type { ResolvedEnv } from './env.ts';
import { getCapabilityRegistry, type CapabilityModule } from './capabilities.ts';
import { cloneJson } from './json.ts';
import { nowIso } from './time.ts';
import { validateProviderContract, type ProviderValidation } from './runtimeContracts.ts';

export type TargetProbeInput = {
  platform: string;
  targetUrl?: string | null;
  collectionId?: string | null;
  blogId?: string | null;
  memberId?: string | null;
  acceptVersion?: string | null;
  authToken?: string | null;
  workspaceName?: string | null;
};

export type TargetProbe = {
  generatedAt: string;
  platform: string;
  targetUrl: string | null;
  probeUrl: string | null;
  targetMode: 'local' | 'remote' | 'missing';
  executionTruth: ProviderValidation['executionTruth'];
  requestMethod: 'HEAD' | 'GET';
  reachable: boolean;
  status: 'blocked' | 'reachable' | 'unreachable';
  responseStatus: number | null;
  ready: boolean;
  liveRemotePublishObserved: boolean;
  authConfigured: boolean;
  notes: string[];
  blockers: string[];
};

export type TargetProbeSummary = {
  generatedAt: string;
  workspaceId: string;
  items: TargetProbe[];
  latestByPlatform: Record<string, TargetProbe>;
  summary: {
    probes: number;
    reachable: number;
    blocked: number;
    unreachable: number;
    remoteTargets: number;
    liveRemotePublishObserved: number;
  };
};

export type TargetProbePack = {
  generatedAt: string;
  workspaceId: string;
  summary: TargetProbeSummary;
  nextActions: string[];
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

export function isRemoteTargetUrl(targetUrl: string | null | undefined): boolean {
  const value = String(targetUrl || '').trim().toLowerCase();
  if (!value) return false;
  if (!value.startsWith('http')) return false;
  return !value.includes('127.0.0.1') && !value.includes('localhost') && !value.includes('.local') && !value.includes('smoke.local');
}

function buildProbeUrl(input: TargetProbeInput): string | null {
  const targetUrl = trimOrNull(input.targetUrl);
  if (!targetUrl) return null;
  switch (input.platform) {
    case 'wordpress':
      return targetUrl.replace(/\/$/, '') + '/wp-json/wp/v2/posts';
    case 'webflow': {
      const collectionId = trimOrNull(input.collectionId);
      return collectionId ? `${targetUrl.replace(/\/$/, '')}/collections/${collectionId}/items` : null;
    }
    case 'shopify': {
      const blogId = trimOrNull(input.blogId);
      return blogId ? `${targetUrl.replace(/\/$/, '')}/admin/api/2024-01/blogs/${blogId}/articles.json` : null;
    }
    case 'wix':
      return targetUrl.replace(/\/$/, '') + '/blog/v3/draft-posts';
    case 'ghost':
      return targetUrl.replace(/\/$/, '') + '/ghost/api/admin/posts/';
    default:
      return targetUrl;
  }
}

function buildProbeHeaders(input: TargetProbeInput): Headers {
  const headers = new Headers({ accept: 'application/json, text/plain;q=0.9, */*;q=0.8' });
  const authToken = trimOrNull(input.authToken);
  if (authToken) headers.set('authorization', `Bearer ${authToken}`);
  const acceptVersion = trimOrNull(input.acceptVersion);
  if (input.platform === 'ghost' && acceptVersion) headers.set('accept-version', acceptVersion);
  return headers;
}

function isReachableStatus(status: number): boolean {
  return (status >= 200 && status < 400) || status === 401 || status === 403 || status === 405;
}

function liveRemotePublishObserved(history: WorkspaceHistory, platform: string): boolean {
  return history.publishRuns.some((item) => item.platform === platform && item.status === 'success' && isRemoteTargetUrl(item.endpoint));
}

export async function runTargetProbe(env: ResolvedEnv, history: WorkspaceHistory, input: TargetProbeInput, modules = getCapabilityRegistry()): Promise<TargetProbe> {
  const platform = trimOrNull(input.platform) || 'generic-api';
  const validation = validateProviderContract({
    platform,
    targetUrl: trimOrNull(input.targetUrl),
    collectionId: trimOrNull(input.collectionId),
    blogId: trimOrNull(input.blogId),
    memberId: trimOrNull(input.memberId),
    acceptVersion: trimOrNull(input.acceptVersion)
  }, modules, env, history);

  const probeUrl = buildProbeUrl({ ...input, platform });
  const requestMethod: TargetProbe['requestMethod'] = probeUrl && platform === 'generic-api' ? 'GET' : 'HEAD';
  const notes = cloneJson(validation.notes || []);
  const blockers = cloneJson(validation.blockers || []);
  const livePublish = liveRemotePublishObserved(history, platform);

  if (!probeUrl || validation.executionTruth === 'blocked') {
    return {
      generatedAt: nowIso(),
      platform,
      targetUrl: trimOrNull(input.targetUrl),
      probeUrl,
      targetMode: validation.targetMode,
      executionTruth: validation.executionTruth,
      requestMethod,
      reachable: false,
      status: 'blocked',
      responseStatus: null,
      ready: false,
      liveRemotePublishObserved: livePublish,
      authConfigured: !!trimOrNull(input.authToken),
      notes,
      blockers
    };
  }

  try {
    let response = await fetch(probeUrl, { method: requestMethod, headers: buildProbeHeaders({ ...input, platform }) });
    if (requestMethod === 'HEAD' && response.status === 404) {
      response = await fetch(probeUrl, { method: 'GET', headers: buildProbeHeaders({ ...input, platform }) });
    }
    const reachable = isReachableStatus(response.status);
    if (reachable) {
      notes.push(response.status === 405
        ? 'Target rejected the probe method but proved the endpoint exists and is network-reachable.'
        : 'Target responded to a real probe request.');
    } else {
      blockers.push(`Probe returned non-reachable status ${response.status}.`);
    }
    if (isRemoteTargetUrl(input.targetUrl)) notes.push('This probe hit a remote-looking target URL, but remote publish proof still depends on a successful publish run.');
    return {
      generatedAt: nowIso(),
      platform,
      targetUrl: trimOrNull(input.targetUrl),
      probeUrl,
      targetMode: validation.targetMode,
      executionTruth: validation.executionTruth,
      requestMethod: requestMethod === 'HEAD' && response.status === 404 ? 'GET' : requestMethod,
      reachable,
      status: reachable ? 'reachable' : 'unreachable',
      responseStatus: response.status,
      ready: validation.ready && reachable,
      liveRemotePublishObserved: livePublish,
      authConfigured: !!trimOrNull(input.authToken),
      notes,
      blockers
    };
  } catch (error) {
    blockers.push(`Probe fetch failed: ${String(error && (error as Error).message ? (error as Error).message : error)}.`);
    return {
      generatedAt: nowIso(),
      platform,
      targetUrl: trimOrNull(input.targetUrl),
      probeUrl,
      targetMode: validation.targetMode,
      executionTruth: validation.executionTruth,
      requestMethod,
      reachable: false,
      status: 'unreachable',
      responseStatus: null,
      ready: false,
      liveRemotePublishObserved: livePublish,
      authConfigured: !!trimOrNull(input.authToken),
      notes,
      blockers
    };
  }
}

function toTargetProbe(item: EvidenceExportRecord): TargetProbe | null {
  if (item.exportType !== 'target_probe') return null;
  const targetProbe = (item.payload as Record<string, unknown>)?.targetProbe as TargetProbe | undefined;
  return targetProbe ? cloneJson(targetProbe) : null;
}

export function listTargetProbes(history: WorkspaceHistory): TargetProbe[] {
  return history.evidenceExports
    .map((item) => toTargetProbe(item))
    .filter(Boolean)
    .sort((a, b) => String(b!.generatedAt).localeCompare(String(a!.generatedAt))) as TargetProbe[];
}

export function buildTargetProbeSummary(history: WorkspaceHistory): TargetProbeSummary {
  const items = listTargetProbes(history);
  const latestByPlatform = Object.fromEntries(items.map((item) => [item.platform, item]).filter(([platform], index, arr) => arr.findIndex((entry) => entry[0] === platform) === index));
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    items,
    latestByPlatform,
    summary: {
      probes: items.length,
      reachable: items.filter((item) => item.status === 'reachable').length,
      blocked: items.filter((item) => item.status === 'blocked').length,
      unreachable: items.filter((item) => item.status === 'unreachable').length,
      remoteTargets: items.filter((item) => item.targetMode === 'remote').length,
      liveRemotePublishObserved: items.filter((item) => item.liveRemotePublishObserved).length
    }
  };
}

export function buildTargetProbePack(history: WorkspaceHistory): TargetProbePack {
  const summary = buildTargetProbeSummary(history);
  const nextActions: string[] = [];
  if (!summary.summary.probes) nextActions.push('Run at least one target probe before treating live-target blockers as understood.');
  if (summary.items.some((item) => item.status === 'blocked')) nextActions.push('Fix missing target fields and rerun the blocked target probes.');
  if (summary.items.some((item) => item.status === 'unreachable')) nextActions.push('Resolve network or endpoint issues for unreachable targets before launch.');
  if (!summary.items.some((item) => item.platform === 'neon-http')) nextActions.push('Add a Neon target probe pack entry before calling the runtime launch-ready.');
  if (!summary.items.some((item) => item.liveRemotePublishObserved)) nextActions.push('A reachable remote CMS target is not enough; run a real remote publish to upgrade from ready-to-prove to proved.');
  return {
    generatedAt: nowIso(),
    workspaceId: history.workspace.id,
    summary,
    nextActions
  };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderTargetProbeSite(input: { workspaceName: string; pack: TargetProbePack }): string {
  const rows = input.pack.summary.items.map((item) => `<tr><td>${esc(item.platform)}</td><td>${esc(item.status)}</td><td>${esc(item.targetMode)}</td><td>${esc(item.responseStatus ?? 'n/a')}</td><td>${esc(item.executionTruth)}</td><td>${esc(item.blockers.join(' | ') || 'none')}</td></tr>`).join('');
  const actions = input.pack.nextActions.map((item) => `<li>${esc(item)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Skye GEO Engine Target Probe Pack</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1b31;--line:#223557;--text:#f4f7fb;--muted:#9fb3cf}body{margin:0;background:radial-gradient(circle at top,#16274e 0%,#07111f 55%);font-family:Inter,system-ui,sans-serif;color:var(--text)}.shell{max-width:1200px;margin:0 auto;padding:24px}.hero,.card{background:rgba(10,18,34,.88);border:1px solid var(--line);border-radius:24px;padding:20px}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:16px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:13px}p,li{color:var(--muted)}h1,h2{margin:0 0 8px 0}</style></head><body><div class="shell"><section class="hero"><h1>Target probe pack · ${esc(input.workspaceName)}</h1><p>This export shows real probe reachability, contract truth, and the remaining gap between target readiness and live proof.</p><div style="font-size:13px;color:#d6e3ff;">Generated: ${esc(input.pack.generatedAt)} · Probes: ${input.pack.summary.summary.probes} · Reachable: ${input.pack.summary.summary.reachable}</div></section><section class="grid"><article class="card"><h2>Probe summary</h2><table><thead><tr><th>Platform</th><th>Status</th><th>Mode</th><th>HTTP</th><th>Truth</th><th>Blockers</th></tr></thead><tbody>${rows}</tbody></table></article><article class="card"><h2>Next actions</h2><ul>${actions || '<li>No additional actions were generated.</li>'}</ul></article></section></div></body></html>`;
}
