#!/usr/bin/env python3
import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page();page.goto('http://127.0.0.1:8765/web/');page.wait_for_function('typeof window.runNative === "function"')
    print(page.evaluate('({isolated:crossOriginIsolated,agent:navigator.userAgent})'),flush=True)
    page.on('console',lambda m:print('CONSOLE',m.text,flush=True));page.on('pageerror',lambda e:print('PAGEERROR',e,flush=True))
    for bits,workers,spill in [(32,1,False),(32,4,True),(64,3,True)]:
        result=page.evaluate('(o)=>window.runNative(o)',{'degree':7,'bits':bits,'workers':workers,'spill':spill,'resume':False})
        assert result['complete'] and result['completedThroughDegree']==7
        assert result['basisSize']==695,(bits,result)
        assert result['terms']>4000
        results.append({'test':'browser-completion','bits':bits,'workers':workers,'spill':spill,**{k:v for k,v in result.items() if k!='preview'}})
        print(json.dumps(results[-1]),flush=True)
    browser.close()
(ROOT/'results/browser-tests.json').write_text(json.dumps(results,indent=2))
