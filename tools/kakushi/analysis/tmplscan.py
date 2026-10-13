import cv2,numpy as np,json
R=1.000081;C=-14.95668
T={}
T['top']=[(265,75),(600,74)]
for x in (271,374,477,580):T['col%d'%x]=[(x,368),(x,88)]
for x in (271,374,477,580):T['short%d'%x]=[(x,228),(x,52)] if x<426 else [(x,228),(x,425)]
T['hmid']=[(226,238),(700,238)]
for x in (262,591):T['outer%d'%x]=[(x,400),(x,62)]
T['vmid']=[(426,95),(426,388)]
T['diagTLBR']=[(255,72),(593,398)];T['diagTRBL']=[(598,72),(265,402)]
def samples(p,a=0.12,b=0.88,n=60):
  (x0,y0),(x1,y1)=p;s=np.linspace(a,b,n);return np.round(x0+(x1-x0)*s).astype(int),np.round(y0+(y1-y0)*s).astype(int)
S={k:samples(v) for k,v in T.items()}
E={k:(v[0],v[1]) for k,v in T.items()}
cap=cv2.VideoCapture('in/video.mp4');fps=cap.get(cv2.CAP_PROP_FPS);n=0;rows=[];ts=[]
while True:
  ok,f=cap.read()
  if not ok:break
  t=n/fps;n+=1
  if t<14 or t>145:continue
  f=cv2.resize(f,(854,480));h,s,v=cv2.split(cv2.cvtColor(f,cv2.COLOR_BGR2HSV))
  m=((h>=125)&(h<=172)&(s>70)&(v>90)).astype(np.uint8);m=cv2.dilate(m,np.ones((5,5),np.uint8))
  cy=((h>=80)&(h<=100)&(s>110)&(v>150)).astype(np.uint8)
  row={}
  for k,(xs,ys) in S.items():
    cov=float(m[ys,xs].mean())
    ends=[]
    for (ex,ey) in E[k]:ends.append(float(cy[max(0,ey-14):ey+15,max(0,ex-14):ex+15].mean()))
    row[k]=(cov,ends[0],ends[1])
  rows.append(row);ts.append(t)
json.dump({'t':ts,'rows':rows,'templates':T},open('an/tmplscan.json','w'))
print(len(ts))
