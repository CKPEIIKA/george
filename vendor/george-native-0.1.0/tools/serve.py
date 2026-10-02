#!/usr/bin/env python3
"""Development-only HTTP server with the isolation headers WASM threads require."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,os
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin')
        self.send_header('Cross-Origin-Embedder-Policy','require-corp')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default='.');p.add_argument('--port',type=int,default=8765);a=p.parse_args();os.chdir(a.root)
    ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
