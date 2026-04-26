import os
import socket

def _read_bool(value, fallback):
    normalized = str(value or '').strip().lower()
    if not normalized:
        return fallback
    if normalized in ('1','true','yes','on'):
        return True
    if normalized in ('0','false','no','off'):
        return False
    return fallback

def _read_list(value):
    return [item.strip().lower() for item in str(value or '').split(',') if item.strip()]

_POLICY = {
    'enabled': _read_bool(os.environ.get('SKYEQUANTA_RUNTIME_EGRESS_ENABLED'), True),
    'allow_http': _read_bool(os.environ.get('SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP'), True),
    'block_private': _read_bool(os.environ.get('SKYEQUANTA_RUNTIME_EGRESS_BLOCK_PRIVATE'), True),
    'block_metadata': _read_bool(os.environ.get('SKYEQUANTA_RUNTIME_EGRESS_BLOCK_METADATA'), True),
    'allowed_hosts': list(dict.fromkeys(_read_list(os.environ.get('SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS')))),
}

def _is_local(hostname):
    normalized = str(hostname or '').strip().lower()
    return not normalized or normalized == 'localhost' or normalized.endswith('.local') or normalized.endswith('.internal')

def _is_metadata(hostname):
    normalized = str(hostname or '').strip().lower()
    return normalized in ('169.254.169.254','metadata.google.internal','metadata','100.100.100.200','169.254.170.2','fd00:ec2::254')

def _is_private_ipv4(hostname):
    try:
        parts = [int(part) for part in str(hostname).split('.')]
    except ValueError:
        return False
    if len(parts) != 4 or any(part < 0 or part > 255 for part in parts):
        return False
    a, b = parts[0], parts[1]
    return a == 10 or a == 127 or a == 0 or (a == 169 and b == 254) or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168) or (a == 100 and 64 <= b <= 127) or a >= 224

def _is_blocked_ipv6(hostname):
    normalized = str(hostname or '').strip().lower().strip('[]')
    return ':' in normalized and (normalized in ('::1','::') or normalized.startswith('fc') or normalized.startswith('fd') or normalized.startswith('fe80:'))

def _matches_allowlist(hostname):
    normalized = str(hostname or '').strip().lower()
    return not _POLICY['allowed_hosts'] or any(normalized == item or normalized.endswith('.' + item) for item in _POLICY['allowed_hosts'])

def _assert_allowed(hostname, protocol='http:'):
    if not _POLICY['enabled']:
        return
    normalized = str(hostname or '').strip().lower()
    if not normalized:
        return
    if protocol == 'http:' and not _POLICY['allow_http']:
        raise OSError(f"runtime_egress_blocked: insecure http transport blocked for '{normalized}'")
    if _POLICY['block_metadata'] and _is_metadata(normalized):
        raise OSError(f"runtime_egress_blocked: metadata target '{normalized}' is blocked")
    if _POLICY['block_private'] and (_is_local(normalized) or _is_private_ipv4(normalized) or _is_blocked_ipv6(normalized)):
        raise OSError(f"runtime_egress_blocked: private/local target '{normalized}' is blocked")
    if not _matches_allowlist(normalized):
        raise OSError(f"runtime_egress_blocked: host '{normalized}' is outside the runtime allowlist")

_original_create_connection = socket.create_connection
_original_socket_connect = socket.socket.connect
_original_getaddrinfo = socket.getaddrinfo

def _patched_create_connection(address, *args, **kwargs):
    host = address[0] if isinstance(address, tuple) and address else None
    _assert_allowed(host, 'tcp:')
    return _original_create_connection(address, *args, **kwargs)

def _patched_socket_connect(self, address):
    host = address[0] if isinstance(address, tuple) and address else None
    _assert_allowed(host, 'tcp:')
    return _original_socket_connect(self, address)

def _patched_getaddrinfo(host, port, *args, **kwargs):
    _assert_allowed(host, 'dns:')
    return _original_getaddrinfo(host, port, *args, **kwargs)

socket.create_connection = _patched_create_connection
socket.socket.connect = _patched_socket_connect
socket.getaddrinfo = _patched_getaddrinfo


try:
    import http.client as _http_client

    _original_http_connect = _http_client.HTTPConnection.connect
    _original_https_connect = _http_client.HTTPSConnection.connect

    def _patched_http_connect(self):
        _assert_allowed(getattr(self, 'host', None), 'http:')
        return _original_http_connect(self)

    def _patched_https_connect(self):
        _assert_allowed(getattr(self, 'host', None), 'https:')
        return _original_https_connect(self)

    _http_client.HTTPConnection.connect = _patched_http_connect
    _http_client.HTTPSConnection.connect = _patched_https_connect
except Exception:
    pass
