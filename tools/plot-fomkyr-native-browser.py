#!/usr/bin/env python3
"""Small linear native/browser figure from completed, audited FK6 measurements."""
import argparse, json, statistics
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p=argparse.ArgumentParser()
p.add_argument('report',type=Path)
p.add_argument('--output',type=Path,default=Path('docs/benchmarks/fomkyr-0.6.6-native-browser'))
a=p.parse_args();report=json.loads(a.report.read_text())
assert report['state']=='complete'
audit=json.loads((a.report.parent/'leading-word-audit.json').read_text())
assert audit['state']=='complete' and audit['runs']==len(report['rows'])
style={'font.family':'sans-serif','font.sans-serif':['Liberation Sans','DejaVu Sans'],
 'font.size':8,'axes.labelsize':8,'axes.titlesize':8,'xtick.labelsize':7,'ytick.labelsize':7,
 'legend.fontsize':7,'lines.linewidth':1.1,'lines.markersize':3,'axes.linewidth':.6,
 'xtick.direction':'in','ytick.direction':'in','axes.grid':True,'grid.alpha':.2,
 'grid.linewidth':.45,'legend.frameon':False,'pdf.fonttype':42,'svg.fonttype':'none'}
series=[('fomkyr-native-pgo','Native C / O3 + LTO + PGO','#004488','-','o'),
        ('fomkyr','Chromium / Wasm64','#994455','--','s'),
        ('fomkyr-firefox','Firefox / Wasm64','#6699CC','-.','^')]
public={'version':report['coreVersion'],'case':'FK6, Q, original generator order',
 'protocol':{'workers':4,'memoryMiB':4096,'batchPairs':128,'resume':False,'hilbertClosure':False,
  'timeLimitSeconds':120,'wall':'Cold engine/process time, including initialization, checkpoints and full text export; browser startup excluded.',
  'ram':'Native: OS peak RSS. Browsers: peak process-tree PSS sampled every 0.25 s, including browser/runtime and proportional shared pages. Capacity is separate; browser peaks can be missed.',
  'trials':'Browsers: one per degree 1–7, three per degree 8–10. Native: three per degree. Curves use medians; time bands show trial ranges.',
  'scope':'Same host and allowances; results describe this presentation. Degrees <=9 match archived independent prefixes; degree 10 uses historical consistency evidence.'},'measurements':[]}
with plt.rc_context(style):
 fig,axes=plt.subplots(1,2,figsize=(190/25.4,76/25.4),layout='constrained')
 for sid,label,color,line,marker in series:
  rows=[r for r in report['rows'] if r['id']==sid];degrees=sorted({r['degree'] for r in rows})
  seconds=[];ram=[];lower=[];upper=[]
  for degree in degrees:
   subset=[r for r in rows if r['degree']==degree]
   assert all(r['status']=='complete' for r in subset)
   time=statistics.median(r['coldWallSeconds'] for r in subset)
   mem=statistics.median(r['peakRssMiB'] if sid=='fomkyr-native-pgo' else r['peakPssMiB'] for r in subset)
   seconds.append(time);ram.append(mem)
   lower.append(min(r['coldWallSeconds'] for r in subset));upper.append(max(r['coldWallSeconds'] for r in subset))
   public['measurements'].append(dict(engine=sid,degree=degree,trials=len(subset),seconds=time,
    rangeSeconds=[lower[-1],upper[-1]],peakPhysicalMiB=mem,ramMetric='RSS' if sid=='fomkyr-native-pgo' else 'PSS'))
  axes[0].plot(degrees,seconds,label=label,color=color,linestyle=line,marker=marker)
  axes[0].fill_between(degrees,lower,upper,color=color,alpha=.12,linewidth=0)
  axes[1].plot(degrees,ram,color=color,linestyle=line,marker=marker)
 for ax in axes:
  ax.set_xlabel('Maximal degree');ax.set_xticks(range(1,11));ax.set_xlim(.7,10.3);ax.set_ylim(bottom=0)
 axes[0].set_ylabel('Elapsed time (s)');axes[1].set_ylabel('Peak physical RAM (MiB)')
 axes[0].set_title('(a) Elapsed time',loc='left');axes[1].set_title('(b) Physical RAM',loc='left')
 fig.legend(*axes[0].get_legend_handles_labels(),loc='outside upper center',ncol=3)
 a.output.parent.mkdir(parents=True,exist_ok=True)
 for suffix in ['svg','pdf','png']:fig.savefig(Path(str(a.output)+'.'+suffix),dpi=250)
 Path(str(a.output)+'.json').write_text(json.dumps(public,indent=2)+'\n')
 print(a.output)
