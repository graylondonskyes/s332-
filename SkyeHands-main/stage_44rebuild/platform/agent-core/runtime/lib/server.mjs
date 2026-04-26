/**
 * OpenHands boundary shim — platform/agent-core/runtime/lib/server.mjs
 * Directive section 3.4
 *
 * STATUS: BOUNDARY SHIM — not a production implementation.
 *
 * This file MUST remain a shim until:
 *   - platform/agent-core/runtime-proof.json shows fullOpenHandsRuntime: true
 *   - All 7 OpenHands proof flags are true (run openhands-smoke.mjs)
 *
 * GrayChunks will block any claim that outruns these proof flags.
 *
 * When fullOpenHandsRuntime: true is proven, this shim should be replaced
 * with a real connector to the running OpenHands Python server.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_FILE = path.resolve(__dirname, '../../runtime-proof.json');

function readProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return {}; }
}

// ─── Shim API surface ─────────────────────────────────────────────────────

export async function getStatus() {
  const proof = readProof();
  return {
    shimStatus: 'boundary-shim',
    fullOpenHandsRuntime: proof.fullOpenHandsRuntime === true,
    proofFlags: {
      packageImportable: proof.packageImportable ?? false,
      serverLaunches: proof.serverLaunches ?? false,
      taskReceived: proof.taskReceived ?? false,
      workspaceFileSeen: proof.workspaceFileSeen ?? false,
      fileEditedOrGenerated: proof.fileEditedOrGenerated ?? false,
      commandOrTestRun: proof.commandOrTestRun ?? false,
      resultReturnedToSkyeHands: proof.resultReturnedToSkyeHands ?? false,
    },
    action: proof.fullOpenHandsRuntime
      ? 'Replace this shim with real OpenHands connector'
      : 'Run platform/agent-core/scripts/openhands-smoke.mjs to prove runtime',
  };
}

export async function sendTask(taskPayload) {
  const proof = readProof();

  if (!proof.fullOpenHandsRuntime) {
    throw new Error(
      '[OpenHands Shim] fullOpenHandsRuntime is not proven. ' +
      'Run openhands-smoke.mjs before sending real tasks. ' +
      `Current proof flags: ${JSON.stringify(proof.proofFlags ?? {})}`
    );
  }

  // When runtime is proven, this shim should be replaced with:
  //   const res = await fetch(`http://localhost:3101/api/task`, { method: 'POST', body: JSON.stringify(taskPayload) });
  //   return res.json();
  throw new Error('[OpenHands Shim] Replace this shim with real HTTP call to OpenHands server at localhost:3101');
}

export async function getWorkspaceFiles(workspaceDir) {
  const proof = readProof();
  if (!proof.fullOpenHandsRuntime) {
    throw new Error('[OpenHands Shim] fullOpenHandsRuntime not proven — cannot list workspace files.');
  }
  throw new Error('[OpenHands Shim] Replace with real OpenHands workspace file listing call.');
}

export default { getStatus, sendTask, getWorkspaceFiles };
