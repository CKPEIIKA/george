#!/usr/bin/env python3
"""Apply FK Gate 0.3 reference hooks to an explicitly selected LOCAL fomkyr 0.6.5.
No remote writes; no deploy; checks source shapes and makes backups. Optimized
core is independent of this adapter, which is a version-specific integration test.
"""
from pathlib import Path
import argparse,shutil
p=argparse.ArgumentParser();p.add_argument('checkout',type=Path);p.add_argument('--apply',action='store_true');a=p.parse_args()
r=a.checkout.resolve();mod=Path(__file__).resolve().parents[1];changes={}
kernel=r/"src/kernel.c"
if kernel.exists():
 text=kernel.read_text()
 if "FK_GATE_REFERENCE_01" in text and "fg_sector_upper[360]" not in text:raise SystemExit("Earlier prototype adapter detected. Restore .before-fkgate backups before integrating this complete module.")
def edit(path,subs):
 path=r/path;s=path.read_text();original=s
 if 'FK_GATE_REFERENCE_01' in s:return
 for old,new in subs:
  if s.count(old)!=1:raise SystemExit(f'{path}: expected exactly one integration point: {old[:80]!r}')
  s=s.replace(old,new,1)
 s='/* FK_GATE_REFERENCE_01 */\n'+s if path.suffix in ['.c','.h'] else '// FK_GATE_REFERENCE_01\n'+s
 changes[path]=(original,s)
edit(Path('src/kernel.c'),[
 ('#include "kernel.h"','#include "kernel.h"\n#include "../fk_gate/src/fk_gate.h"\n#include "../fk_gate/profiles/fk6_sectors.h"'),
 ('  u32 abi,generators,target,workers,modulus,spill,error,completed,current,certifying;', '  FkgGate fgate;u64 fg_closed,fg_poll_calls,fg_skipped,fg_recounts;double fg_count_ms;u64 fg_sector_upper[360],fg_sector_peak;GN_ATOMIC(u64) fg_sector_skipped;u32 fg_sector_enabled,fg_sector_ready,fg_sector_error,fg_sector_nodes;double fg_sector_ms;\n  u32 abi,generators,target,workers,modulus,spill,error,completed,current,certifying;'),
 (' if(S.degree_committed!=S.degree_scheduled||(S.degree_total_known&&S.degree_seen!=S.degree_total))return GN_STATE;S.completed=S.current;S.current=0;return 0;}', ' if(S.fgate.status!=FKG_CLOSED||S.fgate.degree!=S.current){if(S.degree_committed!=S.degree_scheduled||(S.degree_total_known&&S.degree_seen!=S.degree_total))return GN_STATE;}else if(S.input_expected||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock)||S.degree_committed!=S.degree_scheduled)return GN_STATE;S.completed=S.current;S.current=0;return 0;}'),
 ('static int reduce_pair_impl(u32 lane)', 'static int fg_sector_pair(Lane*l);\nstatic int reduce_pair_impl(u32 lane)'),
 ('l->result=(Poly){0};l->pairs++;\n Rule*f=', 'l->result=(Poly){0};l->pairs++;\n if(fg_sector_pair(l))return 0;\n Rule*f='),
 ('#include "hilbert.inc"','#include "hilbert.inc"\n#include "../fk_gate/src/fk_gate.c"\n#include "../fk_gate/adapters/fomkyr065.inc"')])
# Export declarations via one guarded adapter header.
kh=r/'src/kernel.h';h=kh.read_text()
if 'FK_GATE_REFERENCE_01' not in h:
 changes[kh]=(h,h.replace('#endif\n', '#endif\n',1).replace('API u32 gn_abi(void);','/* FK_GATE_REFERENCE_01 */\nAPI int gn_fg_bind(u32 length);\nAPI int gn_fg_sector_mode(u32 enabled);\nAPI u64 gn_fg_class(u32 cls,u32 lower);\nAPI u64 gn_fg_group(u32 g,u32 lower);\nAPI int gn_fg_begin(u64 budget);\nAPI int gn_fg_poll(void);\nAPI int gn_fg_close(u64 budget);\nAPI int gn_fg_status(void);\nAPI u32 gn_fg_limb(u32 item,u32 limb);\nAPI u64 gn_fg_stat(u32 item);\nAPI u32 gn_abi(void);'))
