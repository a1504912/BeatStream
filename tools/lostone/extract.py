import cv2,numpy as np,json,math
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from pathlib import Path
root=Path('lostone-analysis');c=cv2.VideoCapture('upload/BeatStream   ロストワンの号哭 BEAST Lv10_480p.mp4');c.set(cv2.CAP_PROP_POS_MSEC,25000);_,ref=c.read();template=cv2.cvtColor(ref[71:90,573:592],cv2.COLOR_BGR2GRAY)
templates=[cv2.warpAffine(template,cv2.getRotationMatrix2D((9,9),a,1),(19,19),borderMode=cv2.BORDER_REPLICATE) for a in range(0,120,10)]
c.set(cv2.CAP_PROP_POS_FRAMES,0);rs=np.arange(101,410,dtype=np.float32);qs=np.arange(-9,10,dtype=np.float32);maps=[]
for lane in range(8):
 a=-math.pi/2+lane*math.pi/4;maps.append((426+rs[None,:]*math.cos(a)-qs[:,None]*math.sin(a),232+rs[None,:]*math.sin(a)+qs[:,None]*math.cos(a)))
fixed=[(272,80),(582,80),(677,231),(581,383),(272,383),(176,232)];tracks=[];active=[[] for _ in range(8)];rip=[];idx=0
while True:
 ok,f=c.read()
 if not ok:break
 t=idx/30;idx+=1
 if t<6 or t>138:continue
 hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV);h,s,v=cv2.split(hsv);mask=(((h>=135)&(h<=177)|((h>=20)&(h<=110)))&(s>95)&(v>95)).astype(np.float32);gray=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);rv=[]
 for x,y in fixed:
  crop=gray[y-13:y+14,x-13:x+14];bright=(gray[y-8:y+9,x-8:x+9]>175).sum();rv.append(float(max(cv2.matchTemplate(crop,z,cv2.TM_CCOEFF_NORMED).max() for z in templates)) if bright>18 else 0)
 rip.append([t,rv])
 for lane,(mx,my) in enumerate(maps):
  strip=cv2.remap(mask,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);sig=gaussian_filter1d(strip.mean(axis=0),2.7);peaks,_=find_peaks(sig,height=.12,prominence=.07,distance=18);obs=[]
  for i in peaks:
   d=float(rs[i]);a=-math.pi/2+lane*math.pi/4;x=int(426+d*math.cos(a));y=int(232+d*math.sin(a))
   if 43<x<813 and 30<y<420:obs.append((d,float(mask[y-6:y+7,x-6:x+7].mean())))
  matches=[]
  for tr in active[lane]:
   last=tr['p'][-1];dt=t-last[0]
   for j,o in enumerate(obs):
    err=abs(o[0]-(last[1]-250*dt))
    if dt<.14 and err<13:matches.append((err,tr,j))
  usedt=set();usedo=set()
  for _,tr,j in sorted(matches,key=lambda z:z[0]):
   if id(tr) in usedt or j in usedo:continue
   tr['p'].append([t,*obs[j]]);usedt.add(id(tr));usedo.add(j)
  for j,o in enumerate(obs):
   if j not in usedo:tr={'lane':lane,'p':[[t,*o]]};tracks.append(tr);active[lane].append(tr)
  active[lane]=[tr for tr in active[lane] if t-tr['p'][-1][0]<.14]
json.dump(tracks,open(root/'tracks.json','w'));json.dump(rip,open(root/'ripples.json','w'))
valid=[]
for tr in tracks:
 pts=np.array(tr['p'])
 if len(pts)<6 or np.ptp(pts[:,1])<25:continue
 slope,intercept=np.polyfit(pts[:,0],pts[:,1],1);err=np.median(abs(pts[:,1]-(slope*pts[:,0]+intercept)))
 if not(-290<slope<-225) or err>4:continue
 hit=(82-intercept)/slope
 if 8<hit<138:valid.append(dict(lane=tr['lane'],t=float(hit),center=float(np.median(pts[:,2])),frames=len(pts)))
json.dump(valid,open(root/'valid.json','w'));print('moving trajectories',len(valid),flush=True)
events=[];array=np.array([x[1] for x in rip])
for lane in range(6):
 inds=np.where(array[:,lane]>.62)[0]
 for g in np.split(inds,np.where(np.diff(inds)>4)[0]+1):
  if len(g)>=6 and g[-1]-g[0]>=8:events.append({'lane':lane,'t':rip[int(g[-1])][0]+1/30})
json.dump(events,open(root/'ripple-events.json','w'));print('ripple events',len(events),flush=True)
