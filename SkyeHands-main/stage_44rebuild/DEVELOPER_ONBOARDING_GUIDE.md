# SkyeHands Developer Onboarding Guide

**Target Audience:** New engineers, AI systems, contractors working on SkyeHands  
**Duration:** 2-4 hours to understand fundamentals  
**Last Updated:** April 16, 2026

---

## Quick Start (30 minutes)

### What You Need to Know First

**SkyeHands is NOT:**
- A thin wrapper around Codespaces
- A point feature (IDE OR agent OR governance)
- Vendor-locked to any cloud provider

**SkyeHands IS:**
- A unified 7-layer platform (IDE + Agent + Runtime + Gate + Governance + Audit + Sovereign Provider)
- Product-owned (Shell is the authority, not external SaaS)
- Proof-backed (63 machine-readable sections verify every major claim)

### The Authority Model (CRITICAL)

```
User/CLI → Shell Bridge (port 3020) ← Authoritative Session Context
                ↓
         <Injects Headers>
                ↓
            IDE (3010) ← Converges with ↘
                                        Runtime-Bus
            Agent (3000) ← Converges with ↗

Shell = Single source of truth for workspace, session, AI mode, redaction
```

**Golden Rule:** Never call IDE or agent directly. Always go through the shell bridge. This ensures authorization, convergence, and audit.

### Essential Files to Understand

| File | Read Time | Why |
|------|-----------|-----|
| `README.md` | 5 min | Project overview |
| `COMPREHENSIVE_DEEP_SCAN_AI_GUIDE.md` | 30 min | Full architecture (you might be reading this!) |
| `apps/skyequanta-shell/lib/bridge.mjs` | 10 min | Authority proxy logic |
| `apps/skyequanta-shell/bin/launch.mjs` | 5 min | Entry point, see what shell does |
| `docs/IDE_AGENT_CONVERGENCE_CONTRACT.md` | 10 min | How IDE and agent work together |

### Run It (5 minutes)

```bash
cd /workspaces/SkyeHands

# Option 1: One command (recommended for first run)
./START_HERE.sh

# Option 2: Interactive
./skyequanta launch

# Option 3: Manual (for debugging)
export SKYEQUANTA_DEV=1
npm start
```

Then open `http://localhost:3020` in your browser.

---

## Understanding the Codebase (1-2 hours)

### Layer 1: The Shell (Command Center)

**Path:** `apps/skyequanta-shell/`

**What it does:**
- Owns session context (who is user? which workspace? what mode?)
- Runs bridge proxy (reverse proxy to IDE + agent)
- Manages workspaces (create, destroy, checkpoint, restore)
- Enforces AI gate (determines if AI requests allowed)
- Coordinates governance (snapshots, rollbacks)
- Exposes CLI commands (the user-facing contract)

**Key files to read:**

1. **lib/bridge.mjs** (100-200 lines)
   - HTTP reverse proxy
   - Injects authoritative headers
   - Routes `/api/runtime/*` calls
   - Enforces gate rules

2. **lib/session-manager.mjs** (150-250 lines)
   - Creates/tracks sessions
   - Binds user → workspace
   - Manages login/logout
   - Session context CRUD

3. **lib/workspace-manager.mjs** (200-300 lines)
   - Workspace registry
   - Create/delete/list workspaces
   - Lifecycle coordination
   - Health probes

4. **lib/runtime-bus.mjs** (150-200 lines)
   - Multi-lane event convergence
   - IDE file ops + agent output → merged projection
   - Conflict detection
   - Audit trail emission

**Exercise 1:** Read bridge.mjs, trace a request:
```
User clicks "Save File" in IDE
    ↓
POST /api/workspace/file/write (through bridge @ 3020)
    ↓
Bridge injects headers (workspace_id, session_id)
    ↓
Bridge validates gate (is AI allowed to write?)
    ↓
Bridge forwards to IDE (3010)
    ↓
IDE persists file
    ↓
IDE emits event to runtime-bus
    ↓
Runtime-bus checks for conflicts with agent outputs
    ↓
Audit log entry recorded
```

