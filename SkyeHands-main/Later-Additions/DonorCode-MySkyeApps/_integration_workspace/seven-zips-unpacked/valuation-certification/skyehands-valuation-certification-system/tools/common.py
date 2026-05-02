from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import zipfile
import hashlib
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ROOT = Path(os.environ.get('SKYEHANDS_VCS_ROOT', Path(__file__).resolve().parents[1]))
WORKSPACES_DIR = ROOT / 'data' / 'workspaces'
CONFIG_DIR = ROOT / 'config'

TEXT_EXTENSIONS = {
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.html', '.css', '.scss', '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php', '.yml', '.yaml', '.toml', '.env', '.example', '.sh', '.sql', '.graphql', '.xml'
}

LANGUAGE_MAP = {
    '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.jsx': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.py': 'Python', '.java': 'Java', '.kt': 'Kotlin', '.go': 'Go', '.rs': 'Rust',
    '.rb': 'Ruby', '.php': 'PHP', '.sql': 'SQL', '.html': 'HTML', '.css': 'CSS',
    '.scss': 'SCSS', '.sh': 'Shell', '.json': 'JSON', '.md': 'Markdown', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.xml': 'XML'
}

IGNORE_SEGMENTS = {
    'node_modules', '.git', '.next', '.turbo', '.cache', 'coverage', 'dist', 'build', '__pycache__', '.venv', 'venv'
}

ENV_VAR_RE = re.compile(r'\b([A-Z][A-Z0-9_]{2,})\b')


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return fallback


def write_json(path: Path, payload: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    return path


def write_text(path: Path, value: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8')
    return path


def stable_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode('utf-8')).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def workspace_paths(workspace_id: str) -> Dict[str, Path]:
    base = WORKSPACES_DIR / workspace_id
    return {
        'base': base,
        'intake': base / 'intake',
        'runtime': base / 'runtime',
        'artifacts': base / 'artifacts',
        'logs': base / 'logs',
        'workspace': base / 'workspace.json'
    }


def safe_extract_zip(zip_path: Path, dest_dir: Path) -> List[str]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted: List[str] = []
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            member_path = dest_dir / member.filename
            resolved = member_path.resolve()
            if not str(resolved).startswith(str(dest_dir.resolve())):
                continue
            if member.is_dir():
                resolved.mkdir(parents=True, exist_ok=True)
                continue
            resolved.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member, 'r') as source, resolved.open('wb') as target:
                shutil.copyfileobj(source, target)
            extracted.append(member.filename)
    return extracted


def should_ignore(path: Path) -> bool:
    return any(part in IGNORE_SEGMENTS for part in path.parts)


def iter_text_files(root: Path) -> Iterable[Path]:
    for path in root.rglob('*'):
        if not path.is_file() or should_ignore(path):
            continue
        suffix = path.suffix.lower()
        if suffix in TEXT_EXTENSIONS or path.name.lower().endswith(('.env.example', '.env.sample')):
            yield path


def read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding='latin-1')
        except Exception:
            return ''
    except Exception:
        return ''


def language_summary(root: Path) -> Tuple[Dict[str, int], Dict[str, int]]:
    counts: Dict[str, int] = {}
    lines: Dict[str, int] = {}
    for file_path in iter_text_files(root):
        language = LANGUAGE_MAP.get(file_path.suffix.lower())
        if not language:
            continue
        counts[language] = counts.get(language, 0) + 1
        text = read_text_safe(file_path)
        lines[language] = lines.get(language, 0) + sum(1 for line in text.splitlines() if line.strip())
    return counts, lines


def detect_env_vars(text: str) -> List[str]:
    values = []
    for match in ENV_VAR_RE.findall(text):
        if match.startswith(('HTTP', 'HTML', 'JSON', 'UUID')):
            continue
        if len(match) > 64:
            continue
        values.append(match)
    return sorted(set(values))


def zip_directory(source_dir: Path, output_zip: Path) -> Path:
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(source_dir.rglob('*')):
            if path.is_dir():
                continue
            arcname = path.relative_to(source_dir)
            zf.write(path, arcname.as_posix())
    return output_zip


def load_integration_ledger() -> Dict[str, Any]:
    return read_json(CONFIG_DIR / 'integration_ledger_2026.json', {})


def load_weights() -> Dict[str, Any]:
    return read_json(CONFIG_DIR / 'valuation_weights_2026.json', {})


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def format_money(value: float) -> str:
    return f"${value:,.0f}"


def top_n(mapping: Dict[str, Any], limit: int = 5) -> List[Tuple[str, Any]]:
    return sorted(mapping.items(), key=lambda item: item[1], reverse=True)[:limit]
