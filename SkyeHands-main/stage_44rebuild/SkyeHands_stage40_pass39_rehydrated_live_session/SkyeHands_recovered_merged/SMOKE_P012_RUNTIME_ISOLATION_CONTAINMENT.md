# P012 Smoke Proof — Runtime Isolation & Containment Controls

Generated: 2026-04-16T06:38:01.402Z
Checks: 3
Failed Checks: 0
Status: PASS

## Checks
- PASS | runtime isolation policy enforces strict process-lane containment mode
- PASS | runtime egress hook blocks local/private outbound targets
- PASS | tenant isolation blocks cross-tenant access and revoked sessions immediately lose access

## Summary JSON
```json
{
  "pass": true,
  "checks": [
    {
      "pass": true,
      "label": "runtime isolation policy enforces strict process-lane containment mode",
      "detail": {
        "workspaceId": "p012-evidence",
        "requestedMode": "process",
        "mode": "process",
        "strict": true,
        "supported": true,
        "uid": null,
        "gid": null,
        "recursiveChown": true,
        "sandboxPaths": [],
        "prepared": false,
        "preparedAt": null
      }
    },
    {
      "pass": true,
      "label": "runtime egress hook blocks local/private outbound targets",
      "detail": {
        "code": 1,
        "text": "/workspace/SkyeHands/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/apps/skyequanta-shell/lib/runtime-egress-hook.cjs:37\n  if (policy.blockPrivateNetworks && (isLocal(normalized) || isPrivateIpv4(normalized) || isBlockedIpv6(normalized))) throw new Error(`runtime_egress_blocked: private/local target '${normalized}' is blocked`);\n                                                                                                                      ^\n\nError: runtime_egress_blocked: private/local target '127.0.0.1' is blocked\n    at assertAllowed (/workspace/SkyeHands/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/apps/skyequanta-shell/lib/runtime-egress-hook.cjs:37:125)\n    at patchedFetch (/workspace/SkyeHands/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/apps/skyequanta-shell/lib/runtime-egress-hook.cjs:70:5)\n    at [eval]:1:1\n    at runScriptInThisContext (node:internal/vm:209:10)\n    at node:internal/process/execution:446:12\n    at [eval]-wrapper:6:24\n    at runScriptInContext (node:internal/process/execution:444:60)\n    at evalFunction (node:internal/process/execution:279:30)\n    at evalTypeScript (node:internal/process/execution:291:3)\n    at node:internal/main/eval_string:74:3\n\nNode.js v22.21.1"
      }
    },
    {
      "pass": true,
      "label": "tenant isolation blocks cross-tenant access and revoked sessions immediately lose access",
      "detail": {
        "matrixStatus": 200,
        "crossTenantStatus": 401,
        "revokeStatus": 200,
        "afterRevokeStatus": 401
      }
    }
  ]
}
```
