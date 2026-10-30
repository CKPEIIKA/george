#!/usr/bin/env python3
"""Read-only capacity and namespace arithmetic audit of the supplied handoff.
No mathematical certificate is promoted; structural consequences stay conditional.
"""
import argparse,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('status',type=Path);p.add_argument('--out',type=Path);a=p.parse_args();s=json.loads(a.status.read_text())
gap=s['h23_b23']['bounds']['B6']['upper']-s['h23_b23']['bounds']['B6']['lower']
maximum=sum((t['rows']-t['auditedRank'])*t['classSize']for t in s['capacity']['tasks'])
assert gap==s['capacityConclusion']['currentB23Gap'];assert maximum==s['capacityConclusion']['generousMaximumGainWithinCurrentRowPools']
assert gap-maximum==s['capacityConclusion']['minimumRemainingGapEvenAtFullRowRank']
h22,b22,h8,h9=240866764236,240866008458,755777,2347365
r={'sourceSHA256':hashlib.sha256(a.status.read_bytes()).hexdigest(),'snapshotUTC':s['snapshotUTC'],'currentB23Gap':gap,'generousRemainingCapacityGain':maximum,'minimumRemainingGapAtFullSelectedRowRank':gap-maximum,'currentPoolsSufficient':False,'reportedH22':h22,'reportedB22':b22,'Q14ShiftAt22':h8,'newKernelDimensionAfterQ14At22':h22-b22-h8,'dimensionProofReplayedHere':False,'conditionalQ22Degree23LowerContribution':15,'conditionalDerivedH23Lower':s['h23_b23']['bounds']['B6']['lower']+h9+15,'conditionalInputs':['Q14 central regular primitive','Q22 nonzero primitive in FK6/(Q14)','Q22 maps to zero in Nichols','the reported b23 lower certificate is valid'],'Q22CentralityAssumed':False,'liveResultsModified':False,'h23OrB23Exact':False}
if a.out:
 if a.out.exists():raise FileExistsError('choose a new report path')
 a.out.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
