# SkyeHands Codebase Forensics & Recovery Plan

## Current State: FRAGMENTATION

### What We Have (Dynasty Versions for Reference):
1. **SkyeHands_3_1_9_unpacked** (27,658 files)
   - v3.1.9 Full working snapshot
   - Contains: complete platform, scripts, configs, docs
   - Root has `/work/` folder with full codebase

2. **SkyeRoutexFlow_v78_unpacked** (486 files)
   - SkyeRoutexFlow platform v78
   - Contains: AE-Flow, routing logic, whiteglove services
   - Sample of specialized platform components

3. **SkyeHandsunf** (28,430 files)
   - stage40_pass35_evidence_closure_source
   - Current/recent state snapshot
   - Located at: `./SkyeHands-main_stage40_pass35_evidence_closure_source/`

### What's MISSING at Root Level:
- ❌ No `/platform/` directory at root
- ❌ No `/scripts/` at root
- ❌ No `/docs/` at root (except guides)
- ❌ No root-level `package.json`
- ❌ No entry points defined
- ❌ No cohesive build configuration

### The Problem:
The active codebase is buried inside unpacked archives instead of being at the filesystem root. This breaks:
- Build processes (can't find package.json)
- Import paths (code expects /platform not /SkyeHandsunf/SkyeHands-.../platform)
- CI/CD pipelines
- Runtime initialization

## Recovery Strategy

### Phase 1: Analyze & Compare
- [ ] Extract key metrics from each version
- [ ] Identify which version is most "complete"
- [ ] Check for file differences (what changed, what broke)
- [ ] Find common stable patterns

### Phase 2: Consolidate
- [ ] Choose best-working version as baseline
- [ ] Move core structure to root level
- [ ] Establish correct directory hierarchy
- [ ] Restore entry points and configs

### Phase 3: Validate & Repair
- [ ] Check all imports/references are correct
- [ ] Verify package.json dependencies resolve
- [ ] Validate build scripts execute
- [ ] Run smoke tests

### Phase 4: Rebuild State
- [ ] Commit consolidated codebase
- [ ] Update git history
- [ ] Document the recovery

## Critical Files to Restore (From Forensics)
- package.json
- platform/ (all modules)
- scripts/ (automation)
- docs/ (directives)
- .devcontainer/ (dev setup)
- .skyequanta/ (state/config)

---
Ready to execute recovery. Which version should we use as the baseline?
