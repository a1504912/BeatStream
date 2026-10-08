"""Track actual head symbols rather than the colored outlines of their rails.

The templates are cropped from heads observed in this supplied recording.
This second pass keeps occluded short trajectories and records confidence;
it does not manufacture beats to reach the cabinet's final combo count.
"""
import argparse,json,math
from pathlib import Path
from collections import Counter
import cv2,numpy as np
from scipy.signal import find_peaks

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--prior',type=Path,required=True);p.add_argument('--out',type=Path,required=True);args=p.parse_args()
args.out.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
tracks=json.loads((args.prior/'tracks.json').read_text());valid=json.loads((args.prior/'valid.json').read_text());byid={n['track']:n for n in valid}
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS);cx,cy,R=421.5,232.,80.5
def mask(f):
 h,s,v=cv2.split(cv2.cvtColor(f,cv2.COLOR_BGR2HSV));return (((((h>=132)&(h<=179))|((h>=18)&(h<=110)))&(s>85)&(v>75))).astype(np.float32)
templates={}
for kind,track in [('tap',99),('flick',49),('hold',2623)]:
 n=byid[track];pt=min(tracks[track]['p'],key=lambda v:abs(v[1]-150));t,r=pt[:2];a=-math.pi/2+n['lane']*math.pi/4
 cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,f=cap.read();assert ok;f=cv2.resize(f,(854,480),interpolation=cv2.INTER_AREA)
 x,y=round(cx+r*math.cos(a)),round(cy+r*math.sin(a));ref=mask(f)[y-14:y+15,x-14:x+15];refs=[]
 for angle in range(0,360,30):refs.append(cv2.warpAffine(ref,cv2.getRotationMatrix2D((14,14),angle,1),(29,29),borderMode=cv2.BORDER_CONSTANT))
 templates[kind]=refs
rs=np.arange(93,411,dtype=np.float32);qs=np.arange(-20,21,dtype=np.float32);maps=[]
for lane in range(8):
 a=-math.pi/2+lane*math.pi/4;maps.append((cx+rs[None,:]*math.cos(a)-qs[:,None]*math.sin(a),cy+rs[None,:]*math.sin(a)+qs[:,None]*math.cos(a)))
all_tracks=[];active=[[] for _ in range(8)];index=0;cap.set(cv2.CAP_PROP_POS_FRAMES,0)
while True:
 ok,f=cap.read()
 if not ok:break
 t=index/fps;index+=1
 if not 8.8<t<97.7:continue
 f=cv2.resize(f,(854,480),interpolation=cv2.INTER_AREA);m=mask(f)
 for lane,(mx,my) in enumerate(maps):
  strip=cv2.remap(m,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);scores=[]
  for kind,refs in templates.items():
   scores.append(np.maximum.reduce([cv2.matchTemplate(strip,ref,cv2.TM_CCOEFF_NORMED).max(axis=0) for ref in refs]))
  score=np.max(scores,axis=0);peaks,_=find_peaks(score,height=.58,prominence=.10,distance=17)
  obs=[]
  for k in peaks:
   r=float(rs[k+14]);a=-math.pi/2+lane*math.pi/4;x,y=round(cx+r*math.cos(a)),round(cy+r*math.sin(a))
   if not(40<x<816 and 22<y<450):continue
   kind=list(templates)[int(np.argmax(np.array(scores)[:,k]))]
   obs.append([r,float(score[k]),kind])
  matches=[]
  for tr in active[lane]:
   last=tr['p'][-1];dt=t-last[0]
   for j,o in enumerate(obs):
    error=abs(o[0]-(last[1]+tr.get('velocity',-250)*dt))
    if dt<.145 and error<10:matches.append((error,tr,j))
  usedt,usedo=set(),set()
  for _,tr,j in sorted(matches,key=lambda z:z[0]):
   if id(tr) in usedt or j in usedo:continue
   tr['p'].append([t,*obs[j]])
   if len(tr['p'])>3:
    first=tr['p'][-4];tr['velocity']=float(np.clip((obs[j][0]-first[1])/(t-first[0]),-285,-215))
   usedt.add(id(tr));usedo.add(j)
  for j,o in enumerate(obs):
   if j not in usedo:tr={'lane':lane,'p':[[t,*o]]};all_tracks.append(tr);active[lane].append(tr)
  active[lane]=[tr for tr in active[lane] if t-tr['p'][-1][0]<.145]
 if index%600==0:print('Head templates',round(t,1),flush=True)
cap.release();result=[]
for i,tr in enumerate(all_tracks):
 pts=np.array([v[:3] for v in tr['p']])
 if len(pts)<4 or np.ptp(pts[:,1])<25:continue
 slope,intercept=np.polyfit(pts[:,0],pts[:,1],1);err=float(np.median(abs(pts[:,1]-(pts[:,0]*slope+intercept))))
 if not -285<slope<-215 or err>3.2:continue
 hit=float((R-intercept)/slope)
 if not 9.6<hit<97.6:continue
 votes=Counter(v[3] for v in tr['p']);kind=votes.most_common(1)[0][0]
 result.append({'track':i,'lane':tr['lane'],'t':hit,'type':kind,'confidence':float(np.median(pts[:,2])),'frames':len(pts),'error':err,'slope':float(slope),'first':tr['p'][0],'last':tr['p'][-1],'observations':tr['p']})
(args.out/'refined-heads.json').write_text(json.dumps(result,separators=(',',':')))
print(json.dumps({'heads':len(result),'types':dict(Counter(n['type'] for n in result))}),flush=True)
