import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from skyequanta_runtime_bootstrap import configure_runtime

configure_runtime()

OPENHANDS_ENABLED = False
OPENHANDS_IMPORT_ERROR = None
v1_router = None

try:
    from openhands.app_server.v1_router import router as imported_v1_router
    v1_router = imported_v1_router
    OPENHANDS_ENABLED = True
except Exception as error:  # pragma: no cover - fallback mode is intentional
    OPENHANDS_IMPORT_ERROR = f"{type(error).__name__}: {error}"

app = {'name': 'skyequanta-stdlib-app-server'}


def _workspace_root() -> Path:
    value = os.getenv('SKYEQUANTA_WORKSPACE_ROOT') or os.getcwd()
    root = Path(value).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_path(relative_path: str) -> Path:
    root = _workspace_root()
    relative = (relative_path or '').replace('\\', '/').lstrip('/')
    candidate = (root / relative).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError('path_outside_workspace')
    return candidate


def _list_workspace(relative_path: str = '') -> dict:
    target = _safe_path(relative_path)
    entries = []
    if target.exists() and target.is_dir():
        for entry in sorted(target.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
            stats = entry.stat()
            entries.append({
                'name': entry.name,
                'path': entry.relative_to(_workspace_root()).as_posix(),
                'kind': 'directory' if entry.is_dir() else 'file',
                'size': stats.st_size,
                'modifiedAt': stats.st_mtime,
            })
    return {'path': relative_path or '', 'entries': entries}


def _read_workspace_file(relative_path: str) -> dict:
    target = _safe_path(relative_path)
    if not target.exists() or not target.is_file():
        raise FileNotFoundError(relative_path)
    content = target.read_text(encoding='utf-8')
    return {'path': relative_path, 'content': content, 'size': len(content.encode('utf-8'))}


def _write_workspace_file(relative_path: str, content: str) -> dict:
    target = _safe_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content or '', encoding='utf-8')
    stats = target.stat()
    return {'path': relative_path, 'size': stats.st_size, 'modifiedAt': stats.st_mtime}


def _capabilities() -> dict:
    return {
        'serviceMode': 'openhands-full' if OPENHANDS_ENABLED else 'foundation-fastapi',
        'realIdeRuntime': False,
        'realAgentRuntime': True,
        'workspaceBound': True,
        'fullOpenHandsRuntime': OPENHANDS_ENABLED,
        'fallbackReason': OPENHANDS_IMPORT_ERROR,
        'workspaceRoot': str(_workspace_root()),
    }


def _json(handler: BaseHTTPRequestHandler, status: int, payload: dict):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', '*')
    handler.end_headers()
    handler.wfile.write(body)


def _text(handler: BaseHTTPRequestHandler, status: int, text: str):
    body = text.encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'text/plain; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = 'SkyeQuantaAppServer/0.1'

    def log_message(self, fmt, *args):
        return

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        pathname = parsed.path
        if pathname in ('/alive', '/health', '/ready'):
            return _text(self, 200, 'OK')
        if pathname == '/capabilities':
            return _json(self, 200, {'ok': True, 'capabilities': _capabilities()})
        if pathname == '/docs':
            return _json(self, 200, {'ok': True, 'docs': 'stdlib-fallback', 'openhandsEnabled': OPENHANDS_ENABLED})
        if pathname == '/api/workspace/summary':
            summary = _list_workspace('')
            return _json(self, 200, {
                'ok': True,
                'workspaceRoot': str(_workspace_root()),
                'entryCount': len(summary['entries']),
                'entries': summary['entries'][:50],
                'capabilities': _capabilities(),
            })
        if pathname == '/api/files':
            return _json(self, 200, {'ok': True, **_list_workspace((query.get('pathname') or [''])[0])})
        if pathname == '/api/file':
            try:
                return _json(self, 200, {'ok': True, **_read_workspace_file((query.get('pathname') or [''])[0])})
            except Exception as error:
                return _json(self, 404, {'ok': False, 'error': f"{type(error).__name__}: {error}", 'path': (query.get('pathname') or [''])[0]})
        return _json(self, 404, {'ok': False, 'error': 'not_found', 'path': pathname})

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/file':
            return _json(self, 404, {'ok': False, 'error': 'not_found', 'path': parsed.path})
        length = int(self.headers.get('Content-Length', '0') or '0')
        raw = self.rfile.read(length) if length else b''
        try:
            payload = json.loads(raw.decode('utf-8') or '{}')
            pathname = str(payload.get('pathname') or '')
            content = str(payload.get('content') or '')
            return _json(self, 200, {'ok': True, **_write_workspace_file(pathname, content)})
        except Exception as error:
            return _json(self, 400, {'ok': False, 'error': f"{type(error).__name__}: {error}"})


def run_server(host: str, port: int):
    server = ThreadingHTTPServer((host, port), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default=os.getenv('BACKEND_HOST') or '127.0.0.1')
    parser.add_argument('--port', type=int, default=int(os.getenv('BACKEND_PORT') or '3000'))
    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == '__main__':
    main()
