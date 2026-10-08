#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
if len(sys.argv)>1 and sys.argv[1]=='proof':
    from proofkit.cli import entry
    sys.exit(entry(sys.argv[2:]))
from app.cli import entry
sys.exit(entry())
