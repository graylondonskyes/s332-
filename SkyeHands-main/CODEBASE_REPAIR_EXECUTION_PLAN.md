# SKYEHANDS CODEBASE REPAIR — CORRECTED EXECUTION PLAN

**Status:** Ready to execute
**Date:** April 25, 2026 (corrected — previous plan was based on wrong analysis)
**Target:** Integrate SkyeRoutex + missing runtime files into stage_44rebuild canonical app

---

## CONTEXT: WHAT WAS WRONG BEFORE

The previous execution plan had 7 phases including copying apps/, branding/, config/, workspace/, and src/ from Dynasty-Versions. **That plan was wrong.** All of those directories already exist in:

```
stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/
```

This path IS the canonical app root (declared in `stage_44rebuild/skyehands.repo.config.json`).

The only substantive work is:
1. Integrate SkyeRoutex (genuinely missing — 486 files)
2. Add workspace/ runtime templates
3. Add src/runtime.js
4. Optionally integrate root orchestration scripts

---

## CANONICAL APP ROOT PATH

For brevity, all commands below use:
```bash
CANONICAL="stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged"
DYNASTY="Dynasty-Versions"
```

Working from `/home/user/SkyeHands` (repo root).

---

## PRE-EXECUTION CHECKLIST

```bash
# 1. Verify canonical root exists
ls $CANONICAL/apps/skye-reader-hardened/       # Should exist
ls $CANONICAL/platform/user-platforms/          # Should have 5 entries
ls $CANONICAL/scripts/ | wc -l                  # Should be ~223

# 2. Verify SkyeRoutex source exists
ls "$DYNASTY/SkyeRoutexFlow_v78_unpacked/SkyeRoutexFlow_v69_PLATFORM_HOUSE_CIRCLE_NEON_ENTERPRISE_BACKUP_LANE/"

# 3. Check git status
git status

# 4. Create backup branch (optional)
git stash   # if any uncommitted changes
```

---

## PHASE 1: INTEGRATE SKYEROUTEX PLATFORM

**Objective:** Add SkyeRoutex routing/dispatch/payments platform to build
**Time:** ~5 minutes
**Risk:** Low (new files, no conflicts)

### Steps:

```bash
# 1. Copy SkyeRoutex as a top-level sibling platform (recommended)
#    Rationale: SkyeRoutex is its own complete platform, not an app subsystem

ROUTEX_SRC="$DYNASTY/SkyeRoutexFlow_v78_unpacked/SkyeRoutexFlow_v69_PLATFORM_HOUSE_CIRCLE_NEON_ENTERPRISE_BACKUP_LANE"

cp -r "$ROUTEX_SRC" "$CANONICAL/SkyeRoutex-v78"

# 2. Verify the copy
ls "$CANONICAL/SkyeRoutex-v78/"
# Expected: AE-FLOW/, SkyeRoutex/, AuditReadyConsole-main/, NEW-SHIT2/,
#           WHITE_GLOVE_V39-V63/, skyesol-whiteglove-*/, extra-shit/

# 3. Check key components are there
ls "$CANONICAL/SkyeRoutex-v78/AE-FLOW/AE-Flow/"
ls "$CANONICAL/SkyeRoutex-v78/SkyeRoutex/netlify/functions/" | wc -l   # Should be ~33
ls "$CANONICAL/SkyeRoutex-v78/skyesol-whiteglove-bookings/"
ls "$CANONICAL/SkyeRoutex-v78/SkyeRoutex/WHITE_GLOVE_V78/"

# 4. Verify file count
find "$CANONICAL/SkyeRoutex-v78" -type f | wc -l   # Should be ~486
```

### Validation:
- ✅ AE-FLOW PWA app present
- ✅ SkyeRoutex netlify functions present (33 phc-* functions)
- ✅ skyesol-whiteglove services present (bookings, dispatch, memberships, payments, sync)
- ✅ WHITE_GLOVE versions V39-V78 all present
- ✅ AuditReadyConsole application present

---

## PHASE 2: ADD workspace/ RUNTIME TEMPLATES

**Objective:** Add workspace prebuild, secrets, and volume configs
**Time:** ~2 minutes
**Risk:** Low (runtime templates, not code)

```bash
# Copy workspace templates (excludes node_modules/state — these are templates)
cp -r "$DYNASTY/workspace/" "$CANONICAL/workspace/"

# Verify
ls "$CANONICAL/workspace/"
# Expected: prebuilds/, secrets/, volumes/

ls "$CANONICAL/workspace/prebuilds/"
# Expected: local-default/, remote-default/, preview-stage8/, pass38-fallback-*/
```

---

## PHASE 3: ADD src/runtime.js

**Objective:** Add core source runtime file
**Time:** <1 minute
**Risk:** None

```bash
mkdir -p "$CANONICAL/src"
cp "$DYNASTY/src/runtime.js" "$CANONICAL/src/runtime.js"

# Verify
ls "$CANONICAL/src/"   # Should show runtime.js
```

