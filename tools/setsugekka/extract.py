"""Observe the user-supplied 回レ！雪月花 recording; intermediates stay in scratch.

Requires OpenCV, numpy, scipy. Coordinates refer to the recording resized to
854×480; this is footage analysis, not downloadable cabinet chart data.
"""
import argparse,json,math
from pathlib import Path
import cv2,numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True);args=p.parse_args()
args.out.mkdir(parents=True,exist_ok=True);frames=args.out/'frames';frames.mkdir(exist_ok=True)
cv2.setNumThreads(2)
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS)
cx,cy,hit_radius=421.5,232.0,80.5
fixed=[(268,80),(573,80),(674,232),(573,384),(268,384),(174,232)]
rs=np.arange(94,405,dtype=np.float32);qs=np.arange(-9,10,dtype=np.float32)
maps=[]
for lane in range(8):
 a=-math.pi/2+lane*math.pi/4
 maps.append((cx+rs[None,:]*math.cos(a)-qs[:,None]*math.sin(a),cy+rs[None,:]*math.sin(a)+qs[:,None]*math.cos(a)))
cap.set(cv2.CAP_PROP_POS_MSEC,18000);ok,ref=cap.read();assert ok
ref=cv2.cvtColor(cv2.resize(ref,(854,480)),cv2.COLOR_BGR2GRAY)
x,y=fixed[3];template=ref[y-9:y+10,x-9:x+10];templates=[]
for size in [17,19,22,25,28]:
 scaled=cv2.resize(template,(size,size),interpolation=cv2.INTER_CUBIC)
 for angle in range(0,120,15):
  templates.append(cv2.warpAffine(scaled,cv2.getRotationMatrix2D(((size-1)/2,(size-1)/2),angle,1),(size,size),borderMode=cv2.BORDER_REPLICATE))
cap.set(cv2.CAP_PROP_POS_FRAMES,0)
tracks,active,rows,bodies=[],[[] for _ in range(8)],[],[];index=0
while True:
 ok,full=cap.read()
 if not ok:break
 t=index/fps;frame_index=index;index+=1
 if not 5<=t<=100:continue
 frame=cv2.resize(full,(854,480),interpolation=cv2.INTER_AREA)
 cv2.imwrite(str(frames/f'{frame_index:06d}.jpg'),frame,[cv2.IMWRITE_JPEG_QUALITY,90])
 h,s,v=cv2.split(cv2.cvtColor(frame,cv2.COLOR_BGR2HSV))
 mask=(((((h>=132)&(h<=179))|((h>=18)&(h<=110)))&(s>90)&(v>80))).astype(np.float32)
 gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);values=[]
 for x,y in fixed:
  crop=gray[y-19:y+20,x-19:x+20]
  bright=int((gray[y-10:y+11,x-10:x+11]>135).sum())
  values.append(float(max(cv2.matchTemplate(crop,z,cv2.TM_CCOEFF_NORMED).max() for z in templates)) if bright>15 else 0)
 rows.append([t,values]);body=[]
 for lane,(mx,my) in enumerate(maps):
  strip=cv2.remap(mask,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
  body.append(float(strip[:,(rs>=95)&(rs<=115)].mean()))
  sig=gaussian_filter1d(strip.mean(axis=0),2.2);peaks,_=find_peaks(sig,height=.12,prominence=.07,distance=15)
  obs=[];a=-math.pi/2+lane*math.pi/4
  for k in peaks:
   r=float(rs[k]);x,y=round(cx+r*math.cos(a)),round(cy+r*math.sin(a))
   if not(35<x<818 and 22<y<450):continue
   center=float(mask[y-6:y+7,x-6:x+7].mean());solid=float(mask[y-3:y+4,x-3:x+4].mean())
   hue=float(np.median(h[y-6:y+7,x-6:x+7][mask[y-6:y+7,x-6:x+7]>.5])) if center else 0
   obs.append((r,center,solid,hue))
  matches=[]
  for tr in active[lane]:
   last=tr['p'][-1];dt=t-last[0]
   for j,o in enumerate(obs):
    error=abs(o[0]-(last[1]+tr.get('velocity',-250)*dt))
    if dt<.14 and error<14:matches.append((error,tr,j))
  usedt,usedo=set(),set()
  for _,tr,j in sorted(matches,key=lambda z:z[0]):
   if id(tr) in usedt or j in usedo:continue
   tr['p'].append([t,*obs[j]])
   if len(tr['p'])>4:
    start=tr['p'][-5];tr['velocity']=float(np.clip((obs[j][0]-start[1])/(t-start[0]),-430,-120))
   usedt.add(id(tr));usedo.add(j)
  for j,o in enumerate(obs):
   if j not in usedo:
    tr={'lane':lane,'p':[[t,*o]]};tracks.append(tr);active[lane].append(tr)
  active[lane]=[tr for tr in active[lane] if t-tr['p'][-1][0]<.14]
 bodies.append([t,body])
 if index%600==0:print(f'Observed {t:.1f}s / 100s',flush=True)
cap.release();valid=[]
for i,tr in enumerate(tracks):
 pts=np.array(tr['p'])
 if len(pts)<6 or np.ptp(pts[:,1])<24:continue
 slope,intercept=np.polyfit(pts[:,0],pts[:,1],1);error=float(np.median(abs(pts[:,1]-(slope*pts[:,0]+intercept))))
 if not(-430<slope<-130) or error>4:continue
 hit=float((hit_radius-intercept)/slope)
 if 5<hit<100:
  valid.append({'track':i,'lane':tr['lane'],'t':hit,'center':float(np.median(pts[:,2])),'solid':float(np.median(pts[:,3])),'hue':float(np.median(pts[:,4])),'frames':len(pts),'slope':float(slope),'error':error,'first':tr['p'][0],'last':tr['p'][-1]})
events=[];array=np.array([r[1] for r in rows])
for lane in range(6):
 ids=np.where(array[:,lane]>.56)[0]
 for group in np.split(ids,np.where(np.diff(ids)>3)[0]+1):
  if len(group)>=8 and group[-1]-group[0]>=9 and np.max(array[group,lane])>.77:
   events.append({'lane':lane,'t':rows[int(group[-1])][0]+1/fps,'start':rows[int(group[0])][0],'frames':len(group)})
for name,data in [('tracks.json',tracks),('valid.json',valid),('ripple-scores.json',rows),('ripple-events.json',events),('bodies.json',bodies)]:
 (args.out/name).write_text(json.dumps(data,separators=(',',':')))
print(json.dumps({'movingCandidates':len(valid),'ripples':len(events),'fps':fps,'slopes':np.quantile([n['slope'] for n in valid],[.1,.5,.9]).tolist()}),flush=True)