edit(Path('native/cli.c'),[
 ('#include "hilbert_reference.h"','#include "hilbert_reference.h"\n#include "../fk_gate/adapters/native_host.h"'),
 (' native_set_pulse(log_pulse);int pe=pool_open(workers);', ' fg_host_bind();native_set_pulse(log_pulse);int pe=pool_open(workers);'),
 ('  reference_begin(budget);capture_safe(1);', '  rc=fg_host_begin(budget);if(rc)break;reference_begin(budget);capture_safe(1);'),
 ('  for(;;){capture_safe(1);rc=save_safe(0);', '  for(;;){int gated=fg_host_poll(budget);if(gated<0){rc=-gated;break;}if(gated)break;capture_safe(1);rc=save_safe(0);'),
 (' puts(result.s);if(write_atomic', ' if(fg_host_enabled){result.n--;result.s[result.n]=0;buf_printf(&result,",\\"hilbertGate\\":{\\"closedDegrees\\":%llu,\\"counts\\":%llu,\\"polls\\":%llu,\\"countMicroseconds\\":%llu,\\"unvisitedOverlapsProvedRedundant\\":%llu,\\"sectorSkips\\":%llu,\\"sectorCountMicroseconds\\":%llu,\\"sectorWorkspaceBytes\\":%llu,\\"sectorCounterError\\":%llu,\\"profileThrough\\":%llu,\\"completeDimensionThrough\\":%llu}}",(unsigned long long)gn_fg_stat(1),(unsigned long long)gn_fg_stat(3),(unsigned long long)gn_fg_stat(2),(unsigned long long)gn_fg_stat(5),(unsigned long long)gn_fg_stat(4),(unsigned long long)gn_fg_stat(8),(unsigned long long)gn_fg_stat(9),(unsigned long long)gn_fg_stat(10),(unsigned long long)gn_fg_stat(11),(unsigned long long)gn_fg_stat(14),(unsigned long long)gn_fg_stat(15));}\n puts(result.s);if(write_atomic')])
# Upgrade the native profile metadata of an already-installed 0.1 adapter.
np=r/'native/cli.c';previous=np.read_text()
old_meta='\\"profileThrough\\":13}}'
if 'FK_GATE_REFERENCE_01' in previous and old_meta in previous:
 old_args='(unsigned long long)gn_fg_stat(11));'
 if previous.count(old_meta)!=1 or previous.count(old_args)!=1:raise SystemExit('Unexpected old FK Gate metadata; no writes made.')
 upgraded=previous.replace(old_meta,'\\"profileThrough\\":%llu,\\"completeDimensionThrough\\":%llu}}').replace(old_args,'(unsigned long long)gn_fg_stat(11),(unsigned long long)gn_fg_stat(14),(unsigned long long)gn_fg_stat(15));')
 changes[np]=(previous,upgraded)
edit(Path('web/engine.js'),[
 ("import {planMemory,chooseMemoryPolicy} from './memory-policy.js';", "import {FkGate} from './fk_gate.js';\nimport {planMemory,chooseMemoryPolicy} from './memory-policy.js';"),
 ("      if(restoreError)throw restoreError;", "      if(restoreError)throw restoreError;\n      this.fkGate=new FkGate(this.e,this.memory,{enabled:this.options.hilbertGate===true,sectors:this.options.hilbertSectors===true,budgetBytes:this.options.gateBudgetBytes??64*MiB});this.fkGate.bind(identity);"),
 ("        this.hilbertReference=beginReference", "        this.fkGate.begin();\n        this.hilbertReference=beginReference"),
 ("      this.captureSafePoint();await this.persistSafePoint();\n      if(performance.now()-lastYield>40)", "      if(this.fkGate?.pollAndClose()){this.emit('hilbert-gate',this.fkGate.snapshot());break;}\n      this.captureSafePoint();await this.persistSafePoint();\n      if(performance.now()-lastYield>40)"),
 ("engine:'fomkyr',version:VERSION,", "engine:'fomkyr',version:VERSION,hilbertGate:this.fkGate?.snapshot(),gateEvents:this.fkGate?.events,")])
for path,(old,new) in changes.items():print('PATCH',path.relative_to(r))
if a.apply:
 for path,(old,new) in changes.items():
  backup=path.with_name(path.name+'.before-fkgate')
  if not backup.exists():backup.write_text(old)
  path.write_text(new)
 for folder in ['src','profiles','adapters']:
  target=r/'fk_gate'/folder;target.mkdir(parents=True,exist_ok=True)
  for file in (mod/folder).glob('*'):
   if file.is_file():shutil.copy2(file,target/file.name)
 shutil.copy2(mod/'js/fk_gate.js',r/'web/fk_gate.js')
 print('Local adapter installed. Rebuild matching C/WASM and JS assets together.')
else:print('Dry run only. Add --apply to modify this explicit local checkout.')