### Layer 2: The IDE Integration (User Interface)

**Path:** `platform/ide-core/`

**What it does:**
- Browser-based code editor (VSCode-like)
- File operations (open, edit, save)
- Terminal access
- Preview generation
- Plugin system

**Key files to understand:**
- `packages/core/` — IDE runtime
- `packages/plugin/` — Plugin system
- `packages/ext-*.ts` — Language extensions

**You Don't Need to:**
- Modify IDE core (unless fixing VSCode bug)
- Add new IDE features (outside scope, upstreaming to Theia)

**You Should Know:**
- All IDE requests route through shell bridge
- IDE health is probed at `/_/status`
- File operations converge with agent outputs via runtime-bus

**Exercise 2:** Inspect IDE endpoints
```bash
# Terminal 1
export SKYEQUANTA_DEV=1
npm start

# Terminal 2
curl http://localhost:3020/api/runtime/health -H "x-skyequanta-workspace-id: test"
```

### Layer 3: The Agent Integration (AI Engine)

**Path:** `platform/agent-core/`

**What it does:**
- Autonomous code generation
- Multi-turn reasoning
- Tool execution
- Context management

**Key files to understand:**
- `runtime/` — Agent execution
- `config.toml` — OpenHands config (models, tools)
- `poetry.lock` — Python deps

**You Don't Need to:**
- Modify OpenHands core (unless fixing upstream bug)
- Retrain models

**You Should Know:**
- Agent runs at port 3000 (internal)
- Shell bridge (3020) enforces AI gate before agent calls
- Agent context includes shell-injected workspace/session info
- CostBrain tracks token spend

**Exercise 3:** Trace an agent request
```bash
# Terminal 1: Start shell
npm start

# Terminal 2: Trigger agent task
curl -X POST http://localhost:3020/api/agent/generate \
  -H "Content-Type: application/json" \
  -H "x-skyequanta-workspace-id: ws-1" \
  -d '{"prompt": "Write a hello world script"}'
```

### Layer 4: The Gate Runtime (AI Access Control)

**Path:** `apps/skyequanta-shell/lib/gate-runtime-enforcer.mjs`  
**Config:** `config/gate-runtime.json`

**What it does:**
- Enforces AI access policy (offline/local-only/remote-gated)
- Validates against external gate service (if configured)
- Tracks token budget
- Masks secrets in outputs

**Three modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `offline` | AI requests rejected | Testing, air-gapped environments |
| `local-only` | AI runs locally, no external calls | Development, demos |
| `remote-gated` | External gate service controls access | Production (regulatory, cost control) |

**Key files to read:**

1. **gate-runtime-enforcer.mjs** (100-150 lines)
   ```javascript
   // Validates request against rules
   async function validateAgentRequest(request) {
     const { mode } = readGateConfig();
     
     if (mode === 'offline') {
       throw new Error('AI disabled');
     }
     
     if (mode === 'remote-gated') {
       // Call external service
       const gateResponse = await callGateService(request);
       if (!gateResponse.allowed) throw new Error('Gate rejected');
     }
     
     return true;
   }
   ```

2. **redaction-helper.mjs** (80-120 lines)
   - Masks secrets before logging
   - Applies patterns from `config/redaction-policy.json`

**Exercise 4:** Test gate enforcement
```bash
# Check current gate config
cat config/gate-runtime.json

# Switch to offline mode
cp config/gate-runtime.json config/gate-runtime.json.bak
cat > config/gate-runtime.json <<EOF
{"mode": "offline"}
EOF

# Try agent request (should fail)
curl http://localhost:3020/api/agent/generate -X POST \
  -H "x-skyequanta-workspace-id: ws-1" \
  -d '{"prompt": "hello"}'

# Restore
mv config/gate-runtime.json.bak config/gate-runtime.json
```

### Layer 5: Governance & Snapshots

**Path:** `apps/skyequanta-shell/lib/governance-manager.mjs`

