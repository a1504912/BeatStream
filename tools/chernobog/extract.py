"""Track the supplied CHERNOBOG cabinet recording; intermediate observations are reviewable."""
import argparse, json, math
from pathlib import Path
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

parser = argparse.ArgumentParser()
parser.add_argument('video', type=Path)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
cv2.setNumThreads(2)
cap = cv2.VideoCapture(str(args.video))
fps = cap.get(cv2.CAP_PROP_FPS)
cx, cy, hit_radius = 426.67, 238.0, 91.0
rs = np.arange(94, 440, dtype=np.float32)
qs = np.arange(-9, 10, dtype=np.float32)
maps = []
for lane in range(8):
    angle = -math.pi/2 + lane*math.pi/4
    maps.append((cx + rs[None,:]*math.cos(angle) - qs[:,None]*math.sin(angle),
                 cy + rs[None,:]*math.sin(angle) + qs[:,None]*math.cos(angle)))
fixed = [(260,73),(593,73),(695,238),(593,405),(260,405),(160,238)]
tracks, active, ripples, bodies = [], [[] for _ in range(8)], [], []
best_crops = [[] for _ in range(6)]
index = 0
while True:
    ok, full = cap.read()
    if not ok:
        break
    t = index/fps
    index += 1
    if t < 14 or t > 130:
        continue
    frame = cv2.resize(full, (854,480), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h,s,v = cv2.split(hsv)
    mask = ((((h>=135)&(h<=177)) | ((h>=20)&(h<=110))) & (s>95) & (v>95)).astype(np.float32)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    rv = []
    for lane,(x,y) in enumerate(fixed):
        crop = gray[y-14:y+15,x-14:x+15]
        bright = int((gray[y-9:y+10,x-9:x+10]>190).sum())
        rv.append(bright)
        if bright > 35 and (not best_crops[lane] or t-best_crops[lane][-1]['t']>.3):
            best_crops[lane].append({'t':t,'bright':bright})
            if len(best_crops[lane])<80:
                cv2.imwrite(str(args.out/f'ripple-{lane}-{t:.3f}.png'),frame[y-36:y+37,x-36:x+37])
    ripples.append([t,rv])
    body = []
    for lane,(mx,my) in enumerate(maps):
        strip = cv2.remap(mask,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        body.append(float(strip[:,(rs>=108)&(rs<=140)].mean()))
        sig = gaussian_filter1d(strip.mean(axis=0),2.1)
        peaks,_ = find_peaks(sig,height=.13,prominence=.075,distance=13)
        observations = []
        angle = -math.pi/2 + lane*math.pi/4
        for p in peaks:
            distance = float(rs[p])
            x,y = int(cx+distance*math.cos(angle)),int(cy+distance*math.sin(angle))
            if not (56<x<799 and 16<y<466):
                continue
            center = float(mask[y-6:y+7,x-6:x+7].mean())
            solid = float(mask[y-3:y+4,x-3:x+4].mean())
            observations.append((distance,center,solid))
        matches = []
        for tr in active[lane]:
            last = tr['p'][-1]
            dt = t-last[0]
            velocity = tr.get('velocity',-265)
            for j,observation in enumerate(observations):
                error = abs(observation[0]-(last[1]+velocity*dt))
                if dt<.115 and error<13:
                    matches.append((error,tr,j))
        used_tracks,used_observations = set(),set()
        for _,tr,j in sorted(matches,key=lambda z:z[0]):
            if id(tr) in used_tracks or j in used_observations:
                continue
            previous = tr['p'][-1]
            tr['p'].append([t,*observations[j]])
            if len(tr['p'])>4:
                start = tr['p'][-5]
                velocity = (observations[j][0]-start[1])/(t-start[0])
                tr['velocity'] = float(np.clip(velocity,-420,-130))
            used_tracks.add(id(tr));used_observations.add(j)
        for j,observation in enumerate(observations):
            if j not in used_observations:
                tr = {'lane':lane,'p':[[t,*observation]]}
                tracks.append(tr);active[lane].append(tr)
        active[lane] = [tr for tr in active[lane] if t-tr['p'][-1][0]<.115]
    bodies.append([t,body])
    if index % 600 == 0:
        print(f'video {t:.1f}s: {len(tracks)} trajectories',flush=True)
cap.release()
valid = []
for tr in tracks:
    points = np.array(tr['p'])
    if len(points)<7 or np.ptp(points[:,1])<20:
        continue
    slope,intercept = np.polyfit(points[:,0],points[:,1],1)
    error = float(np.median(abs(points[:,1]-(slope*points[:,0]+intercept))))
    if not (-420<slope<-170) or error>3.4:
        continue
    hit = float((hit_radius-intercept)/slope)
    if 14<hit<130:
        valid.append({'lane':tr['lane'],'t':hit,'center':float(np.median(points[:,2])),
                      'solid':float(np.median(points[:,3])),'frames':len(points),
                      'slope':float(slope),'error':error,'first':tr['p'][0],'last':tr['p'][-1]})
for filename,data in [('tracks.json',tracks),('valid.json',valid),('ripples.json',ripples),
                      ('bodies.json',bodies),('ripple-candidates.json',best_crops)]:
    (args.out/filename).write_text(json.dumps(data,separators=(',',':')))
print(json.dumps({'moving':len(valid),'slopes':[float(x) for x in np.quantile([n['slope'] for n in valid],[.1,.5,.9])]}),flush=True)
