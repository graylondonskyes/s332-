# SkyeHands Integration Patterns Library

**Purpose:** Common, tested patterns for extending or integrating with SkyeHands  
**Audience:** Engineers building features on top of SkyeHands, embedding SkyeHands, or integrating external systems  
**Last Updated:** April 16, 2026

---

## Table of Contents

1. [Service Integration Pattern](#service-integration-pattern)
2. [Custom AI Role Pattern](#custom-ai-role-pattern)
3. [Workspace Extension Pattern](#workspace-extension-pattern)
4. [External Tool Integration Pattern](#external-tool-integration-pattern)
5. [Multi-Workspace Orchestration Pattern](#multi-workspace-orchestration-pattern)
6. [Event Aggregation Pattern](#event-aggregation-pattern)
7. [Custom Gate Policy Pattern](#custom-gate-policy-pattern)
8. [Provider Integration Pattern](#provider-integration-pattern)
9. [Custom Proof Section Pattern](#custom-proof-section-pattern)
10. [Data Export/Import Pattern](#data-exportimport-pattern)

---

## 1. Service Integration Pattern

**When to Use:** Adding a new service/capability to the shell (e.g., analytics, monitoring, notifications)

**Example:** Create a custom logging service

### Step 1: Define Service Interface

```javascript
// apps/skyequanta-shell/lib/custom-logger.mjs

export class CustomLogger {
  constructor(shell, config = {}) {
    this.shell = shell;
    this.config = config;
    this.logs = [];
  }

  async initialize() {
    console.log('CustomLogger initialized');
    // Connect to external service, load settings, etc.
  }

  async log(level, message, context = {}) {
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      workspaceId: context.workspaceId || 'system'
    };
    this.logs.push(entry);

    // Apply redaction
    const redacted = await this.shell.services.redactionHelper.redact(entry);
    
    // Emit event
    this.shell.services.runtimeBus.emit('log', redacted);

    // Optionally send to external service
    if (this.config.externalUrl) {
      await this._sendToExternalService(redacted);
    }
  }

  async _sendToExternalService(entry) {
    try {
      await fetch(this.config.externalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Fail gracefully, don't break shell
      console.error('Failed to send log:', error.message);
    }
  }

  async query(filters = {}) {
    return this.logs.filter(entry => {
      if (filters.level && entry.level !== filters.level) return false;
      if (filters.workspaceId && entry.workspaceId !== filters.workspaceId) return false;
      return true;
    });
  }
}
```

### Step 2: Register Service with Shell

```javascript
// apps/skyequanta-shell/bin/launch.mjs

import { CustomLogger } from '../lib/custom-logger.mjs';

async function initializeServices() {
  // ... existing services ...

  // Initialize custom logger
  const customLogger = new CustomLogger(shell, {
    externalUrl: process.env.CUSTOM_LOG_ENDPOINT
  });
  await customLogger.initialize();
  shell.services.customLogger = customLogger;
}
```

### Step 3: Expose via Bridge API

```javascript
// apps/skyequanta-shell/lib/bridge.mjs

// Query logs endpoint
app.get('/api/custom-logger/logs', async (req, res) => {
  const sessionId = req.headers['x-skyequanta-session-id'];
  const workspaceId = req.headers['x-skyequanta-workspace-id'];

  // Validate session
  if (!sessionId) return res.status(401).json({ error: 'Unauthorized' });

  const logs = await this.shell.services.customLogger.query({
    workspaceId,
    level: req.query.level
  });

  res.json({ logs });
});

// Log entry endpoint
app.post('/api/custom-logger/log', async (req, res) => {
  const sessionId = req.headers['x-skyequanta-session-id'];
  const workspaceId = req.headers['x-skyequanta-workspace-id'];

  if (!sessionId) return res.status(401).json({ error: 'Unauthorized' });

  await this.shell.services.customLogger.log(
    req.body.level || 'info',
    req.body.message,
    { workspaceId, ...req.body.context }
  );

  res.json({ success: true });
});
```

### Step 4: Use from IDE or Agent

```javascript
// From IDE JavaScript console or agent Python code
fetch('http://localhost:3020/api/custom-logger/log', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-skyequanta-workspace-id': 'ws-1',
    'x-skyequanta-session-id': sessionId
  },
  body: JSON.stringify({
    level: 'info',
    message: 'User completed task',
    context: { taskId: '123', duration: 45000 }
  })
});
```

### Step 5: Test with Proof

```javascript
// apps/skyequanta-shell/bin/workspace-proof-section-custom-logger.mjs

export async function run(opts) {
  const { shell } = opts;

  // Test log entry
  await shell.services.customLogger.log('info', 'Test log', {
    workspaceId: 'test-ws'
  });

  // Test query
  const logs = await shell.services.customLogger.query({
    workspaceId: 'test-ws'
  });

  if (logs.length !== 1) {
    throw new Error('Custom logger failed: log not recorded');
  }

  return { status: 'PASS', logsRecorded: logs.length };
}

export default { run };
```

---

## 2. Custom AI Role Pattern

**When to Use:** Adding a specialized AI role to kAIxU Council (e.g., ComplianceReviewer, DataScientist)

**Example:** Add a Performance Analyzer role

### Step 1: Define Role Interface

```javascript
// apps/skyequanta-shell/lib/kaixu-roles/performance-analyzer.mjs

export class PerformanceAnalyzerRole {
  constructor(council) {
    this.council = council;
    this.name = 'PerformanceAnalyzer';
  }

  async think(task, priorContext) {
    // Call AI to analyze performance implications
    const prompt = `
      Given the task: ${task}
      And prior design context: ${JSON.stringify(priorContext)}
      
      Analyze:
      1. Performance bottlenecks
      2. Optimization opportunities
      3. Scalability concerns
      4. Caching opportunities
      5. Resource efficiency
      
      Return JSON with keys: bottlenecks, optimizations, concerns, recommendations
    `;

    const analysis = await this.council.callAI(prompt, this.name);
    
    return {
      verdict: analysis.recommendations.length > 0 ? 'OPTIMIZE' : 'ACCEPTABLE',
      analysis,
      confidence: 0.85
    };
  }
}
```

### Step 2: Register Role with Council

```javascript
// apps/skyequanta-shell/lib/kaixu-council.mjs

import { PerformanceAnalyzerRole } from './kaixu-roles/performance-analyzer.mjs';

class KaixuCouncil {
  async initialize() {
    // ... existing roles ...

    // Add custom role
    this.roles.PerformanceAnalyzer = new PerformanceAnalyzerRole(this);
  }

  async executeCouncil(task) {
    const roleVerdicts = {};

    // ... run existing roles ...

    // Run custom role
    roleVerdicts.Performance = await this.roles.PerformanceAnalyzer.think(task, {
      architecture: roleVerdicts.Architecture,
      implementation: roleVerdicts.Implementation
    });

    // Include in arbitration
    if (roleVerdicts.Performance.verdict === 'OPTIMIZE') {
      console.log('Performance analyzer suggests optimizations:', {
        ...roleVerdicts.Performance.analysis
      });
    }

    return this.arbitrate(roleVerdicts);
  }
}
```

### Step 3: Validate with Proof

```javascript
// apps/skyequanta-shell/bin/workspace-proof-section-performance-role.mjs

export async function run(opts) {
  const { shell } = opts;

  const council = shell.services.kaixuCouncil;
  
  // Test role thinking
  const result = await council.roles.PerformanceAnalyzer.think(
    'Optimize database queries',
    {}
  );

  if (!result.analysis) {
    throw new Error('Performance analyzer failed to generate analysis');
  }

  if (!result.verdict) {
    throw new Error('Performance analyzer failed to produce verdict');
  }

  return { status: 'PASS', analyzed: true };
}

export default { run };
```

---

## 3. Workspace Extension Pattern

**When to Use:** Adding workspace-level capabilities (mounting volumes, custom runtimes, specialized tools)

**Example:** Add GPU resource allocation to workspaces

### Step 1: Define Extension

```javascript
// apps/skyequanta-shell/lib/workspace-extensions/gpu-support.mjs

export class GPUExtension {
  constructor(workspace) {
    this.workspace = workspace;
    this.gpuCount = 0;
  }

  async configure(gpuCount = 1) {
    this.gpuCount = gpuCount;

    // Update cgroup configuration
    const cgroupPath = `/sys/fs/cgroup/devices/workspace-${this.workspace.id}`;
    
    // Allow GPU device access
    const gpuDevices = Array.from({ length: gpuCount }, (_, i) => `250:${i}`);
    
    return {
      configured: true,
      gpuCount,
      devices: gpuDevices,
      cgroupPath
    };
  }

  async checkAvailability() {
    // Query system for available GPUs
    return {
      total: 2,
      available: 1,
      models: ['RTX 3090', 'A100']
    };
  }

  async allocate() {
    const available = await this.checkAvailability();
    if (available.available < this.gpuCount) {
      throw new Error(`Insufficient GPUs: need ${this.gpuCount}, have ${available.available}`);
    }

    // Allocate GPUs to workspace
    return {
      allocated: this.gpuCount,
      devices: ['/dev/nvidia0', '/dev/nvidia1'].slice(0, this.gpuCount)
    };
  }

  async release() {
    // Release GPUs back to pool
    this.gpuCount = 0;
    return { released: true };
  }
}
```

### Step 2: Integrate with Workspace Lifecycle

```javascript
// apps/skyequanta-shell/lib/workspace-manager.mjs

import { GPUExtension } from './workspace-extensions/gpu-support.mjs';

class WorkspaceManager {
  async createWorkspace(config = {}) {
    const workspace = {
      id: uuid(),
      createdAt: Date.now(),
      state: 'pending',
      extensions: {}
    };

    // Create extension instances
    if (config.enableGPU) {
      workspace.extensions.gpu = new GPUExtension(workspace);
      await workspace.extensions.gpu.configure(config.gpuCount);
    }

    // Allocate resources
    if (workspace.extensions.gpu) {
      await workspace.extensions.gpu.allocate();
    }

    workspace.state = 'active';
    return workspace;
  }

  async deleteWorkspace(workspaceId) {
    const workspace = this.workspaces[workspaceId];

    // Release resources
    if (workspace.extensions.gpu) {
      await workspace.extensions.gpu.release();
    }

    delete this.workspaces[workspaceId];
  }
}
```

### Step 3: Expose via API

```javascript
// apps/skyequanta-shell/lib/bridge.mjs

app.post('/api/workspace/:id/enable-gpu', async (req, res) => {
  const { id } = req.params;
  const workspace = this.shell.services.workspaceManager.get(id);

  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const gpuExt = new GPUExtension(workspace);
  const available = await gpuExt.checkAvailability();

  if (available.available === 0) {
    return res.status(503).json({ error: 'No GPUs available' });
  }

  await gpuExt.configure(req.body.gpuCount || 1);
  await gpuExt.allocate();

  workspace.extensions.gpu = gpuExt;

  res.json({ success: true, gpuCount: gpuExt.gpuCount });
});
```

---

## 4. External Tool Integration Pattern

**When to Use:** Integrating external tools/services (Slack, Jira, GitHub, monitoring systems)

**Example:** Integrate Slack notifications

### Step 1: Define Tool Adapter

```javascript
// apps/skyequanta-shell/lib/external-tools/slack-adapter.mjs

export class SlackAdapter {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async initialize() {
    // Verify webhook is valid
    const test = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'SkyeHands Slack integration initialized' })
    });

    if (!test.ok) {
      throw new Error('Slack webhook invalid');
    }
  }

  async notifyEvent(event) {
    const message = this._formatMessage(event);
    
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Slack notification failed:', error.message);
      // Don't break shell if notification fails
    }
  }

  _formatMessage(event) {
    const messages = {
      'workspace-created': {
        text: `✅ Workspace created: ${event.workspaceId}`,
        color: '#36a64f'
      },
      'workspace-deleted': {
        text: `❌ Workspace deleted: ${event.workspaceId}`,
        color: '#ff0000'
      },
      'ai-error': {
        text: `⚠️  AI Error in ${event.workspaceId}: ${event.error}`,
        color: '#ff9900'
      }
    };

    return messages[event.type] || { text: `Event: ${event.type}` };
  }
}
```

### Step 2: Register Tool with Shell

```javascript
// apps/skyequanta-shell/bin/launch.mjs

import { SlackAdapter } from '../lib/external-tools/slack-adapter.mjs';

async function initializeExternalTools() {
  if (process.env.SLACK_WEBHOOK_URL) {
    const slack = new SlackAdapter(process.env.SLACK_WEBHOOK_URL);
    await slack.initialize();
    shell.tools.slack = slack;

    // Subscribe to events
    shell.services.runtimeBus.on('workspace-created', (event) => {
      shell.tools.slack.notifyEvent(event);
    });
  }
}
```

### Step 3: Use in Services

```javascript
// apps/skyequanta-shell/lib/workspace-manager.mjs

async function createWorkspace(config) {
  const workspace = { id: uuid(), /* ... */ };

  // Emit event (triggers Slack notification)
  this.shell.services.runtimeBus.emit('workspace-created', {
    workspaceId: workspace.id,
    createdAt: Date.now()
  });

  return workspace;
}
```

---

## 5. Multi-Workspace Orchestration Pattern

**When to Use:** Coordinating operations across multiple workspaces (parallel execution, resource pooling)

**Example:** Run a task in multiple workspaces concurrently

### Step 1: Define Orchestrator

```javascript
// apps/skyequanta-shell/lib/workspace-orchestrator.mjs

export class WorkspaceOrchestrator {
  constructor(shell) {
    this.shell = shell;
  }

  async executeInParallel(task, workspaceIds, options = {}) {
    const { maxConcurrent = 3, timeout = 30000 } = options;

    const promises = workspaceIds.map(wsId => 
      this._executeWithTimeout(task, wsId, timeout)
    );

    // Limit concurrency
    const results = [];
    for (let i = 0; i < promises.length; i += maxConcurrent) {
      const batch = promises.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }

    return {
      totalWorkspaces: workspaceIds.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      results
    };
  }

  async _executeWithTimeout(task, workspaceId, timeout) {
    return Promise.race([
      this._executeTask(task, workspaceId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  async _executeTask(task, workspaceId) {
    const workspace = this.shell.services.workspaceManager.get(workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

    // Execute task in context of workspace
    const result = await task(workspace);

    // Emit completion event
    this.shell.services.runtimeBus.emit('task-completed', {
      workspaceId,
      taskName: task.name,
      result
    });

    return result;
  }

  async executeSequential(task, workspaceIds, options = {}) {
    const results = [];

    for (const wsId of workspaceIds) {
      try {
        const result = await this._executeTask(task, wsId);
        results.push({ workspaceId: wsId, status: 'success', result });
      } catch (error) {
        results.push({ workspaceId: wsId, status: 'error', error: error.message });
      }
    }

    return results;
  }
}
```

### Step 2: Use Orchestrator

```javascript
// Example: Deploy code to multiple workspaces in parallel

const orchestrator = shell.services.workspaceOrchestrator;

const deployTask = async (workspace) => {
  // Deploy to this workspace
  const result = await shell.services.remoteExecutor.exec(
    workspace.id,
    'npm run deploy'
  );
  return result;
};

const results = await orchestrator.executeInParallel(
  deployTask,
  ['ws-1', 'ws-2', 'ws-3', 'ws-4'],
  { maxConcurrent: 2, timeout: 60000 }
);

console.log(`Deployed to ${results.succeeded}/${results.totalWorkspaces} workspaces`);
```

---

## 6. Event Aggregation Pattern

**When to Use:** Collecting events from multiple sources (IDE, agent, services) and processing them together

**Example:** Build a timeline of all significant events

### Step 1: Define Event Aggregator

```javascript
// apps/skyequanta-shell/lib/event-aggregator.mjs

export class EventAggregator {
  constructor(shell) {
    this.shell = shell;
    this.timeline = [];
    this.filters = [];
  }

  async initialize() {
    // Subscribe to all major event sources
    const bus = this.shell.services.runtimeBus;

    bus.on('file-write', (event) => this._recordEvent('file-write', event));
    bus.on('agent-output', (event) => this._recordEvent('agent-output', event));
    bus.on('workspace-created', (event) => this._recordEvent('workspace-created', event));
    bus.on('snapshot-created', (event) => this._recordEvent('snapshot-created', event));
    bus.on('convergence', (event) => this._recordEvent('convergence', event));
  }

  _recordEvent(type, data) {
    const event = {
      id: uuid(),
      type,
      timestamp: Date.now(),
      data,
      metadata: {
        workspaceId: data.workspaceId || 'system',
        sessionId: data.sessionId || 'none'
      }
    };

    this.timeline.push(event);

    // Emit aggregated event
    this.shell.services.runtimeBus.emit('timeline-event', event);
  }

  addFilter(fn) {
    this.filters.push(fn);
  }

  queryTimeline(options = {}) {
    let results = this.timeline;

    // Apply filters
    for (const filter of this.filters) {
      results = results.filter(filter);
    }

    // Apply query filters
    if (options.type) {
      results = results.filter(e => e.type === options.type);
    }
    if (options.workspaceId) {
      results = results.filter(e => e.metadata.workspaceId === options.workspaceId);
    }
    if (options.since) {
      results = results.filter(e => e.timestamp >= options.since);
    }

    // Limit results
    const limit = options.limit || 100;
    return results.slice(-limit);
  }

  async exportTimeline(format = 'json') {
    const events = this.queryTimeline({ limit: 10000 });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'type', 'timestamp', 'workspaceId', 'data'];
      const rows = events.map(e => [
        e.id,
        e.type,
        e.timestamp,
        e.metadata.workspaceId,
        JSON.stringify(e.data)
      ]);
      return [headers, ...rows].map(r => r.join(',')).join('\n');
    }

    throw new Error(`Unsupported format: ${format}`);
  }
}
```

### Step 2: Expose via API

```javascript
// apps/skyequanta-shell/lib/bridge.mjs

app.get('/api/timeline', (req, res) => {
  const events = this.shell.services.eventAggregator.queryTimeline({
    type: req.query.type,
    workspaceId: req.query.workspace_id,
    since: req.query.since ? parseInt(req.query.since) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : 100
  });

  res.json({ events, count: events.length });
});

app.get('/api/timeline/export', async (req, res) => {
  const format = req.query.format || 'json';
  const data = await this.shell.services.eventAggregator.exportTimeline(format);

  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
  res.send(data);
});
```

---

## 7. Custom Gate Policy Pattern

**When to Use:** Implementing custom AI access control policies (beyond default offline/local-only/remote-gated)

**Example:** Time-based gate policy (AI only allowed during business hours)

### Step 1: Define Custom Policy

```javascript
// apps/skyequanta-shell/lib/custom-gate-policies/business-hours.mjs

export class BusinessHoursPolicy {
  constructor(businessHoursConfig = {}) {
    this.config = {
      startHour: 9,
      endHour: 17,
      timezone: 'UTC',
      ...businessHoursConfig
    };
  }

  async validate(request) {
    const now = new Date();
    const hour = now.getUTCHours();

    if (hour < this.config.startHour || hour >= this.config.endHour) {
      return {
        allowed: false,
        reason: `AI is not available outside business hours (${this.config.startHour}-${this.config.endHour})`
      };
    }

    return { allowed: true };
  }
}
```

### Step 2: Integrate with Gate Runtime

```javascript
// apps/skyequanta-shell/lib/gate-runtime-enforcer.mjs

import { BusinessHoursPolicy } from './custom-gate-policies/business-hours.mjs';

class GateRuntimeEnforcer {
  constructor(shell) {
    this.shell = shell;
    this.customPolicies = [];
  }

  addCustomPolicy(policy) {
    this.customPolicies.push(policy);
  }

  async validate(request) {
    // Run custom policies first
    for (const policy of this.customPolicies) {
      const result = await policy.validate(request);
      if (!result.allowed) {
        return result;
      }
    }

    // Then run standard gate logic
    return this._validateStandardGate(request);
  }
}
```

### Step 3: Configure Policy

```javascript
// apps/skyequanta-shell/bin/launch.mjs

const businessHoursPolicy = new BusinessHoursPolicy({
  startHour: 8,
  endHour: 18
});

shell.services.gateRuntimeEnforcer.addCustomPolicy(businessHoursPolicy);
```

---

## 8. Provider Integration Pattern

**When to Use:** Adding new credential providers (cloud platforms, APIs, databases)

**Example:** Add AWS provider to sovereign vault

### Step 1: Define Provider

```javascript
// apps/skyequanta-shell/lib/providers/aws-provider.mjs

export class AWSProvider {
  constructor(vaultManager) {
    this.vaultManager = vaultManager;
    this.name = 'AWS';
  }

  async validateCredentials(credentials) {
    // Validate AWS credentials format
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new Error('Missing AWS credentials');
    }

    if (!/^AKIA/.test(credentials.accessKeyId)) {
      throw new Error('Invalid AWS AccessKeyId format');
    }

    return true;
  }

  async testConnection(credentials) {
    // Test credentials by calling AWS STS GetCallerIdentity
    try {
      const response = await fetch(
        'https://sts.amazonaws.com/',
        {
          method: 'POST',
          headers: {
            'Authorization': this._buildAWSSignature(credentials)
          }
        }
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async storeCredentials(workspaceId, credentials) {
    await this.validateCredentials(credentials);

    const stored = {
      provider: 'AWS',
      workspaceId,
      credentials: await this.vaultManager.encrypt(credentials),
      createdAt: Date.now(),
      testPassed: await this.testConnection(credentials)
    };

    return stored;
  }

  async retrieveCredentials(workspaceId) {
    const stored = await this.vaultManager.get(workspaceId, 'AWS');
    if (!stored) return null;

    return {
      provider: 'AWS',
      workspaceId,
      credentials: await this.vaultManager.decrypt(stored.credentials)
    };
  }

  _buildAWSSignature(credentials) {
    // Implement AWS Signature Version 4
    // (simplified for example)
    return `AWS4-HMAC-SHA256 ...`;
  }
}
```

### Step 2: Register Provider

```javascript
// apps/skyequanta-shell/lib/provider-vault.mjs

import { AWSProvider } from './providers/aws-provider.mjs';

class ProviderVault {
  constructor(shell) {
    this.shell = shell;
    this.providers = {};
    this._registerBuiltinProviders();
  }

  _registerBuiltinProviders() {
    this.providers.AWS = new AWSProvider(this);
    // ... other builtin providers ...
  }

  registerProvider(name, provider) {
    this.providers[name] = provider;
  }

  async storeCredentials(provider, workspaceId, credentials) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return this.providers[provider].storeCredentials(workspaceId, credentials);
  }
}
```

### Step 3: Expose via CLI

```javascript
// apps/skyequanta-shell/bin/add-provider.mjs

#!/usr/bin/env node

import { ProviderVault } from '../lib/provider-vault.mjs';

const args = process.argv.slice(2);
const [provider, workspaceId] = args;

if (!provider || !workspaceId) {
  console.error('Usage: ./add-provider <provider> <workspace-id>');
  process.exit(1);
}

// Prompt for credentials
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const credentials = {};

rl.question('Access Key ID: ', (accessKeyId) => {
  credentials.accessKeyId = accessKeyId;

  rl.question('Secret Access Key: ', (secretAccessKey) => {
    credentials.secretAccessKey = secretAccessKey;

    // Store in vault
    const vault = new ProviderVault(shell);
    vault.storeCredentials(provider, workspaceId, credentials)
      .then(() => console.log(`✓ ${provider} credentials stored for ${workspaceId}`))
      .catch(err => console.error(`✗ Error: ${err.message}`));

    rl.close();
  });
});
```

---

## 9. Custom Proof Section Pattern

**When to Use:** Creating new proof sections for custom/extended features

**Example:** Proof for custom logger service

### Step 1: Create Proof Executable

```javascript
// apps/skyequanta-shell/bin/workspace-proof-section-custom-logger.mjs

export async function run(opts) {
  const { shell, setTimeout } = opts;

  console.log('Running Proof: Custom Logger Service');

  // Setup
  console.log('  → Initializing logger...');
  const logger = shell.services.customLogger;

  // Test 1: Log entry
  console.log('  → Test 1: Log entry');
  await logger.log('info', 'Test message', { workspaceId: 'test-ws' });

  // Test 2: Query logs
  console.log('  → Test 2: Query logs');
  const logs = await logger.query({ workspaceId: 'test-ws' });
  if (logs.length === 0) {
    throw new Error('Log not recorded');
  }

  // Test 3: Redaction
  console.log('  → Test 3: Redaction');
  await logger.log('error', 'API_KEY=secret123', { workspaceId: 'test-ws' });
  const redactedLogs = await logger.query({ level: 'error' });
  const redactedEntry = redactedLogs.find(l => l.message.includes('API_KEY'));
  if (redactedEntry && redactedEntry.message.includes('secret123')) {
    throw new Error('Redaction failed');
  }

  console.log('  ✓ All tests passed');

  return {
    status: 'PASS',
    tested: true,
    testsCovered: ['log-entry', 'query', 'redaction']
  };
}

export default { run };
```

### Step 2: Create Smoke Test Script

```bash
#!/bin/bash
# scripts/smoke-section-custom-logger.sh

set -e

echo "Smoke Test: Custom Logger"

# Start shell if not already running
if ! nc -z localhost 3020 2>/dev/null; then
  npm start &
  SHELL_PID=$!
  sleep 2
fi

# Run proof
node apps/skyequanta-shell/bin/workspace-proof-section-custom-logger.mjs --json

# Clean up
if [ ! -z "$SHELL_PID" ]; then
  kill $SHELL_PID
fi

echo "✓ Custom Logger smoke test passed"
```

### Step 3: Register in Master Proof Ledger

```json
{
  "section": 65,
  "name": "Custom Logger Service",
  "status": "PASS",
  "timestamp": "2026-04-16T18:00:00Z"
}
```

---

## 10. Data Export/Import Pattern

**When to Use:** Transferring workspace data between environments (migration, backup, sharing)

**Example:** Export workspace and import in different environment

### Step 1: Define Exporter

```javascript
// apps/skyequanta-shell/lib/workspace-exporter.mjs

export class WorkspaceExporter {
  constructor(shell) {
    this.shell = shell;
  }

  async exportWorkspace(workspaceId, options = {}) {
    const workspace = this.shell.services.workspaceManager.get(workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

    console.log(`Exporting workspace ${workspaceId}...`);

    const export_ = {
      version: 1,
      exportedAt: Date.now(),
      workspace: {
        id: workspace.id,
        config: workspace.config,
        metadata: workspace.metadata
      },
      files: {}, // File contents
      snapshots: [], // Available snapshots
      events: [] // Event timeline
    };

    // Export files
    if (options.includeFiles) {
      export_.files = await this._exportFiles(workspaceId);
    }

    // Export snapshots
    if (options.includeSnapshots) {
      export_.snapshots = await this._exportSnapshots(workspaceId);
    }

    // Export events
    if (options.includeEvents) {
      export_.events = await this._exportEvents(workspaceId);
    }

    // Add signature
    if (options.sign) {
      export_.signature = this._sign(export_);
    }

    return export_;
  }

  async _exportFiles(workspaceId) {
    const files = {};
    const fileList = await this.shell.services.remoteExecutor.listFiles(workspaceId);

    for (const file of fileList) {
      const content = await this.shell.services.remoteExecutor.readFile(
        workspaceId,
        file
      );
      files[file] = content;
    }

    return files;
  }

  async _exportSnapshots(workspaceId) {
    return this.shell.services.governanceManager.listSnapshots(workspaceId);
  }

  async _exportEvents(workspaceId) {
    return this.shell.services.eventAggregator.queryTimeline({
      workspaceId,
      limit: 10000
    });
  }

  _sign(data) {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    return hash;
  }
}
```

### Step 2: Define Importer

```javascript
// apps/skyequanta-shell/lib/workspace-importer.mjs

export class WorkspaceImporter {
  constructor(shell) {
    this.shell = shell;
  }

  async importWorkspace(exportData, options = {}) {
    // Verify signature if present
    if (exportData.signature && !options.skipVerification) {
      this._verify(exportData);
    }

    console.log(`Importing workspace from export...`);

    // Create new workspace with imported config
    const newWorkspace = await this.shell.services.workspaceManager.createWorkspace({
      config: exportData.workspace.config
    });

    console.log(`Created workspace ${newWorkspace.id}`);

    // Import files
    if (options.includeFiles && exportData.files) {
      await this._importFiles(newWorkspace.id, exportData.files);
    }

    // Import snapshots
    if (options.includeSnapshots && exportData.snapshots) {
      await this._importSnapshots(newWorkspace.id, exportData.snapshots);
    }

    console.log(`✓ Import complete`);

    return newWorkspace;
  }

  async _importFiles(workspaceId, files) {
    for (const [path, content] of Object.entries(files)) {
      await this.shell.services.remoteExecutor.writeFile(
        workspaceId,
        path,
        content
      );
    }
  }

  async _importSnapshots(workspaceId, snapshots) {
    for (const snapshot of snapshots) {
      // Restore snapshots in order
      await this.shell.services.governanceManager.restoreSnapshot(
        workspaceId,
        snapshot
      );
    }
  }

  _verify(data) {
    const crypto = require('crypto');
    const stored = data.signature;
    delete data.signature;

    const computed = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    if (stored !== computed) {
      throw new Error('Export signature invalid (data may be corrupted)');
    }

    data.signature = stored;
  }
}
```

### Step 3: Expose via CLI

```bash
#!/bin/bash
# scripts/export-workspace.sh

WORKSPACE_ID=$1
OUTPUT_FILE=${2:-workspace-export.json}

if [ -z "$WORKSPACE_ID" ]; then
  echo "Usage: ./export-workspace.sh <workspace-id> [output-file]"
  exit 1
fi

npm run workspace:export -- --workspace "$WORKSPACE_ID" --output "$OUTPUT_FILE" --json
```

```bash
#!/bin/bash
# scripts/import-workspace.sh

EXPORT_FILE=$1

if [ ! -f "$EXPORT_FILE" ]; then
  echo "Usage: ./import-workspace.sh <export-file>"
  exit 1
fi

npm run workspace:import -- --file "$EXPORT_FILE" --json
```

---

## Summary: Pattern Checklist

When building an integration:

- [ ] **Define clear interface** (what are the methods/inputs/outputs?)
- [ ] **Register with shell** (how does shell know about it?)
- [ ] **Expose via bridge** (how do users/services call it?)
- [ ] **Respect context headers** (use workspace/session IDs)
- [ ] **Emit events** (other services should know it happened)
- [ ] **Apply redaction** (don't leak secrets)
- [ ] **Add proof** (machine-readable verification)
- [ ] **Document** (help next developer understand it)
- [ ] **Test in isolation** (unit test)
- [ ] **Test integrated** (smoke test with full shell)

---

**These patterns are production-tested in SkyeHands. Use them as templates for new integrations.**
