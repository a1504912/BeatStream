import json,sys,numpy as np
R=1.000086;C=-12.0936;G0=0.2875;U=0.075;LAG=-0.08
n=json.load(open(sys.argv[1]));out=sys.argv[2]
sc=json.load(open('an2/score-steps.json'))['steps']
judg=[(s['time'],s['previousReading']) for s in sc for j in range(s['delta'])]
def jtime(x):return (G0+U*(x['kend'] if x['type']=='hold' else x['k'])-C)/R+LAG
def match(n):
  mine=sorted([(jtime(x),i) for i,x in enumerate(n)]);mt=np.array([m[0] for m in mine])
  used=set();miss=[]
  for t,prev in judg:
    lo,hi=np.searchsorted(mt,prev-0.12),np.searchsorted(mt,t+0.12)
    cand=[k for k in range(lo,hi) if k not in used]
    if cand:used.add(min(cand,key=lambda k:abs(mt[k]-(t+prev)/2)))
    else:miss.append(R*((t+prev)/2-LAG)+C)
  extra=[mine[k][1] for k in range(len(mine)) if k not in used]
  return miss,extra
log=[]
# 1. green-core ripple flashes that explain a missing judgment
flash=[(50.05,2),(54.86,2),(55.3,3),(60.09,3),(64.91,3),(107.21,1),(107.65,2),(117.71,3)]
miss,extra=match(n)
for g,p in flash:
  m=[x for x in miss if abs(x-(g+0.187))<0.1]
  if m:
    k=round((m[0]-G0)/U);n.append({'k':k,'kend':k,'lane':p,'type':'ripple','origin':'green-core-flash'});log.append(('add-ripple',round(G0+U*k,4),p))
# 2. move a nearby unmatched note onto an unexplained judgment slot
for it in range(3):
  miss,extra=match(n);moved=0
  for g in miss:
    near=[i for i in extra if abs((G0+U*n[i]['k'])-g)<0.35 and n[i]['type']=='ripple']
    if near:
      i=min(near,key=lambda i:abs((G0+U*n[i]['k'])-g));k=round((g-G0)/U)
      log.append(('retime',n[i]['type'],n[i]['lane'],round(G0+U*n[i]['k'],4),round(G0+U*k,4)))
      n[i]['k']=n[i]['kend']=k;n[i]['origin']='score-retimed';extra.remove(i);moved+=1
  if not moved:break
miss,extra=match(n)
json.dump(n,open(out,'w'))
for l in log:print(l)
print('total',len(n),'missing',len(miss),[round(x,3) for x in miss])
print('extra',len(extra),[(round(G0+U*n[i]['k'],3),n[i]['type'],n[i]['lane']) for i in extra])
