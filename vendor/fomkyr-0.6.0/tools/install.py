#!/usr/bin/env python3
"""Install fomkyr in a LOCAL George checkout. Validates source edits first.
Upgrades the 0.2 overlay; recognizes old and current registry/worker layouts.
No remote repository writes, deployment, or replacement of another SW.
"""
from pathlib import Path
import argparse, shutil, sys, difflib, re
p=argparse.ArgumentParser();p.add_argument('george',type=Path);p.add_argument('--dry-run',action='store_true');a=p.parse_args()
root=a.george.resolve();web=root/'web';src=Path(__file__).resolve().parents[1]
if not (web/'src/backends.js').is_file():sys.exit('Expected a George checkout containing web/src/backends.js')
changes={};warnings=[]
def edit(rel,fn):
 path=web/rel;old=path.read_text();new=fn(old)
 if old!=new:changes[path]=(old,new)
def once(text,old,new,label):
 if new in text:return text
 if text.count(old)!=1:raise ValueError('Unexpected source shape: '+label+'; no files have been changed.')
 return text.replace(old,new,1)
def optional(text,old,new,label):
 if new in text or old not in text:return text
 return once(text,old,new,label)
try:
 def registry(s):
  entry="  fomkyr: Object.freeze({directory:'../engine/fomkyr/', worker:'../engine/fomkyr/george-worker.js', label:'fomkyr - exact NC + Hilbert', kind:'native', experimental:true, defaultHeapMiB:512, maximumHeapMiB:14304, capabilities:FOMKYR_CAPABILITIES}),"
  if entry not in s:
   pattern=r"(?m)^\s*fomkyr:\s*Object\.freeze\(\{[^\n]*\}\),?\s*$"
   if re.search(pattern,s):s=re.sub(pattern,'\n'+entry,s,count=1)
   else:s=once(s,'export const BACKENDS = Object.freeze({','export const BACKENDS = Object.freeze({\n'+entry,'backends registry')
  if "import {FOMKYR_CAPABILITIES}" not in s:s="import {FOMKYR_CAPABILITIES} from '../engine/fomkyr/backend-capabilities.js';\n"+s
  return s
 edit('src/backends.js',registry)
 def worker(s):
  if 'dispatchFomkyr' in s:return s
  s="import { dispatchFomkyr } from './fomkyr/george-entry.js';\n"+s
  old="  if (await dispatchNative({id, command, job, source, backend})) return;" if 'dispatchNative' in s else '  activeId = id;'
  return once(s,old,"  if (await dispatchFomkyr({id, command, job, source, backend})) return;\n"+old,'legacy worker dispatch')
 edit('engine/worker.js',worker)
 def bridge(s):
  if 'forwardFomkyrProgress' not in s:
   s="import {forwardFomkyrProgress} from '../engine/fomkyr/progress-view.js';\n"+s
   if '      const p = this.pending.get(data.id);' in s:
    s=once(s,'      const p = this.pending.get(data.id);',"      if (data.event?.type === 'progress') forwardFomkyrProgress(data.event);\n      const p = this.pending.get(data.id);",'live fomkyr progress')
   else:
    pattern=r"(?m)^([ \t]*)(if \(data\.event\.type === 'control')"
    s,n=re.subn(pattern,lambda m:m[1]+"if (data.event.type === 'progress') forwardFomkyrProgress(data.event);\n"+m[0],s,count=1)
    if n!=1:raise ValueError('Unexpected source shape: live fomkyr progress; no files have been changed.')
  # Keep current George's close-handshake cancellation path, but make its
  # control events and Atomics store legal on non-isolated/unshared pages.
  if 'this.nativeControl' in s:
   s=optional(s,"if (data.event.type === 'control' && data.event.memory?.buffer instanceof SharedArrayBuffer)","if (data.event.type === 'control')",'unshared control event')
   s=optional(s,"Atomics.store(new Int32Array(this.nativeControl.memory.buffer, this.nativeControl.cancelOffset, 1), 0, 1);","if (this.nativeControl.shared !== false && this.nativeControl.memory) Atomics.store(new Int32Array(this.nativeControl.memory.buffer, this.nativeControl.cancelOffset, 1), 0, 1);",'unshared cancellation')
   return s
  if 'this.fomkyrControl' not in s:
   s=once(s,'      const p = this.pending.get(data.id);',"      if (data.event?.type === 'control') this.fomkyrControl = data.event;\n      const p = this.pending.get(data.id);",'control event')
   s=once(s,'    this.worker?.terminate();',"    const stoppedWorker = this.worker;\n    if (this.fomkyrControl && stoppedWorker) {\n      if (this.fomkyrControl.shared !== false && this.fomkyrControl.memory) Atomics.store(new Int32Array(this.fomkyrControl.memory.buffer, this.fomkyrControl.cancelOffset, 1), 0, 1);\n      stoppedWorker.postMessage({id:-1, command:'cancel', backend:'fomkyr'});\n      setTimeout(() => stoppedWorker.terminate(), 3000);\n    } else stoppedWorker?.terminate();\n    this.fomkyrControl = null;",'cooperative cancel')
  else:
   s=optional(s,"      Atomics.store(new Int32Array(this.fomkyrControl.memory.buffer, this.fomkyrControl.cancelOffset, 1), 0, 1);","      if (this.fomkyrControl.shared !== false && this.fomkyrControl.memory) Atomics.store(new Int32Array(this.fomkyrControl.memory.buffer, this.fomkyrControl.cancelOffset, 1), 0, 1);",'old overlay cancellation')
  return s
 edit('src/engine.js',bridge)
 def syntax(s):
  # Current George validates memory through backend.maximumHeapMiB. Older
  # versions have the range inline; preserve the other engines' policy.
  if 'validMemoryMiB(Number(form.memoryMiB)' not in s:
   new="!integer(form.memoryMiB, 128, ['native','fomkyr'].includes(form.backend) ? 14304 : MAX_MEMORY_MIB)"
   if new not in s:
    old="!integer(form.memoryMiB, 128, form.backend === 'native' ? 14304 : MAX_MEMORY_MIB)" if "form.backend === 'native' ? 14304" in s else '!integer(form.memoryMiB, 128, MAX_MEMORY_MIB)'
    s=once(s,old,new,'per-backend memory validation')
  s=re.sub(r"^import \{ readFomkyrOptions \} from '../engine/fomkyr/controls.js';\n",'',s,flags=re.M)
  if 'import {optionsFromGeorgeForm,validateFomkyrForm}' not in s:s="import {optionsFromGeorgeForm,validateFomkyrForm} from '../engine/fomkyr/form-options.js';\n"+s
  old="  job.fomkyrOptions = { ...readFomkyrOptions(), ...form.fomkyrOptions };\n"
  s=s.replace(old,'')
  s=once(s,'  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);',"  if (form.backend === 'fomkyr') {\n    const unsupported = validateFomkyrForm(form);\n    if (unsupported.length) throw new Error(unsupported.join(' '));\n    job.fomkyrOptions = optionsFromGeorgeForm(form);\n    if (job.fomkyrOptions.hilbert !== false) job.outputs.hs = 'result.hs';\n  }\n  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);",'fomkyr settings passthrough')
  s=optional(s,"export function validateSettings(form) {\n  const errors = [];","export function validateSettings(form) {\n  const errors = validateFomkyrForm(form);",'backend form validation')
  s=optional(s,"if (form[key] !== undefined && form[key] !== '' && !integer(form[key], 1, 10000)) errors.push(`${label} must be an integer from 1 to 10000.`);","if (form[key] !== undefined && form[key] !== '' && !integer(form[key], 1, form.backend === 'fomkyr' ? 0xfffffffe : 10000)) errors.push(`${label} must be a positive integer within the selected engine's index range.`);",'degree form range')
  s=optional(s,'export function parseRelation(src, vars) {','export function parseRelation(src, vars, maxExponent = 10000) {','exponent parameter')
  s=optional(s,"if (!Number.isSafeInteger(e) || e > 10000) throw new SyntaxError('Exponents must be integers from 0 to 10000');","if (!Number.isSafeInteger(e) || e > maxExponent) throw new SyntaxError(`Exponents must be integers from 0 to ${maxExponent}`);",'exponent range')
  s=optional(s,'parseRelation(r, form.vars));',"parseRelation(r, form.vars, form.backend === 'fomkyr' ? 0xfffffffe : 10000));",'buildJob exponent range')
  # This spelling occurs twice in current sources; both are scoped to form.
  s=s.replace('parseRelation(r, form.vars || [])',"parseRelation(r, form.vars || [], form.backend === 'fomkyr' ? 0xfffffffe : 10000)")
  s=s.replace("if (form.monomialPruning) session.push('(SETREDUCTIVITY NIL)');","if (form.monomialPruning && form.backend !== 'fomkyr') session.push('(SETREDUCTIVITY NIL)');")
  s=s.replace("if (form.monomialPruning) session.push('(SETREDUCTIVITY T)');","if (form.monomialPruning && form.backend !== 'fomkyr') session.push('(SETREDUCTIVITY T)');")
  # Permit explicitly supplied all-one weights for fomkyr's same grading.
  s=optional(s,"String(form.weights || '').trim()) return false;","(form.backend === 'fomkyr' ? String(form.weights || '').trim().split(/[\\s,]+/).filter(Boolean).some(w => w !== '1') : String(form.weights || '').trim())) return false;",'unit-weight pruning')
  return s
 edit('src/bergman-syntax.js',syntax)
 def html(s):
  if '<option value="fomkyr"' not in s:s=once(s,'<select id="backend">','<select id="backend">\n          <option value="fomkyr">fomkyr - C/WASM, browser fallback, Hilbert</option>','engine select')
  if 'value="14304"' not in s:s=once(s,'<select id="memoryMiB" aria-describedby="memoryHint">','<select id="memoryMiB" aria-describedby="memoryHint">\n          <option value="14304">fomkyr: 14 304 MiB (below 15 GB)</option>','memory select')
  return s
 edit('index.html',html)
 def app(s):
  if 'attachFomkyrResultLinks' not in s:
   s="import { attachFomkyrResultLinks } from '../engine/fomkyr/result-links.js';\n"+s
   s=once(s,'  renderFiles(job, files);',"  renderFiles(job, files);\n  attachFomkyrResultLinks($('filesOut'), res.fomkyr);",'result links')
  s=optional(s,'parseRelation(r, vv.names);',"parseRelation(r, vv.names, f.backend === 'fomkyr' ? 0xfffffffe : 10000);",'preview exponent range')
  s=optional(s,"$('nativeWorkersField').hidden = els.backend.value !== 'native';","$('nativeWorkersField').hidden = !['native','fomkyr'].includes(els.backend.value);",'worker UI')
  s=optional(s,"els.maxserdegField.hidden = f.task !== 'hilbert';","els.maxserdegField.hidden = f.task !== 'hilbert' && f.backend !== 'fomkyr';",'Hilbert degree UI')
  s=optional(s,"const show = { basis: true, series: has('hs') || has('pb'),","const show = { basis: true, series: has('hs') || has('pb') || els.backend.value === 'fomkyr',",'Hilbert tab')
  # Existing numeric series renderer rounds big coefficients. For fomkyr render
  # a bounded prefix directly from exact decimal strings; full CSV is downloadable.
  if 'renderFomkyrSeries' not in s:
   s="import {renderFomkyrSeries} from '../engine/fomkyr/result-links.js';\n"+s
   s=optional(s,"if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res);","if (res.fomkyr?.hilbert) renderFomkyrSeries($('seriesOut'), res.fomkyr.hilbert);\n  else if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res);",'exact Hilbert rendering')
  s=optional(s,"if (res.native?.reduced === false)","if ((res.native ?? res.fomkyr)?.reduced === false)",'unreduced label')
  s=optional(s,"if (res.native?.previewTruncated)","if ((res.native ?? res.fomkyr)?.previewTruncated)",'preview label')
  return s
 edit('src/app.js',app)
 if (web/'src/backend-capabilities.js').is_file():
  edit('src/backend-capabilities.js',lambda s:s.replace("errors.push('The selected engine requires a maximal degree from 1 to 20.');","errors.push(`The selected engine requires ${key} from ${range.min} to ${range.max}.`);"))
