#!/usr/bin/env python3
"""Synthetic anchor/upgrade tests, NOT installation into a live fomkyr tree."""
import ast,tempfile,subprocess,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];script=R/'tools/install_reference.py';tree=ast.parse(script.read_text());shapes={}
for node in tree.body:
 if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=='edit':
  call=node.value;name=ast.literal_eval(call.args[0].args[0]);pairs=ast.literal_eval(call.args[1]);shapes[name]='\n'.join(old for old,new in pairs)+'\n'
shapes['src/kernel.h']='API u32 gn_abi(void);\n#endif\n'
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp)
 for name,text in shapes.items():p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 cmd=['python3',str(script),str(root)]
 subprocess.run(cmd,check=True,capture_output=True);assert all((root/n).read_text()==t for n,t in shapes.items())
 subprocess.run(cmd+['--apply'],check=True,capture_output=True)
 text=(root/'native/cli.c').read_text();assert '\\"profileThrough\\":%llu' in text and 'gn_fg_stat(15)' in text
 installed={n:(root/n).read_bytes() for n in shapes};subprocess.run(cmd+['--apply'],check=True,capture_output=True);assert all((root/n).read_bytes()==t for n,t in installed.items())
 # Old scalar13 metadata must update on an otherwise already-installed source.
 np=root/'native/cli.c';old=np.read_text().replace('\\"profileThrough\\":%llu,\\"completeDimensionThrough\\":%llu','\\"profileThrough\\":13').replace('(unsigned long long)gn_fg_stat(11),(unsigned long long)gn_fg_stat(14),(unsigned long long)gn_fg_stat(15));','(unsigned long long)gn_fg_stat(11));');np.write_text(old)
 subprocess.run(cmd+['--apply'],check=True,capture_output=True);assert np.read_bytes()==installed['native/cli.c']
 # Corrupt an uninstalled anchor: refuse all writes.
 for name,text in shapes.items():(root/name).write_text(text)
 kp=root/'src/kernel.c';kp.write_text(kp.read_text().replace('static int reduce_pair_impl','static int wrong_function'))
 before={n:(root/n).read_bytes() for n in shapes};p=subprocess.run(cmd+['--apply'],capture_output=True);assert p.returncode!=0 and all((root/n).read_bytes()==t for n,t in before.items())
r={'passed':True,'tests':['dry-run','fresh-exact-anchor-shape','idempotence','existing-0.1-metadata-upgrade','altered-anchor-refusal-before-writes'],'scope':'synthetic source shapes only; no current live fomkyr checkout was available'}
(R/'evidence/current-installer-shape.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
