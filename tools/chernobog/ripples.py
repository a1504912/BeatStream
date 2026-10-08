"""Recognize persistent white Ripple centers, then timestamp their disappearance."""
import argparse,json
from pathlib import Path
import cv2,numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('video',type=Path)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
cv2.setNumThreads(2)
ref=cv2.imread(str(args.out/'ripple-0-49.150.png'),cv2.IMREAD_GRAYSCALE)
template=ref[26:47,26:47]
templates=[]
for size in [19,21,24,27,30,33]:
    scaled=cv2.resize(template,(size,size),interpolation=cv2.INTER_CUBIC)
    templates.extend(cv2.warpAffine(scaled,cv2.getRotationMatrix2D(((size-1)/2,(size-1)/2),a,1),(size,size),borderMode=cv2.BORDER_REPLICATE) for a in range(0,120,10))
fixed=[(260,73),(593,73),(695,238),(593,405),(260,405),(160,238)]
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS);rows=[];index=0
while True:
    ok,full=cap.read()
    if not ok:break
    t=index/fps;index+=1
    if t<14 or t>130:continue
    gray=cv2.cvtColor(cv2.resize(full,(854,480),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY)
    values=[]
    for x,y in fixed:
        crop=gray[y-19:y+20,x-19:x+20]
        bright=int((gray[y-9:y+10,x-9:x+10]>190).sum())
        score=float(max(cv2.matchTemplate(crop,z,cv2.TM_CCOEFF_NORMED).max() for z in templates)) if bright>70 else 0
        values.append(score)
    rows.append([t,values])
cap.release();array=np.array([r[1] for r in rows]);events=[]
for lane in range(6):
    indexes=np.where(array[:,lane]>.62)[0]
    for group in np.split(indexes,np.where(np.diff(indexes)>3)[0]+1):
        if len(group)>=14 and group[-1]-group[0]>=17:
            events.append({'lane':lane,'t':rows[int(group[-1])][0]+1/fps,'start':rows[int(group[0])][0], 'frames':len(group)})
(args.out/'ripple-events.json').write_text(json.dumps(events,separators=(',',':')))
(args.out/'ripple-scores.json').write_text(json.dumps(rows,separators=(',',':')))
print('persistent Ripple events',len(events),flush=True)
