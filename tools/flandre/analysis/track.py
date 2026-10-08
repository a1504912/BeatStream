import numpy as np,json
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter1d
d=np.load('an/kymo.npz');t=d['times'].astype(float);L=d['lanes'].astype(np.float32);rs=d['rs']
R=1.000086;C=-12.0936;R0=84.0;import sys;SPEED=float(sys.argv[1]) if len(sys.argv)>1 else 300.0
names=['pink','cyan','yellow','green','white','gray']
col=np.maximum.reduce([L[...,0],L[...,1],L[...,2],L[...,3]])
tracks=[]
for lane in range(8):
  active=[]
  for f in range(len(t)):
    sig=gaussian_filter1d(col[f,lane],2.0)
    p,_=find_peaks(sig,height=0.25,prominence=0.12,distance=10)
    obs=[(float(rs[k]),k) for k in p if 95<=rs[k]<=410]
    used=set()
    for tr in sorted(active,key=lambda z:-len(z['p'])):
      lt,lr=tr['p'][-1][:2];dt=t[f]-lt;pred=lr-300*dt
      best=None
      for j,(r,k) in enumerate(obs):
        if j in used:continue
        e=abs(r-pred)
        if e<7 and (best is None or e<best[0]):best=(e,j)
      if best:
        j=best[1];used.add(j);r,k=obs[j];tr['p'].append((t[f],r,*[float(L[f,lane,k,c]) for c in range(6)]))
    for j,(r,k) in enumerate(obs):
      if j not in used:
        tr={'lane':lane,'p':[(t[f],r,*[float(L[f,lane,k,c]) for c in range(6)])]};active.append(tr);tracks.append(tr)
    active=[tr for tr in active if t[f]-tr['p'][-1][0]<0.1]
out=[]
for tr in tracks:
  P=np.array(tr['p'])
  if len(P)<6 or np.ptp(P[:,1])<40:continue
  sl,ic=np.polyfit(P[:,0],P[:,1],1)
  if not(-340<sl<-260):continue
  arr=P[:,0]+(P[:,1]-R0)/SPEED;T=float(np.median(arr));err=float(np.median(abs(arr-T)))*SPEED
  if err>4:continue
  out.append({'lane':tr['lane'],'tv':float(T),'g':float(R*T+C),'n':len(P),'fitSlope':float(sl),'slope':float(sl),'err':float(err),'rmin':float(P[:,1].min()),'rmax':float(P[:,1].max()),
              'cls':{nm:float(np.median(P[:,2+i])) for i,nm in enumerate(names)}})
out.sort(key=lambda o:o['g'])
json.dump(out,open('an/tracks.json','w'))
g=np.array([o['g'] for o in out]);sl=np.array([o['slope'] for o in out])
print('tracks',len(out),'slope median',np.median(sl))
ph=((g-0.2875)%0.075)/0.075;print('16th',np.histogram(ph,bins=15,range=(0,1))[0].tolist())
ang=ph*2*np.pi;z=np.exp(1j*ang).mean();print('mean phase s',(np.angle(z)/(2*np.pi)%1)*0.075,'R',abs(z))
print('beat',np.histogram(((g-0.2875)%0.3)/0.3,bins=24,range=(0,1))[0].tolist())
