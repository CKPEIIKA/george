#!/usr/bin/env python3
"""Large checkpoint records must not silently lower execution concurrency."""
from pathlib import Path
import itertools,json,os,struct,subprocess,tempfile

ROOT=Path(__file__).resolve().parents[1]
BINARY=Path(os.environ.get('FOMKYR_TEST_BINARY',ROOT/'dist/fomkyr')).resolve()
with tempfile.TemporaryDirectory(prefix='fomkyr-restore-workers-')as folder:
 root=Path(folder);fixture=root/'fixture.json';job=root/'job'
 terms=[{'word':list(w),'coefficient':'1'}for w in itertools.islice(itertools.product(range(4),repeat=7),8000)]
 fixture.write_text(json.dumps({'variables':['a','b','c','d'],'relations':[{'degree':7,'terms':terms}]}))
 common=['-d','7','--memory','128M','--row-reserve','4M','--commit-row-reserve','1M','--quiet']
 first=subprocess.run([str(BINARY),'-i',str(fixture),'--workdir',str(job),'-j','1','--scratch','8M',*common],capture_output=True,text=True,timeout=60)
 assert first.returncode==0,(first.returncode,first.stderr)
 result=json.loads(first.stdout);assert result['complete']and result['basisSize']==1,result
 basis=next((job/'fomkyr').glob('alg-*/basis.gnb'));before=basis.read_bytes()
 size=struct.unpack_from('<I',before,4)[0]
 # At four workers the cooperative 6MiB scratch gives <154KiB import space;
 # this fixture deliberately requires a temporary wider loading layout.
 capacity=((6*1048576//5)&~65535)//8
 assert size>capacity,(size,capacity)
 again=subprocess.run([str(BINARY),'--resume',str(job),'-j','4','--scratch','6M',*common],capture_output=True,text=True,timeout=60)
 assert again.returncode==0,(again.returncode,again.stderr)
 resumed=json.loads(again.stdout)
 assert resumed['complete']and resumed['workers']==4 and resumed['basisSize']==1,resumed
 assert basis.read_bytes()==before,'Frozen polynomial bytes changed during restoration'
 print(json.dumps({'passed':True,'requestedWorkers':4,'reportedWorkers':resumed['workers'],'recordBytes':size,'initialImportCapacityBytes':capacity,'basisBytesUnchanged':True}))
