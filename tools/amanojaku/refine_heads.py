"""Fit colored head centroids; rotating outlines can create duplicate radial peaks."""
import argparse,json,math
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,required=True);p.add_argument('--frames',type=Path,required=True);args=p.parse_args()
notes=json.loads((args.analysis/'classified.json').read_text());tracks=json.loads((args.analysis/'tracks.json').read_text())
for n in notes:
 if n['scores'][n['type']]<.54:continue
 a=-math.pi/2+n['lane']*math.pi/4;points=[]
 for pt in tracks[n['track']]['p']:
  t,r=pt[:2]
  if not 115<r<245:continue
  x,y=round(426+r*math.cos(a)),round(232+r*math.sin(a));frame=cv2.imread(str(args.frames/f'{round(t*30):06d}.jpg'))
  crop=frame[y-32:y+33,x-32:x+33]
  if crop.shape!=(65,65,3):continue
  h,s,v=cv2.split(cv2.cvtColor(crop,cv2.COLOR_BGR2HSV));colored=((h>=15)&(h<=110)) if n['type']=='flick' else (((h>=135)&(h<=177))|((h>=15)&(h<=110)))
  mask=(colored&(s>95)&(v>95)).astype(np.uint8)*255
  mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
  contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);options=[]
  for c in contours:
   area=cv2.contourArea(c);m=cv2.moments(c)
   if not 110<area<1900 or not m['m00']:continue
   px,py=m['m10']/m['m00'],m['m01']/m['m00'];d=math.hypot(px-32,py-32)
   if d<28:options.append((d,px,py))
  if not options:continue
  _,px,py=min(options);rad=(x+px-32-426)*math.cos(a)+(y+py-32-232)*math.sin(a);points.append([t,rad])
 if len(points)<5:continue
 pts=np.array(points);slope,intercept=np.polyfit(pts[:,0],pts[:,1],1);error=float(np.median(abs(pts[:,1]-(slope*pts[:,0]+intercept))))
 if -350<slope<-180 and error<4:
  n['radialPeakTime']=n['t'];n['t']=float((82-intercept)/slope);n['centroidError']=error;n['centroidSamples']=len(points)
(args.analysis/'refined.json').write_text(json.dumps(notes,separators=(',',':')))
print('refined',sum('centroidSamples' in n for n in notes))
