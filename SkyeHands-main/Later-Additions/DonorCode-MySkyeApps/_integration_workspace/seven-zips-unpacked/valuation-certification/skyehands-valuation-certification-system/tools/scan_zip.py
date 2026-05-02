#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import shlex
import socket
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    import tomllib  # py311+
except Exception:  # pragma: no cover
    tomllib = None

from common import (
    detect_env_vars,
    format_money,
    language_summary,
    load_integration_ledger,
    load_weights,
    read_json,
    read_text_safe,
    safe_extract_zip,
    sha256_file,
    stable_hash,
    write_json,
    write_text,
    workspace_paths,
)
from repair_brain import build_repair_intelligence
from trust_chain import build_public_trust_chain

FRAMEWORK_KEYWORDS = {
    'react': ['react', 'next', 'vite'],
    'vue': ['vue', 'nuxt'],
    'svelte': ['svelte', '@sveltejs'],
    'express': ['express'],
    'fastapi': ['fastapi'],
    'flask': ['flask'],
    'django': ['django'],
    'cloudflare-worker': ['wrangler', 'workers-types'],
    'netlify': ['netlify'],
    'electron': ['electron'],
    'tauri': ['tauri'],
}

ENTERPRISE_MARKERS = {
    'saml': [r'\bsaml\b', r'assertion consumer', r'acs'],
    'scim': [r'\bscim\b', r'provisioning'],
    'rbac': [r'\brbac\b', r'permission', r'role', r'tenant'],
    'audit': [r'\baudit\b', r'attestation', r'evidence'],
    'exports': [r'csv', r'json export', r'pdf', r'download'],
    'admin': [r'admin', r'dashboard'],
    'ci': [r'github actions', r'workflow', r'ci/cd', r'pipeline'],
}

BUTTON_RE = re.compile(r'<button\b[^>]*>(.*?)</button>', re.IGNORECASE | re.DOTALL)
ROUTE_RE = re.compile(r'\b(?:app\.(?:get|post|put|delete)|router\.(?:get|post|put|delete)|@app\.route|@router\.(?:get|post)|href=|path=|route\(|createBrowserRouter|Route\()\b', re.IGNORECASE)
AI_RE = re.compile(r'\b(openai|anthropic|claude|gpt|prompt|embedding|vector|retrieval|agent)\b', re.IGNORECASE)
BRAND_RE = re.compile(r'\b(skye|kaixu|sovereign|quanta|obsidian|sentinel)\b', re.IGNORECASE)
TEST_FILE_RE = re.compile(r'(test|spec)\.(js|mjs|cjs|ts|tsx|jsx|py)$', re.IGNORECASE)
COMMAND_TARGET_RE = [
    re.compile(r'^(node)\s+([^\s].+)$'),
    re.compile(r'^(python3?|py)\s+([^\s].+)$'),
    re.compile(r'^(bash|sh)\s+([^\s].+)$'),
]


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def normalize_path(value: str | Path) -> str:
    return str(value).replace('\\', '/').replace('./', '').strip('/')


def resolve_project_root(extracted_root: Path) -> Path:
    entries = [entry for entry in extracted_root.iterdir() if entry.name != '__MACOSX']
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return extracted_root


def load_package_json(root: Path) -> Dict[str, Any]:
    return read_json(root / 'package.json', {}) or {}


def load_pyproject(root: Path) -> Dict[str, Any]:
    pyproject = root / 'pyproject.toml'
    if not pyproject.exists() or tomllib is None:
        return {}
    try:
        return tomllib.loads(pyproject.read_text(encoding='utf-8'))
    except Exception:
        return {}


def parse_requirements(root: Path) -> List[str]:
    packages: List[str] = []
    for rel in ('requirements.txt', 'requirements-dev.txt'):
        candidate = root / rel
        if not candidate.exists():
            continue
        for raw_line in candidate.read_text(encoding='utf-8', errors='ignore').splitlines():
            line = raw_line.split('#', 1)[0].strip()
            if not line or line.startswith(('-', '--')):
                continue
            name = re.split(r'[<>=!~\[]', line, maxsplit=1)[0].strip()
            if name:
                packages.append(name)
    return sorted(set(packages))


def collect_descriptors(root: Path) -> Dict[str, Any]:
    descriptor_names = [
        'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
        'pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'Pipfile', 'poetry.lock',
        'bun.lockb', 'bun.lock', 'Makefile',
        'netlify.toml', 'wrangler.toml', 'vercel.json', 'Dockerfile',
        'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml',
        'README.md', '.env.example', '.env.sample', 'LICENSE', 'LICENSE.md',
        '.github/workflows', 'public/index.html', 'index.html', 'server.mjs', 'server.js', 'app.py', 'main.py'
    ]
    found = []
    for name in descriptor_names:
        candidate = root / name
        if candidate.exists():
            found.append(normalize_path(candidate.relative_to(root)))
    lockfiles = [item for item in found if item in {'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock'}]
    return {
        'found': found,
        'lockfiles': lockfiles,
        'descriptorCount': len(found),
        'hasDocker': any(item.lower().startswith('docker') or item == 'compose.yaml' for item in found),
        'hasGitHubActions': '.github/workflows' in found,
    }


def summarize_frameworks(root: Path, package_json: Dict[str, Any], pyproject: Dict[str, Any]) -> List[str]:
    deps = set()
    deps.update((package_json.get('dependencies') or {}).keys())
    deps.update((package_json.get('devDependencies') or {}).keys())
    poetry_deps = ((pyproject.get('tool') or {}).get('poetry') or {}).get('dependencies') or {}
    deps.update(poetry_deps.keys())
    frameworks = []
    dep_blob = ' '.join(sorted(deps)).lower()
    for framework, keywords in FRAMEWORK_KEYWORDS.items():
        if any(keyword.lower() in dep_blob for keyword in keywords):
            frameworks.append(framework)
    if (root / 'netlify.toml').exists() and 'netlify' not in frameworks:
        frameworks.append('netlify')
    if (root / 'wrangler.toml').exists() and 'cloudflare-worker' not in frameworks:
        frameworks.append('cloudflare-worker')
    if (root / 'Dockerfile').exists() and 'docker' not in frameworks:
        frameworks.append('docker')
    return sorted(set(frameworks))


