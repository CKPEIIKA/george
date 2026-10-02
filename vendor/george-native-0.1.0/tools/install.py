#!/usr/bin/env python3
"""Install a narrow overlay into a LOCAL George checkout. No network, no git commits.
Refuses unfamiliar required source shapes; --dry-run changes nothing.
"""
from pathlib import Path
import argparse,shutil,sys,difflib
p=argparse.ArgumentParser();p.add_argument('george',type=Path);p.add_argument('--dry-run',action='store_true');a=p.parse_args()
root=a.george.resolve();web=root/'web';src=Path(__file__).resolve().parents[1]
if not (web/'src/backends.js').is_file():sys.exit('Expected a George checkout containing web/src/backends.js')
changes={}
def edit(rel,fn):
    path=web/rel;text=path.read_text();changed=fn(text)
    if text!=changed:changes[path]=(text,changed)
def once(text,old,new,label):
    if new in text:return text
    if text.count(old)!=1:raise ValueError('Unexpected source shape: '+label+'; no files have been changed.')
    return text.replace(old,new,1)
try:
    edit('src/backends.js',lambda s:once(s,'export const BACKENDS = Object.freeze({',"export const BACKENDS = Object.freeze({\n  native: Object.freeze({directory:'../engine/native/', label:'Native NC (experimental)'}),",'backends registry'))
    def worker(s):
        if 'dispatchNative' in s:return s
        s="import { dispatchNative } from './native/george-entry.js';\n"+s
        return once(s,"  activeId = id;","  if (await dispatchNative({id, command, job, source, backend})) return;\n  activeId = id;",'worker dispatch')
    edit('engine/worker.js',worker)
    def bridge(s):
        if 'this.nativeControl' in s:return s
        s=once(s,'      const p = this.pending.get(data.id);',"      if (data.event?.type === 'control') this.nativeControl = data.event;\n      const p = this.pending.get(data.id);",'control event')
        s=once(s,'    this.worker?.terminate();',"    const stoppedWorker = this.worker;\n    if (this.nativeControl && stoppedWorker) {\n      Atomics.store(new Int32Array(this.nativeControl.memory.buffer, this.nativeControl.cancelOffset, 1), 0, 1);\n      stoppedWorker.postMessage({id:-1, command:'cancel', backend:'native'});\n      setTimeout(() => stoppedWorker.terminate(), 3000);\n    } else stoppedWorker?.terminate();\n    this.nativeControl = null;",'cooperative cancel')
        return s
    edit('src/engine.js',bridge)
    def syntax(s):
        old='!integer(form.memoryMiB, 128, MAX_MEMORY_MIB)';new="!integer(form.memoryMiB, 128, form.backend === 'native' ? 14304 : MAX_MEMORY_MIB)"
        s=once(s,old,new,'per-backend memory validation')
        # Preserve native tuning without adding a second settings form. Job API users may set it.
        if 'nativeOptions: form.nativeOptions' not in s:
            s=once(s,'  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);','  job.nativeOptions = form.nativeOptions;\n  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);','native options passthrough')
        return s
    edit('src/bergman-syntax.js',syntax)
    def html(s):
        if '<option value="native"' not in s:s=once(s,'<select id="backend">','<select id="backend">\n          <option value="native">Native NC - experimental, C O3/LTO + shared workers</option>','engine select')
        if 'value="14304"' not in s:
            # Insert after the select opening, independently of existing memory64 extensions.
            s=once(s,'<select id="memoryMiB" aria-describedby="memoryHint">','<select id="memoryMiB" aria-describedby="memoryHint">\n          <option value="14304">Native: 14 304 MiB (below 15 GB)</option>','memory select')
        return s
    edit('index.html',html)
    def app(s):
        if 'attachNativeResultLinks' in s:return s
        s="import { attachNativeResultLinks } from '../engine/native/result-links.js';\n"+s
        return once(s,'  renderFiles(job, files);',"  renderFiles(job, files);\n  attachNativeResultLinks($('filesOut'), res.native);",'streamed result links')
    edit('src/app.js',app)
except (ValueError,OSError) as e:sys.exit(str(e))
for path,(before,after) in changes.items():
    print('PATCH',path.relative_to(root))
    if a.dry_run:print(''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile=str(path),tofile=str(path))))
if not a.dry_run:
    for path,(before,after) in changes.items():
        backup=path.with_suffix(path.suffix+'.before-native')
        if not backup.exists():backup.write_text(before)
        path.write_text(after)
    dest=web/'engine/native';dest.mkdir(parents=True,exist_ok=True)
    for name in ['runtime.js','lane.js','engine.js','job-adapter.js','george-entry.js','result-links.js']:
        shutil.copyfile(src/'web'/name,dest/name)
    for bits in [32,64]:shutil.copyfile(src/f'dist/george{bits}.wasm',dest/f'george{bits}.wasm')
    print('Installed:',dest)
    print('Serve with COOP/COEP headers. This script does not configure GitHub Pages isolation or deploy the site.')
