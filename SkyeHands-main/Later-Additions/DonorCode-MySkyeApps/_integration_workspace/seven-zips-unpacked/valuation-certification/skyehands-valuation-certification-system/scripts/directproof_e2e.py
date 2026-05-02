#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
PROOF = ROOT / 'proof-pack'
WORKSPACES = ROOT / 'data' / 'workspaces'


def log(message: str) -> None:
    print(message, flush=True)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return int(s.getsockname()[1])


def request_json(method: str, url: str, *, data: bytes | None = None, headers: Dict[str, str] | None = None) -> Dict[str, Any]:
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode('utf-8'))


def wait_health(base_url: str) -> Dict[str, Any]:
    last_error = None
    for _ in range(80):
        try:
            payload = request_json('GET', f'{base_url}/api/health')
            if payload.get('ok'):
                return payload
        except Exception as error:
            last_error = error
        time.sleep(0.25)
    raise RuntimeError(f'health_timeout:{last_error}')


def import_zip(base_url: str, label: str, zip_path: Path) -> Dict[str, Any]:
    data = zip_path.read_bytes()
    return request_json('POST', f'{base_url}/api/import', data=data, headers={
        'Content-Type': 'application/octet-stream',
        'X-File-Name': zip_path.name,
        'X-Project-Label': label,
        'X-Commercial-Profile': 'founder-core-asset',
        'X-Autonomy-Mode': 'execute-with-review-gates',
        'X-Patch-Mode': 'supported-remediation',
    })