---

## PHASE 4 (OPTIONAL): REVIEW ROOT ORCHESTRATION FILES

**Do this step only after reviewing the content — do NOT blindly copy.**

```bash
# Check if recovered_merged already has a Makefile (it does)
cat "$CANONICAL/Makefile" | head -20

# Compare with Dynasty-Versions Makefile
diff "$CANONICAL/Makefile" "$DYNASTY/Makefile" || true

# If Dynasty skyequanta.mjs is needed:
if [ ! -f "$CANONICAL/skyequanta.mjs" ]; then
  cp "$DYNASTY/skyequanta.mjs" "$CANONICAL/skyequanta.mjs"
fi
```

---

## PHASE 5: VERIFY PRESERVED PLATFORMS

Verify GrayChunks and all existing platforms are intact after the additions.

```bash
# GrayChunks
ls "$CANONICAL/scripts/graychunks-core.mjs"
ls "$CANONICAL/graychunks.config.json"
ls "$CANONICAL/skydexia/alerts/graychunks-findings.json"

# AE Command Hub
ls "$CANONICAL/platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/"

# Codex platforms
ls "$CANONICAL/platform/user-platforms/skyehands-codex-real-platform/"

# Autonomous agent lane
ls "$CANONICAL/.skyequanta/autonomous-maintenance/"
ls "$CANONICAL/.skyequanta/autonomy-gradient/"
```

---

## FINAL VALIDATION

```bash
# 1. Confirm SkyeRoutex is integrated
find "$CANONICAL/SkyeRoutex-v78" -type f | wc -l   # ~486

# 2. Confirm all platforms accessible
for platform in ae-autonomous-store-system-maggies \
                skye-account-executive-commandhub-s0l26-0s \
                skyehands-codex-competitor \
                skyehands-codex-control-plane \
                skyehands-codex-real-platform; do
  if [ -d "$CANONICAL/platform/user-platforms/$platform" ]; then
    echo "✓ $platform"
  else
    echo "✗ $platform MISSING"
  fi
done

# 3. Script count
ls "$CANONICAL/scripts/" | wc -l      # Should be 223+

# 4. Subsystem count
ls "$CANONICAL/.skyequanta/" | wc -l  # Should be 19+

# 5. Full repo file count
find stage_44rebuild -type f | wc -l  # Should be ~32,000+ after SkyeRoutex added
```

### Success Criteria:
- [ ] SkyeRoutex at `$CANONICAL/SkyeRoutex-v78/` with ~486 files
- [ ] workspace/ templates present
- [ ] src/runtime.js present
- [ ] All 5 user-platforms present
- [ ] GrayChunks scripts intact
- [ ] 223+ scripts in canonical scripts/
- [ ] No existing platform overwritten

---

## GIT COMMIT & PUSH

```bash
cd /home/user/SkyeHands

# Stage only the new additions
git add "$CANONICAL/SkyeRoutex-v78/"
git add "$CANONICAL/workspace/" 2>/dev/null || true
git add "$CANONICAL/src/" 2>/dev/null || true

# Check what's staged
git diff --cached --stat

# Commit
git commit -m "Integrate SkyeRoutex platform + workspace templates + src/runtime.js

ADDITIONS:
- SkyeRoutex-v78 platform (486 files):
  * AE-FLOW PWA application
  * SkyeRoutex netlify functions (33 phc-* functions)
  * skyesol-whiteglove services (bookings/dispatch/memberships/payments/sync)
  * WHITE_GLOVE versions V39-V78
  * AuditReadyConsole application
- workspace/ runtime templates (prebuilds, secrets, volumes)
- src/runtime.js core source file

PRESERVED:
- GrayChunks platform (scripts/graychunks-*.mjs)
- All 5 platform/user-platforms
- 19 .skyequanta subsystems
- 223 scripts suite"

# Push
git push -u origin claude/repair-codebase-Wur41
```

---

## ROLLBACK

If something goes wrong:

```bash
# Remove the additions
rm -rf "$CANONICAL/SkyeRoutex-v78"
rm -rf "$CANONICAL/workspace"
rm -f "$CANONICAL/src/runtime.js"

# Reset git state
git checkout -- .
```

---

## WHAT THIS PLAN DOES NOT DO

The old plan included copying apps/, branding/, config/, src/, workspace/ from Dynasty-Versions into stage_44rebuild. **This is NOT needed and NOT done** because:

1. Those directories already exist at the canonical app root
2. Dynasty-Versions versions of those files are OLDER than what's in stage_44rebuild
3. Copying them would OVERWRITE newer code with older code

---

## NOTES ON DYNASTY-VERSIONS REFERENCE ARCHIVES

Dynasty-Versions contains three older unpacked builds (`SkyeHands_3_1_9_unpacked`, `SkyeHandsunf`, `SkyeHands_stage40_pass41_unpacked`). These are reference archives only. **Do not merge them into stage_44rebuild.** The recovered_merged build is newer than all three.
