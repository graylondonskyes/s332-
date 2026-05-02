#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List

from common import stable_hash

SEVERITY_WEIGHT = {
    'critical': 30,
    'high': 22,
    'medium': 12,
    'low': 6,
}

ISSUE_PLAYBOOK = {
    'missing-readme': {
        'lane': 'documentation',
        'targets': ['README.md'],
        'summary': 'Generate a root README that reflects the detected stack, launch commands, smoke entrypoints, and certification posture.',
    },
    'missing-env-example': {
        'lane': 'secret-surface',
        'targets': ['.env.example'],
        'summary': 'Materialize an environment template from detected env keys so deployers can configure the workspace without reading source.',
    },
    'missing-license': {
        'lane': 'release-surface',
        'targets': ['LICENSE.md'],
        'summary': 'Emit a release-visible license placeholder so the workspace stops shipping without a declared usage posture.',
    },
    'missing-tests': {
        'lane': 'runtime-proof',
        'targets': ['tests/', 'package.json'],
        'summary': 'Generate a smoke-oriented automated test surface and wire it to an executable test command.',
    },
    'missing-start-script': {
        'lane': 'launch-surface',
        'targets': ['package.json'],
        'summary': 'Expose a real launch command in package.json so the scanner and deploy tooling can exercise the runtime directly.',
    },
    'missing-smoke-script': {
        'lane': 'smoke-surface',
        'targets': ['scripts/', 'package.json'],
        'summary': 'Create a smoke command that proves the entry surface or runtime target instead of leaving the workspace advisory-only.',
    },
    'missing-ci': {
        'lane': 'delivery-surface',
        'targets': ['.github/workflows/', 'netlify.toml'],
        'summary': 'Create delivery automation so smoke/test proof can be re-run outside the scanner host.',
    },
    'fake-ui-signals': {
        'lane': 'ui-honesty',
        'targets': ['public/', 'src/'],
        'summary': 'Replace placeholder controls or href="#" surfaces with working routes, disabled states, or honest explanatory flows.',
    },
    'broken-command-targets': {
        'lane': 'command-integrity',
        'targets': ['package.json', 'scripts/'],
        'summary': 'Repair or remove broken script targets so runtime proof stops pointing at missing files.',
    },
    'runtime-proof-gap': {
        'lane': 'proof-hardening',
        'targets': ['scripts/', 'package.json', 'server/'],
        'summary': 'Harden the runtime, smoke, or validation surfaces until the workspace can be executed cleanly.',
    },
    'unclear-entrypoint': {
        'lane': 'surface-discovery',
        'targets': ['package.json', 'server/', 'public/'],
        'summary': 'Declare an explicit runtime entry or static entry surface so the workspace is no longer ambiguous.',
    },
}


def infer_stack_label(report: Dict[str, Any]) -> str:
    frameworks = report.get('frameworks', []) or []
    runtimes = report.get('reconstruction', {}).get('projectClass', {}).get('runtimeFamilies', []) or []
    stack = frameworks + runtimes
    if not stack:
        return 'general software workspace'
    return ', '.join(dict.fromkeys(stack))


def provider_env_detected() -> bool:
    return any(os.environ.get(name) for name in [
        'SKYEHANDS_AI_REPAIR_ENDPOINT',
        'SKYEHANDS_AI_REPAIR_MODEL',
        'OPENAI_API_KEY',
        'OPENAI_TEXT_KEY',
    ])


def classify_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
    play = ISSUE_PLAYBOOK.get(issue.get('issueId'), {
        'lane': 'general-remediation',
        'targets': ['workspace'],
        'summary': issue.get('detail', 'Remediate the detected issue with a source-backed patch.'),
    })
    severity = str(issue.get('severity', 'medium')).lower()
    patchable = bool(issue.get('patchable'))
    weight = SEVERITY_WEIGHT.get(severity, 10)
    confidence = 0.92 if patchable else 0.58
    automation_mode = 'deterministic-patch' if patchable else 'operator-review'
    expected_gain = weight * (1800 if patchable else 950)
    return {
        'issueId': issue.get('issueId'),
        'title': issue.get('title'),
        'severity': severity,
        'patchable': patchable,
        'lane': play['lane'],
        'automationMode': automation_mode,
        'confidence': round(confidence, 2),
        'impactScore': weight,
        'expectedValueGain': expected_gain,
        'targets': play['targets'],
        'strategy': play['summary'],
        'steps': build_steps(issue, play),
    }


