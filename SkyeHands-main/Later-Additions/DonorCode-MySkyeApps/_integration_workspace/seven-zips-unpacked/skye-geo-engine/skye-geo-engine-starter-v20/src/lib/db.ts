import { cloneJson, parseJsonString } from './json.ts';
import { createId } from './id.ts';
import { nowIso } from './time.ts';
import type { ResolvedEnv } from './env.ts';
import { AppError } from './errors.ts';

export type WorkspaceRecord = {
  id: string;
  orgId: string;
  name: string;
  brand: string | null;
  niche: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  primaryUrl: string | null;
  audience: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AuditRunRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  targetUrl: string;
  score: number;
  result: Record<string, unknown>;
  createdAt: string;
};

export type ContentPlanRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  brand: string;
  niche: string;
  audience: string;
  result: Record<string, unknown>;
  createdAt: string;
};

export type SavedPromptPackRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  brand: string;
  niche: string;
  market: string | null;
  result: Record<string, unknown>;
  createdAt: string;
};

export type SourceRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  siteName: string | null;
  title: string;
  snippet: string;
  contentText: string;
  contentHash: string;
  retrievalOrigin: string;
  retrievedAt: string;
  publishedAt: string | null;
  createdAt: string;
};

export type ArticleBriefRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  primaryKeyword: string;
  brief: Record<string, unknown>;
  sourceIds: string[];
  createdAt: string;
};

export type ArticleClaimRecord = {
  claimId: string;
  text: string;
  sourceIds: string[];
};

export type ArticleFaqRecord = {
  question: string;
  answer: string;
  sourceIds: string[];
};

export type ArticleRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  briefId: string;
  title: string;
  slug: string;
  bodyHtml: string;
  jsonLd: string;
  citations: Array<{ sourceId: string; title: string; canonicalUrl: string | null }>;
  language: string;
  tone: string;
  callToAction: string;
  infographicPrompt: string;
  claimMap: ArticleClaimRecord[];
  faqItems: ArticleFaqRecord[];
  createdAt: string;
};

export type PublishRunRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  articleId: string | null;
  platform: string;
  payload: Record<string, unknown>;
  endpoint: string | null;
  status: 'prepared' | 'queued' | 'success' | 'failed';
  remoteId: string | null;
  attemptCount: number;
  responseStatus: number | null;
  responseExcerpt: string | null;
  lastError: string | null;
  scheduledFor: string | null;
  lastAttemptAt: string | null;
  executedAt: string | null;
  createdAt: string;
};

export type VisibilityRunRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  promptPackId: string;
  provider: string;
  prompt: string;
  answerText: string;
  result: Record<string, unknown>;
  createdAt: string;
};

export type EvidenceExportRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  projectId: string | null;
  exportType: string;
  subjectType: string | null;
  subjectId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceHistory = {
  workspace: WorkspaceRecord;
  projects: ProjectRecord[];
  jobs: JobRecord[];
  auditRuns: AuditRunRecord[];
  contentPlans: ContentPlanRecord[];
  promptPacks: SavedPromptPackRecord[];
  sources: SourceRecord[];
  briefs: ArticleBriefRecord[];
  articles: ArticleRecord[];
  publishRuns: PublishRunRecord[];
  visibilityRuns: VisibilityRunRecord[];
  evidenceExports: EvidenceExportRecord[];
};