except (ValueError,OSError) as e:sys.exit(str(e))
assets=[f for f in (src/'web').glob('*.js') if f.name!='fomkyr-isolation-worker.js']+list((src/'dist').glob('fomkyr*.wasm'))
if len(list((src/'dist').glob('fomkyr*.wasm')))!=4:sys.exit('Expected all four shared/unshared WASM binaries')
for file in assets:
 if not file.is_file():sys.exit('Missing release asset: '+str(file))
for path,(old,new) in changes.items():
 print('PATCH',path.relative_to(root))
 if a.dry_run:print(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile=str(path),tofile=str(path))))
if not a.dry_run:
 for path,(old,new) in changes.items():
  backup=path.with_suffix(path.suffix+'.before-fomkyr-0.6.0')
  if not backup.exists():backup.write_text(old)
  path.write_text(new)
 dest=web/'engine/fomkyr';dest.mkdir(parents=True,exist_ok=True)
 for file in assets:shutil.copyfile(file,dest/file.name)
 shutil.copyfile(src/'web/fomkyr-isolation-worker.js',web/'fomkyr-isolation-worker.js')
 (web/'.nojekyll').touch(exist_ok=True)
 print('Installed:',dest)
 print('Select fomkyr / noncommutative / degleftlex / Groebner basis. Leave max degree blank for unbounded completion.')
 print('Static HTTPS/GitHub Pages: existing isolation is retained; the single-worker build needs no isolation headers.')
 print('The optional Enable static-host multicore button registers a project-scoped service worker and reloads once.')
 print('No deployment has been performed. Read docs/BROWSER_COMPATIBILITY.md before publishing.')