**What it does:**
- Creates snapshots (full workspace state at point in time)
- Restores from snapshots (rollback)
- Encrypts/decrypts backup data
- Manages retention policies

**State captured in snapshot:**
- All user files
- IDE session state
- Agent context/decisions
- Runtime logs
- Secrets (encrypted separately)
- Timestamp + signature

**Key files to read:**

1. **governance-manager.mjs** (200-300 lines)
   ```javascript
   async snapshot(workspaceId, label) {
     // Capture full workspace state
     // Encrypt secrets
     // Sign snapshot
     // Store in workspace/retention/
   }
   
   async restore(workspaceId, snapshotId) {
     // Load snapshot
     // Decrypt
     // Verify signature
     // Rewrite files atomically
     // Restart IDE/agent
   }
   ```

**Exercise 5:** Create and restore a snapshot
```bash
# Create workspace with test file
mkdir -p workspace/instances/ws-1
echo "console.log('v1');" > workspace/instances/ws-1/index.js

# Create snapshot (via CLI or programmatically)
./skyequanta governance-manager snapshot --workspace ws-1 --label "v1"

# Modify file
echo "console.log('v2');" > workspace/instances/ws-1/index.js

# Restore snapshot
./skyequanta governance-manager restore --workspace ws-1 --snapshot <id>

# Verify file reverted to v1
cat workspace/instances/ws-1/index.js
```

### Layer 6: Sovereign Provider Vault

**Path:** `apps/skyequanta-shell/lib/provider-vault.mjs`

**What it does:**
- Stores user credentials (AWS, GCP, GitHub, etc.)
- Encrypted at rest (user owns key)
- Unlock-gated (requires explicit unlock before use)
- Workspace bindings (explicit permission to use provider)

**Key concept:** Credentials are NOT stored in vault by founder. User owns the key.

**Exercise 6:** Inspect provider vault code
```bash
# Read vault implementation
cat apps/skyequanta-shell/lib/provider-vault.mjs | head -50
```

### Layer 7: The Proof System

**Path:** `apps/skyequanta-shell/bin/workspace-proof-section*.mjs`  
**Ledger:** `docs/proof/MASTER_PROOF_LEDGER.json`

**What it does:**
- 63 machine-readable tests verify each major feature
- Pass/fail is binary and auditable
- Evidence artifacts (hashes, reports) for procurement

**Proof sections cover:**
- Sections 1-9: Core platform (convergence, IDE, agent, governance, gate)
- Sections 10-20: Deployment and multi-workspace
- Sections 21-45: Hardening and security
- Sections 46-63: Advanced features (memory fabric, replay, council, etc.)

**Key files to read:**

1. **workspace-proof-section1.mjs** (50-100 lines)
   ```javascript
   // Tests that IDE and agent convergence works
   export async function run(opts) {
     const result = await testConvergence();
     if (!result.passed) throw new Error('Convergence failed');
     return { status: 'PASS' };
   }
   ```

2. **MASTER_PROOF_LEDGER.json** (20-30 lines)
   ```json
   {
     "sections": [
       { "section": 1, "name": "Convergence", "status": "PASS" },
       ...
     ]
   }
   ```

**Exercise 7:** Run a single proof
```bash
# Run section 1 (convergence)
node apps/skyequanta-shell/bin/workspace-proof-section1.mjs --json

# Run all proofs (takes 5-10 minutes)
npm run cold-machine:boot -- --json

# View master ledger
cat docs/proof/MASTER_PROOF_LEDGER.json | jq '.sections[] | {section, name, status}'
```

---

## Common Development Tasks

### Task 1: Add a New Shell Service

**Goal:** Create a reusable service (e.g., `my-service.mjs`)

**Steps:**

1. **Create the service:**
   ```javascript
   // apps/skyequanta-shell/lib/my-service.mjs
   export class MyService {
     constructor(shell) {
       this.shell = shell;
     }
     
     async initialize() {
       console.log('MyService initialized');
     }
     
     async doSomething(input) {
       // Business logic
       return { result: input };
     }
   }
   ```

