# First-Run Operator Checklist

- Generated: 2026-04-04T13:31:17.361Z
- Workspace: local-default
- Readiness score: 100%
- Bridge: http://127.0.0.1:3020

## Canonical sequence

1. Run `./skyequanta operator:start --workspace local-default --json`.
2. Open [First-run center](http://127.0.0.1:3020/first-run-center?workspaceId=local-default).
3. Open [Stabilize center](http://127.0.0.1:3020/stabilize-center?workspaceId=local-default).
4. Run `./skyequanta operator:stabilize --workspace local-default --json` when the first-run score is below 100%.
5. Finish with `./skyequanta doctor --mode deploy --probe-active --json` before handoff.

## Current recommended actions

- run_doctor

## Cockpit links

- workspace: http://127.0.0.1:3020/workspace-center?workspaceId=local-default
- runtime: http://127.0.0.1:3020/runtime-center?workspaceId=local-default
- gate: http://127.0.0.1:3020/gate-center?workspaceId=local-default
- file: http://127.0.0.1:3020/file-center?workspaceId=local-default
- ops: http://127.0.0.1:3020/ops-center?workspaceId=local-default
- aiPatch: http://127.0.0.1:3020/ai-patch-center?workspaceId=local-default
- preview: http://127.0.0.1:3020/preview-center?workspaceId=local-default
- recovery: http://127.0.0.1:3020/recovery-center?workspaceId=local-default
- guide: http://127.0.0.1:3020/operator-guide?workspaceId=local-default
- firstRun: http://127.0.0.1:3020/first-run-center?workspaceId=local-default
- stabilize: http://127.0.0.1:3020/stabilize-center?workspaceId=local-default
- stabilizationReport: http://127.0.0.1:3020/stabilization-report-center?workspaceId=local-default
- api: http://127.0.0.1:3020/api/workspaces/local-default/cockpit
