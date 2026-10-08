import numpy as np,json,sys
from scipy.signal import find_peaks
d=np.load('an/kymo.npz');t=d['times'].astype(float);P=d['ripples'].astype(np.float32);rr=d['rr']
R=1.000086;C=-12.0936
def scan(s,Ts,ch=3,rmin=12,rmax=72):
  out=np.zeros((6,len(Ts)));cnt=np.zeros(len(Ts))
  for fi,tf in enumerate(t):
    r=s*(Ts-tf);ok=(r>=rmin)&(r<=rmax)
    if not ok.any():continue
    i0=np.floor(r[ok]).astype(int);fr=r[ok]-i0
    for p in range(6):
      v=P[fi,p,:,ch];out[p,ok]+=v[i0]*(1-fr)+v[i0+1]*fr
    cnt[ok]+=1
  return out/np.maximum(cnt,1)
if __name__=='__main__':
  Ts=np.arange(12.5,147,1/240)
  for s in [150,165,180,195]:
    A=scan(s,Ts);ev=[]
    for p in range(6):
      pk,_=find_peaks(A[p],height=0.12,distance=20,prominence=0.06);ev+=[(p,Ts[k],A[p,k]) for k in pk]
    g=np.array([R*e[1]+C for e in ev]);ph=((g-0.2875)%0.075)/0.075;z=np.exp(2j*np.pi*ph).mean()
    print(s,len(ev),'phase %.2f R %.2f'%(np.angle(z)/(2*np.pi)%1,abs(z)), [ '%d:%.2f'%(p,abs(np.exp(2j*np.pi*ph[[e[0]==p for e in ev]]).mean())) for p in range(6)])