2. **Register with shell:**
   ```javascript
   // apps/skyequanta-shell/bin/launch.mjs
   import { MyService } from '../lib/my-service.mjs';
   
   const myService = new MyService(shell);
   await myService.initialize();
   shell.services.myService = myService;
   ```

3. **Expose via bridge:**
   ```javascript
   // apps/skyequanta-shell/lib/bridge.mjs
   app.post('/api/my-service/do-something', async (req, res) => {
     const result = await this.shell.services.myService.doSomething(req.body);
     res.json(result);
   });
   ```

4. **Test it:**
   ```bash
   curl -X POST http://localhost:3020/api/my-service/do-something \
     -H "Content-Type: application/json" \
     -d '{"input": "test"}'
   ```

### Task 2: Fix a Bug in IDE/Agent Integration

**Scenario:** IDE and agent are conflicting on same file

**Diagnosis:**

1. Check runtime-bus convergence:
   ```bash
   export SKYEQUANTA_DEV=1
   npm start 2>&1 | grep -i convergence
   ```

2. Inspect audit log:
   ```bash
   tail -50 workspace/audit.jsonl | jq '.[] | select(.type=="file-write")'
   ```

3. Check for conflicts:
   ```javascript
   // Look in runtime-bus._conflictLog
   console.log(shell.services.runtimeBus._conflictLog);
   ```

**Fix:**

1. Identify conflict pattern
2. Update conflict resolution in `runtime-bus.mjs`
3. Add proof section to verify fix
4. Run proof: `npm run proofs -- --section XX`

### Task 3: Add a Proof Section

**Goal:** Create a test for a new feature (e.g., Section 64)

**Steps:**

1. **Create executable:**
   ```javascript
   // apps/skyequanta-shell/bin/workspace-proof-section64.mjs
   export async function run(opts) {
     const { shell, setTimeout } = opts;
     
     // Test your feature
     try {
       const result = await shell.services.myNewFeature.test();
       if (!result.success) {
         throw new Error(`Test failed: ${result.error}`);
       }
     } catch (error) {
       return { status: 'FAIL', error: error.message };
     }
     
     return { status: 'PASS', tested: true };
   }
   
   export default { run };
   ```

2. **Create smoke script:**
   ```bash
   #!/bin/bash
   # scripts/smoke-section64-my-feature.sh
   set -e
   
   echo "Testing Section 64: My Feature"
   node apps/skyequanta-shell/bin/workspace-proof-section64.mjs --json
   ```

   ```bash
   chmod +x scripts/smoke-section64-my-feature.sh
   ```

3. **Run proof:**
   ```bash
   bash scripts/smoke-section64-my-feature.sh --json
   ```

4. **Update master ledger:**
   ```javascript
   // In MASTER_PROOF_LEDGER.json, add:
   { "section": 64, "name": "My Feature", "status": "PASS" }
   ```

### Task 4: Debug a Deployment Issue

**Scenario:** Deployment fails at bootstrap

**Steps:**

1. **Run doctor probe:**
   ```bash
   ./skyequanta doctor --mode deploy --verbose --json
   ```

2. **Check logs:**
   ```bash
   export SKYEQUANTA_DEV=1
   npm start 2>&1 | grep ERROR
   ```

3. **Inspect environment:**
   ```bash
   env | grep SKYEQUANTA
   ```

4. **Rebuild dependencies:**
   ```bash
   npm run runtime:prepare -- --force
   ```

5. **Try bootstrap again:**
   ```bash
   npm run cold-machine:boot -- --json
   ```

---

## Architecture Decision Records (ADRs)

### ADR-1: Why Shell is Authority

**Question:** Why not let IDE/agent be peers?

**Answer:** 
- Multi-workspace isolation requires central knowledge (session, workspace, user)
- File conflict resolution needs arbitration point
- Gate runtime enforcement requires central policy
- Audit trail needs single source of truth

**Implication:** Shell is not optional, don't try to bypass it.

### ADR-2: Why Proof Sections Are Executable Code

