#!/usr/bin/env python3
"""Install a relocatable, versioned bundle without modifying system services."""
from pathlib import Path
import argparse,shutil,os,tempfile
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--prefix',type=Path,default=Path.home()/'.local');a=ap.parse_args();dest=a.prefix/'share/kircracker-cli/0.2.0';dest.parent.mkdir(parents=True,exist_ok=True)
if dest.exists():raise SystemExit(f'Refusing to overwrite {dest}; remove or choose a new prefix explicitly')
tmp=dest.with_name(dest.name+'.installing');shutil.copytree(R,tmp,ignore=shutil.ignore_patterns('__pycache__','*.pyc','results-local','kircracker-work'))
os.replace(tmp,dest);bindir=a.prefix/'bin';bindir.mkdir(parents=True,exist_ok=True);launcher=bindir/'kircracker'
if launcher.exists() or launcher.is_symlink():raise SystemExit(f'Bundle installed at {dest}, but existing launcher {launcher} was left unchanged')
launcher.symlink_to(dest/'kircracker');print(launcher)
