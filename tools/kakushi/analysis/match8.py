import json,sys,numpy as np
R=1.000081;C=-14.95668;G0=0.10986;U=0.1056338
n=json.load(open(sys.argv[1]));S=json.load(open('an/streams.json'));LAG=float(sys.argv[2])
steps=json.load(open('an3/score-steps.json'))['steps'];T=np.array([s['time'] for s in steps]);P=np.array([s['previousReading'] for s in steps]);cap=[s['delta'] for s in steps]
v=lambda g:(g-C)/R
# streams first: take up to 5 units from windows overlapping [start-0.2,end+0.15] (video clock)
sx=[]
for i,s in enumerate(S):
  need=5;a,b=v(s['start'])-0.2+LAG,v(s['end'])+0.15+LAG
  for j in range(len(T)):
    if need<=0:break
    if T[j]>=a and P[j]<=b and cap[j]>0:
      take=min(cap[j],need);cap[j]-=take;need-=take
  if need>2:sx.append((s['end'],'s',s['name'],need))
objs=sorted([(v(G0+U*(x['kend'] if x['type']=='hold' else x['k']))+LAG,i) for i,x in enumerate(n)])
extra=[]
for t,i in objs:
  j=np.searchsorted(T,t)
  cands=[jj for jj in range(max(0,j-2),min(len(T),j+3)) if P[jj]-0.12<=t<=T[jj]+0.12 and cap[jj]>=3]
  if cands:jj=min(cands,key=lambda jj:abs((T[jj]+P[jj])/2-t));cap[jj]-=5
  else:extra.append((t,i))
left=[(P[j],T[j],cap[j]) for j in range(len(cap)) if cap[j]>=3]
print('LAG',LAG,'notes',len(n),'streams',len(S),'unmatched notes',len(extra),'streams short',len(sx),'leftover units',sum(max(0,c) for c in cap),'left windows',len(left))
if len(sys.argv)>3:
  for t,i in extra:x=n[i];print('EXTRA g %.3f %s L%d n=%s'%(G0+U*x['k'],x['type'],x['lane'],x.get('n')))
  for s in sx:print('STREAM-SHORT',s)
  for p,t,c in left:print('LEFT g %.3f-%.3f units %d'%(R*(p-LAG)+C,R*(t-LAG)+C,c))
