#!/usr/bin/env python3
"""Real Playwright browser/OPFS tests. No mocked browser APIs.

Run after `python -m playwright install --with-deps firefox chromium`.
This is a LOCAL static-host simulation, not a test of a deployed GitHub URL.
Every failure is recorded and produces a nonzero exit code; missing browsers
are not silently marked as passed. The module can be imported without running.
"""
from __future__ import annotations
import argparse, contextlib, http.server, json, shutil, tempfile, threading, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

@contextlib.contextmanager
def static_host(directory: Path, isolated: bool):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(directory), **kw)
        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache')
            if isolated:
                self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
                self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
                self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
            super().end_headers()
        def log_message(self, *a):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}'
    finally:
        server.shutdown(); server.server_close(); thread.join()

def matrix(browser, directory: Path):
    fixture = json.loads((ROOT / 'fixtures/fk6.json').read_text())
    reports = []
    def record(name, result):
        reports.append({'test': name, 'passed': True, **result})
    def run(page, **options):
        return page.evaluate('(o) => window.runNative(o)', {
            'data': fixture, 'degree': 4, 'workers': 3, 'resume': False,
            'hilbertRequired': True, 'budgetBytes': 128*1048576,
            'memoryPolicy': 'auto', **options})
    def verify(r):
        assert r['basisSize'] == 265, r
        assert r['hilbert']['coefficients'] == ['1','15','125','765','3831'], r
    with static_host(directory, False) as origin, browser.new_context() as ctx:
        page=ctx.new_page(); page.set_default_timeout(60000)
        page.goto(origin+'/george/#preserve-this-fragment')
        page.wait_for_function('typeof window.runNative === "function"')
        assert not page.evaluate('crossOriginIsolated')
        r=run(page, execution='auto', spill=False); verify(r)
        assert r['shared'] is False and r['workers'] == 1, r
        record('plain-static-host-unshared-fallback', {'mode': r['executionMode']})
        r=run(page, execution='single', spill=True, storageFallback=False, runKey='browser-single')
        verify(r); assert r['storage']=='opfs', r
        record('plain-static-host-exclusive-OPFS', {'mode':r['ioMode']})
        outcome=page.evaluate('''async o => {try {await window.runNative(o); return {unexpectedSuccess:true};}
          catch(e){return {code:e.code,message:e.message};}}''', {'data':fixture,'degree':3,'execution':'multicore','spill':False})
        assert outcome.get('code')=='ISOLATION_REQUIRED',outcome
        record('strict-multicore-without-isolation', {})
        status=page.evaluate('() => window.enableFomkyrIsolation(false)')
        assert status['status'] in ('reload-required','ready'),status
        page.reload(); page.wait_for_function('typeof window.runNative === "function"')
        assert page.url.endswith('#preserve-this-fragment'),page.url
        assert page.evaluate('navigator.serviceWorker.controller !== null')
        isolated=page.evaluate('crossOriginIsolated')
        r=run(page, execution='auto', spill=True, storageFallback=False, ioMode='broker',runKey='browser-static-sw')
        verify(r); assert r['shared']==isolated,r
        assert r['workers']==(3 if isolated else 1),r
        record('project-subpath-service-worker-and-automatic-mode', {'crossOriginIsolated':isolated,'mode':r['executionMode'],'io':r['ioMode'],'fragmentPreserved':True})
        # Project-scoped worker must not take over an unrelated sibling page.
        sibling=ctx.new_page();sibling.goto(origin+'/other/')
        assert not sibling.evaluate('navigator.serviceWorker.controller !== null')
        record('service-worker-scope-does-not-cover-sibling', {})
    with static_host(directory, True) as origin, browser.new_context() as ctx:
        page=ctx.new_page();page.set_default_timeout(60000)
        page.goto(origin+'/george/');page.wait_for_function('typeof window.runNative === "function"')
        assert page.evaluate('crossOriginIsolated')
        for io in ('auto','broker'):
            r=run(page,execution='multicore',spill=True,storageFallback=False,ioMode=io,runKey='browser-isolated-'+io)
            verify(r);assert r['shared'] and r['workers']==3,r
            if io=='broker': assert r['ioMode']=='broker-exclusive',r
            record('isolated-multicore-OPFS-'+io,{'mode':r['executionMode'],'io':r['ioMode']})
        r=run(page,bits=64,execution='auto',spill=False);verify(r)
        record('memory64-or-declared-fallback',{'bits':r['bits'],'fallbacks':r['fallbacks']})
        # Long words use the same real browser backend, not a JS algebra mock.
        d=33;f={'variables':['a','b'],'relations':[{'degree':d,'terms':[{'word':[1]*d,'coefficient':'1'},{'word':[0]*d,'coefficient':'-1'}]}]}
        r=run(page,data=f,degree=d+1,execution='multicore',spill=True,storageFallback=False,ioMode='broker',runKey='browser-long')
        assert r['basisSize']==2 and r['completedThroughDegree']==34,r
        record('long-word-record-and-Hilbert',{'degree':34})
    return reports

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser',choices=['firefox','chromium','all'],default='all')
    parser.add_argument('--chromium-executable',type=Path)
    parser.add_argument('--report',type=Path,default=ROOT/'results/browser-tests.json')
    args=parser.parse_args()
    from playwright.sync_api import sync_playwright
    result={'host':'real Playwright browsers; real browser OPFS; local static subpath simulation','browsers':[]}
    with tempfile.TemporaryDirectory(prefix='fomkyr-browser-') as td:
        directory=Path(td);shutil.copytree(ROOT/'web',directory/'george')
        (directory/'other').mkdir();(directory/'other/index.html').write_text('<!doctype html><title>Uncontrolled sibling</title>')
        with sync_playwright() as p:
            for name in (['firefox','chromium'] if args.browser=='all' else [args.browser]):
                entry={'browser':name,'passed':False};browser=None
                try:
                    kw={'headless':True}
                    if name=='chromium':
                        kw['args']=['--no-sandbox','--disable-dev-shm-usage']
                        if args.chromium_executable:kw['executable_path']=str(args.chromium_executable)
                    browser=getattr(p,name).launch(**kw)
                    entry['version']=browser.version
                    entry['reports']=matrix(browser,directory);entry['passed']=True
                except Exception as e:
                    entry['error']=str(e);entry['traceback']=traceback.format_exc()
                finally:
                    if browser:browser.close()
                    result['browsers'].append(entry)
    result['passed']=all(x['passed'] for x in result['browsers'])
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
    return 0 if result['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
