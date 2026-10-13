import json,numpy as np
G0=0.10986;U=0.1056338
n=json.load(open('an/combined3f.json'));S=json.load(open('an/streams.json'));occ=np.load('an/occ.npy')
RP=[(262,72),(591,72),(692,238),(591,405),(262,405),(160,238)]
log=[];out=[]
for x in n:
  g=G0+U*x['k']
  if x['type']=='ripple':
    if g>=125.9:log.append(('drop-clear-ripple',round(g,2),x['lane']));continue
    px,py=RP[x['lane']];bad=False
    for s in S:
      if s['appear']-0.1<=g<=s['end']+0.35:
        pts=s['poly'];near=min(np.hypot(px-a,py-b) for a,b in pts)
        # also distance to segments
        for (a0,b0),(a1,b1) in zip(pts[:-1],pts[1:]):
          for f in np.linspace(0,1,30):near=min(near,np.hypot(px-(a0+(a1-a0)*f),py-(b0+(b1-b0)*f)))
        if near<45:bad=True;break
    if bad:log.append(('drop-stream-ripple',round(g,2),x['lane']));continue
  out.append(x)
# short holds: tap/flick heads followed by an occupancy run of >=3 slots starting within 1 slot
for x in out:
  if x['type']!='tap':continue
  k=x['k'];L=x['lane'];hi=occ[L]>0.6
  if k+1<hi.shape[0] and (hi[k] or hi[k+1]):
    j=k+1
    while j+1<hi.shape[0] and hi[j+1]:j+=1
    if j-k>=3:x['type']='hold';x['kend']=j;log.append(('short-hold',round(G0+U*k,2),L,j-k))
json.dump(out,open('an/combined4.json','w'))
from collections import Counter
print(len(n),'->',len(out),Counter(x['type'] for x in out));print(Counter(l[0] for l in log));print([l for l in log if l[0]=='short-hold'])
