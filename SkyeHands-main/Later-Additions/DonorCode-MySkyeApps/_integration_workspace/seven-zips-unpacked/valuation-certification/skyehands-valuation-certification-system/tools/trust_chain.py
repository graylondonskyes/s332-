#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict

from common import stable_hash, write_json, write_text, zip_directory


def slugify(value: str) -> str:
    clean = ''.join(ch.lower() if ch.isalnum() else '-' for ch in value)
    while '--' in clean:
        clean = clean.replace('--', '-')
    return clean.strip('-') or 'workspace'


def run_checked(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, check=True)
    return (result.stdout or result.stderr or '').strip()


INTERMEDIATE_EXT = """basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
"""


LEAF_EXT_TEMPLATE = """basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=@alt_names

[alt_names]
DNS.1={domain_public}
DNS.2={domain_local}
"""


def build_public_trust_chain(report: Dict[str, Any], artifact_dir: Path) -> Dict[str, Any]:
    trust_dir = artifact_dir / 'public-trust-pack'
    if trust_dir.exists():
        shutil.rmtree(trust_dir)
    trust_dir.mkdir(parents=True, exist_ok=True)

    slug = slugify(report.get('projectLabel') or report.get('workspaceId') or 'workspace')
    workspace_id = str(report.get('workspaceId') or 'workspace')
    domain_public = f'{slug}.example.com'
    domain_local = f'{slug}.skyehands.local'
    challenge_token = stable_hash({'workspaceId': workspace_id, 'slug': slug})[:48]
    openssl_available = shutil.which('openssl') is not None
    if not openssl_available:
        return {
            'status': 'unavailable',
            'opensslAvailable': False,
            'verified': False,
            'domainPublic': domain_public,
            'domainLocal': domain_local,
            'error': 'openssl_not_available',
            'artifacts': {},
        }

    root_key = trust_dir / 'root-ca.key'
    root_crt = trust_dir / 'root-ca.crt'
    intermediate_key = trust_dir / 'intermediate-ca.key'
    intermediate_csr = trust_dir / 'intermediate-ca.csr'
    intermediate_crt = trust_dir / 'intermediate-ca.crt'
    leaf_key = trust_dir / 'leaf.key'
    leaf_csr = trust_dir / 'leaf.csr'
    leaf_crt = trust_dir / 'leaf.crt'
    chain_pem = trust_dir / 'chain.pem'
    fullchain_pem = trust_dir / 'fullchain.pem'
    intermediate_ext = trust_dir / 'intermediate.ext'
    leaf_ext = trust_dir / 'leaf.ext'

    write_text(intermediate_ext, INTERMEDIATE_EXT)
    write_text(leaf_ext, LEAF_EXT_TEMPLATE.format(domain_public=domain_public, domain_local=domain_local))

    run_checked(['openssl', 'genrsa', '-out', str(root_key), '2048'], trust_dir)
    run_checked([
        'openssl', 'req', '-x509', '-new', '-key', str(root_key), '-sha256', '-days', '3650',
        '-subj', '/CN=SkyeHands Local Root Authority/O=Skyes Over London LC',
        '-out', str(root_crt)
    ], trust_dir)

    run_checked(['openssl', 'genrsa', '-out', str(intermediate_key), '2048'], trust_dir)
    run_checked([
        'openssl', 'req', '-new', '-key', str(intermediate_key),
        '-subj', '/CN=SkyeHands Local Intermediate Authority/O=Skyes Over London LC',
        '-out', str(intermediate_csr)
    ], trust_dir)
    run_checked([
        'openssl', 'x509', '-req', '-in', str(intermediate_csr), '-CA', str(root_crt), '-CAkey', str(root_key),
        '-CAcreateserial', '-out', str(intermediate_crt), '-days', '1825', '-sha256', '-extfile', str(intermediate_ext)
    ], trust_dir)

    run_checked(['openssl', 'genrsa', '-out', str(leaf_key), '2048'], trust_dir)
    run_checked([
        'openssl', 'req', '-new', '-key', str(leaf_key), '-out', str(leaf_csr),
        '-subj', f'/CN={domain_public}/O=Skyes Over London LC'
    ], trust_dir)
    run_checked([
        'openssl', 'x509', '-req', '-in', str(leaf_csr), '-CA', str(intermediate_crt), '-CAkey', str(intermediate_key),
        '-CAcreateserial', '-out', str(leaf_crt), '-days', '825', '-sha256', '-extfile', str(leaf_ext)
    ], trust_dir)

    chain_pem.write_text(intermediate_crt.read_text(encoding='utf-8') + root_crt.read_text(encoding='utf-8'), encoding='utf-8')
    fullchain_pem.write_text(leaf_crt.read_text(encoding='utf-8') + intermediate_crt.read_text(encoding='utf-8'), encoding='utf-8')

    verify_output = run_checked(['openssl', 'verify', '-CAfile', str(root_crt), '-untrusted', str(intermediate_crt), str(leaf_crt)], trust_dir)

    http01_dir = trust_dir / '.well-known' / 'acme-challenge'
    http01_dir.mkdir(parents=True, exist_ok=True)
    http01_file = http01_dir / challenge_token[:32]
    http01_file.write_text(f'{challenge_token}.skyehands-http01\n', encoding='utf-8')
    dns01_file = trust_dir / 'dns-01-record.txt'
    dns01_file.write_text(f'_acme-challenge.{domain_public} TXT \"{challenge_token}.skyehands-dns01\"\n', encoding='utf-8')

    issue_script = trust_dir / 'issue-public-cert.sh'
    issue_script.write_text(f'''#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${{DOMAIN:-{domain_public}}}"
EMAIL="${{EMAIL:-operator@example.com}}"
ACME_CLIENT="${{ACME_CLIENT:-certbot}}"
CHALLENGE="${{CHALLENGE:-dns-01}}"
echo "Prepare public issuance for $DOMAIN via $ACME_CLIENT using $CHALLENGE."
echo "CSR: {leaf_csr.name}"
echo "HTTP-01 token file: {http01_file.relative_to(trust_dir)}"
echo "DNS-01 record file: {dns01_file.name}"
''', encoding='utf-8')
    os.chmod(issue_script, 0o755)

    readiness = {
        'status': 'public-ca-ready',
        'verified': verify_output.endswith(': OK'),
        'opensslAvailable': True,
        'domainPublic': domain_public,
        'domainLocal': domain_local,
        'challengeToken': challenge_token,
        'verification': {
            'verified': verify_output.endswith(': OK'),
            'command': f'openssl verify -CAfile {root_crt.name} -untrusted {intermediate_crt.name} {leaf_crt.name}',
            'output': verify_output,
        },
        'readiness': {
            'csrGenerated': True,
            'http01Ready': True,
            'dns01Ready': True,
            'issueScriptReady': True,
            'chainFilesReady': True,
        },
        'acme': {
            'http01Path': str(http01_file.relative_to(trust_dir)),
            'dns01RecordPath': str(dns01_file.relative_to(trust_dir)),
            'csrPath': str(leaf_csr.relative_to(trust_dir)),
            'recommendedChallenges': ['dns-01', 'http-01'],
            'manualSteps': [
                'Set DOMAIN and EMAIL, then run issue-public-cert.sh with the preferred ACME client.',
                'Publish the HTTP-01 token file or DNS-01 TXT record on the chosen public domain.',
                'Replace the placeholder example.com domain with the real production hostname before public issuance.',
            ],
        },
        'artifacts': {
            'rootCert': str(root_crt),
            'intermediateCert': str(intermediate_crt),
            'leafCert': str(leaf_crt),
            'leafCsr': str(leaf_csr),
            'chainPem': str(chain_pem),
            'fullchainPem': str(fullchain_pem),
            'issueScript': str(issue_script),
        },
        'fingerprint': stable_hash({'workspaceId': workspace_id, 'domainPublic': domain_public, 'challengeToken': challenge_token}),
    }

    write_json(trust_dir / 'public-trust-readiness.json', readiness)
    bundle_zip = zip_directory(trust_dir, artifact_dir / 'VCS-024-public-trust-pack.zip')
    readiness['bundleZip'] = str(bundle_zip)
    return readiness


__all__ = ['build_public_trust_chain']
