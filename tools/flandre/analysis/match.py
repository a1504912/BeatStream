import json,sys,numpy as np
R=1.000086;C=-12.0936;G0=0.2875;U=0.075;LAG=-0.08
n=json.load(open(sys.argv[1]));sc=json.load(open('an2/score-steps.json'))['steps']
mine=sorted([((G0+U*(x['kend'] if x['type']=='hold' else x['k'])-C)/R+LAG,i) for i,x in enumerate(n)])
judg=[]
for s in sc:
  for j in range(s['delta']):judg.append((s['time'],s['previousReading']))
# greedy two-pointer: each judgment (lo,hi window) matched to an unmatched note whose time is in [prev-0.1, time+0.1]
used=set();unmatched=[]
mt=np.array([m[0] for m in mine])
for t,prev in judg:
  cand=[k for k in range(np.searchsorted(mt,prev-0.12),np.searchsorted(mt,t+0.12)) if k not in used]
  if cand:
    k=min(cand,key=lambda k:abs(mt[k]-(t+prev)/2));used.add(k)
  else:unmatched.append((t,prev))
extra=[mine[k] for k in range(len(mine)) if k not in used]
print('judgments',len(judg),'mine',len(mine),'missing',len(unmatched),'extra',len(extra))
print('MISSING (video t, game g):',[(round(t,2),round(R*(t-LAG)+C,3)) for t,p in unmatched])
print('EXTRA:',[(round(G0+U*n[i]['k'],3),n[i]['type'],n[i]['lane'],n[i].get('n')) for t,i in extra])
print()
ex=[(G0+U*(n[i]['kend'] if n[i]['type']=='hold' else n[i]['k']),i) for t,i in extra]
for t,p in unmatched:
  g=R*((t+p)/2-LAG)+C
  near=[(round(e-g,3),n[i]['type'],n[i]['lane']) for e,i in ex if abs(e-g)<0.35]
  print('missing g=%.3f (window %.3f-%.3f) nearby extras %s'%(g,R*(p-LAG)+C,R*(t-LAG)+C,near))
