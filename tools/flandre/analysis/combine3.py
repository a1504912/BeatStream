import json,numpy as np
from collections import Counter
R=1.000086;C=-12.0936;G0=0.2875;U=0.075
mv=json.load(open('an/moving.json'));occ=np.load('an/occ.npy')
MINRUN=6
def runs(lane):
  hi=occ[lane]>0.6;out=[];k=0
  while k<len(hi):
    if hi[k]:
      j=k
      while j+1<len(hi) and hi[j+1]:j+=1
      if j-k>=MINRUN:out.append((k,j))
      k=j+1
    else:k+=1
  return out
notes=[];log=Counter()
for lane in range(8):
  xs=sorted([n for n in mv if n['lane']==lane],key=lambda n:n['gc'])
  # merge green square edge pairs
  merged=[]
  for n in xs:
    if merged and n['col']=='green' and merged[-1]['col']=='green' and n['gc']-merged[-1]['gc']<0.16:
      m=merged[-1];m['gc']=(m['gc']+n['gc'])/2;m['slot']=round((m['gc']-G0)/U);m['n']=max(m['n'],n['n']);log['greenMerged']+=1;continue
    merged.append(dict(n))
  rr=runs(lane);used=set()
  for (k0,k1) in rr:
    inrun=[n for n in merged if k0-2<=n['slot']<=k1+2]
    head=min(inrun,key=lambda n:n['slot']) if inrun else None
    hk=head['slot'] if head and head['slot']<=k0+1 else k0
    # tail: last occupied slot, snapped to a track if one sits within a slot
    tails=[n for n in inrun if abs(n['slot']-k1)<=1]
    tk=max(n['slot'] for n in tails) if tails else k1
    for n in inrun:used.add(id(n))
    notes.append({'k':hk,'kend':tk,'lane':lane,'type':'hold','n':head['n'] if head else 0})
    log['holdAbsorbed']+=len(inrun)
  for n in merged:
    if id(n) in used:continue
    notes.append({'k':n['slot'],'kend':n['slot'],'lane':lane,'type':'flick' if n['col']=='green' else 'tap','n':n['n'],'col':n['col']})
for r in json.load(open('an/bursts2.json')):
  k=round((r['g']+0.045-G0)/U);notes.append({'k':k,'kend':k,'lane':r['pos'],'type':'ripple'})
# drop exact duplicates on one target
seen=set();final=[]
for n in sorted(notes,key=lambda n:(n['k'],n['type']=='ripple',n['lane'])):
  key=(n['k'],n['type']=='ripple',n['lane'])
  if key in seen:log['dup']+=1;continue
  seen.add(key);final.append(n)
json.dump(final,open('an/combined3.json','w'))
print(dict(log),'total',len(final),Counter(n['type'] for n in final))
sc=json.load(open('an/score-steps.json'))['steps']
jt=np.array([(G0+U*x['k']-C)/R-0.06 for x in final])
pts=[(s['time'],int((jt<=s['time']).sum())-s['count']) for s in sc]
print(' '.join('%.0f:%+d'%p for p in pts[::4]))
