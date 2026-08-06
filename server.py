import http.server
import socketserver
import os
import urllib.parse

PORT = 8080

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

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), CleanURLHandler) as httpd:
        print(f"Serving at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
