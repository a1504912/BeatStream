"""Sample the recording into lane/ripple kymographs (time x radius) for note detection.

Coordinates refer to the recording resized to 854x480, the same layout as the
other video-reference tools. For each frame and each of the eight lanes we
average colour-class masks across a 15 px band perpendicular to the lane; for
each of the six fixed Ripple circles we average over concentric annuli.
"""
import argparse,math
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True)
p.add_argument('--start',type=float,default=11.0);p.add_argument('--end',type=float,default=147.0);a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
cx,cy=421.5,232.0
RIPPLES=[(268,80),(573,80),(674,232),(573,384),(268,384),(174,232)]
rs=np.arange(60,421,dtype=np.float32);qs=np.arange(-7,8,dtype=np.float32)
lane_maps=[]
for lane in range(8):
    ang=-math.pi/2+lane*math.pi/4
    lane_maps.append((cx+rs[None,:]*math.cos(ang)-qs[:,None]*math.sin(ang),cy+rs[None,:]*math.sin(ang)+qs[:,None]*math.cos(ang)))
rr=np.arange(0,76,dtype=np.float32);th=np.linspace(0,2*math.pi,96,endpoint=False,dtype=np.float32)
ripple_maps=[(x+rr[None,:]*np.cos(th)[:,None],y+rr[None,:]*np.sin(th)[:,None]) for x,y in RIPPLES]
def classes(frame):
    h,s,v=cv2.split(cv2.cvtColor(frame,cv2.COLOR_BGR2HSV));col=(s>90)&(v>90)
    pink=col&(h>=135)&(h<=175);cyan=col&(h>=80)&(h<=104);yellow=col&(h>=18)&(h<=36);green=col&(h>=42)&(h<=78)
    white=(s<60)&(v>170);gray=(s<60)&(v>90)&(v<=170)
    return np.dstack([pink,cyan,yellow,green,white,gray]).astype(np.float32)
cap=cv2.VideoCapture(str(a.video));fps=cap.get(cv2.CAP_PROP_FPS);times,lanes,ripples=[],[],[];i=0
while True:
    ok,f=cap.read()
    if not ok:break
    t=i/fps;i+=1
    if t<a.start:continue
    if t>a.end:break
    c=classes(cv2.resize(f,(854,480),interpolation=cv2.INTER_AREA))
    lanes.append(np.stack([cv2.remap(c,mx,my,cv2.INTER_LINEAR).mean(axis=0) for mx,my in lane_maps]))
    ripples.append(np.stack([cv2.remap(c,mx,my,cv2.INTER_LINEAR).mean(axis=0) for mx,my in ripple_maps]))
    times.append(t)
cap.release()
np.savez_compressed(a.out/'kymo.npz',times=np.array(times),fps=fps,rs=rs,rr=rr,lanes=np.array(lanes,dtype=np.float16),ripples=np.array(ripples,dtype=np.float16),classes=np.array(['pink','cyan','yellow','green','white','gray']))
print('frames',len(times),'lanes',np.array(lanes).shape,'ripples',np.array(ripples).shape)
