import json,numpy as np
G0=0.10986;U=0.1056338;occ=np.load('an/occ.npy')
n=json.load(open('an/combined5.json'))
key=lambda g:round((g-G0)/U)
REJECT=[(11.096,'tap',5),(21.237,'ripple',2),(23.032,'tap',6),(24.617,'tap',2),(24.934,'hold',0),(30.321,'ripple',0),(35.814,'tap',6),(40.251,'tap',3),(53.349,'tap',5),(76.483,'tap',1),(99.723,'ripple',2),(101.413,'ripple',5),(106.589,'tap',1),(113.138,'tap',5),(113.244,'tap',7),(113.455,'hold',6),(114.617,'tap',5),(115.356,'ripple',2),(115.673,'tap',2),(118.631,'tap',6),(120.004,'tap',1),(124.863,'tap',2)]
TOHOLD=[(79.124,2),(79.124,6),(108.279,5)]
rej={(key(g),t,l) for g,t,l in REJECT}
out=[x for x in n if (x['k'],x['type'],x['lane']) not in rej]
for g,l in TOHOLD:
  k=key(g);x=next(q for q in out if q['k']==k and q['lane']==l)
  j=k+1
  while j+1<occ.shape[1] and occ[l][j+1]>0.45:j+=1
  x['type']='hold';x['kend']=max(j,k+2);x['origin']='reviewed-hold';print('hold',g,l,round(G0+U*x['kend'],3))
json.dump(out,open('an/final.json','w'))
json.dump({'reject':REJECT,'toHold':TOHOLD},open('an/review7.json','w'))
from collections import Counter;print(len(n),'->',len(out),Counter(x['type'] for x in out))
