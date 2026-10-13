import cv2,numpy as np,json
R=1.000081;C=-14.95668
cap=cv2.VideoCapture('in/video.mp4');fps=cap.get(cv2.CAP_PROP_FPS)
CUSTOM=[('square1',40.6,43.2,[(395,128),(528,128),(528,330),(322,330),(322,130)]),
        ('square2',69.6,72.2,[(395,128),(528,128),(528,330),(322,330),(322,130)]),
        ('zigR',68.4,70.6,[(735,120),(750,261),(720,367)]),
        ('zigL',68.8,71.2,[(120,350),(106,210),(131,112)]),
        ('short477',75.3,77.8,[(477,205),(477,420)]),('short580',75.5,78.0,[(580,205),(580,420)]),
        ('hshort1',14.3,16.6,[(545,238),(700,238)]),('hshort2',20.9,23.3,[(545,238),(700,238)]),
        ('hshort3',112.3,114.6,[(545,238),(700,238)]),('hshort4',119.0,121.4,[(545,238),(700,238)]),
        ('hlong30',29.5,31.7,[(226,238),(700,238)]),('hlong49',48.0,50.4,[(226,238),(700,238)]),('hlong111',110.6,113.0,[(226,238),(700,238)])]
def pts(poly,step=4):
  out=[]
  for (x0,y0),(x1,y1) in zip(poly[:-1],poly[1:]):
    n=max(1,int(np.hypot(x1-x0,y1-y0)/step))
    for i in range(n):out.append((x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))
  out=np.array(out);k=len(out);return out[int(k*0.08):int(k*0.92)].astype(int)
res=[]
for name,g0,g1,poly in CUSTOM:
  v0,v1=(g0-C)/R,(g1-C)/R;P=pts(poly);cap.set(cv2.CAP_PROP_POS_FRAMES,round(v0*fps));n=round(v0*fps);cov=[];ts=[]
  while n/fps<v1:
    ok,f=cap.read();t=n/fps;n+=1
    f=cv2.resize(f,(854,480));h,s,v=cv2.split(cv2.cvtColor(f,cv2.COLOR_BGR2HSV))
    m=(((h>=125)&(h<=172)&(s>70)&(v>90))|((h>=80)&(h<=100)&(s>110)&(v>150))|((h>=110)&(h<=135)&(s>70)&(v>120))).astype(np.uint8);m=cv2.dilate(m,np.ones((5,5),np.uint8))
    cov.append(float(m[P[:,1],P[:,0]].mean()));ts.append(t)
  cov=np.array(cov);ts=np.array(ts);hi=np.where(cov>0.7)[0]
  if not len(hi):res.append((name,None));print(name,'no run',cov.max().round(2));continue
  # take longest contiguous run
  groups=np.split(hi,np.where(np.diff(hi)>2)[0]+1);gp=max(groups,key=len)
  after=[i for i in range(gp[-1],len(cov)) if cov[i]<0.15];gone=ts[after[0]] if after else ts[gp[-1]]
  r=dict(name=name,appear=R*ts[gp[0]]+C,lastFull=R*ts[gp[-1]]+C,gone=R*gone+C,poly=poly,cov=float(np.percentile(cov[gp],80)))
  res.append((name,r));print('%-9s appear %.2f lastFull %.2f gone %.2f cov %.2f'%(name,r['appear'],r['lastFull'],r['gone'],r['cov']))
json.dump([r for n,r in res if r],open('an/custom-runs.json','w'))