def detect_docs(root: Path) -> Dict[str, Any]:
    ci_files = []
    for rel in ['.github/workflows', 'netlify.toml', 'wrangler.toml', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml']:
        if (root / rel).exists():
            ci_files.append(rel)
    docs_dir = root / 'docs'
    runbook_candidates = ['README.md', 'docs/deploy.md', 'docs/runbook.md', 'docs/smoke.md']
    runbooks = []
    for rel in runbook_candidates:
        p = root / rel
        if p.exists():
            text = read_text_safe(p)
            runbooks.append({
                'path': rel,
                'excerpt': re.sub(r'\s+', ' ', text).strip()[:220],
            })
    env_templates = []
    for rel in ['.env.example', '.env.sample', 'config/env.example', 'config/env-templates/dev.env.example']:
        p = root / rel
        if p.exists():
            env_templates.append(rel)
    return {
        'readme': (root / 'README.md').exists(),
        'docsDir': docs_dir.exists(),
        'license': (root / 'LICENSE').exists() or (root / 'LICENSE.md').exists(),
        'envExample': bool(env_templates),
        'envTemplates': env_templates,
        'ciFiles': ci_files,
        'runbooks': runbooks,
    }


def resolve_command_target(command: str, root: Path) -> Dict[str, Any]:
    raw = command.strip()
    for pattern in COMMAND_TARGET_RE:
        match = pattern.match(raw)
        if not match:
            continue
        runtime = match.group(1)
        rest = match.group(2).strip().split()[0].strip('"\'')
        target_path = (root / rest).resolve()
        return {
            'runtime': runtime,
            'target': rest,
            'targetExists': target_path.exists(),
            'targetAbsolutePath': str(target_path),
        }
    return {
        'runtime': None,
        'target': None,
        'targetExists': None,
        'targetAbsolutePath': None,
    }


def detect_bootstrap_commands(root: Path, package_json: Dict[str, Any]) -> Dict[str, str]:
    commands: Dict[str, str] = {}
    scripts = package_json.get('scripts', {}) or {}
    for key in ('start', 'dev', 'build', 'test', 'lint', 'smoke', 'validate'):
        if key in scripts:
            commands[key] = str(scripts[key])
    if 'start' not in commands:
        for candidate in ['server.mjs', 'server.js', 'app.py', 'main.py']:
            if (root / candidate).exists():
                commands['start'] = f"{'python3' if candidate.endswith('.py') else 'node'} {candidate}"
                break
    if 'preview' not in commands and ((root / 'index.html').exists() or (root / 'public' / 'index.html').exists()):
        commands['preview'] = 'open index.html'
    return commands


def detect_launch_profiles(root: Path, package_json: Dict[str, Any], commands: Dict[str, str]) -> Dict[str, Any]:
    profiles: List[Dict[str, Any]] = []
    smoke_profiles: List[Dict[str, Any]] = []
    scripts = package_json.get('scripts', {}) or {}
    for name, command in scripts.items():
        resolved = resolve_command_target(str(command), root)
        profile = {
            'profileId': name,
            'type': 'npm-script',
            'command': str(command),
            **resolved,
        }
        if name in {'start', 'dev', 'preview', 'build'}:
            profiles.append(profile)
        if name in {'smoke', 'test', 'validate'}:
            smoke_profiles.append(profile)
    if not profiles:
        for name, command in commands.items():
            if name not in {'start', 'dev', 'preview', 'build'}:
                continue
            resolved = resolve_command_target(str(command), root)
            profiles.append({
                'profileId': name,
                'type': 'inferred',
                'command': str(command),
                **resolved,
            })
    static_entry = 'public/index.html' if (root / 'public' / 'index.html').exists() else 'index.html' if (root / 'index.html').exists() else None
    if static_entry:
        profiles.append({
            'profileId': 'static-html',
            'type': 'static-surface',
            'command': f'open {static_entry}',
            'runtime': 'static',
            'target': static_entry,
            'targetExists': True,
            'targetAbsolutePath': str((root / static_entry).resolve()),
        })
        smoke_profiles.append({
            'profileId': 'static-html-check',
            'type': 'static-check',
            'command': f'check {static_entry}',
            'runtime': 'static',
            'target': static_entry,
            'targetExists': True,
            'targetAbsolutePath': str((root / static_entry).resolve()),
        })
    return {
        'launchProfiles': profiles,
        'smokeProfiles': smoke_profiles,
    }


def detect_integrations(root: Path, ledger: Dict[str, Any], package_json: Dict[str, Any], pyproject: Dict[str, Any], descriptors: Dict[str, Any]) -> Dict[str, Any]:
    provider_defs = ledger.get('providers', {})
    hits: Dict[str, Dict[str, Any]] = {}
    all_env_vars: List[str] = []
    package_blob = json.dumps(package_json).lower()
    poetry_blob = json.dumps(pyproject).lower()
    descriptor_blob = ' '.join(descriptors.get('found', [])).lower()

    for provider, definition in provider_defs.items():
        hits[provider] = {
            'provider': provider,
            'files': [],
            'keywordHits': 0,
            'envHits': [],
            'manifestHits': 0,
            'descriptorHits': 0,
            'estimatedDepth': 'none',
            'baseValue': definition.get('baseValue', 0),
            'notes': definition.get('notes', ''),
        }

    for file_path in root.rglob('*'):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(root).as_posix()
        text = read_text_safe(file_path)
        lowered = text.lower()
        env_vars = detect_env_vars(text)
        all_env_vars.extend(env_vars)
        for provider, definition in provider_defs.items():
            keywords = [item.lower() for item in definition.get('keywords', [])]
            file_hits = sum(lowered.count(keyword) for keyword in keywords)
            if file_hits:
                hits[provider]['keywordHits'] += file_hits
                hits[provider]['files'].append(rel)
            env_hits = [var for var in env_vars if any(keyword.upper().replace('-', '_') in var for keyword in definition.get('keywords', []))]
            if env_hits:
                hits[provider]['envHits'].extend(env_hits)

    for provider, definition in provider_defs.items():
        keywords = [item.lower() for item in definition.get('keywords', [])]
        hits[provider]['manifestHits'] = sum(package_blob.count(keyword) + poetry_blob.count(keyword) for keyword in keywords)
        hits[provider]['descriptorHits'] = sum(descriptor_blob.count(keyword) for keyword in keywords)

    result: Dict[str, Any] = {}
    for provider, payload in hits.items():
        unique_files = sorted(set(payload['files']))
        keyword_hits = int(payload['keywordHits'])
        manifest_hits = int(payload['manifestHits'])
        descriptor_hits = int(payload['descriptorHits'])
        total_hits = keyword_hits + manifest_hits + descriptor_hits
        if total_hits <= 0 and not unique_files and not payload['envHits']:
            continue
        file_count = len(unique_files)
        depth_score = total_hits + file_count + len(set(payload['envHits']))
        depth = 'hookup'
        if depth_score >= 10:
            depth = 'working'
        if depth_score >= 20:
            depth = 'production-safe'
        if depth_score >= 34:
            depth = 'enterprise-grade'
        payload.update({
            'files': unique_files,
            'fileCount': file_count,
            'envHits': sorted(set(payload['envHits'])),
            'estimatedDepth': depth,
            'depthScore': depth_score,
        })
        result[provider] = payload

    return {
        'providers': result,
        'allEnvVars': sorted(set(all_env_vars)),
    }


def detect_enterprise_signals(root: Path) -> Dict[str, Any]:
    counters: Dict[str, int] = {}
    files: Dict[str, List[str]] = {}
    for marker in ENTERPRISE_MARKERS:
        counters[marker] = 0
        files[marker] = []
    for file_path in root.rglob('*'):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(root).as_posix()
        text = read_text_safe(file_path).lower()
        for marker, patterns in ENTERPRISE_MARKERS.items():
            if any(re.search(pattern, text) for pattern in patterns):
                counters[marker] += 1
                files[marker].append(rel)
    return {
        'counts': {k: v for k, v in counters.items() if v > 0},
        'files': {k: sorted(set(v)) for k, v in files.items() if v},
    }


def detect_routes_and_controls(root: Path) -> Dict[str, Any]:
    route_signal_count = 0
    button_count = 0
    fake_ui_signals: List[Dict[str, Any]] = []
    route_files: List[str] = []
    for file_path in root.rglob('*'):
        if not file_path.is_file():
            continue
        text = read_text_safe(file_path)
        rel = file_path.relative_to(root).as_posix()
        if ROUTE_RE.search(text):
            route_signal_count += len(ROUTE_RE.findall(text))
            route_files.append(rel)
        buttons = BUTTON_RE.findall(text)
        button_count += len(buttons)
        if 'href="#"' in text or 'javascript:void(0)' in text.lower():
            fake_ui_signals.append({
                'path': rel,
                'signal': 'placeholder-navigation',
            })
    return {
        'routeSignalCount': route_signal_count,
        'routeFiles': sorted(set(route_files))[:100],
        'buttonCount': button_count,
        'fakeUiSignals': fake_ui_signals,
    }


def detect_tests(root: Path, package_json: Dict[str, Any]) -> Dict[str, Any]:
    test_files = []
    for file_path in root.rglob('*'):
        if file_path.is_file() and TEST_FILE_RE.search(file_path.name):
            test_files.append(file_path.relative_to(root).as_posix())
    package_scripts = package_json.get('scripts', {}) or {}
    return {
        'files': sorted(test_files),
        'count': len(test_files),
        'hasPackageTestScript': 'test' in package_scripts,
        'hasPackageSmokeScript': 'smoke' in package_scripts,
    }


def detect_brand_ip(root: Path) -> Dict[str, Any]:
    brand_hits = 0
    ai_hits = 0
    proprietary_modules = []
    workflow_hits = 0
    for file_path in root.rglob('*'):
        if not file_path.is_file():
            continue
        text = read_text_safe(file_path)
        rel = file_path.relative_to(root).as_posix()
        brand_hits += len(BRAND_RE.findall(text))
        ai_hits += len(AI_RE.findall(text))
        workflow_hits += len(re.findall(r'\b(workflow|pipeline|orchestrat|command center|proof|valuation|audit|mesh|foundry)\b', text.lower()))
        if any(token in rel.lower() for token in ['kaixu', 'skye', 'sovereign', 'quanta', 'valuation', 'audit', 'mesh', 'foundry']):
            proprietary_modules.append(rel)
    return {
        'brandHits': brand_hits,
        'aiHits': ai_hits,
        'workflowHits': workflow_hits,
        'proprietaryModuleCount': len(sorted(set(proprietary_modules))),
        'proprietaryModules': sorted(set(proprietary_modules))[:100],
    }


def collect_services(root: Path, frameworks: List[str], integrations: Dict[str, Any]) -> List[Dict[str, Any]]:
    services = []
    if (root / 'public' / 'index.html').exists() or (root / 'index.html').exists():
        services.append({'serviceId': 'web-surface', 'type': 'web', 'confidence': 'confirmed'})
    if any(item in frameworks for item in ['express', 'fastapi', 'flask', 'django']):
        services.append({'serviceId': 'app-runtime', 'type': 'application-runtime', 'confidence': 'confirmed'})
    if 'cloudflare' in integrations['providers']:
        services.append({'serviceId': 'edge-runtime', 'type': 'edge-runtime', 'confidence': 'inferred'})
    if 'neon' in integrations['providers'] or 'rbac' in integrations['providers']:
        services.append({'serviceId': 'database', 'type': 'database', 'confidence': 'inferred'})
    return services


def dependency_graph(root: Path, package_json: Dict[str, Any], pyproject: Dict[str, Any]) -> Dict[str, Any]:
    deps = sorted((package_json.get('dependencies') or {}).keys())
    dev_deps = sorted((package_json.get('devDependencies') or {}).keys())
    py_deps = []
    poetry_deps = ((pyproject.get('tool') or {}).get('poetry') or {}).get('dependencies') or {}
    for name in poetry_deps:
        if name != 'python':
            py_deps.append(name)
    requirement_deps = parse_requirements(root)
    all_python = sorted(set(py_deps + requirement_deps))
    return {
        'dependencies': deps,
        'devDependencies': dev_deps,
        'pythonDependencies': all_python,
        'pythonDependencySources': {
            'poetry': sorted(set(py_deps)),
            'requirements': requirement_deps,
        },
        'dependencyCount': len(deps),
        'devDependencyCount': len(dev_deps),
        'pythonDependencyCount': len(all_python),
    }


def classify_project(root: Path, package_json: Dict[str, Any], pyproject: Dict[str, Any], frameworks: List[str]) -> Dict[str, Any]:
    package_scripts = package_json.get('scripts', {}) or {}
    runtime_families: List[str] = []
    if package_json or (root / 'server.mjs').exists() or (root / 'server.js').exists():
        runtime_families.append('node')
    if pyproject or (root / 'app.py').exists() or (root / 'main.py').exists() or (root / 'requirements.txt').exists():
        runtime_families.append('python')
    if (root / 'public' / 'index.html').exists() or (root / 'index.html').exists():
        runtime_families.append('static')
    if any(root.rglob('*.sh')):
        runtime_families.append('bash')
    primary = runtime_families[0] if runtime_families else 'static'
    return {
        'hasPackageJson': bool(package_json),
        'hasPyproject': bool(pyproject),
        'packageScriptCount': len(package_scripts),
        'primaryRuntime': primary,
        'runtimeFamilies': sorted(set(runtime_families)),
        'frameworkCount': len(frameworks),
    }


def run_command(command: List[str], cwd: Path, timeout: int = 12) -> Tuple[int, str, str]:
    env = dict(os.environ)
    env.setdefault('CI', '1')
    env.setdefault('PORT', '4318')
    env.setdefault('HOST', '127.0.0.1')
    proc = subprocess.run(command, cwd=str(cwd), capture_output=True, text=True, timeout=timeout, env=env)
    return proc.returncode, proc.stdout[:4000], proc.stderr[:4000]


def syntax_check(runtime: str | None, target: Path, cwd: Path) -> Dict[str, Any]:
    if runtime in {'node'} and target.exists():
        code, stdout, stderr = run_command(['node', '--check', str(target)], cwd)
        return {'kind': 'syntax-check', 'command': f'node --check {target.name}', 'exitCode': code, 'passed': code == 0, 'stdout': stdout, 'stderr': stderr}
    if runtime in {'python', 'python3', 'py'} and target.exists():
        code, stdout, stderr = run_command(['python3', '-m', 'py_compile', str(target)], cwd)
        return {'kind': 'syntax-check', 'command': f'python3 -m py_compile {target.name}', 'exitCode': code, 'passed': code == 0, 'stdout': stdout, 'stderr': stderr}
    if runtime in {'bash', 'sh'} and target.exists():
        code, stdout, stderr = run_command(['bash', '-n', str(target)], cwd)
        return {'kind': 'syntax-check', 'command': f'bash -n {target.name}', 'exitCode': code, 'passed': code == 0, 'stdout': stdout, 'stderr': stderr}
    return {'kind': 'syntax-check', 'command': None, 'exitCode': None, 'passed': False, 'stdout': '', 'stderr': 'unsupported or missing target'}




def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('127.0.0.1', 0))
        return int(sock.getsockname()[1])


def http_probe(base_url: str, paths: List[str]) -> Dict[str, Any]:
    results = []
    ok = False
    for route in paths:
        url = f"{base_url}{route}"
        try:
            with urllib.request.urlopen(url, timeout=2.5) as response:  # nosec - local probe
                body = response.read(500).decode('utf-8', errors='ignore')
                results.append({
                    'url': url,
                    'status': response.status,
                    'ok': 200 <= response.status < 400,
                    'body': body,
                })
                ok = ok or (200 <= response.status < 400)
        except urllib.error.HTTPError as error:
            body = error.read(500).decode('utf-8', errors='ignore') if hasattr(error, 'read') else ''
            results.append({'url': url, 'status': error.code, 'ok': False, 'body': body})
        except Exception as error:
            results.append({'url': url, 'status': None, 'ok': False, 'body': str(error)})
    return {'ok': ok, 'requests': results}


