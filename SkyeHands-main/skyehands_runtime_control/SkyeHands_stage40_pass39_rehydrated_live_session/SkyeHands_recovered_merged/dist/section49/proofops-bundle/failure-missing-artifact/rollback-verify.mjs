import { computeLabel } from './fixture-project/feature.mjs';
if (computeLabel() !== 'before-proofops') throw new Error('rollback failed');
console.log(JSON.stringify({ ok: true, label: computeLabel() }));
