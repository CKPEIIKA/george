#!/usr/bin/env python3
"""Development-only HTTP server with the isolation headers WASM threads require."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,os
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if not getattr(self.server,'plain',False):
            self.send_header('Cross-Origin-Opener-Policy','same-origin')
            self.send_header('Cross-Origin-Embedder-Policy','require-corp')
            self.send_header('Cross-Origin-Resource-Policy','same-origin')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default='.');p.add_argument('--port',type=int,default=8765);p.add_argument('--plain',action='store_true',help='Static-host simulation: no isolation headers');a=p.parse_args();os.chdir(a.root)
    server=ThreadingHTTPServer(('127.0.0.1',a.port),Handler);server.plain=a.plain;server.serve_forever()
