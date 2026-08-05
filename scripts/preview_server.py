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
