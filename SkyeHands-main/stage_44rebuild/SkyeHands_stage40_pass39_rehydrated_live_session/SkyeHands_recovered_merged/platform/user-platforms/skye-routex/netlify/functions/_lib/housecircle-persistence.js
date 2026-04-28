const { saveOrgState, clean, compact, nowISO, pushEvent } = require('./housecircle-cloud-store');
const { mirrorOrgStateToNeon, readNeonConfig } = require('./housecircle-neon-store');
const { boolEnv } = require('./housecircle-runtime-guard');

function persistencePolicy(){
  const neon = readNeonConfig();
  const requireNeonPrimary = boolEnv('PHC_REQUIRE_NEON_PRIMARY');
  const autoMirror = boolEnv('PHC_NEON_AUTOMIRROR') || requireNeonPrimary;
  const strictMirror = boolEnv('PHC_STRICT_NEON_MIRROR') || requireNeonPrimary;
  return {
    mode: requireNeonPrimary ? 'neon-primary-required-no-local-fallback' : (autoMirror ? 'file-primary-neon-automirror' : 'file-primary-local'),
    requireNeonPrimary,
    autoMirror,
    strictMirror,
    neonConfigured: !!neon.configured,
    neonMode: neon.mode,
    generatedAt: nowISO()
  };
}
function strictError(message, extra){ const err = new Error(message); err.persistence = extra || {}; return err; }
async function persistOrgState(orgId, state, meta){
  meta = meta || {};
  const safeOrg = clean(orgId || (state && state.orgId) || 'default-org') || 'default-org';
  const policy = persistencePolicy();
  let saved = null;
  let mirror = { ok:false, skipped:true, reason:'PHC_NEON_AUTOMIRROR is not enabled.', policy };

  // Production/strict Neon mode must fail BEFORE a local JSON write when the primary store is absent.
  if(policy.requireNeonPrimary){
    if(!policy.neonConfigured){
      throw strictError('Neon primary is required and no NEON_DATABASE_URL / DATABASE_URL is configured. Local fallback write was blocked.', { saved:false, mirror:{ ok:false, configured:false }, policy });
    }
    mirror = await mirrorOrgStateToNeon(safeOrg, state, { sourceLane:compact(meta.sourceLane || 'v83-neon-primary'), eventKind:compact(meta.eventKind || 'state_persist'), note:compact(meta.note || 'V83 Neon-primary save.') });
    if(!mirror.ok){
      throw strictError(mirror.reason || mirror.error || 'Strict Neon primary persistence failed before local write.', { saved:false, mirror, policy });
    }
    saved = saveOrgState(safeOrg, state);
    try{ pushEvent(saved, { kind:'persistence_policy', note:'State persisted under V83 Neon-primary policy.', detail:{ mode:policy.mode, mirrorOk:true, eventKind:meta.eventKind || 'state_persist' } }); saveOrgState(safeOrg, saved); }catch(_){ }
    return { ok:true, saved, mirror, policy };
  }

  saved = saveOrgState(safeOrg, state);
  if(policy.autoMirror){
    if(!policy.neonConfigured){ mirror = { ok:false, configured:false, skipped:false, reason:'Neon mirror requested but no NEON_DATABASE_URL / DATABASE_URL is configured.', policy }; }
    else { mirror = await mirrorOrgStateToNeon(safeOrg, saved, { sourceLane:compact(meta.sourceLane || 'v83-file-mirror'), eventKind:compact(meta.eventKind || 'state_persist'), note:compact(meta.note || 'V83 file-primary save mirrored to Neon.') }); }
    if(policy.strictMirror && !mirror.ok){ throw strictError(mirror.reason || mirror.error || 'Strict Neon mirror failed.', { saved, mirror, policy }); }
  }
  try{ pushEvent(saved, { kind:'persistence_policy', note:'State persisted under V83 persistence policy.', detail:{ mode:policy.mode, mirrorOk:!!mirror.ok, mirrorSkipped:!!mirror.skipped, eventKind:meta.eventKind || 'state_persist' } }); saveOrgState(safeOrg, saved); }catch(_){ }
  return { ok:true, saved, mirror, policy };
}
module.exports = { persistencePolicy, persistOrgState };