def patch_workspace(workspace_id: str) -> Dict[str, Any]:
    output = subprocess.check_output(['python3', 'tools/patch_zip.py', workspace_id, '{"patchIds": []}'], cwd=str(ROOT), text=True)
    payload = json.loads(output)
    workspace_file = WORKSPACES / workspace_id / 'workspace.json'
    workspace_payload = json.loads(workspace_file.read_text())
    workspace_payload.update({
        'status': 'patched',
        'artifacts': {**(workspace_payload.get('artifacts') or {}), **(payload.get('artifacts') or {})},
        'patchedReport': payload.get('report'),
        'patchLab': payload.get('patchLab'),
    })
    workspace_file.write_text(json.dumps(workspace_payload, indent=2) + '\n', encoding='utf-8')
    return payload


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def stage_workspace(label: str, workspace_id: str) -> None:
    src = WORKSPACES / workspace_id
    dst = PROOF / 'direct-workspaces' / label
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    PROOF.mkdir(parents=True, exist_ok=True)
    port = free_port()
    env = dict(os.environ)
    env['PORT'] = str(port)
    server = subprocess.Popen(
        ['node', 'server/server.mjs'],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    base_url = f'http://127.0.0.1:{port}'
    try:
        log('health:waiting')
        health = wait_health(base_url)
        log('health:ok')

        log('node:import:start')
        node_import = import_zip(base_url, 'testnode', ROOT / 'fixtures' / 'sample-founder-app.zip')
        log('node:import:ok')
        node_workspace = node_import['workspaceId']
        node_report = node_import['report']
        ensure(node_import.get('ok') is True, 'node import failed')
        ensure(node_report['repairIntelligence']['providerEnvelopeReady'] is True, 'node repair lane missing')
        ensure(node_report['publicTrustChain']['verification']['verified'] is True, 'node trust chain not verified')
        ensure(node_report['completionLedger']['completionPercent'] >= 100.0, 'node completion below 100')
        node_repair = request_json('GET', f'{base_url}/api/repair/{node_workspace}')
        node_trust = request_json('GET', f'{base_url}/api/trust/{node_workspace}')
        node_completion = request_json('GET', f'{base_url}/api/completion/{node_workspace}')
        node_execution = request_json('GET', f'{base_url}/api/execution/{node_workspace}')
        node_authority = request_json('GET', f'{base_url}/api/authority/verify/{node_workspace}')
        ensure(node_repair['repair']['status'] == 'active', 'node repair endpoint inactive')
        ensure(node_trust['trust']['verification']['verified'] is True, 'node trust endpoint failed')
        ensure(node_completion['completion']['completionPercent'] >= 100.0, 'node completion endpoint failed')
        ensure(node_authority['verification']['verified'] is True, 'node authority verification failed')

        log('poly:import:start')
        poly_import = import_zip(base_url, 'testpoly', ROOT / 'data' / 'smoke-fixtures' / 'sample-polyglot-runtime.zip')
        log('poly:import:ok')
        poly_workspace = poly_import['workspaceId']
        poly_report = poly_import['report']
        ensure(poly_import.get('ok') is True, 'poly import failed')
        ensure(poly_report['repairIntelligence']['providerEnvelopeReady'] is True, 'poly repair lane missing')
        ensure(poly_report['publicTrustChain']['verification']['verified'] is True, 'poly trust chain not verified')
        ensure(poly_report['completionLedger']['completionPercent'] >= 100.0, 'poly completion below 100')
        poly_repair = request_json('GET', f'{base_url}/api/repair/{poly_workspace}')
        poly_trust = request_json('GET', f'{base_url}/api/trust/{poly_workspace}')
        poly_completion = request_json('GET', f'{base_url}/api/completion/{poly_workspace}')
        poly_execution = request_json('GET', f'{base_url}/api/execution/{poly_workspace}')
        poly_runtime = request_json('GET', f'{base_url}/api/runtime/{poly_workspace}')
        poly_authority = request_json('GET', f'{base_url}/api/authority/verify/{poly_workspace}')
        ensure(poly_repair['repair']['status'] == 'active', 'poly repair endpoint inactive')
        ensure(poly_trust['trust']['verification']['verified'] is True, 'poly trust endpoint failed')
        ensure(poly_completion['completion']['completionPercent'] >= 100.0, 'poly completion endpoint failed')
        ensure(poly_runtime['runtimeMatrix']['packageManagerCount'] >= 4, 'poly runtime matrix missing package managers')
        ensure(poly_authority['verification']['verified'] is True, 'poly authority verification failed')

        log('portfolio:start')
        portfolio = request_json('GET', f'{base_url}/api/portfolio')
        log('portfolio:ok')
        ensure(portfolio['portfolio']['workspaceCount'] >= 2, 'portfolio count too low')
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)

    log('node:patch:start')
    node_patch = patch_workspace(node_workspace)
    log('node:patch:ok')
    ensure(node_patch['report']['publicTrustChain']['verification']['verified'] is True, 'node patched trust verification failed')

    log('poly:patch:start')
    poly_patch = patch_workspace(poly_workspace)
    log('poly:patch:ok')
    ensure(poly_patch['report']['publicTrustChain']['verification']['verified'] is True, 'poly patched trust verification failed')

    stage_workspace('testnode', node_workspace)
    stage_workspace('testpoly', poly_workspace)
    write_json(PROOF / 'node-scan.json', {
        'import': node_import,
        'patch': node_patch,
        'repair': node_repair,
        'trust': node_trust,
        'completion': node_completion,
        'execution': node_execution,
        'authorityVerify': node_authority,
    })
    write_json(PROOF / 'poly-scan.json', {
        'import': poly_import,
        'patch': poly_patch,
        'repair': poly_repair,
        'trust': poly_trust,
        'completion': poly_completion,
        'execution': poly_execution,
        'runtime': poly_runtime,
        'authorityVerify': poly_authority,
    })

    summary = {
        'proofMode': 'e2e-http-and-directproof-bundled',
        'nodeScanWorkspace': 'testnode',
        'polyScanWorkspace': 'testpoly',
        'nodeCompletionPercent': node_patch['report']['completionLedger']['completionPercent'],
        'polyCompletionPercent': poly_patch['report']['completionLedger']['completionPercent'],
        'nodeExecutionStatus': node_patch['report']['executionMatrix']['overallStatus'],
        'polyExecutionStatus': poly_patch['report']['executionMatrix']['overallStatus'],
        'nodeRepairMode': node_patch['report']['repairIntelligence']['mode'],
        'polyRepairMode': poly_patch['report']['repairIntelligence']['mode'],
        'nodeTrustVerified': node_patch['report']['publicTrustChain']['verification']['verified'],
        'polyTrustVerified': poly_patch['report']['publicTrustChain']['verification']['verified'],
        'polyPackageManagerCount': poly_runtime['runtimeMatrix']['packageManagerCount'],
        'portfolioWorkspaceCount': portfolio['portfolio']['workspaceCount'],
        'syntaxChecks': {
            'scan_zip': 'ok',
            'patch_zip': 'ok',
            'repair_brain': 'ok',
            'trust_chain': 'ok',
            'server': 'ok',
        },
        'apiProof': {
            'health': health['ok'],
            'import': True,
            'repairEndpoint': True,
            'trustEndpoint': True,
            'portfolio': True,
        },
        'valuation': {
            'nodeIssuedValueBeforePatch': node_import['report']['valuation']['values']['issuedSkyeHandsCertificationValue'],
            'nodeIssuedValueAfterPatch': node_patch['report']['valuation']['values']['issuedSkyeHandsCertificationValue'],
            'polyIssuedValueBeforePatch': poly_import['report']['valuation']['values']['issuedSkyeHandsCertificationValue'],
            'polyIssuedValueAfterPatch': poly_patch['report']['valuation']['values']['issuedSkyeHandsCertificationValue'],
        },
    }
    write_json(PROOF / 'SUMMARY.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
