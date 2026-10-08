import json,numpy as np
from collections import Counter
R=1.000086;C=-12.0936;G0=0.2875;U=0.075;SPEED=301.0;R0=84.0
d=np.load('an/kymo.npz');t=d['times'].astype(float);L=d['lanes'].astype(np.float32);rs=d['rs']
colm=np.maximum.reduce([L[...,0],L[...,1],L[...,2],L[...,3]])
o=json.load(open('an/tracks.json'));ph={int(k):v for k,v in json.load(open('an/lanephase.json')).items()}
FAM={'pink':'round','cyan':'round','yellow':'round','green':'square'}
notes=[]
for lane in range(8):
  xs=sorted([x for x in o if x['lane']==lane and x['n']>=8],key=lambda x:x['g'])
  for x in xs:x['gc']=x['g']-ph[lane]*U+U   # corrected continuous game time
  # cluster tracks within 0.05 s (same note seen twice, or square edges)
  cl=[]
  for x in xs:
    if cl and x['gc']-cl[-1][-1]['gc']<0.06:cl[-1].append(x)
    else:cl.append([x])
  for c in cl:
    col=Counter(max(['pink','cyan','yellow','green'],key=lambda q:x['cls'][q]) for x in c).most_common(1)[0][0]
    gc=float(np.mean([x['gc'] for x in c])) if len(c)>1 else c[0]['gc']
    k=round((gc-G0)/U)
    notes.append({'lane':lane,'slot':k,'gc':gc,'col':col,'n':max(x['n'] for x in c),'parts':len(c),'tvis':float(np.mean([x['tv'] for x in c]))})
# ribbons: for consecutive notes in a lane, check fill between them
def fill(lane,tv_head,tv_tail):
  # sample frames between; body spans radii between head and tail positions
  vals=[]
  for f in np.where((t>tv_head-1.0)&(t<tv_tail))[0]:
    rh=R0+SPEED*(tv_head-t[f]);rt=R0+SPEED*(tv_tail-t[f])
    lo,hi=max(rh,100)+12,min(rt,rs[-1]-2)-12
    if hi-lo<15:continue
    seg=colm[f,lane,int(lo-rs[0]):int(hi-rs[0])];vals.append(float((seg>0.25).mean()))
  return float(np.median(vals)) if len(vals)>=3 else 0.0
notes.sort(key=lambda n:(n['lane'],n['slot']))
for a,b in zip(notes[:-1],notes[1:]):
  if a['lane']!=b['lane'] or b['slot']-a['slot']<2 or b['slot']-a['slot']>64:continue
  a['nextFill']=fill(a['lane'],a['tvis'],b['tvis'])
json.dump(notes,open('an/moving.json','w'))
f=np.array([n.get('nextFill',0) for n in notes]);print('notes',len(notes),Counter(n['col'] for n in notes),'parts',Counter(n['parts'] for n in notes))
print('fill hist',np.histogram(f[f>0],bins=10,range=(0,1))[0].tolist())
