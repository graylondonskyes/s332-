# SKYEHANDS: COMPREHENSIVE DEEP SCAN & AI INTEGRATION GUIDE

**Last Updated:** April 16, 2026  
**Version:** 0.1.6 (Core) / 3.1.9 (Shell)  
**Current Stage:** Stage 40, Pass 39 (Recovered, Rehydrated, Live)  
**Project Status:** Production-ready with Stage 9-10 proof passing, comprehensive 63-section hardening

---

## TABLE OF CONTENTS

1. [Mission & Identity](#mission--identity)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack Deep Dive](#technology-stack-deep-dive)
4. [Component Architecture](#component-architecture)
5. [Directory Structure & File Organization](#directory-structure--file-organization)
6. [Critical Integration Points](#critical-integration-points)
7. [Configuration System](#configuration-system)
8. [Proof & Evidence System](#proof--evidence-system)
9. [Deployment & Operations](#deployment--operations)
10. [AI/LLM Integration Patterns](#aillm-integration-patterns)
11. [Development Workflow](#development-workflow)
12. [Business Model & Valuation](#business-model--valuation)
13. [Common Tasks & Patterns](#common-tasks--patterns)
14. [Emergency & Debugging](#emergency--debugging)

---

## MISSION & IDENTITY

### What is SkyeHands?

**SkyeQuantaCore-TheHybrid-AutonomousIDE** (marketed as **SkyeHands**) is a **product-owned Autonomous Developer Cloud platform** that replaces GitHub Codespaces with a unified system combining:

- **Hybrid IDE** (Theia-based browser editor)
- **Autonomous Agent** (OpenHands-based AI execution engine)
- **Runtime Orchestration** (Multi-workspace, multi-tenant execution)
- **Governance Layer** (Snapshots, rollback, audit, disaster recovery)
- **AI Access Control** (Gate runtime, redaction policies)
- **Sovereign Provider Integration** (User-owned credential vaults)

### Company & Branding

- **Company:** Skyes Over London
- **AI Name:** kAIxU (pronounced "kai-zoo")
- **Product Identity Source:** `branding/identity.json`
- **Core Philosophy:** "Category of One" — Not incremental improvement on Codespaces, but a fundamentally different approach to autonomous development

### Core Mission

Enable non-expert operators to:
1. Deploy autonomous developer environments using a single command (`./START_HERE.sh`)
2. Run AI-driven code generation with governance controls (kAIxU Council orchestration)
3. Manage multi-workspace fleets with snapshot/restore/rollback capabilities
4. Maintain audit trails and sovereign provider credentials safely
5. Ship production workloads backed by proof artifacts and regulatory materials

---

## ARCHITECTURE OVERVIEW

### 7-Layer Unified Platform Model

```
┌─────────────────────────────────────────────────┐
│   Operator Surface (./START_HERE.sh / CLI)      │ ← Non-expert entry
├─────────────────────────────────────────────────┤
│        SkyeQuanta Shell (Authority Layer)       │
│    - Session mgmt, workspace registry           │
│    - Runtime contract enforcement               │
│    - Bridge proxy (IDE + Agent convergence)     │
│    - Gate runtime & redaction                   │
├─────────────────────────────────────────────────┤
│  Hybrid IDE Layer         │   Autonomous Agent  │
│  (Theia via port 3010)    │   (OpenHands v3010) │
│  - File operations        │   - Code generation │
│  - Terminal/terminal      │   - Execution       │
│  - Preview routing        │   - Context mgmt    │
├─────────────────────────────────────────────────┤
│      Remote Executor (Workspace Runtime)        │
│    - Container isolation, lifecycle mgmt        │
│    - Resource limits (cgroups)                  │
│    - Orphan reaping & recovery                  │
├─────────────────────────────────────────────────┤
│   Governance & Audit (Snapshots/Restore)       │
│    - State capture, rollback, encryption        │
├─────────────────────────────────────────────────┤
│   Sovereign Provider (Encrypted Credentials)    │
│    - User-owned vaults, unlock-gated brokerage │
├─────────────────────────────────────────────────┤
│    Linux Kernel (seccomp, AppArmor, cgroups)   │
└─────────────────────────────────────────────────┘
```

### Authority Pattern (CRITICAL)

The **SkyeQuanta Shell** is the **single source of truth** for:
- Session context (user, workspace, AI mode)
- Workspace registry and lifecycle
- File operation authorization
- Preview state projection
- Runtime health aggregation
- AI gate enforcement
- Governance snapshots

**All IDE and agent traffic routes through the shell's bridge proxy**, not directly to underlying services. This ensures:
- Consistent authorization
- Converged context injection
- Unified logging and audit
- Runtime contract enforcement

---

## TECHNOLOGY STACK DEEP DIVE

### Languages

| Language | Primary Role | Version | Location |
|----------|-------------|---------|----------|
| **Node.js (ES6+)** | Runtime, Shell, CLI, Bridge | 22+ | `apps/skyequanta-shell/` + root scripts |
| **Python** | Agent foundation, FastAPI hooks | 3.13+ | `platform/agent-core/` + shell bootstrap |
| **Bash** | Bootstrap orchestration, smoke tests | 5.0+ | `scripts/`, `START_HERE.sh` |
| **JavaScript** | IDE plugins, build tools | ESM modules | `platform/ide-core/packages/`, webpack configs |

### Core Frameworks & Libraries

#### Node.js
- **Express.js** — HTTP server for bridge proxy and API routes
- **EventEmitter2** — Multi-lane event convergence (runtime-bus)
- **Fs-extra** — File operations with atomic writes
- **Tar, Unzipper** — Archive handling for recovery, export
- **Crypto, jsonwebtoken** — Encryption, signed attestation
- **Child_process** — Workspace spawning, operator lifecycle
- **Socket.io** (optional) — Real-time bridge communication

#### Python
- **FastAPI** — Async HTTP hooks for shell bootstrap
- **Poetry** — Dependency management with lock files
- **OpenHands SDK** — Autonomous agent framework
- **Pydantic** — Configuration validation
- **APScheduler** — Background task scheduling

#### Integrated Upstream
- **Theia IDE** (`platform/ide-core/`) — ~1,900 files, VSCode-compatible editor
- **OpenHands** (`platform/agent-core/`) — ~70,000 files, autonomous agent runtime

### System Integration

- **Docker/OCI Runtime** — Container storage driver, workspace isolation
- **Linux Kernel Features:**
  - `cgroups` v2 — Resource limits (CPU, memory, PIDs)
  - `seccomp` — Syscall filtering
  - `AppArmor` — Mandatory access control profiles
  - Namespaces — PID, network, UTS isolation
- **OpenAI APIs** — Optional `text-to-speech`, `image-to-text` integration
- **Git** — Version control for workspace state snapshots

### Package Management

| Tool | Purpose | Location | Lock File |
|------|---------|----------|-----------|
| **npm** | Root/shell JS deps | Root, `apps/skyequanta-shell/` | `package-lock.json` (if present) |
| **poetry** | Agent/platform Python | `platform/agent-core/` | `poetry.lock` |
| **Bundled Fallbacks** | System deps bootstrap | `.skyequanta/runtime-deps/` | Auto-generated |

**Key Fallback Paths:**
- Poetry venv: `.skyequanta/runtime-deps/agent-venv`
- xkbfile.pc: `.skyequanta/runtime-deps/pkgconfig`
- ripgrep: `platform/ide-core/node_modules/@vscode/ripgrep` (fallback if system install fails)
- Keytar, drivelist, node-pty: Stub implementations if native modules fail

---

## COMPONENT ARCHITECTURE

### 1. SkyeQuanta Shell (Authority Layer)

**Path:** `apps/skyequanta-shell/`  
**Version:** 3.1.9  
**Entry Points:** `bin/operator-green.mjs`, `bin/launch.mjs`, `bin/bridge.mjs`

#### Responsibilities

- **Session Authority:** Owns user session context, workspace binding, AI mode state
- **Bridge Proxy:** HTTP reverse proxy at port 3020 (default) that:
  - Routes IDE requests (3010) through authorization layer
  - Routes agent requests (3000) through context injection
  - Injects authoritative headers (`x-skyequanta-workspace-id`, `x-skyequanta-session-id`, etc.)
  - Enforces gate runtime rules
- **Workspace Registry:** CRUD operations on workspace definitions, lifecycle management
- **Runtime Orchestration:** Spawns remote executor, manages workspace processes
- **Gate Runtime Enforcement:** Validates AI gate configuration, enforces redaction policies
- **Governance:** Snapshot/restore integration, rollback coordination
- **Operator CLI:** User-facing commands (launch, doctor, runtime-seal, support-dump)

#### Key Libraries (lib/ directory)

| File | Purpose |
|------|---------|
| `bridge.mjs` | HTTP proxy + runtime contract server |
| `session-manager.mjs` | Shell-owned session CRUD and authority |
| `workspace-manager.mjs` | Workspace registry and lifecycle |
| `runtime-bus.mjs` | Multi-lane event convergence |
| `gate-runtime-enforcer.mjs` | AI access control validation |
| `redaction-helper.mjs` | Secret masking for logs/exports |
| `governance-manager.mjs` | Snapshot/restore/rollback operations |
| `provider-vault.mjs` | Encrypted credential storage |
| `kaixu-council.mjs` | AI role orchestration |
| `skye-memory-fabric.mjs` | Context persistence across runs |
| `skye-replay.mjs` | Execution timeline verification |
| `remote-executor-manager.mjs` | Workspace runtime spawning |
| `operator-automation.mjs` | Operator command execution |
| `proof-orchestrator.mjs` | Proof section runner coordination |

#### Key Executables (bin/ directory)

| File | Purpose |
|------|---------|
| `operator-green.mjs` | Ship-candidate explicit flow |
| `launch.mjs` | Interactive shell launcher |
| `bridge.mjs` | Standalone bridge proxy |
| `doctor.mjs` | Deploy readiness diagnostic |
| `runtime-seal.mjs` | Gate/runtime validation |
| `remote-executor.mjs` | Default workspace runtime |
| `workspace-proof-section*.mjs` | 63 individual proof runners |
| `cold-machine-bootstrap.mjs` | Fresh machine setup orchestration |
| `ship-candidate.mjs` | Production packaging |

### 2. Remote Executor (Workspace Runtime)

**Path:** `apps/skyequanta-shell/bin/remote-executor.mjs`  
**Default Runtime:** Used by shell to spawn workspace processes  
**Port:** 3030+ (per-workspace allocation)

#### Responsibilities

- **Workspace Isolation:** Spawns containerized or sandboxed workspace instances
- **Process Lifecycle:** Manages IDE + agent process spawning, monitoring, cleanup
- **Orphan Management:** Detects and reaps zombie processes (especially after failures)
- **Resource Limits:** Enforces cgroup limits (CPU, memory, PID count)
- **Recovery:** Handles restart logic, health checks, self-healing
- **Multi-workspace Orchestration:** Manages concurrent workspace instances
- **Bridge Communication:** Reports health/status back to shell's health probe

#### Key Configuration

- `SKYEQUANTA_WORKSPACE_ID` — Unique workspace identifier
- `SKYEQUANTA_WORKSPACE_PORT` — Allocated port for this workspace
- `SKYEQUANTA_RESOURCE_LIMITS` — JSON cgroup constraints
- `SKYEQUANTA_AUTO_RESTART` — Boolean restart-on-failure
- `SKYEQUANTA_RECOVERY_MODE` — Full/light/none

### 3. Theia IDE Integration (ide-core)

**Path:** `platform/ide-core/`  
**Port:** 3010 (default)  
**Technology:** VSCode-compatible browser editor

#### Key Components

| Directory | Purpose |
|-----------|---------|
| `packages/core` | IDE runtime core |
| `packages/plugin` | Plugin system |
| `packages/ext-*.ts` | Language extensions (JS, Python, etc.) |
| `plugins/` | Built-in editor plugins |
| `node_modules/` | Auto-installed dependencies |

#### Integration Points with Shell

- **File Operations:** Converge with agent outputs through runtime-bus
- **Terminal Proxy:** Shell-owned bridge enforces execution context
- **Preview Routing:** Shell manages preview URL generation (`/preview/*`)
- **Health Probes:** Shell checks IDE health via `/_/status` endpoint
- **Authorization:** All IDE requests include shell-injected auth headers

#### Common IDE Requests (all route through bridge)

```
GET /_/status                    → Health check
GET /files/*                     → File read (authorized by session)
POST /files/write                → File write (atomic, rollback-aware)
GET /terminal/*                  → Terminal access (contextualized)
POST /preview/*                  → Preview generation (session-scoped)
```

### 4. OpenHands Agent Integration (agent-core)

**Path:** `platform/agent-core/`  
**Port:** 3000 (agent backend)  
**Framework:** OpenHands autonomous agent runtime

#### Key Components

| Directory | Purpose |
|-----------|---------|
| `runtime/` | Agent execution engine |
| `config.toml` | Agent configuration (models, tools, etc.) |
| `poetry.lock` | Python dependency lock |
| `scripts/` | Agent bootstrap and utilities |

#### Integration Points with Shell

- **Context Injection:** Shell provides workspace/session context on every agent request
- **AI Gate Enforcement:** Shell validates agent requests against gate runtime config
- **File System Access:** Agent file ops converge with IDE through runtime-bus
- **Tool Registration:** Shell restricts available tools based on mode/role
- **Model Selection:** Gate runtime determines which LLM/model the agent uses
- **Budget Tracking:** Shell (via CostBrain module) monitors agent token/cost spend

#### Agent Request Flow

```
Agent needs to do something
    ↓
Shell bridge intercepts (port 3020 / /api/agent/*)
    ↓
Shell injects context: workspace_id, session_id, user_role, gate_mode
    ↓
Shell queries gate-runtime config (offline/local-only/remote-gated)
    ↓
If remote-gated: Call external gate service to validate + get LLM routing
    ↓
Shell authorizes tool availability (based on role + autonomy-gradient)
    ↓
Request forwarded to native agent runtime (port 3000) with headers
    ↓
Agent executes with shell-provided context
    ↓
Results flow back through bridge for redaction + audit logging
```

### 5. Bridge Proxy (Runtime Contract Authority)

**Path:** `apps/skyequanta-shell/lib/bridge.mjs`  
**Listener:** `http://localhost:3020` (default)  
**Authority:** Shell-owned HTTP reverse proxy

#### Canonical Routes

| Route | Target | Purpose |
|-------|--------|---------|
| `GET /api/runtime/context` | Shell | Get current workspace/session/lane context |
| `GET /api/runtime/health` | Aggregated | Combined IDE+agent+runtime health |
| `POST /api/runtime/events` | Shell | Submit runtime event (test/debug) |
| `GET /api/gate/status` | Gate enforcer | Gate runtime mode + model |
| `*` → `localhost:3010/...` | IDE | All other requests proxy to IDE |

#### Authoritative Headers Injected by Bridge

```
x-skyequanta-authoritative-surface: bridge
x-skyequanta-workspace-id: {workspace_id}
x-skyequanta-session-id: {session_id}
x-skyequanta-user-id: {user_id}
x-skyequanta-ai-mode: {mode: "offline"|"local"|"gated"|"unbounded"}
x-skyequanta-autonomy-gradient: {gradient: "bounded"|"unbounded"|"escalation"}
x-skyequanta-gate-model: {model}
x-skyequanta-redacted-output: {boolean}
```

### 6. Gate Runtime (AI Access Control)

**Configuration:** `config/gate-runtime.json`  
**Authority:** Enforced by shell's `gate-runtime-enforcer.mjs`

#### Modes

| Mode | Behavior |
|------|----------|
| `offline` | AI/LLM routes hard-fail. Shell works in local-only mode. |
| `local-only` | Shell and workspace active, gate disabled. IDE + agent work normally. |
| `remote-gated` | Requires `SKYEQUANTA_GATE_URL` + `SKYEQUANTA_GATE_TOKEN`. Remote gate service controls AI access. |

#### Default Configuration

```json
{
  "version": 1,
  "mode": "local-only",
  "gate": {
    "url": null,
    "model": "kaixu/deep",
    "urlEnvVars": ["SKYEQUANTA_GATE_URL", "OMEGA_GATE_URL"],
    "tokenEnvVars": ["SKYEQUANTA_GATE_TOKEN", "SKYEQUANTA_OSKEY"],
    "modelEnvVars": ["SKYEQUANTA_GATE_MODEL"],
    "founderGatewayEnabled": true
  }
}
```

#### Redaction Policy

**Path:** `config/redaction-policy.json`  
**Purpose:** Governs which values appear in logs, reports, exports

Example redaction rules:
```json
{
  "patterns": [
    { "name": "api_keys", "regex": "api_key['\\\"]?\\s*[:=]\\s*['\\\"]?([^'\\\"\\s]+)" },
    { "name": "passwords", "regex": "password['\\\"]?\\s*[:=]\\s*['\\\"]?([^'\\\"\\s]+)" },
    { "name": "tokens", "regex": "token['\\\"]?\\s*[:=]\\s*['\\\"]?([^'\\\"\\s]+)" }
  ],
  "replacement": "[REDACTED]"
}
```

### 7. Governance & Audit Layer

**Path:** `apps/skyequanta-shell/lib/governance-manager.mjs`

#### Capabilities

| Operation | Purpose |
|-----------|---------|
| **Snapshot** | Capture full workspace state at a point in time |
| **Restore** | Reconstruct workspace from snapshot |
| **Rollback** | Undo mutations from a specific file operation |
| **Encrypt** | Encrypt snapshots for backup-at-rest security |
| **Export** | Generate audit-chain evidence for procurement |
| **Retention** | Configurable cleanup policies for old snapshots |

#### Snapshot Contents

- File system state (all user files)
- IDE session state
- Agent context (memory, decisions)
- Runtime logs
- Secrets mask (encrypted separately)
- Timestamp + signature

#### Restore Workflow

```
User requests rollback to snapshot {T}
    ↓
Governance manager validates write-lock (no concurrent changes)
    ↓
Decrypts snapshot backup
    ↓
Compares current state to snapshot state (diff analysis)
    ↓
Atomically rewrites files from snapshot
    ↓
Restarts IDE/agent with snapshot runtime context
    ↓
Audit log entry: "Restored to snapshot {T}"
```

### 8. Sovereign Provider Vault

**Path:** `apps/skyequanta-shell/lib/provider-vault.mjs`

#### Key Features

- **User-Owned Credentials:** Providers (cloud accounts, APIs, etc.) are owned by user, not founder
- **Encrypted Storage:** Vault is encrypted at rest with user key
- **Unlock-Gated:** Requires unlock action before credentials can be used
- **Workspace Bindings:** Explicit assignment of providers to workspaces
- **Redacted Export:** Procurement materials prove provider binding without leaking credentials

#### Unlock-Gated Brokerage

```
Workspace needs AWS credentials
    ↓
Shell checks: Is provider unlocked?
    ↓
If NO: Show unlock prompt (1-time per session or per-operation)
    ↓
User confirms unlock
    ↓
Shell decrypts provider vault, injects credentials into workspace context
    ↓
Time-limited lease (expires after N minutes or session close)
    ↓
Redacted audit log: "Provider AWS used on 2026-04-16T15:30:00Z"
```

---

## DIRECTORY STRUCTURE & FILE ORGANIZATION

### Root Level

| Path | Purpose |
|------|---------|
| `START_HERE.sh` | One-command full deployment (non-expert entry) |
| `skyequanta` | Symlink to shell (canonical CLI) |
| `skyequanta.mjs` | CLI entry point |
| `Makefile` | Build targets, automation |
| `package.json` | Root npm scripts and metadata |
| `README.md` | Project overview |
| `.gitignore` | Git exclusions |
| `merge_manifest.json` | Recovery merge metadata (internal) |

### /apps/

| Path | Purpose |
|------|---------|
| `skye-reader-hardened/` | Document parser for formats (DOCX, PDF, EPUB) |
| `skyequanta-shell/` | **PRIMARY: Authority shell (60+ scripts, 80+ libs)** |

### /apps/skyequanta-shell/

| Path | Purpose |
|------|---------|
| `bin/` | 60+ executables (operators, proofs, orchestrators) |
| `lib/` | 80+ libraries (core services) |
| `python/` | FastAPI hooks, bootstrap automation |
| `package.json` | Shell-specific npm scripts |
| `node_modules/` | Shell dependencies (auto-installed) |

### /platform/

| Path | Purpose |
|------|---------|
| `agent-core/` | OpenHands upstream (~70K files) |
| `ide-core/` | Theia upstream (~1,900 files) |
| `user-platforms/` | Customer-specific configs |

### /config/

| Path | Purpose |
|------|---------|
| `env.example` | Runtime env vars template |
| `env-templates/` | Deployment-mode-specific env files |
| `gate-runtime.json` | AI access control config |
| `redaction-policy.json` | Secret masking rules |
| `agent/` | Agent-specific configs |

### /branding/

| Path | Purpose |
|------|---------|
| `identity.json` | Product identity (company, product, AI name) |

### /docs/

| Path | Purpose |
|------|---------|
| `ARCHITECTURE_*.html` | Architecture diagrams |
| `CANONICAL_*.md` | Canonical operator surfaces |
| `DEPLOYMENT_*.md` | Deployment guidelines |
| `GATE_RUNTIME_*.md` | Gate runtime documentation |
| `IDE_AGENT_*.md` | Convergence contract |
| `proof/` | Evidence artifacts (hashes, ledger, reports) |
| `INVESTOR_*.md` | Valuation and smoke reports (50+ dated) |
| `CLAIMS_REGISTER.md` | Feature claims backed by proof |

### /scripts/

| Path | Purpose |
|------|---------|
| `bootstrap-*.sh` | Environment setup scripts |
| `smoke-*.sh` | Individual proof section tests |
| `smoke-ship-candidate.sh` | Ship-candidate test entry |

### /src/

| Path | Purpose |
|------|---------|
| `runtime.js` | Runtime contract entry point |

### /workspace/

| Path | Purpose | Lifecycle |
|-------|---------|-----------|
| `instances/` | Container runtime definitions | Created per workspace, cleaned on exit |
| `prebuilds/` | Cached build artifacts | Preserved across runs unless --clean |
| `retention/` | Backup/snapshot storage | Managed by governance layer |
| `secrets/` | Workspace-scoped secrets | Encrypted, destroyed on cleanup |
| `volumes/` | Persistent data (stage-specific) | `stage10-a/`, `stage10-b/`, `stage10-c/`, etc. |

### /dist/

| Path | Purpose |
|------|---------|
| `ship-candidate/` | Production deployment package |
| `production-release/` | Release bundles with checksums |

---

## CRITICAL INTEGRATION POINTS

### 1. Session Context Injection

**How It Works:**

Every request to IDE or agent must carry shell-authorized session context:

```javascript
// Shell creates session context
const sessionContext = {
  sessionId: uuid(),
  workspaceId: workspace.id,
  userId: user.id,
  aiMode: "local", // or "gated" or "unbounded"
  autonomyGradient: "bounded", // or "unbounded" or "escalation"
  timestamp: Date.now(),
  signature: hmac256(JSON.stringify(...), shellSecret)
};

// Bridge injects into every IDE request
app.use((req, res, next) => {
  req.headers['x-skyequanta-session-id'] = sessionContext.sessionId;
  req.headers['x-skyequanta-workspace-id'] = sessionContext.workspaceId;
  // ... more headers
  next();
});

// IDE/agent receive and validate
const validateSessionContext = (headers) => {
  const sig = hmac256(JSON.stringify(sanitizeHeaders(headers)), shellSecret);
  if (sig !== headers['x-skyequanta-signature']) {
    throw new Error('Invalid session context');
  }
};
```

**Why This Matters:**

Without shell-injected context, IDE and agent cannot know which workspace they're serving or what rules apply. This is the foundation of multi-workspace isolation and governance.

### 2. File Operation Convergence

**How It Works:**

Both IDE (file edits) and agent (code generation) write files. Shell's `runtime-bus` converges both into one authoritative projection:

```javascript
// runtime-bus.mjs
class RuntimeBus extends EventEmitter2 {
  // IDE file write
  onFileWrite(event) {
    this._fileWriteQueue.push(event);
    this._convergencePhase();
  }

  // Agent code generation output
  onAgentOutput(event) {
    this._agentOutputQueue.push(event);
    this._convergencePhase();
  }

  _convergencePhase() {
    // Detect conflicts (both wrote same file)
    const conflicts = this._detectConflicts();
    
    if (conflicts.length > 0) {
      // Escalate to user or apply conflict resolution
      this._handleConflict(conflicts);
    }
    
    // Commit authoritative file state to workspace
    this._commitFiles();
    
    // Emit convergence event (for audit)
    this.emit('file-convergence', {
      timestamp: Date.now(),
      affectedFiles: [...this._edits.keys()],
      conflicts,
      agentOutput: this._agentOutputQueue
    });
  }
}
```

**Why This Matters:**

Without convergence, IDE edits and agent outputs would step on each other. The runtime-bus ensures a unified file projection and audit trail.

### 3. Gate Runtime Validation

**How It Works:**

Before any AI operation, shell validates against gate config:

```javascript
// gate-runtime-enforcer.mjs
async function validateAgentRequest(request) {
  const { mode } = gateRuntime;
  
  if (mode === 'offline') {
    throw new Error('AI is disabled (offline mode)');
  }
  
  if (mode === 'remote-gated') {
    // Call remote gate service
    const gateResponse = await callGateService({
      url: process.env.SKYEQUANTA_GATE_URL,
      token: process.env.SKYEQUANTA_GATE_TOKEN,
      request
    });
    
    if (!gateResponse.allowed) {
      throw new Error(`Gate rejected: ${gateResponse.reason}`);
    }
    
    // Gate returns authorized model/token limits
    return {
      modelId: gateResponse.modelId,
      maxTokens: gateResponse.maxTokens
    };
  }
  
  if (mode === 'local-only') {
    // No validation needed, use local model
    return { modelId: 'local', maxTokens: Infinity };
  }
}
```

**Why This Matters:**

This is the control point for regulatory compliance, cost management, and AI safety. Without gate validation, AI could run uncontrolled.

### 4. Proof Orchestration

**How It Works:**

Each proof section (1-63) is a standalone executable. Orchestrator runs them in sequence with timeout/recovery:

```javascript
// proof-orchestrator.mjs
async function runProofs(sections) {
  const results = {};
  
  for (const section of sections) {
    try {
      const proof = require(`./workspace-proof-section${section}.mjs`);
      const result = await proof.run({ timeout: 300000 }); // 5 min timeout
      results[section] = { status: 'PASS', ...result };
    } catch (error) {
      results[section] = { status: 'FAIL', error: error.message };
      // Continue to next proof (don't stop on failure)
    }
  }
  
  // Write master proof ledger
  await fs.writeFile(
    'docs/proof/MASTER_PROOF_LEDGER.json',
    JSON.stringify(results, null, 2)
  );
  
  // Emit proof-complete event
  return results;
}
```

**Why This Matters:**

Proofs are machine-readable evidence that features work. They're used in procurement, investor pitches, and deployment readiness checks.

---

## CONFIGURATION SYSTEM

### Environment Variables (Primary Config)

**Location:** `config/env.example` (template), `config/env-templates/` (mode-specific)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SKYEQUANTA_HOST` | 127.0.0.1 | Shell bind address |
| `SKYEQUANTA_BRIDGE_PORT` | 3020 | Bridge proxy listen port |
| `SKYEQUANTA_IDE_PORT` | 3010 | IDE upstream port |
| `SKYEQUANTA_AGENT_PORT` | 3000 | Agent upstream port |
| `SKYEQUANTA_DEV` | 0 | Enable debug logs |
| `SKYEQUANTA_AUTO_INSTALL_SYSTEM_DEPS` | 1 | Auto-install Linux packages |
| `LLM_API_KEY` | (empty) | Provider API key (OpenAI, etc.) |
| `LLM_MODEL` | gpt-4o | Default LLM model |
| `SKYEQUANTA_GATE_URL` | (empty) | Remote gate service URL |
| `SKYEQUANTA_GATE_TOKEN` | (empty) | Gate service auth token |
| `SKYEQUANTA_GATE_MODEL` | kaixu/deep | Gate-routed model |
| `SKYEQUANTA_INTERNAL_RUNTIME_INVOCATION` | 0 | Allow legacy runtime invocation |
| `SKYEQUANTA_ALLOW_LEGACY_RUNTIME` | 0 | Allow deprecated OpenHands direct calls |

### JSON Configuration Files

#### config/gate-runtime.json

Controls AI access mode and redaction behavior:

```json
{
  "version": 1,
  "mode": "local-only",
  "gate": {
    "url": null,
    "model": "kaixu/deep",
    "urlEnvVars": ["SKYEQUANTA_GATE_URL", "OMEGA_GATE_URL"],
    "tokenEnvVars": ["SKYEQUANTA_GATE_TOKEN", "SKYEQUANTA_OSKEY"],
    "modelEnvVars": ["SKYEQUANTA_GATE_MODEL"],
    "founderGatewayEnabled": true
  },
  "redaction": {
    "policyPath": "config/redaction-policy.json",
    "supportDumpDir": ".skyequanta/reports/support-dumps"
  }
}
```

#### config/redaction-policy.json

Example security rules:

```json
{
  "patterns": [
    {
      "name": "aws_secret_access_key",
      "regex": "AKIA[0-9A-Z]{16}"
    },
    {
      "name": "private_key",
      "regex": "-----BEGIN (RSA|EC|OPENSSH|PRIVATEKEY)"
    }
  ],
  "replacement": "[REDACTED]",
  "enabled": true
}
```

#### branding/identity.json

Product identity injection:

```json
{
  "companyName": "Skyes Over London",
  "productName": "SkyeQuantaCore-TheHybrid-AutonomousIDE",
  "productVersion": "0.1.6",
  "aiDisplayName": "kAIxU",
  "componentNames": {
    "agentCore": "Autonomous Execution Layer",
    "ideCore": "Hybrid IDE Layer",
    "shellApp": "SkyeQuanta Shell",
    "governanceLayer": "Governance & Audit Engine"
  }
}
```

### Deployment Mode Selection

| Mode | Env File | Entry Point | Use Case |
|------|----------|-------------|----------|
| **Development** | `config/env-templates/dev.env` | `npm start` | Local development |
| **Proof** | `config/env-templates/proof.env` | Smoke test scripts | Regression testing |
| **Deploy** | `config/env-templates/deploy.env` | `./START_HERE.sh` | Production deployment |

---

## PROOF & EVIDENCE SYSTEM

### What Are Proofs?

Proofs are **machine-executable, reproducible tests** that verify each major feature works. They exist in two forms:

1. **Proof Executables:** `apps/skyequanta-shell/bin/workspace-proof-section*.mjs` (60+ files)
2. **Smoke Test Scripts:** `scripts/smoke-section*.sh` (bash wrappers)

### Master Proof Ledger

**Path:** `docs/proof/MASTER_PROOF_LEDGER.json`  
**Purpose:** Machine-readable pass/fail status for all proof sections

Example:

```json
{
  "stage": 9,
  "pass": 39,
  "sections": [
    { "section": 1, "name": "Core Convergence", "status": "PASS", "timestamp": "2026-04-10T12:00:00Z" },
    { "section": 2, "name": "IDE Integration", "status": "PASS", "timestamp": "2026-04-10T12:05:00Z" },
    ...
    { "section": 9, "name": "Deployment Readiness", "status": "PASS", "timestamp": "2026-04-10T12:30:00Z" },
    { "section": 10, "name": "Multi-Workspace Stress", "status": "PASS", "timestamp": "2026-04-10T13:00:00Z" }
  ],
  "overall": "PASS"
}
```

### Running Proofs

#### Individual Proof

```bash
# Run section 1
node apps/skyequanta-shell/bin/workspace-proof-section1.mjs --json

# Or via smoke test
bash scripts/smoke-section1-convergence.sh --json
```

#### All Proofs

```bash
# Via orchestrator
npm run cold-machine:boot -- --json

# Or via explicit ship-candidate flow
./skyequanta operator-green --json
```

### Proof Sections (1-63)

| Sections | Category | Purpose |
|----------|----------|---------|
| 1-9 | **Core Platform** | IDE/agent convergence, governance, gate, bootstrap |
| 10-20 | **Deployment** | Multi-workspace, preview routing, operator surfaces |
| 21-38 | **Hardening Phase 1** | Security, isolation, recovery, rootless namespaces |
| 39-45 | **Hardening Phase 2** | Advanced attestation, execution enforcement, AppArmor |
| 46-63 | **Category Features** | Memory fabric, replay, council, sovereignty, compliance |

### Evidence Artifacts

| File | Purpose |
|------|---------|
| `MASTER_PROOF_LEDGER.json` | Pass/fail for all sections |
| `PROOF_ARTIFACT_HASHES.json` | SHA256 of proof outputs (attestation) |
| `DEPLOYMENT_READINESS_REPORT.json` | Machine-readable deploy state |
| `STAGE_9_DEPLOYMENT_READINESS.json` | Specific Stage 9 evidence |
| `STAGE_10_MULTI_WORKSPACE_STRESS.json` | Stage 10 stress test results |

---

## DEPLOYMENT & OPERATIONS

### One-Command Deployment

**Entry:** `./START_HERE.sh`

**Flow:**

```bash
# 1. Load deployment env
source config/env-templates/deploy.env

# 2. Run cold-machine bootstrap
npm run cold-machine:boot -- --json

# 3. Spin up shell's bridge proxy
node apps/skyequanta-shell/bin/bridge.mjs

# 4. Run doctor probe (deploy readiness check)
./skyequanta doctor --mode deploy --probe-active --json

# 5. Generate ship-candidate package
./skyequanta operator-green --json

# 6. Output: dist/ship-candidate/
#    - operator-handoff/     ← Commissioning materials
#    - artifact-manifest.json ← SHA hashes
#    - deployment-readiness-report.json
#    - support-dump.json     ← Redacted diagnostics
```

### Interactive Launch

```bash
./skyequanta launch
```

Prompts user to:
1. Select IDE/agent port mappings
2. Confirm gate runtime mode
3. Choose workspace isolation strategy
4. Start shell in foreground with live logs

### Deployment Readiness Check

```bash
./skyequanta doctor --mode deploy --probe-active --json
```

Verifies:
- Node.js version ✓
- Python availability and version ✓
- System dependencies (xkbfile, ripgrep, etc.) ✓
- Gate runtime configuration ✓
- Workspace isolation capabilities ✓
- Operator surfaces executable ✓

### Gate Runtime Validation

```bash
./skyequanta runtime-seal --strict --json
```

Ensures:
- Gate configuration is valid JSON ✓
- Redaction policy loads correctly ✓
- Provider vault is accessible ✓
- All required env vars are set ✓
- Mode-specific requirements met ✓

### Support Dump Generation

```bash
./skyequanta support-dump --json
```

Produces redacted diagnostics:
- System info (OS, Node version, Python version)
- Configuration (with secrets redacted)
- Recent logs (problematic entries highlighted)
- Proof status snapshot
- Operator surface availability
- Provider vault status (locked/unlocked)
- Deployment readiness report

---

## AI/LLM INTEGRATION PATTERNS

### 1. Gate Runtime Flow (AI Access Control)

```
User Action
    ↓
IDE / Agent initiates AI request
    ↓
Bridge intercepts @ localhost:3020
    ↓
Shell's gate-runtime-enforcer validates:
  - Is mode="offline"? → REJECT (return 503)
  - Is mode="local-only"? → ALLOW (use local model)
  - Is mode="remote-gated"? → CALL external gate service
    - Send: workspace_id, user_id, action, tokens_needed
    - Receive: allowed (bool), model_id, token_limit, cost
    ↓
If denied: Return 403 Forbidden
If allowed: Inject x-skyequanta-gate-model header
    ↓
Forward to agent @ localhost:3000 with:
  - Context headers (workspace, session, user)
  - Model routing info
  - Token budget
    ↓
Agent executes within budget
    ↓
CostBrain module tracks spend
    ↓
Results returned through bridge
    ↓
Redaction helper masks secrets before logging
    ↓
Audit entry recorded
```

### 2. kAIxU Council Execution

**Purpose:** Multi-role AI orchestration with arbitration

**Roles:**

1. **Architect** — Design decisions, structure planning
2. **Implementer** — Code generation, execution
3. **Test Breaker** — Negative case testing, edge cases
4. **Security Reviewer** — Vulnerability checking, permissions
5. **Migration Engineer** — Data transition, legacy handling
6. **Deploy/Recovery** — Deployment planning, rollback strategy
7. **Documentation** — README, API docs, guides
8. **Cost Optimizer** — Budget tracking, cost reduction suggestions

**Orchestration:**

```javascript
// kaixu-council.mjs
class KaixuCouncil {
  async executeCouncil(task) {
    const roleVerdicts = {};
    
    // Architect proposes design
    const design = await this.roles.Architect.think(task);
    roleVerdicts.Architecture = design;
    
    // Implementer codes to design
    const code = await this.roles.Implementer.think(task, design);
    roleVerdicts.Implementation = code;
    
    // Test Breaker finds holes
    const testCases = await this.roles.TestBreaker.think(code, design);
    roleVerdicts.TestCases = testCases;
    
    // Security Reviewer checks
    const securityReport = await this.roles.SecurityReviewer.think(code);
    roleVerdicts.Security = securityReport;
    
    // Cost Optimizer calculates
    const costAnalysis = await this.roles.CostOptimizer.think(code);
    roleVerdicts.Cost = costAnalysis;
    
    // Arbitrate verdicts
    const finalDecision = await this.arbitrate(roleVerdicts);
    
    // Emit audit trail
    this.emit('council-verdict', {
      task,
      roleVerdicts,
      finalDecision,
      timestamp: Date.now()
    });
    
    return finalDecision;
  }
  
  async arbitrate(verdicts) {
    // If security says "REJECT", override all others
    if (verdicts.Security.verdict === 'REJECT') {
      return { approved: false, reason: verdicts.Security.reason };
    }
    
    // If cost exceeds budget, escalate
    if (verdicts.Cost.estimatedCost > this.budget) {
      return { approved: false, reason: 'Budget exhausted', action: 'ESCALATE' };
    }
    
    // If test breaker found critical holes, ask for fixes
    if (verdicts.TestCases.criticalIssues.length > 0) {
      return { approved: false, reason: 'Critical test failures', action: 'FIX_AND_RETRY' };
    }
    
    // Approve
    return { approved: true, verdict: verdicts };
  }
}
```

### 3. Skye Memory Fabric (Context Persistence)

**Purpose:** Remember prior decisions and context across autonomous runs

```javascript
// skye-memory-fabric.mjs
class SkyeMemoryFabric {
  async storeDecision(decision) {
    // Store in memory graph
    const node = {
      id: uuid(),
      type: 'decision',
      content: decision,
      timestamp: Date.now(),
      workspace: this.workspaceId,
      relatedDecisions: [] // Backward/forward links
    };
    
    // Query for related context
    const related = await this.queryRelated(decision);
    node.relatedDecisions = related.map(r => r.id);
    
    // Store with encryption if sensitive
    if (decision.sensitive) {
      node.encrypted = await encrypt(JSON.stringify(decision), this.workspaceKey);
    }
    
    // Persist to memory store
    await this.store.save(node);
    
    return node.id;
  }
  
  async getContextForTask(task) {
    // Query memory fabric for relevant prior decisions
    const related = await this.queryRelated(task);
    
    // Build context injection
    const context = {
      priorDecisions: related.map(r => ({
        decision: r.content,
        timestamp: r.timestamp,
        consequence: r.consequence
      })),
      learnedLessons: this.extractLessons(related),
      confidenceScore: this.calculateConfidence(related)
    };
    
    return context;
  }
}
```

### 4. Skye Replay (Execution Timeline Verification)

**Purpose:** Verify execution history and enable fork from prior checkpoint

```javascript
// skye-replay.mjs
class SkyeReplay {
  async recordExecution(operation) {
    const receipt = {
      id: uuid(),
      operation,
      timestamp: Date.now(),
      checksum: sha256(JSON.stringify(operation)),
      signature: sign(sha256(...), this.signKey),
      priorReceipt: this.lastReceipt.id
    };
    
    // Timeline is a linked list
    await this.timeline.append(receipt);
    this.lastReceipt = receipt;
    
    return receipt;
  }
  
  async verifyTimeline() {
    const receipts = await this.timeline.getAll();
    
    for (let i = 1; i < receipts.length; i++) {
      const current = receipts[i];
      const prior = receipts[i - 1];
      
      // Verify signature
      const isValid = verify(current.signature, sha256(...), this.verifyKey);
      if (!isValid) throw new Error(`Timeline corrupted at ${i}`);
      
      // Verify prior link
      if (current.priorReceipt !== prior.id) {
        throw new Error(`Timeline chain broken at ${i}`);
      }
    }
    
    return true; // Timeline is canonical
  }
  
  async forkFromCheckpoint(checkpointId) {
    // Reset workspace to checkpoint execution state
    const checkpoint = await this.timeline.get(checkpointId);
    
    // Reload all operations up to checkpoint
    const beforeCheckpoint = await this.timeline.getAllBefore(checkpointId);
    
    // Rebuild workspace state
    for (const receipt of beforeCheckpoint) {
      await this.replayOperation(receipt.operation);
    }
    
    // New timeline branch starts
    this.branchId = uuid();
    
    return this.branchId;
  }
}
```

### 5. ProofOps (Evidence Pack Generation)

**Purpose:** Generate procurement-safe, audited evidence packets

```javascript
// proofops.mjs
async function generateEvidencePack(task) {
  // Execute task with full audit enabled
  const execution = await executeWithAudit(task);
  
  // Collect evidence
  const evidence = {
    taskId: task.id,
    executed: execution.timestamp,
    results: execution.results,
    
    // Audit trail (all decisions, sign-offs)
    auditTrail: execution.auditTrail,
    
    // Attestation (signed by shell)
    attestation: {
      executedBy: 'SkyeQuanta Shell',
      workspace: this.workspaceId,
      signature: sign(JSON.stringify(execution.results), this.signKey),
      timestamp: Date.now()
    },
    
    // Redacted version (for procurement)
    redacted: applyRedaction(execution, REDACTION_POLICY),
    
    // Negative cases (what didn't work)
    negativeTests: execution.failedTests
  };
  
  return evidence;
}
```

---

## DEVELOPMENT WORKFLOW

### Adding a New Component

**Step 1: Plan Architecture**
- What does it do? (single responsibility)
- How does it integrate with shell? (entry point)
- What's its authority? (CLI? Probed endpoint? Background?)

**Step 2: Create Entry File**
```bash
# Add to apps/skyequanta-shell/lib/my-component.mjs
export class MyComponent {
  constructor(shell) {
    this.shell = shell;
  }
  
  async initialize() {
    // Setup
  }
  
  async handle(request) {
    // Business logic
  }
}
```

**Step 3: Register with Shell**
```javascript
// apps/skyequanta-shell/lib/bridge.mjs
import { MyComponent } from './my-component.mjs';

const myComponent = new MyComponent(this);
app.post('/api/my-component/action', async (req, res) => {
  const result = await myComponent.handle(req.body);
  res.json(result);
});
```

**Step 4: Write Proof**
```javascript
// apps/skyequanta-shell/bin/workspace-proof-sectionXX.mjs
export async function run(opts) {
  // Test the component
  const result = await shell.services.myComponent.handle(testData);
  
  if (!result.success) {
    throw new Error(`MyComponent failed: ${result.error}`);
  }
  
  return { status: 'PASS', tested: true };
}
```

**Step 5: Add to Proof Ledger**
```json
{
  "section": XX,
  "name": "My Component",
  "status": "PASS"
}
```

### Debugging a Feature

1. **Check Logs:**
   ```bash
   # Enable debug output
   export SKYEQUANTA_DEV=1
   npm start
   ```

2. **Verify Gate Runtime:**
   ```bash
   ./skyequanta runtime-seal --strict --json
   ```

3. **Check Singular Proof:**
   ```bash
   node apps/skyequanta-shell/bin/workspace-proof-sectionXX.mjs --json
   ```

4. **Inspect Bridge Requests:**
   ```bash
   # Monitor bridge traffic
   curl http://localhost:3020/api/runtime/health
   ```

5. **Check Workspace State:**
   ```bash
   # Inspect workspace directory
   ls -la workspace/instances/
   ```

### Common Dev Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start shell in dev mode |
| `npm run cold-machine:boot -- --json` | Full bootstrap (all proofs) |
| `npm run proofs -- --section 1` | Run single proof |
| `npm run test` | Run unit tests (if present) |
| `npm run build` | Rebuild dist/ outputs |
| `npm run doctor -- --mode deploy` | Deployment readiness check |
| `npm run support-dump -- --json` | Generate diagnostics |

---

## BUSINESS MODEL & VALUATION

### $9,600,000 Code-Floor Valuation (Present Value)

**Breakdown:**

| Component | Value | Rationale |
|-----------|-------|-----------|
| Shell runtime + bridge + orchestration | $2,250,000 | Authority core, 60+ executables, 80+ libs |
| Hybrid IDE + agent convergence + executor | $2,950,000 | Unified platform (not point feature) |
| Governance + gate + sovereign provider | $1,800,000 | Enterprise features (snapshot/rollback/vaulting) |
| Operator automation + proof + packaging | $1,650,000 | Procurement-ready, non-expert ops, proof ladder |
| Category-creation premium | $950,000 | Not incremental, fundamentally new approach |

### Why This Floor?

1. **Unified Platform** — Not vendor-locked to Codespaces, self-contained
2. **Product-Owned Core** — Shell is authority, not external SaaS dependency
3. **Buyer-Ready Materials** — Procurement, proof, valuation inside repo
4. **Sovereign Credentials** — User owns keys, no founder vault lock-in
5. **Production Code** — Not a demo, real implementation with proof

### Projected Strategic Valuation

| Milestone | Valuation | Contingency |
|-----------|-----------|-----------|
| Category creator funded | $18-28M pre-money | Working proof + operator surfaces |
| Early commercial (1-3 customers) | $50-150M | TAM proof, customer revenue |
| Market validation (5-10 customers) | $150-500M | Installed base, benchmarks |
| Acquisition | $500M-1.5B | Strategic acquirer premium |

---

## COMMON TASKS & PATTERNS

### Deploy to New Environment

```bash
# 1. Copy deployment env
cp config/env-templates/deploy.env .env

# 2. Configure for environment
# Edit .env: Set SKYEQUANTA_GATE_URL, SKYEQUANTA_HOST, etc.

# 3. Run one-command deploy
./START_HERE.sh

# 4. Verify ship-candidate output
ls -la dist/ship-candidate/
cat dist/ship-candidate/deployment-readiness-report.json
```

### Enable AI Gate

```bash
# 1. Update config
echo 'SKYEQUANTA_GATE_URL=https://gate.example.com' >> .env
echo 'SKYEQUANTA_GATE_TOKEN=token_xyz' >> .env

# 2. Update gate config
cat > config/gate-runtime.json <<EOF
{
  "mode": "remote-gated",
  "gate": {
    "url": "https://gate.example.com",
    "model": "kaixu/deep"
  }
}
EOF

# 3. Validate and start
./skyequanta runtime-seal --strict --json
npm start
```

### Create Workspace Snapshot

```javascript
// In shell code or CLI
const governance = shell.services.governance;
const snapshot = await governance.snapshot({
  workspaceId: 'ws-123',
  label: `Before migration ${Date.now()}`
});

console.log(`Snapshot created: ${snapshot.id}`);
```

### Restore from Snapshot

```javascript
await governance.restore({
  workspaceId: 'ws-123',
  snapshotId: snapshot.id
});

console.log('Workspace restored');
```

### Unlock Provider Vault

```bash
# Unlock provider vault for this session
./skyequanta provider-vault unlock --duration 3600

# Now workspace can use unlocked credentials
# Credentials expire after 3600 seconds
```

### Run Specific Proof Section

```bash
# Run section 46 (Skye Memory Fabric)
node apps/skyequanta-shell/bin/workspace-proof-section46.mjs --json

# Or via smoke test
bash scripts/smoke-section46-skye-memory-fabric.sh --json
```

---

## EMERGENCY & DEBUGGING

### Complete Bootstrap Failed

**Symptoms:** ./START_HERE.sh fails at doctor or bootstrap phase

**Recovery:**

```bash
# 1. Check system dependencies
./skyequanta doctor --mode deploy --verbose --json

# 2. Rebuild runtime deps
npm run runtime:prepare -- --force

# 3. Clean and retry
rm -rf .skyequanta/
./START_HERE.sh
```

### Bridge Proxy Not Starting

**Symptoms:** Cannot reach localhost:3020

**Recovery:**

```bash
# 1. Check port is not bound
lsof -i :3020

# 2. Try alternate port
SKYEQUANTA_BRIDGE_PORT=3021 npm start

# 3. Check bridge logs
export SKYEQUANTA_DEV=1
npm start 2>&1 | grep -i bridge
```

### Gate Runtime Enforcement Erroring

**Symptoms:** All agent requests return 403

**Recovery:**

```bash
# 1. Validate gate config
./skyequanta runtime-seal --strict --json

# 2. Check env vars
env | grep SKYEQUANTA_GATE

# 3. Switch to local-only mode (for testing)
cat > config/gate-runtime.json <<EOF
{ "mode": "local-only" }
EOF

./skyequanta runtime-seal --strict --json
npm start
```

### Workspace Not Isolating

**Symptoms:** Multiple workspaces interfering with each other

**Recovery:**

```bash
# 1. Check cgroups support
cat /proc/cgroups | grep memory

# 2. Verify remote executor
node apps/skyequanta-shell/bin/remote-executor.mjs --diagnostic

# 3. Run multi-workspace stress test
bash scripts/smoke-section10-multi-workspace-stress.sh --json
```

### File Operation Conflicts

**Symptoms:** IDE and agent writes colliding

**Recovery:**

```bash
# 1. Check runtime-bus convergence
export SKYEQUANTA_DEV=1
npm start 2>&1 | grep -i convergence

# 2. Review recent audit trail
cat workspace/audit.jsonl | tail -20

# 3. Restore from snapshot
./skyequanta governance-manager restore --help
```

### Proof Ledger Out of Date

**Symptoms:** Master proof ledger shows old timestamp or failed stages

**Recovery:**

```bash
# 1. Regenerate proof ledger
npm run cold-machine:boot -- --force-reprove --json

# 2. Check individual sections
node apps/skyequanta-shell/bin/workspace-proof-section1.mjs --json

# 3. View results
cat docs/proof/MASTER_PROOF_LEDGER.json | jq '.sections[] | select(.status=="FAIL")'
```

### Support Information

For support, generate a redacted dump:

```bash
./skyequanta support-dump --json > support-output.json

# Include in bug reports (redaction removes secrets):
# - System information
# - Configuration (redacted)
# - Recent logs
# - Proof status
# - Deployment readiness
```

---

## SUMMARY FOR AI SYSTEMS

### What to Know Before Touching This Code

1. **Authority Model:** Shell is the single source of truth. Never bypass it or call IDE/agent directly.

2. **Context Injection:** Every request must carry shell-authorized context headers. Respect `x-skyequanta-*` headers.

3. **Proof-Backed Claims:** Features are machine-verified. Check proof status before assuming something works.

4. **Gate Runtime:** AI access is controlled by `config/gate-runtime.json`. Respect the gate, even in development.

5. **Multi-Workspace Isolation:** Workspaces are isolated. Assume interference and verify isolation between workspace IDs.

6. **Convergence Pattern:** IDE and agent both write files. Use `runtime-bus` to converge, not direct writes.

7. **Governance:** Snapshots should be frequent. Users expect rollback capability. Design with revertibility in mind.

8. **Redaction:** Credentials should be redacted in logs. Apply redaction helper to any output.

9. **Operator Surface IS the Contract:** The public commands (`./START_HERE.sh`, `./skyequanta`, CLI) are the API. Don't change them.

10. **Procurement Materials:** The buyer docs inside `docs/` are real promises. Every claim needs proof.

### Recommended Reading Order

1. `CANONICAL_OPERATOR_SURFACE.md` — What operators can do
2. `IDE_AGENT_CONVERGENCE_CONTRACT.md` — How IDE and agent interact
3. `ARCHITECTURE_OVERVIEW.html` — System architecture
4. `CURRENT_TRUTH_INDEX.md` — Canonical component list
5. This file — Deep understanding of internals

---

**End of AI Integration Guide**

For questions: See `docs/CLAIMS_REGISTER.md` for feature attestation, or review the individual proof sections (`workspace-proof-section*.mjs`) for working examples.

Commit: SkyeHands41526 (April 16, 2026)
