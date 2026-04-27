const fs = require('fs');
const { defaultRuntimeState, saveRuntimeState, loadRuntimeState, resolveJournalPath, appendAuditEvent, replayJournal } = require('../platform/runtime-state');
const { repoPath, fail, ok } = require('./lib');

const statePath = repoPath('artifacts','production-lanes','journal-test-state.json');
fs.rmSync(statePath, { force:true });
fs.rmSync(resolveJournalPath(statePath), { force:true });
let state = defaultRuntimeState();
state = appendAuditEvent(state, { type:'journal-test', ok:true });
state.payments.reconciliations.push({ session_id:'cs_test_123', finalized:true });
saveRuntimeState(statePath, state);
const journalPath = resolveJournalPath(statePath);
if (!fs.existsSync(journalPath)) fail('[runtime-state-journal] FAIL :: missing-journal');
fs.rmSync(statePath, { force:true });
const recovered = loadRuntimeState(statePath);
if (!recovered.audit.length || !recovered.payments.reconciliations.length) fail('[runtime-state-journal] FAIL :: recover');
const replayed = replayJournal(statePath);
if (!replayed.audit.length) fail('[runtime-state-journal] FAIL :: replay');
ok('[runtime-state-journal] PASS');
