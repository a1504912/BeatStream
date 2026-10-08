"""Observe radial note trajectories and fixed Ripple centers in the supplied 480p recording.

Usage: PYTHONPATH=... python3 tools/amanojaku/extract.py VIDEO --out SCRATCH
The raw recording and intermediate images stay outside the source repository.
"""
import argparse, json, math
from pathlib import Path
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

p = argparse.ArgumentParser()
p.add_argument('video', type=Path)
p.add_argument('--out', type=Path, required=True)
args = p.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
cv2.setNumThreads(2)
cap = cv2.VideoCapture(str(args.video))
fps = cap.get(cv2.CAP_PROP_FPS)
cx, cy, hit_radius = 426, 232, 82
fixed = [(272,80),(582,80),(677,232),(582,383),(272,383),(176,232)]
rs = np.arange(94,410,dtype=np.float32)
qs = np.arange(-9,10,dtype=np.float32)
maps = []
for lane in range(8):
    a = -math.pi/2 + lane*math.pi/4
    maps.append((cx+rs[None,:]*math.cos(a)-qs[:,None]*math.sin(a),
                 cy+rs[None,:]*math.sin(a)+qs[:,None]*math.cos(a)))
cap.set(cv2.CAP_PROP_POS_MSEC,30000)
ok, ref = cap.read()
assert ok
template = cv2.cvtColor(ref[71:90,263:282],cv2.COLOR_BGR2GRAY)
templates = []
for size in [17,19,22,25,28,31,34]:
    scaled=cv2.resize(template,(size,size),interpolation=cv2.INTER_CUBIC)
    templates.extend(cv2.warpAffine(scaled,cv2.getRotationMatrix2D(((size-1)/2,(size-1)/2),a,1),
                                  (size,size),borderMode=cv2.BORDER_REPLICATE) for a in range(0,120,10))
cap.set(cv2.CAP_PROP_POS_FRAMES,0)
tracks, active, rows, bodies = [], [[] for _ in range(8)], [], []
index = 0
while True:
    ok, frame = cap.read()
    if not ok: break
    t = index/fps
    index += 1
    if not 9 <= t <= 120: continue
    hsv = cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
    h,s,v = cv2.split(hsv)
    mask = (((((h>=135)&(h<=177))|((h>=20)&(h<=110)))&(s>95)&(v>95))).astype(np.float32)
    gray = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    values = []
    for x,y in fixed:
        crop = gray[y-19:y+20,x-19:x+20]
        bright = int((gray[y-10:y+11,x-10:x+11]>140).sum())
        score = float(max(cv2.matchTemplate(crop,z,cv2.TM_CCOEFF_NORMED).max() for z in templates)) if bright>18 else 0
        values.append(score)
    rows.append([t,values])
    body = []
    for lane,(mx,my) in enumerate(maps):
        strip = cv2.remap(mask,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        body.append(float(strip[:,(rs>=99)&(rs<=121)].mean()))
        sig = gaussian_filter1d(strip.mean(axis=0),2.4)
        peaks,_ = find_peaks(sig,height=.12,prominence=.07,distance=16)
        obs = []
        a = -math.pi/2+lane*math.pi/4
        for k in peaks:
            distance = float(rs[k])
            x,y = int(cx+distance*math.cos(a)),int(cy+distance*math.sin(a))
            if not (43<x<813 and 30<y<420): continue
            center = float(mask[y-6:y+7,x-6:x+7].mean())
            solid = float(mask[y-3:y+4,x-3:x+4].mean())
            hue = float(np.median(h[y-6:y+7,x-6:x+7][mask[y-6:y+7,x-6:x+7]>.5])) if center else 0
            obs.append((distance,center,solid,hue))
        matches=[]
        for tr in active[lane]:
            last=tr['p'][-1];dt=t-last[0]
            for j,o in enumerate(obs):
                error=abs(o[0]-(last[1]+tr.get('velocity',-250)*dt))
                if dt<.14 and error<13: matches.append((error,tr,j))
        usedt,usedo=set(),set()
        for _,tr,j in sorted(matches,key=lambda z:z[0]):
            if id(tr) in usedt or j in usedo:continue
            tr['p'].append([t,*obs[j]])
            if len(tr['p'])>4:
                start=tr['p'][-5]
                tr['velocity']=float(np.clip((obs[j][0]-start[1])/(t-start[0]),-430,-140))
            usedt.add(id(tr));usedo.add(j)
        for j,o in enumerate(obs):
            if j not in usedo:
                tr={'lane':lane,'p':[[t,*o]]};tracks.append(tr);active[lane].append(tr)
        active[lane]=[tr for tr in active[lane] if t-tr['p'][-1][0]<.14]
    bodies.append([t,body])
    if index%600==0:print(f'video {t:.1f}s: {len(tracks)} trajectories',flush=True)
cap.release()
valid=[]
for i,tr in enumerate(tracks):
    pts=np.array(tr['p'])
    if len(pts)<6 or np.ptp(pts[:,1])<25:continue
    slope,intercept=np.polyfit(pts[:,0],pts[:,1],1)
    error=float(np.median(abs(pts[:,1]-(slope*pts[:,0]+intercept))))
    if not (-430<slope<-150) or error>3.8:continue
    hit=float((hit_radius-intercept)/slope)
    if 9<hit<120:
        valid.append({'track':i,'lane':tr['lane'],'t':hit,'center':float(np.median(pts[:,2])),
                      'solid':float(np.median(pts[:,3])),'hue':float(np.median(pts[:,4])),
                      'frames':len(pts),'slope':float(slope),'error':error,'first':tr['p'][0],'last':tr['p'][-1]})
events=[]
array=np.array([r[1] for r in rows])
for lane in range(6):
    ids=np.where(array[:,lane]>.55)[0]
    for group in np.split(ids,np.where(np.diff(ids)>3)[0]+1):
        if len(group)>=8 and group[-1]-group[0]>=9 and np.max(array[group,lane])>.8:
            events.append({'lane':lane,'t':rows[int(group[-1])][0]+1/fps,
                           'start':rows[int(group[0])][0],'frames':len(group)})
for name,data in [('tracks.json',tracks),('valid.json',valid),('ripple-scores.json',rows),
                  ('ripple-events.json',events),('bodies.json',bodies)]:
    (args.out/name).write_text(json.dumps(data,separators=(',',':')))
print(json.dumps({'moving':len(valid),'ripples':len(events),
                  'slopes':[float(x) for x in np.quantile([n['slope'] for n in valid],[.1,.5,.9])]}))
