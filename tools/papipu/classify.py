"""Classify observed square / circular silhouettes using recording-derived color masks."""
import argparse,json,math
from pathlib import Path
import cv2,numpy as np

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True)
args=p.parse_args();cv2.setNumThreads(2)
tracks=json.loads((args.out/'tracks.json').read_text());valid=json.loads((args.out/'valid.json').read_text())
cap=cv2.VideoCapture(str(args.video))

def mask(frame):
    h,s,v=cv2.split(cv2.cvtColor(frame,cv2.COLOR_BGR2HSV))
    return (((((h>=135)&(h<=177))|((h>=20)&(h<=110)))&(s>95)&(v>95))).astype(np.float32)

def patch(item,radius):
    pt=min(tracks[item['track']]['p'],key=lambda p:abs(p[1]-radius))
    t,r=pt[:2];a=-math.pi/2+item['lane']*math.pi/4
    x,y=round(426+r*math.cos(a)),round(232+r*math.sin(a))
    cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,f=cap.read()
    assert ok
    return f[y-32:y+33,x-32:x+33]

byid={n['track']:n for n in valid}
# Clear silhouettes from the reviewed 29–30 s phrase. They are not artwork assets.
refs={'tap':mask(patch(byid[782],160))[13:52,13:52],
      'flick':mask(patch(byid[768],160))[13:52,13:52]}
templates={}
for kind,ref in refs.items():
    ts=[]
    for size in [35,39,43]:
        scaled=cv2.resize(ref,(size,size))
        for angle in range(0,360,15):
            ts.append(cv2.warpAffine(scaled,cv2.getRotationMatrix2D(((size-1)/2,(size-1)/2),angle,1),
                                    (size,size),borderMode=cv2.BORDER_CONSTANT))
    templates[kind]=ts
out=[]
for i,n in enumerate(valid):
    if not -290<n['slope']<-225 or n['center']<=.16:continue
    scores={kind:[] for kind in templates}
    for radius in [145,185,220]:
        frame=patch(n,radius)
        if frame.shape!=(65,65,3):continue
        m=mask(frame)
        for kind,ts in templates.items():
            scores[kind].append(float(max(cv2.matchTemplate(m,z,cv2.TM_CCOEFF_NORMED).max() for z in ts)))
    if not scores['tap']:continue
    scores={k:float(np.median(v)) for k,v in scores.items()}
    kind='flick' if scores['flick']>scores['tap'] else 'tap'
    out.append({**n,'type':kind,'scores':scores})
(args.out/'classified.json').write_text(json.dumps(out,separators=(',',':')))
from collections import Counter
print('classified',dict(Counter(n['type'] for n in out)))
