#!/usr/bin/env python3
"""Optional pinned Linux x86_64 oracles. Extract locally; never install system packages.

Requires a recent glibc, native GCC/binutils, dpkg-deb, and HTTPS access to Debian.
Alternatively install OCaml 5.3, dune 3.17.2 and Singular using your package manager.
"""
import hashlib, json, shutil, subprocess, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
base = root / 'build/oracles'
debs = base / 'debs'
prefix = base / 'root'
debs.mkdir(parents=True, exist_ok=True)
prefix.mkdir(parents=True, exist_ok=True)
for entry in json.loads((root/'tools/oracle-packages.json').read_text()):
    target = debs / (entry['Package']+'.deb')
    if not target.exists():
        with urllib.request.urlopen('https://deb.debian.org/debian/'+entry['Filename'], timeout=120) as response:
            target.write_bytes(response.read())
    if hashlib.sha256(target.read_bytes()).hexdigest() != entry['SHA256']:
        raise RuntimeError('SHA256 mismatch: '+str(target))
    subprocess.run(['dpkg-deb','-x',str(target),str(prefix)],check=True)
    print(entry['Package'], entry['Version'])
bin_dir = base/'bin'
bin_dir.mkdir(exist_ok=True)
for name in ['gcc','as','ar','ranlib']:
    tool = shutil.which(name)
    if not tool:
        raise RuntimeError('Missing native build tool: '+name)
    link = bin_dir/('x86_64-linux-gnu-'+name)
    if not link.exists(): link.symlink_to(tool)