def build_steps(issue: Dict[str, Any], play: Dict[str, Any]) -> List[str]:
    detail = re.sub(r'\s+', ' ', str(issue.get('detail', '')).strip())
    steps = [
        f'Inspect the evidence behind {issue.get("issueId")}.',
        play['summary'],
    ]
    if detail:
        steps.append(f'Preserve source honesty while repairing this gap: {detail}')
    if issue.get('patchable'):
        steps.append('Re-scan and compare valuation movement after the patch is applied.')
    else:
        steps.append('Emit a repair brief with exact file targets so a human or model-assisted pass can continue without guesswork.')
    return steps


def build_prompt_envelope(report: Dict[str, Any], plan: List[Dict[str, Any]]) -> Dict[str, Any]:
    prompt_payload = {
        'systemRole': 'You are the SkyeHands repair subsystem. Repair code without changing the platform identity. Only claim what can be proven by smoke.',
        'workspaceLabel': report.get('projectLabel'),
        'workspaceId': report.get('workspaceId'),
        'stack': infer_stack_label(report),
        'issues': [
            {
                'issueId': item['issueId'],
                'title': item['title'],
                'severity': item['severity'],
                'targets': item['targets'],
                'strategy': item['strategy'],
            }
            for item in plan[:12]
        ],
        'constraints': [
            'Do not invent features that the workspace cannot support.',
            'Preserve existing branding and keep UI/client-facing surfaces honest.',
            'Return file-specific patch instructions or patch content only.',
            'Any new claim must be backed by smoke or validation commands.',
        ],
        'providerAdapter': {
            'endpointEnv': 'SKYEHANDS_AI_REPAIR_ENDPOINT',
            'modelEnv': 'SKYEHANDS_AI_REPAIR_MODEL',
            'authEnvCandidates': ['OPENAI_API_KEY', 'OPENAI_TEXT_KEY'],
            'requestMode': 'operator-supplied openai-compatible endpoint',
        },
    }
    return {
        'payload': prompt_payload,
        'payloadHash': stable_hash(prompt_payload),
        'providerEnvDetected': provider_env_detected(),
    }


def build_repair_intelligence(report: Dict[str, Any]) -> Dict[str, Any]:
    issues = report.get('issues', []) or []
    plan = [classify_issue(issue) for issue in issues]
    plan.sort(key=lambda item: (-item['impactScore'], -item['confidence'], item['title'] or ''))

    patchable = [item for item in plan if item['patchable']]
    non_patchable = [item for item in plan if not item['patchable']]
    prompt_envelope = build_prompt_envelope(report, plan)
    runtime_status = report.get('runtimeProof', {}).get('status', 'not-run')
    execution_status = report.get('executionMatrix', {}).get('overallStatus', 'not-run')

    mode = 'provider-ready' if prompt_envelope['providerEnvDetected'] else 'offline-fallback'
    summary = {
        'status': 'active',
        'mode': mode,
        'stackLabel': infer_stack_label(report),
        'issueCount': len(plan),
        'patchableCount': len(patchable),
        'operatorReviewCount': len(non_patchable),
        'runtimeStatus': runtime_status,
        'executionStatus': execution_status,
        'projectedValueGain': int(sum(item['expectedValueGain'] for item in plan)),
        'projectedPatchableValueGain': int(sum(item['expectedValueGain'] for item in patchable)),
        'topPriorityIssueIds': [item['issueId'] for item in plan[:5]],
        'fallbackVerified': True,
        'providerEnvelopeReady': True,
        'providerEnvDetected': prompt_envelope['providerEnvDetected'],
        'promptPayloadHash': prompt_envelope['payloadHash'],
        'repairPlanHash': stable_hash(plan),
        'repairPlan': plan,
        'providerEnvelope': prompt_envelope,
        'notes': [
            'This subsystem ships a provider-ready repair prompt envelope and an offline prioritization fallback.',
            'It does not fabricate patches silently; it emits ranked file targets and strategies that can be executed deterministically or by an operator-approved model pass.',
        ],
    }
    return summary


__all__ = ['build_repair_intelligence']