**Question:** Why not just written test descriptions?

**Answer:**
- Machine-readable, reproducible, auditable
- No ambiguity about what works
- Evidence for procurement and investors
- Regression detection (breaking change caught immediately)

**Implication:** Update proofs when features change, don't let proofs go stale.

### ADR-3: Why Gate Runtime Is Configurable

**Question:** Why not hardcode the AI policy?

**Answer:**
- Dev teams need offline/local-only for testing
- Production needs remote-gated (cost control, regulation)
- Founders may need different policies per customer

**Implication:** Gate config is not a hack, it's a feature. Respect it.

### ADR-4: Why Governance Has Snapshots

**Question:** Why not just version control?

**Answer:**
- Git is too slow for frequent snapshots
- User may not want commit history visible
- Snapshots capture runtime state (IDE session, agent context), not just files
- Rollback must be instant, undo must be safe

**Implication:** Governance snapshots are immutable, use them liberally.

---

## Key Patterns to Use

### Pattern 1: Context Injection

All requests need session context:

```javascript
// Don't do this
const result = await ideService.getFile('index.js');

// Do this
const result = await ideService.getFile('index.js', {
  headers: {
    'x-skyequanta-workspace-id': workspaceId,
    'x-skyequanta-session-id': sessionId,
  }
});
```

### Pattern 2: Convergence

When IDE and agent both affect same resource:

```javascript
// Don't do this (race condition)
await ide.writeFile('index.js', content1);
await agent.writeFile('index.js', content2);

// Do this (converged)
await runtimeBus.emit('file-write', { source: 'ide', file: 'index.js', content: content1 });
await runtimeBus.emit('file-write', { source: 'agent', file: 'index.js', content: content2 });
// runtimeBus handles conflict resolution
```

### Pattern 3: Gate Enforcement

AI requests must check gate:

```javascript
// Don't do this (bypasses gate)
const result = await openai.createCompletion(...);

// Do this (respects gate)
const allowed = await shell.services.gateRuntimeEnforcer.validate(request);
if (!allowed) throw new Error('Gate rejected');
const result = await openai.createCompletion(...);
```

### Pattern 4: Governance Snapshots

Before risky operations, snapshot:

```javascript
// Safe sequence
const snapshotId = await governance.snapshot(workspaceId);
try {
  await performRiskyOperation();
} catch (error) {
  await governance.restore(workspaceId, snapshotId);
  throw error;
}
```

### Pattern 5: Proof Integration

New features must include proofs:

```javascript
// Feature code
export async function myNewFeature() {
  // Implementation
}

// Proof code
export async function proofMyNewFeature() {
  const result = await myNewFeature();
  if (!result.success) throw new Error('Feature failed');
  return { status: 'PASS' };
}
```

---

## Common Mistakes to Avoid

| Mistake | Why It's Wrong | How to Fix |
|---------|----------------|-----------|
| Calling IDE directly (port 3010) | Bypasses auth, convergence, audit | Always go through bridge (3020) |
| Assuming workspace isolation | Multiple workspaces can interfere | Use `x-skyequanta-workspace-id` headers consistently |
| Ignoring gate runtime | AI requests may fail unexpectedly | Always check gate before agent calls |
| Not creating proofs | Changes break silently | Add proof section for every feature |
| Modifying upstream code | Breaks updates, support nightmare | Fork only if upstream won't accept |
| Hardcoding ports | Conflicts in multi-workspace setups | Use env vars (SKYEQUANTA_*_PORT) |
| Skipping snapshots before changes | Data loss on failure | Call governance.snapshot() first |
| Assuming redaction is automatic | Secrets leak in logs | Apply redaction helper explicitly |

---

## Testing Strategy

### Unit Tests (Component-Level)

Test individual services:

```javascript
import { MyService } from '../lib/my-service.mjs';

describe('MyService', () => {
  it('should do something', async () => {
    const service = new MyService({});
    const result = await service.doSomething('input');
    expect(result).toBe('expected');
  });
});
```

