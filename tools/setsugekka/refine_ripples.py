"""Re-observe fixed Ripple heads with a centered complete three-sector mark."""
import argparse,json
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True);args=p.parse_args();args.out.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS);cap.set(cv2.CAP_PROP_POS_MSEC,18000);ok,f=cap.read();assert ok;f=cv2.resize(f,(854,480),interpolation=cv2.INTER_AREA)
def white(frame):
 h,s,v=cv2.split(cv2.cvtColor(frame,cv2.COLOR_BGR2HSV));return ((s<80)&(v>145)).astype(np.float32)
m=white(f);ref=m[381:402,567:588];templates=[]
for size in [19,21,23,25]:
 scaled=cv2.resize(ref,(size,size));c=(size-1)/2
 for a in range(0,120,15):templates.append(cv2.warpAffine(scaled,cv2.getRotationMatrix2D((c,c),a,1),(size,size)))
fixed=[(268,82),(578,82),(676,232),(578,391),(268,391),(174,232)];rows=[];index=0;cap.set(cv2.CAP_PROP_POS_FRAMES,0)
while True:
 ok,f=cap.read()
 if not ok:break
 t=index/fps;index+=1
 if not 9<t<98:continue
 f=cv2.resize(f,(854,480),interpolation=cv2.INTER_AREA);m=white(f);values=[]
 for x,y in fixed:
  crop=m[y-23:y+24,x-23:x+24];values.append(float(max(cv2.matchTemplate(crop,z,cv2.TM_CCOEFF_NORMED).max() for z in templates)))
 rows.append([t,values])
 if index%600==0:print('Ripple core',round(t,1),flush=True)
cap.release();arr=np.array([r[1] for r in rows]);events=[]
for lane in range(6):
 ids=np.where(arr[:,lane]>.60)[0]
 for group in np.split(ids,np.where(np.diff(ids)>2)[0]+1):
  if len(group)>=5 and group[-1]-group[0]>=5 and np.max(arr[group,lane])>.78:
   start=rows[int(group[0])][0];end=rows[int(group[-1])][0]+1/fps
   if 9.6<end<97.6:events.append({'lane':lane,'t':end,'start':start,'frames':len(group),'confidence':float(np.median(arr[group,lane]))})
(args.out/'refined-ripples.json').write_text(json.dumps(events,separators=(',',':')));(args.out/'ripple-core-scores.json').write_text(json.dumps(rows,separators=(',',':')))
print(json.dumps({'ripples':len(events),'perLane':{i:sum(n['lane']==i for n in events) for i in range(6)}}),flush=True)
