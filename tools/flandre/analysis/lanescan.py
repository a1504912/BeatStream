import numpy as np
d=np.load('an/kymo.npz');t=d['times'].astype(np.float64);L=d['lanes'].astype(np.float32);rs=d['rs']
col=np.maximum.reduce([L[...,0],L[...,1],L[...,2],L[...,3]])
def scan(s,R0=80.5,rmin=115,rmax=400,Ts=None,lanes=range(8),m=col):
  if Ts is None: Ts=np.arange(t[0]+0.8,t[-1],1/240)
  out=np.zeros((len(lanes),len(Ts)),np.float32);cnt=np.zeros(len(Ts))
  for fi,tf in enumerate(t):
    r=R0+s*(Ts-tf);ok=(r>=rmin)&(r<=rmax)
    if not ok.any():continue
    ri=(r[ok]-rs[0]);i0=np.floor(ri).astype(int);fr=ri-i0
    for li,lane in enumerate(lanes):
      v=m[fi,lane];out[li,ok]+=v[i0]*(1-fr)+v[np.minimum(i0+1,len(rs)-1)]*fr
    cnt[ok]+=1
  return Ts,out/np.maximum(cnt,1)