export interface StorageAdapter {
  readonly kind: 'memory' | 'neon-http';
  createWorkspace(orgId: string, input: { name: string; brand?: string | null; niche?: string | null }): Promise<WorkspaceRecord>;
  listWorkspaces(orgId: string): Promise<WorkspaceRecord[]>;
  createProject(orgId: string, input: { workspaceId: string; name: string; primaryUrl?: string | null; audience?: string | null }): Promise<ProjectRecord>;
  listProjects(orgId: string, workspaceId: string): Promise<ProjectRecord[]>;
  createJob(input: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord>;
  updateJob(id: string, orgId: string, patch: Partial<Pick<JobRecord, 'status' | 'summary' | 'metadata'>>): Promise<JobRecord>;
  listJobs(orgId: string, workspaceId: string): Promise<JobRecord[]>;
  insertAuditRun(input: Omit<AuditRunRecord, 'id' | 'createdAt'>): Promise<AuditRunRecord>;
  listAuditRuns(orgId: string, workspaceId: string): Promise<AuditRunRecord[]>;
  insertContentPlan(input: Omit<ContentPlanRecord, 'id' | 'createdAt'>): Promise<ContentPlanRecord>;
  listContentPlans(orgId: string, workspaceId: string): Promise<ContentPlanRecord[]>;
  insertPromptPack(input: Omit<SavedPromptPackRecord, 'id' | 'createdAt'>): Promise<SavedPromptPackRecord>;
  listPromptPacks(orgId: string, workspaceId: string): Promise<SavedPromptPackRecord[]>;
  getPromptPack(orgId: string, id: string): Promise<SavedPromptPackRecord | null>;
  upsertSources(input: Array<Omit<SourceRecord, 'id' | 'createdAt'>>): Promise<{ inserted: SourceRecord[]; deduped: SourceRecord[] }>;
  listSources(orgId: string, workspaceId: string): Promise<SourceRecord[]>;
  getSourcesByIds(orgId: string, ids: string[]): Promise<SourceRecord[]>;
  insertArticleBrief(input: Omit<ArticleBriefRecord, 'id' | 'createdAt'>): Promise<ArticleBriefRecord>;
  listArticleBriefs(orgId: string, workspaceId: string): Promise<ArticleBriefRecord[]>;
  getArticleBrief(orgId: string, id: string): Promise<ArticleBriefRecord | null>;
  insertArticle(input: Omit<ArticleRecord, 'id' | 'createdAt'>): Promise<ArticleRecord>;
  listArticles(orgId: string, workspaceId: string): Promise<ArticleRecord[]>;
  getArticle(orgId: string, id: string): Promise<ArticleRecord | null>;
  insertPublishRun(input: Omit<PublishRunRecord, 'id' | 'createdAt'>): Promise<PublishRunRecord>;
  updatePublishRun(id: string, orgId: string, patch: Partial<Omit<PublishRunRecord, 'id' | 'orgId' | 'workspaceId' | 'projectId' | 'articleId' | 'platform' | 'payload' | 'createdAt'>>): Promise<PublishRunRecord>;
  getPublishRun(orgId: string, id: string): Promise<PublishRunRecord | null>;
  listPublishRuns(orgId: string, workspaceId: string): Promise<PublishRunRecord[]>;
  insertVisibilityRun(input: Omit<VisibilityRunRecord, 'id' | 'createdAt'>): Promise<VisibilityRunRecord>;
  listVisibilityRuns(orgId: string, workspaceId: string): Promise<VisibilityRunRecord[]>;
  insertEvidenceExport(input: Omit<EvidenceExportRecord, 'id' | 'createdAt'>): Promise<EvidenceExportRecord>;
  listEvidenceExports(orgId: string, workspaceId: string): Promise<EvidenceExportRecord[]>;
  getWorkspaceHistory(orgId: string, workspaceId: string): Promise<WorkspaceHistory>;
}

type MemoryStore = {
  workspaces: WorkspaceRecord[];
  projects: ProjectRecord[];
  jobs: JobRecord[];
  auditRuns: AuditRunRecord[];
  contentPlans: ContentPlanRecord[];
  promptPacks: SavedPromptPackRecord[];
  sources: SourceRecord[];
  briefs: ArticleBriefRecord[];
  articles: ArticleRecord[];
  publishRuns: PublishRunRecord[];
  visibilityRuns: VisibilityRunRecord[];
  evidenceExports: EvidenceExportRecord[];
};

function createEmptyStore(): MemoryStore {
  return {
    workspaces: [],
    projects: [],
    jobs: [],
    auditRuns: [],
    contentPlans: [],
    promptPacks: [],
    sources: [],
    briefs: [],
    articles: [],
    publishRuns: [],
    visibilityRuns: [],
    evidenceExports: []
  };
}

function getMemoryStore(): MemoryStore {
  const key = '__SKYE_GEO_MEMORY_STORE__';
  const globalStore = globalThis as typeof globalThis & { [key: string]: MemoryStore | undefined };
  if (!globalStore[key]) globalStore[key] = createEmptyStore();
  return globalStore[key]!;
}

function ensureWorkspace(orgId: string, workspaceId: string, store: MemoryStore): WorkspaceRecord {
  const workspace = store.workspaces.find((item) => item.orgId === orgId && item.id === workspaceId);
  if (!workspace) throw new AppError(404, 'workspace_not_found', 'Workspace not found.');
  return workspace;
}

function ensureProject(orgId: string, projectId: string, store: MemoryStore): ProjectRecord {
  const project = store.projects.find((item) => item.orgId === orgId && item.id === projectId);
  if (!project) throw new AppError(404, 'project_not_found', 'Project not found.');
  return project;
}

export function snapshotMemoryDbForTests(): Record<string, unknown> {
  return cloneJson(getMemoryStore());
}

export function loadMemoryDbSnapshotForTests(snapshot: unknown): void {
  const key = '__SKYE_GEO_MEMORY_STORE__';
  const globalStore = globalThis as typeof globalThis & { [key: string]: MemoryStore | undefined };
  const value = cloneJson(snapshot || createEmptyStore()) as MemoryStore;
  globalStore[key] = {
    workspaces: Array.isArray(value.workspaces) ? value.workspaces : [],
    projects: Array.isArray(value.projects) ? value.projects : [],
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
    auditRuns: Array.isArray(value.auditRuns) ? value.auditRuns : [],
    contentPlans: Array.isArray(value.contentPlans) ? value.contentPlans : [],
    promptPacks: Array.isArray(value.promptPacks) ? value.promptPacks : [],
    sources: Array.isArray(value.sources) ? value.sources : [],
    briefs: Array.isArray(value.briefs) ? value.briefs : [],
    articles: Array.isArray(value.articles) ? value.articles : [],
    publishRuns: Array.isArray(value.publishRuns) ? value.publishRuns : [],
    visibilityRuns: Array.isArray(value.visibilityRuns) ? value.visibilityRuns : [],
    evidenceExports: Array.isArray(value.evidenceExports) ? value.evidenceExports : []
  };
  memorySingleton = null;
}

class MemoryDb implements StorageAdapter {
  readonly kind = 'memory' as const;
  private readonly store = getMemoryStore();

