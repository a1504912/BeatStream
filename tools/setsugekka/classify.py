"""Classify footage-derived note heads and refine round/square arrival centers."""
import argparse,json,math
from pathlib import Path
import cv2,numpy as np
from collections import Counter
p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,required=True);args=p.parse_args();r=args.analysis
cv2.setNumThreads(2);fps=30000/1001
tracks=json.loads((r/'tracks.json').read_text());valid=json.loads((r/'valid.json').read_text());byid={n['track']:n for n in valid}
def mask(f):
 h,s,v=cv2.split(cv2.cvtColor(f,cv2.COLOR_BGR2HSV))
 return (((((h>=132)&(h<=179))|((h>=18)&(h<=110)))&(s>90)&(v>80))).astype(np.float32)
def patch(n,radius):
 pt=min(tracks[n['track']]['p'],key=lambda p:abs(p[1]-radius));t,rad=pt[:2];a=-math.pi/2+n['lane']*math.pi/4
 x,y=round(421.5+rad*math.cos(a)),round(232+rad*math.sin(a));f=cv2.imread(str(r/'frames'/f'{round(t*fps):06d}.jpg'))
 return f[y-32:y+33,x-32:x+33]
refs={'tap':mask(patch(byid[99],150))[13:52,13:52],'flick':mask(patch(byid[49],150))[13:52,13:52],'hold':mask(patch(byid[2623],150))[13:52,13:52]}
templates={}
for kind,ref in refs.items():
 ts=[]
 for size in [35,39,43]:
  scaled=cv2.resize(ref,(size,size))
  for angle in range(0,360,15):
   ts.append(cv2.warpAffine(scaled,cv2.getRotationMatrix2D(((size-1)/2,(size-1)/2),angle,1),(size,size),borderMode=cv2.BORDER_CONSTANT))
 templates[kind]=ts
out=[]
for n in valid:
 # Keep a broad velocity range for candidate review. Later passes distinguish
 # moving symbol cores from shrinking stationary outlines and shaft caps.
 if not -430<n['slope']<-130 or n['center']<=.15:continue
 scores={kind:[] for kind in templates}
 for radius in [135,165,205]:
  crop=patch(n,radius)
  if crop.shape!=(65,65,3):continue
  m=mask(crop)
  for kind,ts in templates.items():scores[kind].append(float(max(cv2.matchTemplate(m,z,cv2.TM_CCOEFF_NORMED).max() for z in ts)))
 if not scores['tap']:continue
 scores={k:float(np.median(v)) for k,v in scores.items()};kind=max(scores,key=scores.get);item={**n,'type':kind,'scores':scores}
 # A head centroid is more reliable than the largest radial outline peak.
 if kind!='hold' and scores[kind]>.53:
  a=-math.pi/2+n['lane']*math.pi/4;points=[]
  for pt in tracks[n['track']]['p'][::2]:
   t,rad=pt[:2]
   if not 117<rad<245:continue
   x,y=round(421.5+rad*math.cos(a)),round(232+rad*math.sin(a));f=cv2.imread(str(r/'frames'/f'{round(t*fps):06d}.jpg'));crop=f[y-32:y+33,x-32:x+33]
   if crop.shape!=(65,65,3):continue
   m=(mask(crop)*255).astype(np.uint8);m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
   cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);options=[]
   for c in cs:
    area=cv2.contourArea(c);mom=cv2.moments(c)
    if not 75<area<1100 or not mom['m00']:continue
    px,py=mom['m10']/mom['m00'],mom['m01']/mom['m00'];d=math.hypot(px-32,py-32)
    if d<19:options.append((d,px,py))
   if not options:continue
   _,px,py=min(options);rad=(x+px-32-421.5)*math.cos(a)+(y+py-32-232)*math.sin(a);points.append([t,rad])
  if len(points)>=4:
   pts=np.array(points);slope,intercept=np.polyfit(pts[:,0],pts[:,1],1);err=float(np.median(abs(pts[:,1]-(slope*pts[:,0]+intercept))))
   if -430<slope<-130 and err<3:
    item['radialPeakTime']=item['t'];item['t']=float((80.5-intercept)/slope);item['centroidError']=err;item['centroidSamples']=len(points)
 out.append(item)
# Record continuous colored shafts separately from silhouettes: yellow heads
# can otherwise resemble a round tap. Nearby repeated taps do not become holds;
# final hold choices and caps are reviewed in reviewed.json.
cache={}
for n in out:
 if n['type']=='flick' or max(n['scores'].values())<.58 or not 9.5<n['t']<97.5:continue
 a=-math.pi/2+n['lane']*math.pi/4;lengths=[]
 for radius in [130,165,205]:
  pt=min(tracks[n['track']]['p'],key=lambda p:abs(p[1]-radius));t,rad=pt[:2];index=round(t*fps)
  if index not in cache:
   f=cv2.imread(str(r/'frames'/f'{index:06d}.jpg'));cache[index]=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
  rs=np.arange(rad+20,rad+150,dtype=np.float32);q=np.arange(-6,7,dtype=np.float32)
  mx=421.5+rs[None,:]*math.cos(a)-q[:,None]*math.sin(a);my=232+rs[None,:]*math.sin(a)+q[:,None]*math.cos(a)
  strip=cv2.remap(cache[index],mx,my,cv2.INTER_NEAREST);h,s,v=cv2.split(strip)
  color=((h>135)&(h<179)) if n['hue']>125 else ((h>79)&(h<108)) if n['hue']>55 else ((h>17)&(h<38))
  ids=np.where((color&(s>80)&(v>85)).mean(axis=0)>.40)[0]
  lengths.append(max((len(g) for g in np.split(ids,np.where(np.diff(ids)>2)[0]+1)),default=0))
 n['tailRun']=float(np.median(lengths))
(r/'classified.json').write_text(json.dumps(out,separators=(',',':')))
print(json.dumps({'types':dict(Counter(n['type'] for n in out)),'confident':dict(Counter(n['type'] for n in out if n['scores'][n['type']]>.6)),'centroidFits':sum('centroidSamples' in n for n in out)}))