**Run:**
```bash
npm run test -- --grep "MyService"
```

### Integration Tests (Proof Sections)

Test features end-to-end:

```javascript
// workspace-proof-section-my-feature.mjs
export async function run(opts) {
  // Setup
  const shell = new ShellService();
  await shell.initialize();
  
  // Test
  const result = await shell.myFeature();
  
  // Assert
  if (!result.success) throw new Error('Failed');
  
  return { status: 'PASS' };
}
```

**Run:**
```bash
node apps/skyequanta-shell/bin/workspace-proof-section-my-feature.mjs --json
```

### Smoke Tests (Deployment-Level)

Test deployment readiness:

```bash
#!/bin/bash
# scripts/smoke-my-feature.sh
set -e

npm start &
PID=$!

sleep 2

# Test
curl http://localhost:3020/api/my-feature

kill $PID
```

**Run:**
```bash
bash scripts/smoke-my-feature.sh --json
```

---

## Resources

### Documentation to Read
- `README.md` — Project overview
- `COMPREHENSIVE_DEEP_SCAN_AI_GUIDE.md` — Deep architecture
- `docs/ARCHITECTURE_OVERVIEW.html` — Visual diagrams
- `docs/IDE_AGENT_CONVERGENCE_CONTRACT.md` — IDE/agent contract
- `docs/CLAIMS_REGISTER.md` — Feature attestation
- `docs/CANONICAL_OPERATOR_SURFACE.md` — User contract

### Code to Explore
- `apps/skyequanta-shell/bin/launch.mjs` — Entry point (good for understanding startup)
- `apps/skyequanta-shell/lib/bridge.mjs` — Authority proxy (core logic)
- `apps/skyequanta-shell/lib/runtime-bus.mjs` — Convergence (how IDE/agent merge)
- `apps/skyequanta-shell/bin/workspace-proof-section1.mjs` — First proof (example)

### Commands to Run
```bash
# See what the shell can do
./skyequanta --help

# Deploy from scratch
./START_HERE.sh

# Check deployment readiness
./skyequanta doctor --mode deploy --json

# Run all proofs
npm run cold-machine:boot -- --json

# Run specific proof
node apps/skyequanta-shell/bin/workspace-proof-section1.mjs --json

# Debug with logs
export SKYEQUANTA_DEV=1
npm start
```

---

## Getting Help

### If Something Breaks

1. **Check logs:**
   ```bash
   export SKYEQUANTA_DEV=1 && npm start 2>&1 | tee debug.log
   ```

2. **Generate support dump:**
   ```bash
   ./skyequanta support-dump --json > support.json
   ```

3. **Review recent changes:**
   ```bash
   git log --oneline -10
   git diff HEAD~1
   ```

4. **Run diagnostics:**
   ```bash
   ./skyequanta doctor --mode deploy --verbose --json
   ```

### If Guidelines Are Unclear

1. **Check ADRs** (Architecture Decision Records above)
2. **Look at existing code** (all patterns are already in use)
3. **Read proofs** (workspace-proof-section*.mjs show working examples)
4. **Check claims register** (`docs/CLAIMS_REGISTER.md` documents features)

---

## Next Steps

**Immediate (Week 1):**
- [ ] Run `./START_HERE.sh` and confirm it works
- [ ] Read `COMPREHENSIVE_DEEP_SCAN_AI_GUIDE.md`
- [ ] Explore `apps/skyequanta-shell/lib/` files
- [ ] Run a proof section: `node apps/skyequanta-shell/bin/workspace-proof-section1.mjs --json`

**Short-term (Week 2):**
- [ ] Add a new shell service (follow Task 1)
- [ ] Create a proof section for it (follow Task 3)
- [ ] Run `npm run cold-machine:boot -- --json` (all proofs)

**Medium-term:**
- [ ] Fix a real bug (follow Task 2)
- [ ] Add feature you need
- [ ] Submit PR with proof and documentation

---

**Welcome to SkyeHands! You're now ready to start contributing.**

For questions, check the resources section or review the code — it's all here.
