import http.server
import socketserver
import os
import urllib.parse
import hashlib
import http.client
import ssl
import json
import sys
import time

PORT = 8000
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '').strip()
# Simple session management (In a real app, use secure signed cookies)
SESSION_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest() if ADMIN_PASSWORD else ''
GATEWAY_HOST = os.environ.get('KAIXU_GATEWAY_URL', '').strip()

# --- Load .env file (key never hardcoded in app code) ---
def load_dotenv(path=None):
    """Read .env from workspace root (one directory above this script)."""
    if path is None:
        # server.py is in skAIxuide/, .env is in workspace root
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
    path = os.path.abspath(path)
    if os.path.isfile(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
        print(f"[env] Loaded .env from {path}", flush=True)
    else:
        print(f"[env] No .env found at {path}", flush=True)

load_dotenv()

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

socketserver.TCPServer.allow_reuse_address = True

class AuthHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Normalize path
        path = self.path.split('?')[0]
        
        # Redirect root to IDE
        if path == '/':
            self.send_response(303)
            self.send_header('Location', '/skAIxuide/index.html')
            self.end_headers()
            return

        # Serve Project Index (JSON) for sidebar
        if path == '/api/fs/projects':
            projects = []
            try:
                for entry in os.scandir('.'):
                    if entry.is_dir() and not entry.name.startswith('.') and not entry.name == 'node_modules':
                        # Check if it has index.html or similar
                        has_index = os.path.exists(os.path.join(entry.path, 'index.html'))
                        projects.append({
                            "name": entry.name,
                            "path": f"/{entry.name}/index.html" if has_index else f"/{entry.name}/",
                            "has_index": has_index
                        })
            except Exception as e:
                print(f"Error listing projects: {e}")
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(projects).encode())
            return

        # 1. Admin Protection (paths adjusted for workspace root serving)
        if path == '/admin' or path == '/skAIxuide/admin' or path == '/skAIxuide/admin_panel.html' or path == '/skaixuide/admin' or path == '/skaixuide/admin_panel.html':
            if self.check_auth():
                # Serve Admin Panel from correct location
                if path == '/admin':
                   self.send_response(303)
                   self.send_header('Location', '/skAIxuide/admin_panel.html')
                   self.end_headers()
                   return
                return http.server.SimpleHTTPRequestHandler.do_GET(self)
            else:
                # Redirect to Login
                self.send_response(303)
                self.send_header('Location', '/skAIxuide/login.html')
                self.end_headers()
                return

        # 2. Login Page
        if path == '/login' or path == '/skAIxuide/login' or path == '/skaixuide/login':
            self.send_response(303)
            self.send_header('Location', '/skAIxuide/login.html')
            self.end_headers()
            return

        # 3. Serve other files normally
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path = self.path.split('?')[0]
        
        # PROXY LOGIC (Solves CORS)
        if path.startswith('/api/'):
            self.handle_proxy(path)
            return

        if path.endswith('/login') or path.endswith('/login.html'):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            params = urllib.parse.parse_qs(post_data)
            
            password = params.get('password', [''])[0]
            
            if not ADMIN_PASSWORD:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Admin login disabled until ADMIN_PASSWORD is configured"}).encode())
            elif password == ADMIN_PASSWORD:
                self.send_response(303)
                self.send_header('Set-Cookie', f'sk_admin_session={SESSION_TOKEN}; Path=/; HttpOnly')
                self.send_header('Location', '/skAIxuide/admin_panel.html')
                self.end_headers()
            else:
                # Redirect back to login on failure
                self.send_response(303)
                self.send_header('Location', '/skAIxuide/login.html?error=1')
                self.end_headers()
            return

        return http.server.SimpleHTTPRequestHandler.do_POST(self)

    def handle_proxy(self, path):
        if not GATEWAY_HOST:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "KAIXU_GATEWAY_URL is not configured"}).encode())
            return

        # Strip /api prefix to get the relative path for the gateway
        # Example: /api/.netlify/functions/gateway-stream -> /.netlify/functions/gateway-stream
        target_path = path[4:] 
        target_url = GATEWAY_HOST + target_path
        is_stream = 'gateway-stream' in target_path
        stream_start = time.time()
        
        print(f"[Proxy] Forwarding to: {target_url}", flush=True)

        try:
            # Read incoming body
            content_length_header = self.headers.get('Content-Length')
            content_length = int(content_length_header) if content_length_header else 0
            body = self.rfile.read(content_length)

            # Parse the gateway host
            from urllib.parse import urlparse
            parsed = urlparse(GATEWAY_HOST)
            is_https = parsed.scheme == 'https'

            # Use http.client for TRUE streaming (urllib buffers everything)
            if is_https:
                ctx = ssl.create_default_context()
                conn = http.client.HTTPSConnection(parsed.hostname, parsed.port or 443,
                                                    context=ctx, timeout=120)
            else:
                conn = http.client.HTTPConnection(parsed.hostname, parsed.port or 80,
                                                   timeout=120)

            # Build outgoing headers
            out_headers = {'Content-Type': 'application/json'}
            auth_val = self.headers.get('Authorization')
            # Auto-inject key from .env if client didn't send one
            if not auth_val and OPENAI_API_KEY:
                auth_val = f'Bearer {OPENAI_API_KEY}'
            if auth_val:
                out_headers['Authorization'] = auth_val
            # Only set SSE accept header for streaming endpoints
            if is_stream:
                out_headers['Accept'] = 'text/event-stream'
            else:
                out_headers['Accept'] = 'application/json'
            out_headers['Content-Length'] = str(len(body))

            conn.request('POST', target_path, body=body, headers=out_headers)
            resp = conn.getresponse()

            print(f"[Proxy] Gateway responded: {resp.status} {resp.reason}", flush=True)
            if is_stream:
                print(f"[Proxy][DIAG] SSE stream started | payload={len(body)} bytes | t=0.0s", flush=True)

            # Send status + headers to the browser
            self.send_response(resp.status)
            # Forward response headers (skip hop-by-hop)
            skip = {'transfer-encoding', 'connection', 'content-encoding', 'content-length'}
            for k, v in resp.getheaders():
                if k.lower() not in skip:
                    self.send_header(k, v)
            # Force no-buffering headers for SSE
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('X-Accel-Buffering', 'no')
            self.end_headers()

            # Stream response body — use read1() for true non-blocking SSE
            # read(n) blocks until it collects n bytes; read1(n) returns immediately
            # with whatever bytes the socket has available (critical for SSE)
            total_bytes = 0
            chunk_num = 0
            stream_start = time.time()
            last_chunk_time = stream_start
            while True:
                try:
                    chunk = resp.read1(65536)  # returns immediately with available bytes
                except Exception:
                    chunk = resp.read(256)  # fallback for older Python
                if not chunk:
                    break
                chunk_num += 1
                now = time.time()
                elapsed = now - stream_start
                gap = now - last_chunk_time
                last_chunk_time = now

                if is_stream:
                    # Parse SSE event types passing through for diagnostic visibility
                    try:
                        snippet = chunk[:512].decode('utf-8', errors='replace')
                        events_in_chunk = []
                        for line in snippet.split('\n'):
                            if line.startswith('event:'):
                                events_in_chunk.append(line.split(':', 1)[1].strip())
                        evt_label = ','.join(events_in_chunk) if events_in_chunk else '(data)'
                        print(f"[Proxy][DIAG] chunk#{chunk_num} | {len(chunk)}B | +{gap:.1f}s gap | {elapsed:.1f}s total | events=[{evt_label}]", flush=True)
                    except Exception:
                        print(f"[Proxy][DIAG] chunk#{chunk_num} | {len(chunk)}B | +{gap:.1f}s gap | {elapsed:.1f}s total", flush=True)

                self.wfile.write(chunk)
                self.wfile.flush()
                total_bytes += len(chunk)

            stream_elapsed = time.time() - stream_start
            if is_stream:
                print(f"[Proxy][DIAG] SSE stream CLOSED by upstream | {total_bytes}B total | {chunk_num} chunks | {stream_elapsed:.1f}s duration", flush=True)
            print(f"[Proxy] Streamed {total_bytes} bytes to client", flush=True)
            conn.close()

        except http.client.IncompleteRead as e:
            # Write whatever partial data we got
            if e.partial:
                try:
                    self.wfile.write(e.partial)
                    self.wfile.flush()
                except: pass
            print(f"[Proxy] IncompleteRead: got {len(e.partial)} bytes partial", flush=True)
            if is_stream:
                print(f"[Proxy][DIAG] IncompleteRead after {time.time() - stream_start:.1f}s — upstream may have timed out", flush=True)
        except BrokenPipeError:
            print("[Proxy] Client disconnected (BrokenPipe)", flush=True)
        except Exception as e:
            print(f"[Proxy Error] {type(e).__name__}: {e}", flush=True)
            try:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Proxy error: {e}"}).encode())
            except: pass

    def check_auth(self):
        cookie_header = self.headers.get('Cookie')
        if not cookie_header:
            return False
        
        # Simple cookie parsing
        if SESSION_TOKEN and f'sk_admin_session={SESSION_TOKEN}' in cookie_header:
            return True
        return False

if __name__ == "__main__":
    # Ensure stdout is flushed for logs
    sys.stdout.reconfigure(line_buffering=True)
    
    # Serve from workspace root to allow access to all projects
    root_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    os.chdir(root_dir)
    print(f"Serving workspace from: {root_dir}")

    with socketserver.TCPServer(("", PORT), AuthHandler) as httpd:
        print(f"Serving at port {PORT}")
        print("Admin auth:", "configured" if ADMIN_PASSWORD else "disabled (set ADMIN_PASSWORD to enable)")
        httpd.serve_forever()
