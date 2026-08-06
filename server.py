import http.server
import socketserver
import os
import urllib.parse
import json
import re

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Remove query parameters and anchors
        path = urllib.parse.urlparse(path).path
        full_path = super().translate_path(path)
        
        if not os.path.exists(full_path):
            html_path = full_path + '.html'
            if os.path.exists(html_path):
                return html_path
        return full_path

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        # Handle API routes
        url_path = self.path.split('?')[0].rstrip('/')
        if url_path == '/api/inventory' or url_path.startswith('/api/inventory/'):
            # Simple list/single item
            self.handle_inventory_api()
            return
        super().do_GET()

    def do_POST(self):
        url_path = self.path.split('?')[0].rstrip('/')
        if url_path == '/api/send-email':
            self.handle_send_email_api()
            return
        
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error": "Not Found"}')

    def handle_inventory_api(self):
        # Load snapshot data
        snapshot_path = os.path.join(ROOT, 'services', 'pse-inventory', 'data', 'current.json')
        if not os.path.isfile(snapshot_path):
            snapshot_path = os.path.join(ROOT, 'apps', 'pse-inventory-catalog', 'data', 'current.json')
        
        items = []
        meta = {
            "totalCount": 0,
            "schemaVersion": "4.0.0",
            "generatedAt": "2026-08-06T12:00:00Z"
        }
        if os.path.isfile(snapshot_path):
            try:
                with open(snapshot_path, 'r', encoding='utf-8') as f:
                    snap = json.load(f)
                    items = snap.get('items', [])
            except Exception:
                pass
        
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        slug_match = re.match(r'^/api/inventory/([^/?#]+)', parsed.path)
        
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

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), CleanURLHandler) as httpd:
        print(f"Serving at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
