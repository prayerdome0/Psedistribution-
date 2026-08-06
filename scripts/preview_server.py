#!/usr/bin/env python3
"""Preview server mimicking vercel.json clean URLs (extensionless -> .html)."""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# read rewrites from vercel.json
import json
try:
    V = json.load(open(os.path.join(ROOT, 'vercel.json'), encoding='utf-8'))
    REWRITES = V.get('rewrites', [])
except Exception:
    REWRITES = []

def resolve(path):
    if path in ('', '/'):
        return 'index.html'
    if path.endswith('/'):
        path = path[:-1]
    base = path.lstrip('/')
    if os.path.isfile(os.path.join(ROOT, base)):
        return base
    # vercel rewrites
    for r in REWRITES:
        src = r.get('source', '')
        dst = r.get('destination', '')
        if ':' in src:
            pat = re.sub(r':path\*', '.*', src)
            pat = re.sub(r':[a-zA-Z]+', '[^/]+', pat)
            if re.fullmatch(pat, path):
                return dst.lstrip('/')
        elif src.lstrip('/') == path.lstrip('/'):
            return dst.lstrip('/')
    if os.path.isfile(os.path.join(ROOT, base + '.html')):
        return base + '.html'
    return '404.html'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def do_GET(self):
        # Handle API routes
        url_path = self.path.split('?')[0].rstrip('/')
        if url_path == '/api/inventory' or url_path.startswith('/api/inventory/'):
            self.handle_inventory_api()
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        url_path = self.path.split('?')[0].rstrip('/')
        if url_path == '/api/send-email':
            self.handle_send_email_api()
            return
        
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error": "Not Found"}')

    def handle_send_email_api(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            to_email = data.get('to')
            subject = data.get('subject')
            html_content = data.get('html')
            api_key = data.get('apiKey') or os.environ.get('PSE_RESEND_KEY') or ''
            
            # Make request to Resend API
            import urllib.request
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            resend_payload = {
                'from': 'Pilot Sales Distribution <support@pilotsalesdistribution.com>',
                'to': to_email,
                'subject': subject,
                'html': html_content
            }
            
            req = urllib.request.Request(
                'https://api.resend.com/emails',
                data=json.dumps(resend_payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_body.encode('utf-8'))
                return
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
    def handle_inventory_api(self):
        import urllib.parse
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        slug_match = re.match(r'^/api/inventory/([^/?#]+)', parsed.path)
        
        # Load snapshot data
        snapshot_path = os.path.join(ROOT, 'services', 'pse-inventory', 'data', 'current.json')
        if not os.path.isfile(snapshot_path):
            snapshot_path = os.path.join(ROOT, 'apps', 'pse-inventory-catalog', 'data', 'current.json')
        
        items = []
        meta = {
            "totalCount": 0,
            "schemaVersion": "4.0.0",
            "snapshotVersion": "sha256:d81cd244e9a8fb2b29a093bd7461cdfc2922245801a111807e767ec52517bec4",
            "sourceVersion": "sha256:36a2b16545db8d6a071061dfde1f89d33cebd3258d47ff7166266b68a90206e9",
            "generatedAt": "2026-08-06T12:00:00Z"
        }
        if os.path.isfile(snapshot_path):
            try:
                with open(snapshot_path, 'r', encoding='utf-8') as f:
                    snap = json.load(f)
                    items = snap.get('items', [])
                    meta['snapshotVersion'] = snap.get('snapshotVersion', meta['snapshotVersion'])
                    meta['sourceVersion'] = snap.get('sourceVersion', meta['sourceVersion'])
                    meta['generatedAt'] = snap.get('generatedAt', meta['generatedAt'])
            except Exception as e:
                pass
        
        if slug_match:
            slug = urllib.parse.unquote(slug_match.group(1))
            found = next((i for i in items if i.get('slug') == slug or i.get('dealId') == slug), None)
            if found:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(found).encode('utf-8'))
                return
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Item not found"}).encode('utf-8'))
                return
        
        # Filter items
        filtered = items
        q = (params.get('q', [''])[0]).strip().lower()
        cat = (params.get('category', [''])[0]).strip().lower()
        
        if q:
            filtered = [i for i in filtered if q in (i.get('title','') + ' ' + i.get('brand','') + ' ' + i.get('dealId','') + ' ' + i.get('shortDescription','')).lower()]
        if cat and cat != 'all':
            filtered = [i for i in filtered if i.get('category','').lower() == cat]
            
        limit = min(max(int(params.get('limit', [100])[0]), 1), 100)
        paged = filtered[:limit]
        
        meta['totalCount'] = len(filtered)
        meta['returnedCount'] = len(paged)
        meta['nextCursor'] = None
        
        res = {
            "data": paged,
            "meta": meta
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(res).encode('utf-8'))

    def translate_path(self, path):
        resolved = resolve(path)
        return os.path.join(ROOT, resolved)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