  async createWorkspace(orgId: string, input: { name: string; brand?: string | null; niche?: string | null }): Promise<WorkspaceRecord> {
    const timestamp = nowIso();
    const record: WorkspaceRecord = { id: createId('ws'), orgId, name: input.name.trim(), brand: input.brand?.trim() || null, niche: input.niche?.trim() || null, createdAt: timestamp, updatedAt: timestamp };
    this.store.workspaces.push(record);
    return cloneJson(record);
  }

  async listWorkspaces(orgId: string): Promise<WorkspaceRecord[]> {
    return cloneJson(this.store.workspaces.filter((item) => item.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async createProject(orgId: string, input: { workspaceId: string; name: string; primaryUrl?: string | null; audience?: string | null }): Promise<ProjectRecord> {
    ensureWorkspace(orgId, input.workspaceId, this.store);
    const timestamp = nowIso();
    const record: ProjectRecord = { id: createId('prj'), orgId, workspaceId: input.workspaceId, name: input.name.trim(), primaryUrl: input.primaryUrl?.trim() || null, audience: input.audience?.trim() || null, createdAt: timestamp, updatedAt: timestamp };
    this.store.projects.push(record);
    return cloneJson(record);
  }

  async listProjects(orgId: string, workspaceId: string): Promise<ProjectRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.projects.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async createJob(input: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const timestamp = nowIso();
    const record: JobRecord = { id: createId('job'), ...cloneJson(input), createdAt: timestamp, updatedAt: timestamp };
    this.store.jobs.push(record);
    return cloneJson(record);
  }

  async updateJob(id: string, orgId: string, patch: Partial<Pick<JobRecord, 'status' | 'summary' | 'metadata'>>): Promise<JobRecord> {
    const record = this.store.jobs.find((item) => item.orgId === orgId && item.id === id);
    if (!record) throw new AppError(404, 'job_not_found', 'Job not found.');
    if (patch.status) record.status = patch.status;
    if (typeof patch.summary === 'string') record.summary = patch.summary;
    if (patch.metadata) record.metadata = cloneJson(patch.metadata);
    record.updatedAt = nowIso();
    return cloneJson(record);
  }

  async listJobs(orgId: string, workspaceId: string): Promise<JobRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.jobs.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async insertAuditRun(input: Omit<AuditRunRecord, 'id' | 'createdAt'>): Promise<AuditRunRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: AuditRunRecord = { id: createId('audit'), ...cloneJson(input), createdAt: nowIso() };
    this.store.auditRuns.push(record);
    return cloneJson(record);
  }

  async listAuditRuns(orgId: string, workspaceId: string): Promise<AuditRunRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.auditRuns.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async insertContentPlan(input: Omit<ContentPlanRecord, 'id' | 'createdAt'>): Promise<ContentPlanRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: ContentPlanRecord = { id: createId('plan'), ...cloneJson(input), createdAt: nowIso() };
    this.store.contentPlans.push(record);
    return cloneJson(record);
  }

  async listContentPlans(orgId: string, workspaceId: string): Promise<ContentPlanRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.contentPlans.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async insertPromptPack(input: Omit<SavedPromptPackRecord, 'id' | 'createdAt'>): Promise<SavedPromptPackRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: SavedPromptPackRecord = { id: createId('prompt'), ...cloneJson(input), createdAt: nowIso() };
    this.store.promptPacks.push(record);
    return cloneJson(record);
  }

  async listPromptPacks(orgId: string, workspaceId: string): Promise<SavedPromptPackRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.promptPacks.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getPromptPack(orgId: string, id: string): Promise<SavedPromptPackRecord | null> {
    const item = this.store.promptPacks.find((row) => row.orgId === orgId && row.id === id);
    return item ? cloneJson(item) : null;
  }

  async upsertSources(input: Array<Omit<SourceRecord, 'id' | 'createdAt'>>): Promise<{ inserted: SourceRecord[]; deduped: SourceRecord[] }> {
    const inserted: SourceRecord[] = [];
    const deduped: SourceRecord[] = [];
    for (const item of input) {
      ensureWorkspace(item.orgId, item.workspaceId, this.store);
      if (item.projectId) ensureProject(item.orgId, item.projectId, this.store);
      const existing = this.store.sources.find((source) => source.orgId === item.orgId && source.workspaceId === item.workspaceId && source.contentHash === item.contentHash);
      if (existing) {
        deduped.push(cloneJson(existing));
        continue;
      }
      const record: SourceRecord = { id: createId('src'), ...cloneJson(item), createdAt: nowIso() };
      this.store.sources.push(record);
      inserted.push(cloneJson(record));
    }
    return { inserted, deduped };
  }

