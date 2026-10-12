#!/usr/bin/env python3
"""Compare pinned checkouts with an independent merge oracle; no model calls."""
import argparse,json,pathlib,random,subprocess,os
from fractions import Fraction
p=argparse.ArgumentParser();p.add_argument('pi');p.add_argument('durable');p.add_argument('--output',default='/tmp/typescript-memory-execution.json');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];rng=random.Random(20261012);cases=[]
for _ in range(180):
 total=rng.choice([16,32,64,128,256,1024]);parts=[]
 def partition(level,index):
  if level and rng.random()<.72:partition(level-1,index*2);partition(level-1,index*2+1)
  else:parts.append([level,index])
 partition(total.bit_length()-1,0)
 available=[]
 for left,right in zip(parts,parts[1:]):
  if left[0]==right[0] and left[1]%2==0 and right[1]==left[1]+1 and rng.random()<.8:available.append([left[0]+1,left[1]//2])
 candidates=[]
 for i,(left,right) in enumerate(zip(parts,parts[1:])):
  level,index=left;span=2**level
  if level==right[0] and index%2==0 and right[1]==index+1 and [level+1,index//2] in available:
   # Source specification uses last inclusive record; exact rational arithmetic.
   candidates.append((Fraction(total-((index+2)*span-1),span),-index*span,i))
 expected=max(candidates)[2] if candidates else -1
 cases.append({'total':total,'parts':parts,'available':available,'expected':expected})
cases.insert(0,{'total':10,'parts':[[2,0],[2,1],[0,8],[0,9]],'available':[[3,0],[1,4]],'expected':2})
output=pathlib.Path(a.output);casefile=output.with_suffix('.cases.json');casefile.write_text(json.dumps(cases))
pi=pathlib.Path(a.pi).resolve();durable=pathlib.Path(a.durable).resolve()
ts=json.loads(subprocess.check_output(['node','--experimental-transform-types',str(root/'scripts/memory-comparison/probe.ts'),str(pi),str(durable),str(casefile)],text=True))
env=dict(os.environ,MEMORY_COMPARISON_CASES=str(casefile))
lisp=json.loads(subprocess.check_output(['emacs','--batch','-Q','-L',str(root/'vendor/unii-memory'),'-l',str(root/'scripts/memory-comparison/probe.el')],env=env,text=True))
comparisons={name:sum((ts['mergeResults'][i][name] if name!='lisp' else lisp['mergeResults'][i])==c['expected'] for i,c in enumerate(cases)) for name in ['pi','durable','lisp']}
revisions={name:subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip() for name,path in [('pi',pi),('durable',durable),('lisp',root/'vendor/unii-memory')]}
report={'revisions':revisions,'modelCalls':0,'mergeOracle':{'cases':len(cases),'matches':comparisons,'method':'independent exact-rational last-inclusive age with oldest tie'},'pi':ts['behavior'],'lisp':lisp['behavior'],'limits':['Durable full lifecycle tested by upstream suite; cross-language custom operational probes cover pi and Lisp only.','Stub summaries test plumbing, not semantic fidelity, real cache hit rate or cost.','Oracle identity requested from user; this reference covers UNII merge rule only.']}
output.write_text(json.dumps(report,indent=2));print(json.dumps({'output':str(output),'mergeOracle':report['mergeOracle'],'pi':ts['behavior'],'lisp':lisp['behavior']}))
