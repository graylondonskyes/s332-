import { computeLabel, computeMode } from './fixture-project/feature.mjs';
if (computeLabel() !== 'after-proofops') throw new Error('label regression');
if (computeMode() !== 'verified') throw new Error('mode regression');
console.log(JSON.stringify({ ok: true, label: computeLabel(), mode: computeMode() }));