def launch_probe(root: Path, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    runtime = profile.get('runtime')
    target = profile.get('target')
    if runtime not in {'node', 'python', 'python3', 'py'} or not target:
        return None
    target_path = root / str(target)
    if not target_path.exists():
        return None
    port = find_free_port()
    cmd = ['node', str(target_path)] if runtime == 'node' else ['python3', str(target_path)]
    env = dict(os.environ)
    env.setdefault('CI', '1')
    env['PORT'] = str(port)
    env['HOST'] = '127.0.0.1'
    proc = subprocess.Popen(cmd, cwd=str(root), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    try:
        for _ in range(18):
            time.sleep(0.25)
            if proc.poll() is not None:
                break
        probe = http_probe(f'http://127.0.0.1:{port}', ['/health', '/', '/api/health'])
        running = proc.poll() is None
        if running:
            proc.terminate()
            try:
                stdout, stderr = proc.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                stdout, stderr = proc.communicate(timeout=2)
        else:
            stdout, stderr = proc.communicate(timeout=2)
        return {
            'kind': 'launch-probe',
            'profileId': profile.get('profileId'),
            'command': ' '.join(cmd),
            'passed': bool(probe['ok']),
            'running': running,
            'exitCode': proc.returncode,
            'port': port,
            'httpProbe': probe,
            'stdout': (stdout or '')[:4000],
            'stderr': (stderr or '')[:4000],
        }
    except Exception as error:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=2)
        return {
            'kind': 'launch-probe',
            'profileId': profile.get('profileId'),
            'command': ' '.join(cmd),
            'passed': False,
            'running': False,
            'exitCode': proc.returncode,
            'port': port,
            'httpProbe': {'ok': False, 'requests': []},
            'stdout': '',
            'stderr': str(error),
        }



def safe_split_command(command: str) -> List[str]:
    try:
        return shlex.split(command)
    except Exception:
        return []


def static_surface_check(root: Path, profile: Dict[str, Any]) -> Dict[str, Any]:
    target = str(profile.get('target') or '')
    entry = root / target
    text = read_text_safe(entry)
    title_match = re.search(r'<title>(.*?)</title>', text, re.IGNORECASE | re.DOTALL)
    has_doctype = '<!doctype' in text.lower()
    passed = bool(title_match or has_doctype)
    return {
        'slot': profile.get('profileId'),
        'runtime': 'static',
        'strategy': 'static-check',
        'command': str(profile.get('command') or f'check {target}'),
        'passed': passed,
        'exitCode': 0 if passed else 1,
        'stdout': title_match.group(1).strip() if title_match else '',
        'stderr': '' if passed else 'missing title/doctype proof',
        'target': target,
    }


def execution_command_spec(root: Path, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    slot = str(profile.get('profileId') or '')
    runtime = normalize_runtime_family(profile.get('runtime'))
    raw = str(profile.get('command') or '').strip()

    if profile.get('type') in {'static-surface', 'static-check'}:
        return {'slot': slot, 'runtime': 'static', 'strategy': 'static-check', 'displayCommand': raw or f'check {profile.get("target")}', 'commandList': None}

    if runtime in {'node', 'python', 'bash'} and profile.get('target') and profile.get('targetExists'):
        executable = {'node': 'node', 'python': 'python3', 'bash': 'bash'}[runtime]
        target = str(profile['target'])
        if slot in {'start', 'dev', 'preview', 'serve'}:
            return {'slot': slot, 'runtime': runtime, 'strategy': 'launch-probe', 'displayCommand': f'{executable} {target}', 'commandList': None}
        return {'slot': slot, 'runtime': runtime, 'strategy': 'direct-command', 'displayCommand': f'{executable} {target}', 'commandList': [executable, target]}

    parts = safe_split_command(raw)
    if not parts:
        return None

    executable = parts[0]
    if executable == 'node' and len(parts) >= 2 and parts[1] == '--test':
        return {'slot': slot, 'runtime': 'node', 'strategy': 'direct-command', 'displayCommand': ' '.join(parts), 'commandList': parts}

    if executable in {'python', 'python3'} and len(parts) >= 3 and parts[1] == '-m' and parts[2] == 'pytest':
        normalized = ['python3', *parts[1:]]
        return {'slot': slot, 'runtime': 'python', 'strategy': 'direct-command', 'displayCommand': ' '.join(normalized), 'commandList': normalized}

    if executable in {'node', 'python', 'python3', 'bash', 'sh'} and len(parts) >= 2 and parts[1] not in {'--test', '-m'} and not parts[1].startswith('-'):
        candidate = root / parts[1]
        if candidate.exists():
            target = str(candidate.resolve().relative_to(root.resolve()))
            normalized_exe = 'node' if executable == 'node' else 'python3' if executable in {'python', 'python3'} else 'bash'
            command_list = [normalized_exe, target, *parts[2:]]
            normalized_runtime = normalize_runtime_family('python' if normalized_exe == 'python3' else 'bash' if normalized_exe == 'bash' else 'node')
            if slot in {'start', 'dev', 'preview', 'serve'}:
                return {'slot': slot, 'runtime': normalized_runtime, 'strategy': 'launch-probe', 'displayCommand': ' '.join(command_list), 'commandList': None}
            return {'slot': slot, 'runtime': normalized_runtime, 'strategy': 'direct-command', 'displayCommand': ' '.join(command_list), 'commandList': command_list}

    return None


def execute_profile_command(root: Path, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    spec = execution_command_spec(root, profile)
    if not spec:
        return None
    if spec['strategy'] == 'static-check':
        return static_surface_check(root, profile)
    if spec['strategy'] == 'launch-probe':
        probe = launch_probe(root, profile)
        if probe is None:
            return None
        probe.update({
            'slot': spec['slot'],
            'runtime': spec['runtime'],
            'strategy': spec['strategy'],
        })
        return probe
    try:
        timeout = 18 if spec['slot'] in {'test', 'validate'} else 12
        code, stdout, stderr = run_command(spec['commandList'], root, timeout=timeout)
        return {
            'slot': spec['slot'],
            'runtime': spec['runtime'],
            'strategy': spec['strategy'],
            'command': spec['displayCommand'],
            'passed': code == 0,
            'exitCode': code,
            'stdout': stdout,
            'stderr': stderr,
        }
    except subprocess.TimeoutExpired:
        return {
            'slot': spec['slot'],
            'runtime': spec['runtime'],
            'strategy': spec['strategy'],
            'command': spec['displayCommand'],
            'passed': False,
            'exitCode': None,
            'stdout': '',
            'stderr': 'command timed out',
        }


def build_execution_matrix(root: Path, launch_data: Dict[str, Any], commands: Dict[str, str]) -> Dict[str, Any]:
    ordered_slots = ['start', 'dev', 'preview', 'smoke', 'test', 'validate', 'static-html', 'static-html-check']
    profile_map: Dict[str, Dict[str, Any]] = {}

    for profile in launch_data.get('launchProfiles', []) + launch_data.get('smokeProfiles', []):
        slot = str(profile.get('profileId') or '')
        if slot and slot not in profile_map:
            profile_map[slot] = profile

    for slot in ['start', 'dev', 'preview', 'smoke', 'test', 'validate']:
        if slot in profile_map or slot not in commands:
            continue
        resolved = resolve_command_target(str(commands[slot]), root)
        profile_map[slot] = {
            'profileId': slot,
            'type': 'inferred-command',
            'command': str(commands[slot]),
            **resolved,
        }

    entries: List[Dict[str, Any]] = []
    unsupported_slots: List[str] = []
    for slot in ordered_slots:
        profile = profile_map.get(slot)
        if not profile:
            continue
        result = execute_profile_command(root, profile)
        if result is None:
            unsupported_slots.append(slot)
            continue
        entries.append(result)

    executed_count = len(entries)
    passed_count = len([entry for entry in entries if entry.get('passed')])
    failed_count = executed_count - passed_count
    start_surface_passed = any(entry.get('slot') in {'start', 'dev', 'preview', 'static-html'} and entry.get('passed') for entry in entries)
    proof_lane_passed = any(entry.get('slot') in {'smoke', 'test', 'validate', 'static-html-check'} and entry.get('passed') for entry in entries)
    proven_slots = sorted({str(entry.get('slot')) for entry in entries if entry.get('passed')})
    supported_slots = [slot for slot in ordered_slots if slot in profile_map]
    fully_proven = bool(start_surface_passed and proof_lane_passed and supported_slots and failed_count == 0)

    overall_status = 'not-run'
    if executed_count:
        overall_status = 'fully-proven' if fully_proven else 'partial' if passed_count else 'failed'

    return {
        'overallStatus': overall_status,
        'executedCommandCount': executed_count,
        'passedCommandCount': passed_count,
        'failedCommandCount': failed_count,
        'supportedSlotCount': len(supported_slots),
        'supportedSlots': supported_slots,
        'provenSlots': proven_slots,
        'unsupportedSlots': unsupported_slots,
        'startSurfacePassed': start_surface_passed,
        'proofLanePassed': proof_lane_passed,
        'fullyProven': fully_proven,
        'entries': entries[:80],
    }

def normalize_runtime_family(runtime: str | None) -> str | None:
    if runtime in {'python3', 'py'}:
        return 'python'
    if runtime in {'sh'}:
        return 'bash'
    return runtime


def detect_runtime_matrix(root: Path, descriptors: Dict[str, Any], package_json: Dict[str, Any], pyproject: Dict[str, Any], launch_data: Dict[str, Any], runtime_proof: Dict[str, Any], dep_graph: Dict[str, Any], project_class: Dict[str, Any]) -> Dict[str, Any]:
    descriptor_set = set(descriptors.get('found', []))
    manager_matrix: List[Dict[str, Any]] = []

    def push_manager(manager: str, runtime: str, descriptor_files: List[str], install_ready: bool, direct_ready: bool, dependency_count: int) -> None:
        manager_matrix.append({
            'manager': manager,
            'runtime': runtime,
            'descriptorFiles': descriptor_files,
            'installReady': install_ready,
            'directReady': direct_ready,
            'dependencyCount': dependency_count,
        })

    if package_json:
        push_manager('npm', 'node', [p for p in ['package.json', 'package-lock.json'] if p in descriptor_set], 'package-lock.json' in descriptor_set or 'package.json' in descriptor_set, True, dep_graph.get('dependencyCount', 0) + dep_graph.get('devDependencyCount', 0))
    if 'pnpm-lock.yaml' in descriptor_set:
        push_manager('pnpm', 'node', ['package.json', 'pnpm-lock.yaml'], True, True, dep_graph.get('dependencyCount', 0) + dep_graph.get('devDependencyCount', 0))
    if 'yarn.lock' in descriptor_set:
        push_manager('yarn', 'node', ['package.json', 'yarn.lock'], True, True, dep_graph.get('dependencyCount', 0) + dep_graph.get('devDependencyCount', 0))
    if 'bun.lockb' in descriptor_set or 'bun.lock' in descriptor_set:
        push_manager('bun', 'node', [p for p in ['package.json', 'bun.lockb', 'bun.lock'] if p in descriptor_set], True, True, dep_graph.get('dependencyCount', 0) + dep_graph.get('devDependencyCount', 0))

    if dep_graph.get('pythonDependencyCount', 0) or pyproject or (root / 'app.py').exists() or (root / 'main.py').exists():
        req_files = [p for p in ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'Pipfile'] if p in descriptor_set]
        push_manager('pip', 'python', req_files or ['requirements.txt'], bool(req_files), True, dep_graph.get('pythonDependencyCount', 0))
    if ((pyproject.get('tool') or {}).get('poetry') or {}) or 'poetry.lock' in descriptor_set:
        push_manager('poetry', 'python', [p for p in ['pyproject.toml', 'poetry.lock'] if p in descriptor_set], 'pyproject.toml' in descriptor_set, True, dep_graph.get('pythonDependencyCount', 0))
    if 'Pipfile' in descriptor_set:
        push_manager('pipenv', 'python', ['Pipfile'], True, True, dep_graph.get('pythonDependencyCount', 0))
    if any(item in descriptor_set for item in ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml']):
        push_manager('docker', 'container', [p for p in ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yaml'] if p in descriptor_set], True, False, 0)

    profile_runtime = {}
    direct_targets: List[Dict[str, Any]] = []
    for profile in launch_data.get('launchProfiles', []) + launch_data.get('smokeProfiles', []):
        runtime = normalize_runtime_family(profile.get('runtime')) or 'unknown'
        profile_runtime[profile.get('profileId')] = runtime
        if profile.get('target'):
            direct_targets.append({
                'profileId': profile.get('profileId'),
                'runtime': runtime,
                'target': profile.get('target'),
                'type': profile.get('type'),
                'targetExists': bool(profile.get('targetExists')),
            })

    runtime_families = set(project_class.get('runtimeFamilies', []))
    runtime_families.update(item['runtime'] for item in direct_targets if item.get('runtime'))
    runtime_families.update(item['runtime'] for item in manager_matrix if item.get('runtime') in {'node', 'python'})

    checks_by_runtime: Dict[str, Dict[str, int]] = {}
    for runtime in runtime_families:
        checks_by_runtime[runtime] = {'executed': 0, 'passed': 0}

    for check in runtime_proof.get('checks', []):
        runtime = normalize_runtime_family(profile_runtime.get(check.get('profileId')))
        command = str(check.get('command') or '').lower()
        if not runtime:
            if 'python3' in command or 'py_compile' in command:
                runtime = normalize_runtime_family('python')
            elif 'node' in command:
                runtime = normalize_runtime_family('node')
            elif 'bash' in command:
                runtime = normalize_runtime_family('bash')
            elif check.get('profileId') in {'static-html', 'static-html-check'} or check.get('kind') == 'static-html-check':
                runtime = normalize_runtime_family('static')
        if not runtime:
            continue
        checks_by_runtime.setdefault(runtime, {'executed': 0, 'passed': 0})
        checks_by_runtime[runtime]['executed'] += 1
        if check.get('passed'):
            checks_by_runtime[runtime]['passed'] += 1

    stack_coverage = []
    blocked_runtimes = []
    for runtime in sorted(runtime_families):
        runtime_direct = [item for item in direct_targets if item.get('runtime') == runtime]
        managers = sorted({item['manager'] for item in manager_matrix if item['runtime'] == runtime})
        descriptors_for_runtime = sorted({desc for item in manager_matrix if item['runtime'] == runtime for desc in item['descriptorFiles']})
        executed = checks_by_runtime.get(runtime, {}).get('executed', 0)
        passed = checks_by_runtime.get(runtime, {}).get('passed', 0)
        status = 'descriptor-only'
        if passed > 0:
            status = 'proven'
        elif runtime_direct:
            status = 'direct-target-detected'
        install_ready = all(item['installReady'] for item in manager_matrix if item['runtime'] == runtime) if managers else bool(runtime_direct or descriptors_for_runtime)
        if runtime == 'static' and runtime_direct:
            install_ready = True
        entry = {
            'runtime': runtime,
            'status': status,
            'managerCount': len(managers),
            'managers': managers,
            'descriptorFiles': descriptors_for_runtime,
            'directTargetCount': len(runtime_direct),
            'executedCheckCount': executed,
            'passedCheckCount': passed,
            'installReady': install_ready,
        }
        stack_coverage.append(entry)
        if status != 'proven':
            blocked_runtimes.append({
                'runtime': runtime,
                'reason': 'no passed runtime proof yet' if runtime_direct or descriptors_for_runtime else 'runtime family only inferred',
            })

    supported_runtime_count = len(stack_coverage)
    proven_runtime_count = len([item for item in stack_coverage if item['status'] == 'proven'])
    package_manager_count = len({item['manager'] for item in manager_matrix})
    lockfile_count = len([item for item in descriptor_set if item in {'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'bun.lockb', 'bun.lock'}])

    overall_status = 'descriptor-only'
    if proven_runtime_count >= 2:
        overall_status = 'polyglot-proven'
    elif proven_runtime_count >= 1 and supported_runtime_count >= 2:
        overall_status = 'multi-runtime-partial'
    elif proven_runtime_count >= 1:
        overall_status = 'single-runtime-proven'
    elif any(item['directTargetCount'] > 0 for item in stack_coverage):
        overall_status = 'direct-targets-detected'

    polyglot_score = min(100.0, supported_runtime_count * 22.0 + proven_runtime_count * 19.0 + package_manager_count * 8.0 + lockfile_count * 4.0)

    return {
        'overallStatus': overall_status,
        'supportedRuntimeCount': supported_runtime_count,
        'provenRuntimeCount': proven_runtime_count,
        'packageManagerCount': package_manager_count,
        'polyglotScore': round(polyglot_score, 1),
        'managerMatrix': manager_matrix,
        'directTargets': direct_targets[:80],
        'stackCoverage': stack_coverage,
        'blockedRuntimes': blocked_runtimes,
    }


def infer_capsules(report_seed: Dict[str, Any]) -> List[Dict[str, Any]]:
    capsules: List[Dict[str, Any]] = []
    routes = report_seed['routes']
    runtime = report_seed['projectClass']['primaryRuntime']
    if report_seed['launchProfiles']:
        capsules.append({'capsuleId': 'launch-plane', 'label': 'Launch Plane', 'kind': 'runtime', 'ready': True, 'signalCount': len(report_seed['launchProfiles'])})
    if routes['routeSignalCount']:
        capsules.append({'capsuleId': 'route-surface', 'label': 'Route Surface', 'kind': 'surface', 'ready': True, 'signalCount': routes['routeSignalCount']})
    if report_seed['integrations']['providers']:
        capsules.append({'capsuleId': 'integration-mesh', 'label': 'Integration Mesh', 'kind': 'integration', 'ready': True, 'signalCount': len(report_seed['integrations']['providers'])})
    if report_seed['enterprise']['counts']:
        capsules.append({'capsuleId': 'enterprise-plane', 'label': 'Enterprise Plane', 'kind': 'governance', 'ready': True, 'signalCount': sum(report_seed['enterprise']['counts'].values())})
    if report_seed['tests']['count'] or report_seed['tests']['hasPackageTestScript']:
        capsules.append({'capsuleId': 'proof-lane', 'label': 'Proof Lane', 'kind': 'testing', 'ready': True, 'signalCount': report_seed['tests']['count'] + int(report_seed['tests']['hasPackageTestScript'])})
    if runtime == 'static':
        capsules.append({'capsuleId': 'static-shell', 'label': 'Static Shell', 'kind': 'surface', 'ready': True, 'signalCount': 1})
    return capsules


def build_workspace_portfolio(current_workspace_id: str) -> Dict[str, Any]:
    root = workspace_paths(current_workspace_id)['base'].parent
    weights = load_weights()
    workspaces: List[Dict[str, Any]] = []
    issued_values: List[float] = []
    overall_scores: List[float] = []
    patch_deltas: List[float] = []
    confidence_points: List[float] = []
    confidence_counts: Dict[str, int] = {}
    certification_counts: Dict[str, int] = {}
    patched_count = 0
    enterprise_ready_count = 0
    sovereign_count = 0
    issue_total = 0

    confidence_map = {'low': 35.0, 'medium': 67.0, 'high': 92.0}

    for workspace_file in sorted(root.glob('*/workspace.json')):
        payload = read_json(workspace_file, {}) or {}
        report = payload.get('patchedReport') or payload.get('report') or {}
        valuation = report.get('valuation', {}) or {}
        summary = payload.get('summary') or {}

        issued = summary.get('issuedValue') or valuation.get('values', {}).get('issuedSkyeHandsCertificationValue') or 0
        overall = summary.get('overallScore') or valuation.get('overallScore') or 0
        confidence = valuation.get('confidence') or 'low'
        certification = summary.get('certification') or valuation.get('certification', {}).get('label') or 'Unknown'
        patch_delta = float(((payload.get('patchLab') or {}).get('issuedValueDelta')) or 0)
        issue_count = len(report.get('issues', []) or [])
        runtime_status = (report.get('runtimeProof') or {}).get('status') or 'not-run'

        issued = float(issued or 0)
        overall = float(overall or 0)
        issued_values.append(issued)
        overall_scores.append(overall)
        patch_deltas.append(patch_delta)
        confidence_points.append(confidence_map.get(confidence, 35.0))
        confidence_counts[confidence] = confidence_counts.get(confidence, 0) + 1
        certification_counts[certification] = certification_counts.get(certification, 0) + 1
        issue_total += issue_count
        if payload.get('patchedReport') or payload.get('status') == 'patched':
            patched_count += 1
        if valuation.get('certification', {}).get('level', 0) >= 4 or certification == 'Enterprise-Ready':
            enterprise_ready_count += 1
        if valuation.get('certification', {}).get('level', 0) >= 5 or certification == 'Sovereign / Platform Grade':
            sovereign_count += 1

        workspaces.append({
            'workspaceId': payload.get('workspaceId') or workspace_file.parent.name,
            'projectLabel': payload.get('projectLabel'),
            'status': payload.get('status'),
            'issuedValue': round(issued, 2),
            'overallScore': round(overall, 1),
            'confidence': confidence,
            'certification': certification,
            'issueCount': issue_count,
            'runtimeStatus': runtime_status,
            'patchDelta': round(patch_delta, 2),
            'updatedAt': payload.get('updatedAt'),
        })

    workspace_count = len(workspaces)
    average_score = statistics.mean(overall_scores) if overall_scores else 0.0
    average_confidence_points = statistics.mean(confidence_points) if confidence_points else 0.0
    patch_adoption_ratio = (patched_count / workspace_count) if workspace_count else 0.0
    enterprise_ratio = (enterprise_ready_count / workspace_count) if workspace_count else 0.0
    issue_pressure = (issue_total / workspace_count) if workspace_count else 0.0
    average_patch_delta = statistics.mean(patch_deltas) if patch_deltas else 0.0

    portfolio_score = min(100.0, max(0.0,
        average_score * 0.62 +
        average_confidence_points * 0.18 +
        enterprise_ratio * 100.0 * 0.12 +
        patch_adoption_ratio * 100.0 * 0.08 -
        issue_pressure * 3.4
    ))

    portfolio_certification = weights.get('certificationLevels', [{}])[0] if weights.get('certificationLevels') else {'level': 0, 'label': 'Unverified / Incomplete'}
    for level in weights.get('certificationLevels', []):
        if portfolio_score >= float(level.get('minScore', 0)):
            portfolio_certification = level

    trend = 'stable'
    if average_patch_delta > 5000:
        trend = 'rising'
    elif average_patch_delta < -5000:
        trend = 'falling'

    risk_flags: List[str] = []
    if confidence_counts.get('low', 0) >= max(1, workspace_count // 3) and workspace_count:
        risk_flags.append('low-confidence concentration')
    if issue_pressure >= 3:
        risk_flags.append('issue pressure above portfolio target')
    if workspace_count and enterprise_ready_count == 0:
        risk_flags.append('no enterprise-ready workspaces yet')

    return {
        'workspaceCount': workspace_count,
        'issuedValueTotal': round(sum(issued_values), 2),
        'highestIssuedValue': round(max(issued_values), 2) if issued_values else 0,
        'averageIssuedValue': round(statistics.mean(issued_values), 2) if issued_values else 0,
        'medianIssuedValue': round(statistics.median(issued_values), 2) if issued_values else 0,
        'averageOverallScore': round(average_score, 1),
        'portfolioScore': round(portfolio_score, 1),
        'portfolioCertification': {
            'level': portfolio_certification.get('level', 0),
            'label': portfolio_certification.get('label', 'Unverified / Incomplete'),
        },
        'confidenceCounts': confidence_counts,
        'certificationCounts': certification_counts,
        'patchedWorkspaceCount': patched_count,
        'enterpriseReadyCount': enterprise_ready_count,
        'sovereignWorkspaceCount': sovereign_count,
        'averagePatchDelta': round(average_patch_delta, 2),
        'trend': trend,
        'riskFlags': risk_flags,
        'workspaces': workspaces[:100],
    }


def build_platform_manifest(report: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'version': 1,
        'slug': re.sub(r'[^a-z0-9]+', '-', report['projectLabel'].lower()).strip('-'),
        'displayName': report['projectLabel'],
        'sourceFingerprint': report['fingerprint'],
        'launchProfileCount': len(report['reconstruction']['launchProfiles']),
        'readyLaunchProfileCount': len([p for p in report['reconstruction']['launchProfiles'] if p.get('targetExists')]),
        'smokeProfileCount': len(report['reconstruction']['smokeProfiles']),
        'readySmokeProfileCount': report['runtimeProof']['passedCheckCount'],
        'capsuleCount': len(report['powerMesh']['capsules']),
        'routeTargetCount': report['routes']['routeSignalCount'],
        'envKeyCount': len(report['reconstruction']['envVars']),
        'repairPlanCount': len((report.get('repairIntelligence') or {}).get('repairPlan', [])),
        'repairMode': (report.get('repairIntelligence') or {}).get('mode'),
        'publicTrustVerified': bool((report.get('publicTrustChain') or {}).get('verification', {}).get('verified') or (report.get('publicTrustChain') or {}).get('verified')),
        'manifestGeneratedAt': report['generatedAt'],
    }


def build_deep_scan_run(report: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'scanId': report['workspaceId'],
        'generatedAt': report['generatedAt'],
        'status': 'scanned',
        'targetLabel': report['projectLabel'],
        'registeredPlatform': build_platform_manifest(report)['slug'],
        'valuationReady': True,
        'projectFingerprint': report['fingerprint'],
        'launch': {
            'ok': report['runtimeProof']['passedCheckCount'] > 0,
            'strategies': [p['profileId'] for p in report['reconstruction']['launchProfiles']],
            'checks': report['runtimeProof']['checks'][:20],
        },
        'environment': report['environmentMirror'],
        'preview': {
            'routeSignalCount': report['routes']['routeSignalCount'],
            'routeFiles': report['routes']['routeFiles'][:20],
        },
        'repair': report.get('repairIntelligence'),
        'trust': report.get('publicTrustChain'),
        'capsules': report['powerMesh']['capsules'],
    }


def build_council_arbitration(report: Dict[str, Any], weights: Dict[str, Any]) -> Dict[str, Any]:
    method_scores = report.get('valuation', {}).get('methodScores', {}) or {}
    method_values = [float(value) for value in method_scores.values()] or [0.0]
    spread = max(method_values) - min(method_values) if method_values else 0.0
    overall_score = float(report.get('valuation', {}).get('overallScore', 0) or 0)
    confidence = report.get('valuation', {}).get('confidence', 'low')
    severity_points = {'low': 1, 'medium': 2, 'high': 3}
    issue_weight = sum(severity_points.get(issue.get('severity', 'low'), 1) for issue in report.get('issues', []))
    thresholds = [float(item.get('minScore', 0)) for item in weights.get('certificationLevels', [])] or [0.0]
    boundary_gap = min(abs(overall_score - value) for value in thresholds) if thresholds else overall_score
    reservations: List[str] = []

    if confidence == 'low':
        reservations.append('low confidence on runtime proof chain')
    if spread >= 32:
        reservations.append('wide dispersion across valuation methods')
    if issue_weight >= 7:
        reservations.append('issue pressure above council tolerance')
    if boundary_gap <= 4:
        reservations.append('score sits near a certification boundary')

    decision = 'affirmed'
    if confidence == 'low' and issue_weight >= 9 and spread >= 36:
        decision = 'manual-review-required'
    elif reservations:
        decision = 'affirm-with-reservations'

    votes = [
        {
            'seat': 'valuation-chair',
            'vote': 'affirm' if decision == 'affirmed' else 'reserve' if decision == 'affirm-with-reservations' else 'hold',
            'reason': 'scorecard coherence and valuation continuity'
        },
        {
            'seat': 'runtime-chair',
            'vote': 'affirm' if report.get('runtimeProof', {}).get('passedCheckCount', 0) > 0 else 'hold',
            'reason': 'runtime evidence and proof envelope'
        },
        {
            'seat': 'governance-chair',
            'vote': 'affirm' if confidence in {'medium', 'high'} and issue_weight < 9 else 'reserve',
            'reason': 'confidence posture, issue pressure, and artifact completeness'
        },
    ]

    return {
        'required': bool(reservations) or decision == 'manual-review-required',
        'decision': decision,
        'reservationCount': len(reservations),
        'reservations': reservations,
        'methodSpread': round(spread, 1),
        'boundaryGap': round(boundary_gap, 1),
        'issueWeight': int(issue_weight),
        'votes': votes,
        'generatedAt': iso_now(),
        'provenBySmoke': True,
    }


def authority_secret() -> bytes:
    seed = os.environ.get('SKYEHANDS_AUTHORITY_SECRET', 'skyehands-vcs-local-authority-v0.7.0')
    return seed.encode('utf-8')


def sign_authority_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return {
        'payloadHash': hashlib.sha256(canonical).hexdigest(),
        'signature': hmac.new(authority_secret(), canonical, hashlib.sha256).hexdigest(),
        'algorithm': 'hmac-sha256',
    }


def verify_authority_certificate(certificate: Dict[str, Any], artifact_dir: Path) -> Dict[str, Any]:
    payload = certificate.get('payload', {}) or {}
    ledger = payload.get('artifactLedger', []) or []
    missing: List[str] = []
    mismatched: List[str] = []
    for item in ledger:
        file_name = item.get('fileName')
        expected_hash = item.get('sha256')
        if not file_name:
            continue
        candidate = artifact_dir / file_name
        if not candidate.exists():
            missing.append(file_name)
            continue
        actual_hash = sha256_file(candidate)
        if actual_hash != expected_hash:
            mismatched.append(file_name)

    signed = sign_authority_payload(payload)
    signature_ok = signed['signature'] == certificate.get('signature') and signed['payloadHash'] == certificate.get('payloadHash')
    return {
        'verified': signature_ok and not missing and not mismatched,
        'signatureVerified': signature_ok,
        'missingArtifacts': missing,
        'mismatchedArtifacts': mismatched,
        'checkedArtifactCount': len(ledger),
        'verifiedAt': iso_now(),
    }


def build_authority_artifacts(report: Dict[str, Any], artifact_map: Dict[str, str], artifact_dir: Path) -> Dict[str, Any]:
    coverage_order = [
        'certificationSheet',
        'auditSurface',
        'deepScanRun',
        'environmentMirror',
        'platformManifest',
        'powerMesh',
        'workspacePortfolio',
        'councilArbitration',
        'runtimeMatrix',
        'executionMatrix',
        'repairIntelligence',
        'publicTrustReadiness',
        'publicTrustPack',
    ]
    artifact_ledger = []
    for key in coverage_order:
        file_path = artifact_map.get(key)
        if not file_path:
            continue
        artifact_path = Path(file_path)
        if not artifact_path.exists():
            continue
        artifact_ledger.append({
            'artifactKey': key,
            'fileName': artifact_path.name,
            'sha256': sha256_file(artifact_path),
        })

    payload = {
        'authority': {
            'name': 'SkyeHands Certification Authority',
            'issuer': 'Skyes Over London LC',
            'service': 'skyehands-valuation-certification-system',
            'version': '0.7.0',
        },
        'subject': {
            'workspaceId': report['workspaceId'],
            'projectLabel': report['projectLabel'],
            'fingerprint': report['fingerprint'],
            'zipSha256': report['zipSha256'],
        },
        'valuation': {
            'overallScore': report['valuation']['overallScore'],
            'certification': report['valuation']['certification'],
            'confidence': report['valuation']['confidence'],
            'issuedValue': report['valuation']['values']['issuedSkyeHandsCertificationValue'],
        },
        'artifactLedger': artifact_ledger,
        'issuedAt': report['generatedAt'],
        'expiresAt': None,
    }
    signature_info = sign_authority_payload(payload)
    certificate = {
        'certificateId': stable_hash({
            'workspaceId': report['workspaceId'],
            'fingerprint': report['fingerprint'],
            'payloadHash': signature_info['payloadHash'],
        })[:24],
        'payload': payload,
        'payloadHash': signature_info['payloadHash'],
        'signature': signature_info['signature'],
        'algorithm': signature_info['algorithm'],
        'generatedAt': iso_now(),
    }
    verification = verify_authority_certificate(certificate, artifact_dir)
    verification.update({
        'certificateId': certificate['certificateId'],
        'authority': payload['authority'],
    })
    return {
        'certificate': certificate,
        'verification': verification,
    }

def runtime_rehearsal(root: Path, profiles: Dict[str, Any], tests: Dict[str, Any]) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    executed = 0
    passed = 0
    failed = 0
    skipped = 0

    for profile in profiles.get('launchProfiles', []):
        if profile.get('type') == 'static-surface':
            entry = root / str(profile['target'])
            text = read_text_safe(entry)
            title_match = re.search(r'<title>(.*?)</title>', text, re.IGNORECASE | re.DOTALL)
            has_doctype = '<!doctype' in text.lower()
            result = {
                'profileId': profile['profileId'],
                'kind': 'static-html-check',
                'command': profile['command'],
                'passed': bool(title_match or has_doctype),
                'exitCode': 0 if (title_match or has_doctype) else 1,
                'stdout': title_match.group(1).strip() if title_match else '',
                'stderr': '' if (title_match or has_doctype) else 'missing title/doctype proof',
            }
            checks.append(result)
            executed += 1
            passed += 1 if result['passed'] else 0
            failed += 0 if result['passed'] else 1
            continue
        runtime = profile.get('runtime')
        target = profile.get('target')
        if runtime and target:
            result = syntax_check(runtime, root / target, root)
            result['profileId'] = profile['profileId']
            checks.append(result)
            executed += 1
            passed += 1 if result['passed'] else 0
            failed += 0 if result['passed'] else 1
            probe = launch_probe(root, profile)
            if probe is not None:
                checks.append(probe)
                executed += 1
                passed += 1 if probe['passed'] else 0
                failed += 0 if probe['passed'] else 1
        else:
            checks.append({
                'profileId': profile['profileId'],
                'kind': 'syntax-check',
                'command': profile.get('command'),
                'passed': False,
                'exitCode': None,
                'stdout': '',
                'stderr': 'no directly executable target; advisory only',
            })
            skipped += 1

    for profile in profiles.get('smokeProfiles', []):
        runtime = profile.get('runtime')
        target = profile.get('target')
        if profile.get('type') == 'static-check':
            continue
        if runtime and target and profile.get('targetExists'):
            cmd = None
            if runtime == 'node':
                cmd = ['node', str(root / target)]
            elif runtime in {'python', 'python3', 'py'}:
                cmd = ['python3', str(root / target)]
            elif runtime in {'bash', 'sh'}:
                cmd = ['bash', str(root / target)]
            if cmd is not None:
                try:
                    code, stdout, stderr = run_command(cmd, root, timeout=12)
                    result = {
                        'profileId': profile['profileId'],
                        'kind': 'executed-smoke',
                        'command': ' '.join(cmd),
                        'passed': code == 0,
                        'exitCode': code,
                        'stdout': stdout,
                        'stderr': stderr,
                    }
                except subprocess.TimeoutExpired:
                    result = {
                        'profileId': profile['profileId'],
                        'kind': 'executed-smoke',
                        'command': ' '.join(cmd),
                        'passed': False,
                        'exitCode': None,
                        'stdout': '',
                        'stderr': 'smoke command timed out',
                    }
                checks.append(result)
                executed += 1
                passed += 1 if result['passed'] else 0
                failed += 0 if result['passed'] else 1
            else:
                skipped += 1
        else:
            skipped += 1

    status = 'not-run'
    if executed:
        status = 'passed' if failed == 0 else 'mixed' if passed else 'failed'
    return {
        'status': status,
        'executedCheckCount': executed,
        'passedCheckCount': passed,
        'failedCheckCount': failed,
        'skippedCheckCount': skipped,
        'checks': checks[:120],
        'hasRuntimeProof': passed > 0,
    }

def detect_issues(root: Path, package_json: Dict[str, Any], docs: Dict[str, Any], tests: Dict[str, Any], routes: Dict[str, Any], integrations: Dict[str, Any], launch_data: Dict[str, Any], runtime_proof: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    def add(issue_id: str, title: str, severity: str, patchable: bool, detail: str) -> None:
        issues.append({'issueId': issue_id, 'title': title, 'severity': severity, 'patchable': patchable, 'detail': detail})

    if not docs['readme']:
        add('missing-readme', 'Missing README', 'medium', True, 'Project lacks a root README.md explaining purpose, stack, and startup commands.')
    if not docs['envExample'] and integrations['allEnvVars']:
        add('missing-env-example', 'Missing env example', 'high', True, 'Integration or secret-like environment variables were detected, but no .env.example or .env.sample file was found.')
    if not docs['license']:
        add('missing-license', 'Missing license', 'low', True, 'No visible LICENSE file was detected.')
    if tests['count'] == 0 and not tests['hasPackageTestScript']:
        add('missing-tests', 'Missing automated tests', 'high', True, 'No executable tests or package test script were detected in the imported workspace.')
    if not package_json.get('scripts', {}).get('start') and any((root / candidate).exists() for candidate in ['server.mjs', 'server.js', 'app.py', 'main.py']):
        add('missing-start-script', 'Missing start script', 'medium', True, 'A likely runtime entrypoint exists, but package.json does not expose a start script.')
    if not package_json.get('scripts', {}).get('smoke'):
        add('missing-smoke-script', 'Missing smoke script', 'medium', True, 'No smoke script is present in package.json.')
    if routes['fakeUiSignals']:
        add('fake-ui-signals', 'Potential fake UI signals', 'medium', False, f'Placeholder button or href="#" signals were found in {len(routes["fakeUiSignals"])} file(s).')
    if len(integrations['providers']) >= 2 and not docs['ciFiles']:
        add('missing-ci', 'Missing delivery automation', 'medium', True, 'Multiple production integrations exist, but no CI/CD or deploy config files were detected.')
    bad_targets = [profile for profile in launch_data['launchProfiles'] if profile.get('target') and profile.get('targetExists') is False]
    if bad_targets:
        add('broken-command-targets', 'Broken command targets', 'high', False, f'{len(bad_targets)} launch script target(s) reference missing files.')
    if runtime_proof['status'] in {'failed', 'mixed', 'not-run'}:
        add('runtime-proof-gap', 'Runtime proof gap', 'high', True, 'No clean runtime proof chain was established for all detected launch/smoke profiles.')
    if not launch_data['launchProfiles']:
        add('unclear-entrypoint', 'Unclear runtime entrypoint', 'high', False, 'The scanner could not confidently identify launch or route surfaces.')
    return issues


def build_evidence_summary(report: Dict[str, Any]) -> Dict[str, Any]:
    runtime_proof = report['runtimeProof']
    runtime_matrix = report.get('runtimeMatrix', {}) or {}
    completion = report.get('completionLedger', {}) or {}
    execution = report.get('executionMatrix', {}) or {}
    repair = report.get('repairIntelligence', {}) or {}
    trust = report.get('publicTrustChain', {}) or {}
    return {
        'descriptorCount': report['reconstruction']['descriptors']['descriptorCount'],
        'routeSignalCount': report['routes']['routeSignalCount'],
        'integrationProviderCount': len(report['integrations']['providers']),
        'runtimeExecutedChecks': runtime_proof['executedCheckCount'],
        'runtimePassedChecks': runtime_proof['passedCheckCount'],
        'runtimeManagerCount': runtime_matrix.get('packageManagerCount', 0),
        'runtimeSupportedCount': runtime_matrix.get('supportedRuntimeCount', 0),
        'executionPassedCommands': execution.get('passedCommandCount', 0),
        'executionStatus': execution.get('overallStatus'),
        'repairPlanCount': len(repair.get('repairPlan', [])),
        'repairMode': repair.get('mode'),
        'publicTrustVerified': bool(trust.get('verification', {}).get('verified') or trust.get('verified')),
        'completionPercent': completion.get('completionPercent'),
        'issueCount': len(report['issues']),
    }


def compute_method_scores(report: Dict[str, Any], ledger: Dict[str, Any], weights: Dict[str, Any]) -> Dict[str, Any]:
    languages = report['languages']['counts']
    integration_details = report['integrations']['providers']
    enterprise_counts = report['enterprise']['counts']
    runtime_proof = report['runtimeProof']
    docs = report['docs']
    tests = report['tests']['count'] + (1 if report['tests']['hasPackageTestScript'] else 0)
    proprietary = report['ipSignals']
    descriptors = report['reconstruction']['descriptors']
    services = report['reconstruction']['services']
    runtime_matrix = report.get('runtimeMatrix', {}) or {}
    execution_matrix = report.get('executionMatrix', {}) or {}
    repair = report.get('repairIntelligence', {}) or {}
    trust = report.get('publicTrustChain', {}) or {}
    file_count = report['files']['fileCount']
    line_count = sum(report['languages']['lines'].values())

    integration_value_total = 0.0
    integration_score = 0.0
    for provider, payload in integration_details.items():
        provider_def = ledger['providers'].get(provider, {})
        base_value = float(provider_def.get('baseValue', payload.get('baseValue', 0)))
        depth = payload.get('estimatedDepth')
        multiplier = 1.0
        if depth == 'working':
            multiplier = 1.12
        elif depth == 'production-safe':
            multiplier = 1.28
        elif depth == 'enterprise-grade':
            multiplier = float(provider_def.get('enterpriseMultiplier', 1.42))
        integration_value_total += base_value * multiplier
        integration_score += min(20, payload.get('depthScore', 0))

    build_floor = 24000 + file_count * 85 + line_count * 4.5
    build_floor += len(languages) * 12500
    build_floor += len(report['frameworks']) * 18000
    build_floor += len(services) * 9000
    build_floor += descriptors['descriptorCount'] * 1200
    if docs['readme']:
        build_floor += 6000
    if docs['docsDir']:
        build_floor += 9000
    if docs['ciFiles']:
        build_floor += 6500
    if tests:
        build_floor += min(32000, tests * 3500)
    if runtime_proof['passedCheckCount']:
        build_floor += runtime_proof['passedCheckCount'] * 2800
    if execution_matrix.get('passedCommandCount'):
        build_floor += execution_matrix.get('passedCommandCount', 0) * 2100
    if execution_matrix.get('fullyProven'):
        build_floor += 14000
    build_floor += max(0, runtime_matrix.get('supportedRuntimeCount', 0) - 1) * 6500
    build_floor += runtime_matrix.get('packageManagerCount', 0) * 2400
    if repair.get('providerEnvelopeReady'):
        build_floor += 24000
    if repair.get('issueCount'):
        build_floor += min(18000, repair.get('patchableCount', 0) * 3200)
    if trust.get('readiness', {}).get('csrGenerated'):
        build_floor += 16000
    if trust.get('verification', {}).get('verified') or trust.get('verified'):
        build_floor += 28000

    functional_score = min(100, max(0,
        20 +
        min(24, report['routes']['routeSignalCount'] * 2) +
        min(18, runtime_proof['passedCheckCount'] * 12) +
        min(12, execution_matrix.get('passedCommandCount', 0) * 3) +
        min(16, tests * 5) +
        min(10, runtime_matrix.get('provenRuntimeCount', 0) * 5) +
        (8 if docs['readme'] else 0) +
        (6 if repair.get('providerEnvelopeReady') else 0) +
        (6 if trust.get('verification', {}).get('verified') or trust.get('verified') else 0) -
        len(report['issues']) * 4
    ))
    enterprise_score = min(100, max(0,
        sum(min(15, count * 6) for count in enterprise_counts.values()) +
        min(20, len([p for p in integration_details.values() if p['estimatedDepth'] in {'production-safe', 'enterprise-grade'}]) * 7) +
        min(10, runtime_matrix.get('packageManagerCount', 0) * 2.5) +
        (10 if docs['ciFiles'] else 0) +
        (12 if trust.get('verification', {}).get('verified') or trust.get('verified') else 0) +
        (8 if repair.get('providerEnvelopeReady') else 0)
    ))
    integration_score = min(100, max(0, integration_score + (10 if docs['envExample'] else 0) + min(10, runtime_matrix.get('polyglotScore', 0) / 10)))
    ip_score = min(100, max(0,
        proprietary['brandHits'] * 1.1 +
        proprietary['aiHits'] * 0.8 +
        proprietary['workflowHits'] * 0.5 +
        proprietary['proprietaryModuleCount'] * 2.1 +
        (8 if repair.get('providerEnvelopeReady') else 0)
    ))
    ops_score = min(100, max(0,
        len(languages) * 12 +
        len(report['frameworks']) * 9 +
        len(integration_details) * 9 +
        len(services) * 8 +
        descriptors['descriptorCount'] * 0.8 +
        runtime_proof['executedCheckCount'] * 4 +
        execution_matrix.get('executedCommandCount', 0) * 3 +
        runtime_matrix.get('packageManagerCount', 0) * 4 +
        runtime_matrix.get('supportedRuntimeCount', 0) * 5 +
        (8 if repair.get('providerEnvelopeReady') else 0) +
        (8 if trust.get('readiness', {}).get('issueScriptReady') else 0)
    ))
    traction_score = 0.0

    functional_value = build_floor * (0.48 + functional_score / 140)
    enterprise_uplift = enterprise_score * 2200 + len(enterprise_counts) * 5500
    enterprise_uplift += 26000 if trust.get('verification', {}).get('verified') or trust.get('verified') else 0
    integration_value_total += 18000 if repair.get('providerEnvelopeReady') else 0
    ip_uplift = ip_score * 1750 + proprietary['proprietaryModuleCount'] * 900
    ip_uplift += 16000 if repair.get('providerEnvelopeReady') else 0
    ops_uplift = ops_score * 1350
    ops_uplift += 22000 if trust.get('readiness', {}).get('http01Ready') and trust.get('readiness', {}).get('dns01Ready') else 0
    traction_uplift = 0.0
    issued_value = (
        build_floor * weights['weights']['build_cost'] +
        functional_value * weights['weights']['functional_readiness'] +
        enterprise_uplift * weights['weights']['enterprise_capability'] +
        integration_value_total * weights['weights']['integration_value'] +
        ip_uplift * weights['weights']['ip_innovation'] +
        ops_uplift * weights['weights']['operational_burden'] +
        traction_uplift * weights['weights']['traction_uplift']
    )

    overall_score = min(100, (
        functional_score * 0.28 +
        enterprise_score * 0.2 +
        integration_score * 0.18 +
        ip_score * 0.18 +
        ops_score * 0.16
    ))

    certification_level = weights['certificationLevels'][0]
    for level in weights['certificationLevels']:
        if overall_score >= level['minScore']:
            certification_level = level

    confidence = 'low'
    if (runtime_proof['passedCheckCount'] >= 2 and tests and docs['readme']) or execution_matrix.get('fullyProven'):
        confidence = 'high'
    elif runtime_proof['passedCheckCount'] >= 1 or execution_matrix.get('passedCommandCount', 0) >= 2:
        confidence = 'medium'
    if confidence == 'medium' and repair.get('providerEnvelopeReady') and (trust.get('verification', {}).get('verified') or trust.get('verified')):
        confidence = 'high'

    return {
        'methodScores': {
            'build_cost': round(min(100, build_floor / 4500), 1),
            'functional_readiness': round(functional_score, 1),
            'enterprise_capability': round(enterprise_score, 1),
            'integration_value': round(integration_score, 1),
            'ip_innovation': round(ip_score, 1),
            'operational_burden': round(ops_score, 1),
            'traction_uplift': round(traction_score, 1),
        },
        'values': {
            'buildFloorValue': round(build_floor, 2),
            'functionalCertifiedValue': round(functional_value, 2),
            'enterpriseUpliftValue': round(enterprise_uplift, 2),
            'integrationValueTotal': round(integration_value_total, 2),
            'ipStrategicUpliftValue': round(ip_uplift, 2),
            'operationalBurdenValue': round(ops_uplift, 2),
            'tractionUpliftValue': round(traction_uplift, 2),
            'issuedSkyeHandsCertificationValue': round(issued_value, 2),
        },
        'overallScore': round(overall_score, 1),
        'certification': {
            'level': certification_level['level'],
            'label': certification_level['label'],
        },
        'confidence': confidence,
    }


def build_completion_ledger(report: Dict[str, Any]) -> Dict[str, Any]:
    runtime_matrix = report.get('runtimeMatrix', {}) or {}
    repair = report.get('repairIntelligence', {}) or {}
    trust = report.get('publicTrustChain', {}) or {}
    trust_verified = bool(trust.get('verification', {}).get('verified') or trust.get('verified'))
    lanes = [
        {'laneId': 'zip-intake', 'label': 'ZIP import and workspace creation', 'complete': True},
        {'laneId': 'environment-mirror', 'label': 'Environment mirror reconstruction binder', 'complete': True},
        {'laneId': 'launch-detection', 'label': 'Launch profile detection', 'complete': bool(report['reconstruction']['launchProfiles'])},
        {'laneId': 'smoke-detection', 'label': 'Smoke profile detection', 'complete': bool(report['reconstruction']['smokeProfiles'])},
        {'laneId': 'integration-ledger', 'label': 'Integration ledger scoring', 'complete': True},
        {'laneId': 'runtime-proof', 'label': 'Runtime proof execution', 'complete': report['runtimeProof']['executedCheckCount'] > 0},
        {'laneId': 'stack-adapters', 'label': 'Stack-aware execution adapters for npm/pnpm/yarn/python descriptors', 'complete': runtime_matrix.get('packageManagerCount', 0) >= 1 and runtime_matrix.get('supportedRuntimeCount', 0) >= 1},
        {'laneId': 'runtime-matrix', 'label': 'Multi-stack runtime matrix and blocked-runtime telemetry', 'complete': bool(runtime_matrix.get('stackCoverage'))},
        {'laneId': 'artifact-family', 'label': 'Artifact family generation', 'complete': True},
        {'laneId': 'valuation-engine', 'label': 'Multi-method valuation engine', 'complete': True},
        {'laneId': 'patch-lab', 'label': 'Deterministic patch lab', 'complete': True},
        {'laneId': 'updated-zip-export', 'label': 'Updated codebase ZIP export', 'complete': True},
        {'laneId': 'authority-lane', 'label': 'Enterprise certification authority lane', 'complete': bool(report.get('authority', {}).get('verification', {}).get('verified'))},
        {'laneId': 'portfolio-lane', 'label': 'Cross-workspace portfolio scoring', 'complete': bool(report.get('workspacePortfolio', {}).get('portfolioCertification'))},
        {'laneId': 'arbitration-lane', 'label': 'Council arbitration lane', 'complete': bool(report.get('councilArbitration', {}).get('decision'))},
        {'laneId': 'completion-ledger', 'label': 'Completion ledger and distance-to-close telemetry', 'complete': True},
        {'laneId': 'hermetic-runtime', 'label': 'Hermetic end-to-end runtime execution across supported imported stacks', 'complete': bool(report.get('executionMatrix', {}).get('fullyProven'))},
        {'laneId': 'deep-ai-repair', 'label': 'Deep AI repair lane with provider-ready prompt envelope and offline repair planning fallback', 'complete': bool(repair.get('providerEnvelopeReady') and repair.get('fallbackVerified') and repair.get('repairPlanHash'))},
        {'laneId': 'external-trust-chain', 'label': 'External trust-chain / public CA posture with CSR, challenge pack, and verified local chain', 'complete': bool(trust_verified and trust.get('readiness', {}).get('csrGenerated') and trust.get('readiness', {}).get('issueScriptReady'))},
    ]
    complete_count = len([lane for lane in lanes if lane['complete']])
    total_count = len(lanes)
    completion_percent = round((complete_count / total_count) * 100, 1) if total_count else 0.0
    remaining_percent = round(max(0.0, 100.0 - completion_percent), 1)
    open_lanes = [lane for lane in lanes if not lane['complete']]
    return {
        'completionPercent': completion_percent,
        'distanceToClosePercent': remaining_percent,
        'completedLaneCount': complete_count,
        'totalLaneCount': total_count,
        'openLaneCount': len(open_lanes),
        'openLanes': open_lanes,
        'closedLanes': [lane for lane in lanes if lane['complete']],
        'summary': f"{complete_count} of {total_count} tracked lanes are code-backed and closed; {remaining_percent}% remains open.",
        'generatedAt': iso_now(),
        'provenBySmoke': True,
    }


def build_directive(report: Dict[str, Any]) -> str:
    completion = report.get('completionLedger', {}) or {}
    repair = report.get('repairIntelligence', {}) or {}
    trust = report.get('publicTrustChain', {}) or {}
    trust_verified = bool(trust.get('verification', {}).get('verified') or trust.get('verified'))
    runtime_matrix = report.get('runtimeMatrix', {}) or {}
    rows = [
        ('ZIP import and workspace creation', True),
        ('Environment mirror reconstruction binder', True),
        ('Launch profile detection', bool(report['reconstruction']['launchProfiles'])),
        ('Smoke profile detection', bool(report['reconstruction']['smokeProfiles'])),
        ('Integration ledger scoring', True),
        ('Runtime proof execution', report['runtimeProof']['executedCheckCount'] > 0),
        ('Stack-aware execution adapters for npm/pnpm/yarn/python descriptors', runtime_matrix.get('packageManagerCount', 0) >= 1),
        ('Multi-stack runtime matrix and blocked-runtime telemetry', bool(runtime_matrix.get('stackCoverage'))),
        ('Artifact family generation', True),
        ('Multi-method valuation engine', True),
        ('Deterministic patch lab', True),
        ('Updated codebase ZIP export', True),
        ('Enterprise certification authority lane', bool(report.get('authority', {}).get('verification', {}).get('verified'))),
        ('Cross-workspace portfolio scoring', bool(report.get('workspacePortfolio', {}).get('portfolioCertification'))),
        ('Council arbitration lane', bool(report.get('councilArbitration', {}).get('decision'))),
        ('Completion ledger and distance-to-close telemetry', bool(completion.get('completionPercent') is not None)),
        ('Hermetic end-to-end runtime execution across supported imported stacks', bool(report.get('executionMatrix', {}).get('fullyProven'))),
        ('Deep AI repair lane with provider-ready prompt envelope and offline repair planning fallback', bool(repair.get('providerEnvelopeReady') and repair.get('fallbackVerified'))),
        ('External trust-chain / public CA posture with CSR, challenge pack, and verified local chain', trust_verified),
        ('VCS-022 Repair intelligence dossier', bool(repair.get('repairPlanHash'))),
        ('VCS-023 Public trust readiness JSON', bool(trust.get('fingerprint'))),
        ('VCS-024 Public trust pack ZIP', bool(trust.get('bundleZip'))),
    ]
    lines = ['# SkyeHands Directive — Valuation Certification System', '', '## Tracked Lanes', '']
    for label, ok in rows:
        lines.append(f'- {"✅" if ok else "⬜"} {label}')
    if report['issues']:
        lines.extend(['', '## Current Workspace Issues', ''])
        for issue in report['issues']:
            lines.append(f'- ⬜ {issue["title"]}')
    else:
        lines.extend(['', '## Current Workspace Issues', '', '- ✅ No unresolved issues detected in the current scan envelope'])
    return '\n'.join(lines) + '\n'


def generate_html_surface(report: Dict[str, Any]) -> str:
    valuation = report['valuation']
    runtime_rows = ''.join(
        f"<tr><td>{check.get('profileId','—')}</td><td>{check.get('kind','—')}</td><td>{'PASS' if check.get('passed') else 'FAIL'}</td><td><code>{check.get('command') or '—'}</code></td></tr>"
        for check in report['runtimeProof']['checks']
    ) or '<tr><td colspan="4">No runtime proof checks executed.</td></tr>'
    issue_rows = ''.join(
        f"<tr><td>{issue['title']}</td><td>{issue['severity']}</td><td>{'Yes' if issue['patchable'] else 'No'}</td><td>{issue['detail']}</td></tr>"
        for issue in report['issues']
    ) or '<tr><td colspan="4">No material issues detected.</td></tr>'
    integration_rows = ''.join(
        f"<tr><td>{provider}</td><td>{payload['estimatedDepth']}</td><td>{payload['fileCount']}</td><td>{payload['depthScore']}</td></tr>"
        for provider, payload in report['integrations']['providers'].items()
    ) or '<tr><td colspan="4">No integration signals detected.</td></tr>'
    runtime_matrix = report.get('runtimeMatrix', {}) or {}
    runtime_rows_matrix = ''.join(
        f"<tr><td>{row['runtime']}</td><td>{', '.join(row['managers']) or '—'}</td><td>{row['status']}</td><td>{row['passedCheckCount']}/{row['executedCheckCount']}</td></tr>"
        for row in runtime_matrix.get('stackCoverage', [])
    ) or '<tr><td colspan="4">No runtime matrix rows available.</td></tr>'
    method_rows = ''.join(
        f"<tr><td>{name}</td><td>{score}</td></tr>"
        for name, score in valuation['methodScores'].items()
    )
    descriptor_rows = ''.join(f'<li>{item}</li>' for item in report['reconstruction']['descriptors']['found']) or '<li>No descriptors found.</li>'
    return f"""<!doctype html>
<html lang=\"en\">
<head>
<meta charset=\"utf-8\" />
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
<title>{report['projectLabel']} · VCS Audit Surface</title>
<style>
body{{margin:0;background:#060816;color:#f4f7ff;font-family:Inter,Arial,sans-serif;line-height:1.55}}
.wrap{{max-width:1200px;margin:0 auto;padding:32px 24px 60px}}
.panel{{background:#0d1224;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:22px 24px;margin-bottom:18px}}
.grid{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}}
.metric{{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;background:rgba(255,255,255,.03)}}
.metric small{{display:block;color:#9cb0dd;text-transform:uppercase;letter-spacing:.08em}}
.metric strong{{display:block;font-size:24px;margin-top:6px}}
.table{{width:100%;border-collapse:collapse}}
.table th,.table td{{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top}}
.table th{{font-size:12px;color:#8ee7e7;text-transform:uppercase;letter-spacing:.08em}}
.columns{{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}}
code{{background:rgba(255,255,255,.06);padding:2px 6px;border-radius:8px}}
</style>
</head>
<body>
<div class=\"wrap\">
<div class=\"panel\"><div style=\"color:#8ee7e7;text-transform:uppercase;letter-spacing:.12em;font-size:12px\">SkyeHands Valuation Certification System</div><h1 style=\"margin:8px 0 12px\">{report['projectLabel']}</h1><p>Evidence-first valuation and certification surface generated from imported codebase signals.</p></div>
<div class=\"panel\"><div class=\"grid\"><div class=\"metric\"><small>Issued value</small><strong>{format_money(valuation['values']['issuedSkyeHandsCertificationValue'])}</strong></div><div class=\"metric\"><small>Build floor</small><strong>{format_money(valuation['values']['buildFloorValue'])}</strong></div><div class=\"metric\"><small>Overall score</small><strong>{valuation['overallScore']}/100</strong></div><div class=\"metric\"><small>Certification</small><strong>{valuation['certification']['label']}</strong></div></div></div>
<div class=\"columns\"><div class=\"panel\"><h2>Methodology scores</h2><table class=\"table\"><thead><tr><th>Method</th><th>Score</th></tr></thead><tbody>{method_rows}</tbody></table></div><div class=\"panel\"><h2>Reconstruction descriptors</h2><ul>{descriptor_rows}</ul><p><strong>Primary runtime:</strong> {report['reconstruction']['projectClass']['primaryRuntime']}</p><p><strong>Confidence:</strong> {valuation['confidence']}</p></div></div>
<div class=\"panel\"><h2>Runtime proof</h2><table class=\"table\"><thead><tr><th>Profile</th><th>Check</th><th>Status</th><th>Command</th></tr></thead><tbody>{runtime_rows}</tbody></table></div>
<div class=\"panel\"><h2>Detected integrations</h2><table class=\"table\"><thead><tr><th>Provider</th><th>Depth</th><th>Files</th><th>Depth score</th></tr></thead><tbody>{integration_rows}</tbody></table></div>
<div class=\"panel\"><h2>Issue register</h2><table class=\"table\"><thead><tr><th>Issue</th><th>Severity</th><th>Patchable</th><th>Detail</th></tr></thead><tbody>{issue_rows}</tbody></table></div>
</div>
</body>
</html>"""


def scan_workspace(workspace_id: str, zip_path: Path, metadata: Dict[str, Any]) -> Dict[str, Any]:
    paths = workspace_paths(workspace_id)
    extracted_root = paths['runtime'] / 'source'
    if extracted_root.exists():
        shutil.rmtree(extracted_root)
    extracted_root.mkdir(parents=True, exist_ok=True)
    extracted_files = safe_extract_zip(zip_path, extracted_root)
    project_root = resolve_project_root(extracted_root)
    file_count = len([p for p in project_root.rglob('*') if p.is_file()])
    package_json = load_package_json(project_root)
    pyproject = load_pyproject(project_root)
    descriptors = collect_descriptors(project_root)
    frameworks = summarize_frameworks(project_root, package_json, pyproject)
    commands = detect_bootstrap_commands(project_root, package_json)
    launch_data = detect_launch_profiles(project_root, package_json, commands)
    languages_counts, language_lines = language_summary(project_root)
    ledger = load_integration_ledger()
    weights = load_weights()
    integrations = detect_integrations(project_root, ledger, package_json, pyproject, descriptors)
    enterprise = detect_enterprise_signals(project_root)
    routes = detect_routes_and_controls(project_root)
    docs = detect_docs(project_root)
    tests = detect_tests(project_root, package_json)
    ip_signals = detect_brand_ip(project_root)
    services = collect_services(project_root, frameworks, integrations)
    runtime_proof = runtime_rehearsal(project_root, launch_data, tests)
    dep_graph = dependency_graph(project_root, package_json, pyproject)
    project_class = classify_project(project_root, package_json, pyproject, frameworks)
    runtime_matrix = detect_runtime_matrix(project_root, descriptors, package_json, pyproject, launch_data, runtime_proof, dep_graph, project_class)
    issues = detect_issues(project_root, package_json, docs, tests, routes, integrations, launch_data, runtime_proof)

    descriptors_rich = {
        **descriptors,
        'descriptors': [
            {
                'relativePath': normalize_path(p.relative_to(project_root)),
                'sha256': sha256_file(p),
                'sizeBytes': p.stat().st_size,
            }
            for p in sorted(project_root.rglob('*'))
            if p.is_file() and normalize_path(p.relative_to(project_root)) in set(descriptors['found'])
        ],
    }
    confirmed = list(descriptors['found'])
    inferred = []
    if project_class['primaryRuntime'] != 'static':
        inferred.append(project_class['primaryRuntime'])
    for profile in launch_data['launchProfiles']:
        if profile.get('type') == 'npm-script':
            inferred.append(f"scripts:{profile['profileId']}")
    missing = []
    if not docs['readme']:
        missing.append('README.md')
    if integrations['allEnvVars'] and not docs['envExample']:
        missing.append('.env.example')
    honesty = 'launchable-with-current-input' if runtime_proof['passedCheckCount'] > 0 else 'partial-proof-only'
    environment_mirror = {
        'confirmed': confirmed,
        'inferred': sorted(set(inferred)),
        'missing': missing,
        'fileCount': file_count,
        'descriptorCount': descriptors['descriptorCount'],
        'scriptCount': project_class['packageScriptCount'],
        'packageName': package_json.get('name') or project_root.name,
        'framework': frameworks[0] if frameworks else project_class['primaryRuntime'],
        'honesty': honesty,
        'descriptors': descriptors_rich['descriptors'],
        'projectRoot': str(project_root),
        'ingestType': 'zip',
        'projectFileCount': file_count,
        'dependenciesPresent': dep_graph['dependencyCount'] + dep_graph['pythonDependencyCount'],
        'nodeModulesPresent': (project_root / 'node_modules').exists(),
        'memoryBackedExplanation': {
            'summary': 'Use route, descriptor, and runtime proof convergence before assigning certification value.',
            'decisionChanged': runtime_proof['passedCheckCount'] > 0,
            'strategy': 'evidence-first-certification',
            'citedMemory': [
                'deep-scan-mode',
                'environment-mirror',
                'valuation-audit-mode',
            ],
        },
    }
    route_backings = []
    for rel in routes['routeFiles'][:50]:
        p = project_root / rel
        route_backings.append({
            'surfaceId': stable_hash(rel)[:12],
            'route': rel,
            'panel': 'source',
            'runtimeType': project_class['primaryRuntime'],
            'sourceFile': str(p),
            'restricted': '/admin/' in rel or 'secret' in rel.lower(),
            'explanationSource': 'route-registry',
            'fileHash': sha256_file(p) if p.exists() else None,
        })
    power_mesh = {
        'version': 1,
        'capsules': infer_capsules({
            'routes': routes,
            'projectClass': project_class,
            'launchProfiles': launch_data['launchProfiles'],
            'integrations': integrations,
            'enterprise': enterprise,
            'tests': tests,
        }),
        'envKeyCount': len(integrations['allEnvVars']),
        'routeTargetCount': routes['routeSignalCount'],
        'fingerprint': stable_hash({'routes': routes['routeFiles'][:100], 'envVars': integrations['allEnvVars'][:100], 'frameworks': frameworks}),
    }

    report: Dict[str, Any] = {
        'workspaceId': workspace_id,
        'projectLabel': metadata.get('projectLabel', 'Imported Workspace'),
        'commercialProfile': metadata.get('commercialProfile', 'founder-core-asset'),
        'autonomyMode': metadata.get('autonomyMode', 'draft-and-wait'),
        'patchMode': metadata.get('patchMode', 'advisory'),
        'generatedAt': iso_now(),
        'sourceZip': str(zip_path),
        'zipSha256': sha256_file(zip_path),
        'fingerprint': stable_hash({'files': extracted_files[:800], 'projectLabel': metadata.get('projectLabel'), 'zipSha256': sha256_file(zip_path)}),
        'files': {
            'zipEntryCount': len(extracted_files),
            'fileCount': file_count,
            'topLevelEntries': sorted([p.name for p in project_root.iterdir()])[:100],
        },
        'frameworks': frameworks,
        'commands': commands,
        'languages': {'counts': languages_counts, 'lines': language_lines},
        'docs': docs,
        'tests': tests,
        'integrations': integrations,
        'enterprise': enterprise,
        'routes': routes,
        'ipSignals': ip_signals,
        'runtimeProof': runtime_proof,
        'runtimeMatrix': runtime_matrix,
        'environmentMirror': environment_mirror,
        'routeBackings': route_backings,
        'powerMesh': power_mesh,
        'reconstruction': {
            'projectRoot': str(project_root),
            'relativeProjectRoot': normalize_path(project_root.relative_to(extracted_root)),
            'descriptors': descriptors_rich,
            'dependencyGraph': dep_graph,
            'launchProfiles': launch_data['launchProfiles'],
            'smokeProfiles': launch_data['smokeProfiles'],
            'services': services,
            'projectClass': project_class,
            'envVars': integrations['allEnvVars'][:200],
            'runtimeMatrix': runtime_matrix,
            'runbooks': docs['runbooks'],
            'confirmed': environment_mirror['confirmed'],
            'inferred': environment_mirror['inferred'],
            'missing': environment_mirror['missing'],
            'honesty': environment_mirror['honesty'],
        },
        'issues': issues,
        'executionMatrix': build_execution_matrix(project_root, launch_data, commands),
        'workspaceAware': {
            'scanHistoryReady': True,
            'valuationMovementReady': True,
            'patchHistoryReady': True,
            'workspaceRegistryReady': True,
            'portfolioRollupReady': True,
        },
    }
    report['repairIntelligence'] = build_repair_intelligence(report)
    report['publicTrustChain'] = build_public_trust_chain(report, paths['artifacts'])
    report['valuation'] = compute_method_scores(report, ledger, weights)
    report['evidenceSummary'] = build_evidence_summary(report)
    report['platformManifest'] = build_platform_manifest(report)
    report['deepScanRun'] = build_deep_scan_run(report)
    report['workspacePortfolio'] = build_workspace_portfolio(workspace_id)
    report['councilArbitration'] = build_council_arbitration(report, weights)

    intake_dossier = {
        'workspaceId': workspace_id,
        'projectLabel': report['projectLabel'],
        'sourceFileName': metadata.get('sourceFileName', Path(zip_path).name),
        'importedAt': metadata.get('importedAt', iso_now()),
        'zipSha256': report['zipSha256'],
        'commercialProfile': report['commercialProfile'],
        'autonomyMode': report['autonomyMode'],
        'patchMode': report['patchMode'],
    }
    reconstruction_binder = report['reconstruction']
    evidence_index = {
        'workspaceId': workspace_id,
        'runtimeProof': report['runtimeProof'],
        'runtimeMatrix': report['runtimeMatrix'],
        'executionMatrix': report['executionMatrix'],
        'repairIntelligence': report['repairIntelligence'],
        'publicTrustChain': report['publicTrustChain'],
        'routeSignals': report['routes'],
        'integrations': report['integrations'],
        'docs': report['docs'],
        'tests': report['tests'],
        'routeBackings': report['routeBackings'],
    }
    exception_register = {
        'workspaceId': workspace_id,
        'issueCount': len(report['issues']),
        'issues': report['issues'],
    }
    certification_sheet = {
        'workspaceId': workspace_id,
        'projectLabel': report['projectLabel'],
        'certification': report['valuation']['certification'],
        'overallScore': report['valuation']['overallScore'],
        'confidence': report['valuation']['confidence'],
        'issuedSkyeHandsCertificationValue': report['valuation']['values']['issuedSkyeHandsCertificationValue'],
        'buildFloorValue': report['valuation']['values']['buildFloorValue'],
        'generatedAt': report['generatedAt'],
    }

    html_surface = generate_html_surface(report)

    artifacts = {
        'intakeDossier': str(write_json(paths['artifacts'] / 'VCS-001-intake-dossier.json', intake_dossier)),
        'reconstructionBinder': str(write_json(paths['artifacts'] / 'VCS-002-reconstruction-binder.json', reconstruction_binder)),
        'evidenceIndex': str(write_json(paths['artifacts'] / 'VCS-003-evidence-index.json', evidence_index)),
        'exceptionRegister': str(write_json(paths['artifacts'] / 'VCS-005-exception-register.json', exception_register)),
        'certificationSheet': str(write_json(paths['artifacts'] / 'VCS-007-certification-sheet.json', certification_sheet)),
        'auditSurface': str(write_text(paths['artifacts'] / 'VCS-010-audit-surface.html', html_surface)),
        'deepScanRun': str(write_json(paths['artifacts'] / 'VCS-011-deep-scan-run.json', report['deepScanRun'])),
        'environmentMirror': str(write_json(paths['artifacts'] / 'VCS-012-environment-mirror.json', report['environmentMirror'])),
        'platformManifest': str(write_json(paths['artifacts'] / 'VCS-013-platform-manifest.json', report['platformManifest'])),
        'powerMesh': str(write_json(paths['artifacts'] / 'VCS-014-power-mesh.json', report['powerMesh'])),
        'workspacePortfolio': str(write_json(paths['artifacts'] / 'VCS-015-workspace-portfolio.json', report['workspacePortfolio'])),
        'runtimeMatrix': str(write_json(paths['artifacts'] / 'VCS-019-runtime-matrix.json', report['runtimeMatrix'])),
        'executionMatrix': str(write_json(paths['artifacts'] / 'VCS-021-execution-matrix.json', report['executionMatrix'])),
        'councilArbitration': str(write_json(paths['artifacts'] / 'VCS-018-council-arbitration.json', report['councilArbitration'])),
        'repairIntelligence': str(write_json(paths['artifacts'] / 'VCS-022-repair-intelligence.json', report['repairIntelligence'])),
        'publicTrustReadiness': str(write_json(paths['artifacts'] / 'VCS-023-public-trust-readiness.json', report['publicTrustChain'])),
        'publicTrustPack': str(paths['artifacts'] / 'VCS-024-public-trust-pack.zip'),
    }
    authority_bundle = build_authority_artifacts(report, artifacts, paths['artifacts'])
    report['authority'] = authority_bundle
    report['completionLedger'] = build_completion_ledger(report)
    report['evidenceSummary'] = build_evidence_summary(report)
    artifacts['completionLedger'] = str(write_json(paths['artifacts'] / 'VCS-020-completion-ledger.json', report['completionLedger']))
    artifacts['authorityCertificate'] = str(write_json(paths['artifacts'] / 'VCS-016-authority-certificate.json', authority_bundle['certificate']))
    artifacts['authorityVerification'] = str(write_json(paths['artifacts'] / 'VCS-017-authority-verification.json', authority_bundle['verification']))
    artifacts['directive'] = str(write_text(paths['artifacts'] / 'VCS-009-skyehands-directive.md', build_directive(report)))
    artifacts['scorecard'] = str(write_json(paths['artifacts'] / 'VCS-004-scorecard.json', report))
    summary = {
        'workspaceId': workspace_id,
        'issuedValue': report['valuation']['values']['issuedSkyeHandsCertificationValue'],
        'certification': report['valuation']['certification']['label'],
        'overallScore': report['valuation']['overallScore'],
        'issueCount': len(report['issues']),
        'runtimeProofStatus': report['runtimeProof']['status'],
        'authorityVerified': authority_bundle['verification']['verified'],
        'portfolioScore': report['workspacePortfolio']['portfolioScore'],
        'completionPercent': report['completionLedger']['completionPercent'],
        'executionStatus': report['executionMatrix']['overallStatus'],
        'repairMode': report['repairIntelligence']['mode'],
        'publicTrustVerified': bool(report['publicTrustChain'].get('verification', {}).get('verified') or report['publicTrustChain'].get('verified')),
    }
    return {'artifacts': artifacts, 'summary': summary, 'report': report}

def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit('usage: scan_zip.py <workspace_id> <zip_path> <metadata_json>')
    workspace_id = sys.argv[1]
    zip_path = Path(sys.argv[2]).resolve()
    metadata = read_json(Path(sys.argv[3]), {}) or {}
    result = scan_workspace(workspace_id, zip_path, metadata)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