  async listSources(orgId: string, workspaceId: string): Promise<SourceRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.sources.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getSourcesByIds(orgId: string, ids: string[]): Promise<SourceRecord[]> {
    const wanted = new Set(ids);
    return cloneJson(this.store.sources.filter((item) => item.orgId === orgId && wanted.has(item.id)));
  }

  async insertArticleBrief(input: Omit<ArticleBriefRecord, 'id' | 'createdAt'>): Promise<ArticleBriefRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: ArticleBriefRecord = { id: createId('brief'), ...cloneJson(input), createdAt: nowIso() };
    this.store.briefs.push(record);
    return cloneJson(record);
  }

  async listArticleBriefs(orgId: string, workspaceId: string): Promise<ArticleBriefRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.briefs.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getArticleBrief(orgId: string, id: string): Promise<ArticleBriefRecord | null> {
    const item = this.store.briefs.find((row) => row.orgId === orgId && row.id === id);
    return item ? cloneJson(item) : null;
  }

  async insertArticle(input: Omit<ArticleRecord, 'id' | 'createdAt'>): Promise<ArticleRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: ArticleRecord = { id: createId('article'), ...cloneJson(input), createdAt: nowIso() };
    this.store.articles.push(record);
    return cloneJson(record);
  }

  async listArticles(orgId: string, workspaceId: string): Promise<ArticleRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.articles.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getArticle(orgId: string, id: string): Promise<ArticleRecord | null> {
    const item = this.store.articles.find((row) => row.orgId === orgId && row.id === id);
    return item ? cloneJson(item) : null;
  }

  async insertPublishRun(input: Omit<PublishRunRecord, 'id' | 'createdAt'>): Promise<PublishRunRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: PublishRunRecord = { id: createId('publish'), ...cloneJson(input), createdAt: nowIso() };
    this.store.publishRuns.push(record);
    return cloneJson(record);
  }

  async updatePublishRun(id: string, orgId: string, patch: Partial<Omit<PublishRunRecord, 'id' | 'orgId' | 'workspaceId' | 'projectId' | 'articleId' | 'platform' | 'payload' | 'createdAt'>>): Promise<PublishRunRecord> {
    const row = this.store.publishRuns.find((item) => item.orgId === orgId && item.id === id);
    if (!row) throw new AppError(404, 'publish_run_not_found', 'Publish run not found.');
    Object.assign(row, cloneJson(patch));
    return cloneJson(row);
  }

  async getPublishRun(orgId: string, id: string): Promise<PublishRunRecord | null> {
    const row = this.store.publishRuns.find((item) => item.orgId === orgId && item.id === id);
    return row ? cloneJson(row) : null;
  }

  async listPublishRuns(orgId: string, workspaceId: string): Promise<PublishRunRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.publishRuns.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async insertVisibilityRun(input: Omit<VisibilityRunRecord, 'id' | 'createdAt'>): Promise<VisibilityRunRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: VisibilityRunRecord = { id: createId('vis'), ...cloneJson(input), createdAt: nowIso() };
    this.store.visibilityRuns.push(record);
    return cloneJson(record);
  }

  async listVisibilityRuns(orgId: string, workspaceId: string): Promise<VisibilityRunRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.visibilityRuns.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async insertEvidenceExport(input: Omit<EvidenceExportRecord, 'id' | 'createdAt'>): Promise<EvidenceExportRecord> {
    ensureWorkspace(input.orgId, input.workspaceId, this.store);
    if (input.projectId) ensureProject(input.orgId, input.projectId, this.store);
    const record: EvidenceExportRecord = { id: createId('exp'), ...cloneJson(input), createdAt: nowIso() };
    this.store.evidenceExports.push(record);
    return cloneJson(record);
  }

  async listEvidenceExports(orgId: string, workspaceId: string): Promise<EvidenceExportRecord[]> {
    ensureWorkspace(orgId, workspaceId, this.store);
    return cloneJson(this.store.evidenceExports.filter((item) => item.orgId === orgId && item.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getWorkspaceHistory(orgId: string, workspaceId: string): Promise<WorkspaceHistory> {
    const workspace = ensureWorkspace(orgId, workspaceId, this.store);
    return {
      workspace: cloneJson(workspace),
      projects: await this.listProjects(orgId, workspaceId),
      jobs: await this.listJobs(orgId, workspaceId),
      auditRuns: await this.listAuditRuns(orgId, workspaceId),
      contentPlans: await this.listContentPlans(orgId, workspaceId),
      promptPacks: await this.listPromptPacks(orgId, workspaceId),
      sources: await this.listSources(orgId, workspaceId),
      briefs: await this.listArticleBriefs(orgId, workspaceId),
      articles: await this.listArticles(orgId, workspaceId),
      publishRuns: await this.listPublishRuns(orgId, workspaceId),
      visibilityRuns: await this.listVisibilityRuns(orgId, workspaceId),
      evidenceExports: await this.listEvidenceExports(orgId, workspaceId)
    };
  }
}

type NeonQueryResponse = { rows?: Array<Record<string, unknown>> };

function jsonString(value: unknown): string {
  return JSON.stringify(value ?? null);
}

class NeonHttpDb implements StorageAdapter {
  readonly kind = 'neon-http' as const;
  private readonly sqlUrl: string;
  private readonly authToken: string | null;

  constructor(sqlUrl: string, authToken: string | null) {
    this.sqlUrl = sqlUrl;
    this.authToken = authToken;
  }

  private async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const response = await fetch(this.sqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}) },
      body: JSON.stringify({ sql, params })
    });
    if (!response.ok) throw new AppError(500, 'neon_query_failed', `Neon SQL request failed with ${response.status}.`, { sql });
    const data = (await response.json()) as NeonQueryResponse;
    return (data.rows || []) as T[];
  }

  private parseJson(value: unknown, fallback: any) {
    return parseJsonString(typeof value === 'string' ? value : JSON.stringify(value ?? fallback), fallback);
  }

  private rowToWorkspace(row: Record<string, unknown>): WorkspaceRecord { return { id: String(row.id), orgId: String(row.org_id), name: String(row.name), brand: row.brand ? String(row.brand) : null, niche: row.niche ? String(row.niche) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
  private rowToProject(row: Record<string, unknown>): ProjectRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), name: String(row.name), primaryUrl: row.primary_url ? String(row.primary_url) : null, audience: row.audience ? String(row.audience) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
  private rowToJob(row: Record<string, unknown>): JobRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, type: String(row.type), status: String(row.status) as JobRecord['status'], summary: String(row.summary), metadata: this.parseJson(row.metadata_json, {}), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
  private rowToAudit(row: Record<string, unknown>): AuditRunRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, targetUrl: String(row.target_url), score: Number(row.score), result: this.parseJson(row.result_json, {}), createdAt: String(row.created_at) }; }
  private rowToContentPlan(row: Record<string, unknown>): ContentPlanRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, brand: String(row.brand), niche: String(row.niche), audience: String(row.audience), result: this.parseJson(row.result_json, {}), createdAt: String(row.created_at) }; }
  private rowToPromptPack(row: Record<string, unknown>): SavedPromptPackRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, brand: String(row.brand), niche: String(row.niche), market: row.market ? String(row.market) : null, result: this.parseJson(row.result_json, {}), createdAt: String(row.created_at) }; }
  private rowToSource(row: Record<string, unknown>): SourceRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, sourceUrl: row.source_url ? String(row.source_url) : null, canonicalUrl: row.canonical_url ? String(row.canonical_url) : null, siteName: row.site_name ? String(row.site_name) : null, title: String(row.title), snippet: String(row.snippet), contentText: String(row.content_text), contentHash: String(row.content_hash), retrievalOrigin: String(row.retrieval_origin), retrievedAt: String(row.retrieved_at), publishedAt: row.published_at ? String(row.published_at) : null, createdAt: String(row.created_at) }; }
  private rowToBrief(row: Record<string, unknown>): ArticleBriefRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, title: String(row.title), primaryKeyword: String(row.primary_keyword), brief: this.parseJson(row.brief_json, {}), sourceIds: this.parseJson(row.source_ids_json, []), createdAt: String(row.created_at) }; }
  private rowToArticle(row: Record<string, unknown>): ArticleRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, briefId: String(row.brief_id), title: String(row.title), slug: String(row.slug), bodyHtml: String(row.body_html), jsonLd: String(row.json_ld), citations: this.parseJson(row.citations_json, []), language: row.language ? String(row.language) : 'English', tone: row.tone ? String(row.tone) : 'operator', callToAction: row.call_to_action ? String(row.call_to_action) : '', infographicPrompt: row.infographic_prompt ? String(row.infographic_prompt) : '', claimMap: this.parseJson(row.claim_map_json, []), faqItems: this.parseJson(row.faq_items_json, []), createdAt: String(row.created_at) }; }
  private rowToPublish(row: Record<string, unknown>): PublishRunRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, articleId: row.article_id ? String(row.article_id) : null, platform: String(row.platform), payload: this.parseJson(row.payload_json, {}), endpoint: row.endpoint ? String(row.endpoint) : null, status: (row.status ? String(row.status) : 'prepared') as PublishRunRecord['status'], remoteId: row.remote_id ? String(row.remote_id) : null, attemptCount: row.attempt_count ? Number(row.attempt_count) : 0, responseStatus: row.response_status == null ? null : Number(row.response_status), responseExcerpt: row.response_excerpt ? String(row.response_excerpt) : null, lastError: row.last_error ? String(row.last_error) : null, scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null, lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null, executedAt: row.executed_at ? String(row.executed_at) : null, createdAt: String(row.created_at) }; }
  private rowToVisibility(row: Record<string, unknown>): VisibilityRunRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, promptPackId: String(row.prompt_pack_id), provider: String(row.provider), prompt: String(row.prompt), answerText: String(row.answer_text), result: this.parseJson(row.result_json, {}), createdAt: String(row.created_at) }; }
  private rowToEvidence(row: Record<string, unknown>): EvidenceExportRecord { return { id: String(row.id), orgId: String(row.org_id), workspaceId: String(row.workspace_id), projectId: row.project_id ? String(row.project_id) : null, exportType: String(row.export_type), subjectType: row.subject_type ? String(row.subject_type) : null, subjectId: row.subject_id ? String(row.subject_id) : null, payload: this.parseJson(row.payload_json, {}), createdAt: String(row.created_at) }; }

  async createWorkspace(orgId: string, input: { name: string; brand?: string | null; niche?: string | null }): Promise<WorkspaceRecord> { const id = createId('ws'); const rows = await this.query(`insert into workspaces (id, org_id, name, brand, niche) values ($1,$2,$3,$4,$5) returning *`, [id, orgId, input.name.trim(), input.brand?.trim() || null, input.niche?.trim() || null]); return this.rowToWorkspace(rows[0]); }
  async listWorkspaces(orgId: string): Promise<WorkspaceRecord[]> { return (await this.query(`select * from workspaces where org_id=$1 order by created_at desc`, [orgId])).map((row) => this.rowToWorkspace(row)); }
  async createProject(orgId: string, input: { workspaceId: string; name: string; primaryUrl?: string | null; audience?: string | null }): Promise<ProjectRecord> { const id = createId('prj'); const rows = await this.query(`insert into projects (id, org_id, workspace_id, name, primary_url, audience) values ($1,$2,$3,$4,$5,$6) returning *`, [id, orgId, input.workspaceId, input.name.trim(), input.primaryUrl?.trim() || null, input.audience?.trim() || null]); return this.rowToProject(rows[0]); }
  async listProjects(orgId: string, workspaceId: string): Promise<ProjectRecord[]> { return (await this.query(`select * from projects where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToProject(row)); }
  async createJob(input: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobRecord> { const id = createId('job'); const rows = await this.query(`insert into jobs (id, org_id, workspace_id, project_id, type, status, summary, metadata_json) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.type, input.status, input.summary, jsonString(input.metadata)]); return this.rowToJob(rows[0]); }
  async updateJob(id: string, orgId: string, patch: Partial<Pick<JobRecord, 'status' | 'summary' | 'metadata'>>): Promise<JobRecord> { const rows = await this.query(`update jobs set status=coalesce($3,status), summary=coalesce($4,summary), metadata_json=coalesce($5,metadata_json), updated_at=now() where id=$1 and org_id=$2 returning *`, [id, orgId, patch.status ?? null, patch.summary ?? null, patch.metadata ? jsonString(patch.metadata) : null]); if (!rows[0]) throw new AppError(404, 'job_not_found', 'Job not found.'); return this.rowToJob(rows[0]); }
  async listJobs(orgId: string, workspaceId: string): Promise<JobRecord[]> { return (await this.query(`select * from jobs where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToJob(row)); }
  async insertAuditRun(input: Omit<AuditRunRecord, 'id' | 'createdAt'>): Promise<AuditRunRecord> { const id = createId('audit'); const rows = await this.query(`insert into audit_runs (id, org_id, workspace_id, project_id, target_url, score, result_json) values ($1,$2,$3,$4,$5,$6,$7) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.targetUrl, input.score, jsonString(input.result)]); return this.rowToAudit(rows[0]); }
  async listAuditRuns(orgId: string, workspaceId: string): Promise<AuditRunRecord[]> { return (await this.query(`select * from audit_runs where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToAudit(row)); }
  async insertContentPlan(input: Omit<ContentPlanRecord, 'id' | 'createdAt'>): Promise<ContentPlanRecord> { const id = createId('plan'); const rows = await this.query(`insert into content_plans (id, org_id, workspace_id, project_id, brand, niche, audience, result_json) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.brand, input.niche, input.audience, jsonString(input.result)]); return this.rowToContentPlan(rows[0]); }
  async listContentPlans(orgId: string, workspaceId: string): Promise<ContentPlanRecord[]> { return (await this.query(`select * from content_plans where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToContentPlan(row)); }
  async insertPromptPack(input: Omit<SavedPromptPackRecord, 'id' | 'createdAt'>): Promise<SavedPromptPackRecord> { const id = createId('prompt'); const rows = await this.query(`insert into saved_prompt_sets (id, org_id, workspace_id, project_id, brand, niche, market, result_json) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.brand, input.niche, input.market, jsonString(input.result)]); return this.rowToPromptPack(rows[0]); }
  async listPromptPacks(orgId: string, workspaceId: string): Promise<SavedPromptPackRecord[]> { return (await this.query(`select * from saved_prompt_sets where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToPromptPack(row)); }
  async getPromptPack(orgId: string, id: string): Promise<SavedPromptPackRecord | null> { const rows = await this.query(`select * from saved_prompt_sets where org_id=$1 and id=$2 limit 1`, [orgId, id]); return rows[0] ? this.rowToPromptPack(rows[0]) : null; }
  async upsertSources(input: Array<Omit<SourceRecord, 'id' | 'createdAt'>>): Promise<{ inserted: SourceRecord[]; deduped: SourceRecord[] }> {
    const inserted: SourceRecord[] = [];
    const deduped: SourceRecord[] = [];
    for (const item of input) {
      const existing = await this.query(`select * from sources where org_id=$1 and workspace_id=$2 and content_hash=$3 limit 1`, [item.orgId, item.workspaceId, item.contentHash]);
      if (existing[0]) { deduped.push(this.rowToSource(existing[0])); continue; }
      const id = createId('src');
      const rows = await this.query(`insert into sources (id, org_id, workspace_id, project_id, source_url, canonical_url, site_name, title, snippet, content_text, content_hash, retrieval_origin, retrieved_at, published_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`, [id, item.orgId, item.workspaceId, item.projectId, item.sourceUrl, item.canonicalUrl, item.siteName, item.title, item.snippet, item.contentText, item.contentHash, item.retrievalOrigin, item.retrievedAt, item.publishedAt]);
      inserted.push(this.rowToSource(rows[0]));
    }
    return { inserted, deduped };
  }
  async listSources(orgId: string, workspaceId: string): Promise<SourceRecord[]> { return (await this.query(`select * from sources where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToSource(row)); }
  async getSourcesByIds(orgId: string, ids: string[]): Promise<SourceRecord[]> { if (ids.length === 0) return []; return (await this.query(`select * from sources where org_id=$1 and id = any($2::text[])`, [orgId, ids])).map((row) => this.rowToSource(row)); }
  async insertArticleBrief(input: Omit<ArticleBriefRecord, 'id' | 'createdAt'>): Promise<ArticleBriefRecord> { const id = createId('brief'); const rows = await this.query(`insert into article_briefs (id, org_id, workspace_id, project_id, title, primary_keyword, brief_json, source_ids_json) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.title, input.primaryKeyword, jsonString(input.brief), jsonString(input.sourceIds)]); return this.rowToBrief(rows[0]); }
  async listArticleBriefs(orgId: string, workspaceId: string): Promise<ArticleBriefRecord[]> { return (await this.query(`select * from article_briefs where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToBrief(row)); }
  async getArticleBrief(orgId: string, id: string): Promise<ArticleBriefRecord | null> { const rows = await this.query(`select * from article_briefs where org_id=$1 and id=$2 limit 1`, [orgId, id]); return rows[0] ? this.rowToBrief(rows[0]) : null; }
  async insertArticle(input: Omit<ArticleRecord, 'id' | 'createdAt'>): Promise<ArticleRecord> { const id = createId('article'); const rows = await this.query(`insert into articles (id, org_id, workspace_id, project_id, brief_id, title, slug, body_html, json_ld, citations_json, language, tone, call_to_action, infographic_prompt, claim_map_json, faq_items_json) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.briefId, input.title, input.slug, input.bodyHtml, input.jsonLd, jsonString(input.citations), input.language, input.tone, input.callToAction, input.infographicPrompt, jsonString(input.claimMap), jsonString(input.faqItems)]); return this.rowToArticle(rows[0]); }
  async listArticles(orgId: string, workspaceId: string): Promise<ArticleRecord[]> { return (await this.query(`select * from articles where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToArticle(row)); }
  async getArticle(orgId: string, id: string): Promise<ArticleRecord | null> { const rows = await this.query(`select * from articles where org_id=$1 and id=$2 limit 1`, [orgId, id]); return rows[0] ? this.rowToArticle(rows[0]) : null; }
  async insertPublishRun(input: Omit<PublishRunRecord, 'id' | 'createdAt'>): Promise<PublishRunRecord> { const id = createId('publish'); const rows = await this.query(`insert into publish_runs (id, org_id, workspace_id, project_id, article_id, platform, payload_json, endpoint, status, remote_id, attempt_count, response_status, response_excerpt, last_error, scheduled_for, last_attempt_at, executed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.articleId, input.platform, jsonString(input.payload), input.endpoint, input.status, input.remoteId, input.attemptCount, input.responseStatus, input.responseExcerpt, input.lastError, input.scheduledFor, input.lastAttemptAt, input.executedAt]); return this.rowToPublish(rows[0]); }
  async updatePublishRun(id: string, orgId: string, patch: Partial<Omit<PublishRunRecord, 'id' | 'orgId' | 'workspaceId' | 'projectId' | 'articleId' | 'platform' | 'payload' | 'createdAt'>>): Promise<PublishRunRecord> { const rows = await this.query(`update publish_runs set endpoint=coalesce($3,endpoint), status=coalesce($4,status), remote_id=coalesce($5,remote_id), attempt_count=coalesce($6,attempt_count), response_status=coalesce($7,response_status), response_excerpt=coalesce($8,response_excerpt), last_error=coalesce($9,last_error), scheduled_for=coalesce($10,scheduled_for), last_attempt_at=coalesce($11,last_attempt_at), executed_at=coalesce($12,executed_at) where id=$1 and org_id=$2 returning *`, [id, orgId, patch.endpoint ?? null, patch.status ?? null, patch.remoteId ?? null, patch.attemptCount ?? null, patch.responseStatus ?? null, patch.responseExcerpt ?? null, patch.lastError ?? null, patch.scheduledFor ?? null, patch.lastAttemptAt ?? null, patch.executedAt ?? null]); if (!rows[0]) throw new AppError(404, 'publish_run_not_found', 'Publish run not found.'); return this.rowToPublish(rows[0]); }
  async getPublishRun(orgId: string, id: string): Promise<PublishRunRecord | null> { const rows = await this.query(`select * from publish_runs where org_id=$1 and id=$2 limit 1`, [orgId, id]); return rows[0] ? this.rowToPublish(rows[0]) : null; }
  async listPublishRuns(orgId: string, workspaceId: string): Promise<PublishRunRecord[]> { return (await this.query(`select * from publish_runs where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToPublish(row)); }
  async insertVisibilityRun(input: Omit<VisibilityRunRecord, 'id' | 'createdAt'>): Promise<VisibilityRunRecord> { const id = createId('vis'); const rows = await this.query(`insert into visibility_runs (id, org_id, workspace_id, project_id, prompt_pack_id, provider, prompt, answer_text, result_json) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.promptPackId, input.provider, input.prompt, input.answerText, jsonString(input.result)]); return this.rowToVisibility(rows[0]); }
  async listVisibilityRuns(orgId: string, workspaceId: string): Promise<VisibilityRunRecord[]> { return (await this.query(`select * from visibility_runs where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToVisibility(row)); }
  async insertEvidenceExport(input: Omit<EvidenceExportRecord, 'id' | 'createdAt'>): Promise<EvidenceExportRecord> { const id = createId('exp'); const rows = await this.query(`insert into evidence_exports (id, org_id, workspace_id, project_id, export_type, subject_type, subject_id, payload_json) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [id, input.orgId, input.workspaceId, input.projectId, input.exportType, input.subjectType, input.subjectId, jsonString(input.payload)]); return this.rowToEvidence(rows[0]); }
  async listEvidenceExports(orgId: string, workspaceId: string): Promise<EvidenceExportRecord[]> { return (await this.query(`select * from evidence_exports where org_id=$1 and workspace_id=$2 order by created_at desc`, [orgId, workspaceId])).map((row) => this.rowToEvidence(row)); }
  async getWorkspaceHistory(orgId: string, workspaceId: string): Promise<WorkspaceHistory> {
    const rows = await this.query(`select * from workspaces where org_id=$1 and id=$2 limit 1`, [orgId, workspaceId]);
    if (!rows[0]) throw new AppError(404, 'workspace_not_found', 'Workspace not found.');
    return { workspace: this.rowToWorkspace(rows[0]), projects: await this.listProjects(orgId, workspaceId), jobs: await this.listJobs(orgId, workspaceId), auditRuns: await this.listAuditRuns(orgId, workspaceId), contentPlans: await this.listContentPlans(orgId, workspaceId), promptPacks: await this.listPromptPacks(orgId, workspaceId), sources: await this.listSources(orgId, workspaceId), briefs: await this.listArticleBriefs(orgId, workspaceId), articles: await this.listArticles(orgId, workspaceId), publishRuns: await this.listPublishRuns(orgId, workspaceId), visibilityRuns: await this.listVisibilityRuns(orgId, workspaceId), evidenceExports: await this.listEvidenceExports(orgId, workspaceId) };
  }
}

let memorySingleton: StorageAdapter | null = null;

export function getDb(env: ResolvedEnv): StorageAdapter {
  if (env.dbMode === 'neon-http') return new NeonHttpDb(env.neonSqlUrl!, env.neonSqlAuthToken);
  if (!memorySingleton) memorySingleton = new MemoryDb();
  return memorySingleton;
}


export function resetMemoryDbForTests(): void {
  memorySingleton = null;
  const key = '__SKYE_GEO_MEMORY_STORE__';
  const globalStore = globalThis as typeof globalThis & { [key: string]: MemoryStore | undefined };
  globalStore[key] = createEmptyStore();
}
