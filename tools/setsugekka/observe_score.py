"""Read the recording's scoreboard to independently check note arrivals.

The supplied recording uses score increments on a 692-unit scale, which is
kept separate from its displayed 712 COMBO. Pixel templates are learned
from manually read, separated frames of the same recording, not a font OCR.
"""
import argparse, json
from pathlib import Path
import cv2, numpy as np

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True);args=p.parse_args()
args.out.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
cap=cv2.VideoCapture(str(args.video));fps=cap.get(cv2.CAP_PROP_FPS)
seeds={10:'0002890',20:'0093930',50:'0495664',70:'0708092',90:'0913294',95:'0968208',98:'1000000'}
def glyph(frame,i):
 crop=frame[20:137,1340+i*72:1340+(i+1)*72]
 h,s,v=cv2.split(cv2.cvtColor(crop,cv2.COLOR_BGR2HSV));m=((s<65)&(v>145)).astype(np.uint8)
 _,labels,stats,_=cv2.connectedComponentsWithStats(m)
 candidates=[(s[4],k) for k,s in enumerate(stats[1:],1) if s[3]>55 and s[2]>15 and s[4]>650]
 if not candidates:return None
 _,k=max(candidates);x,y,w,h,_=stats[k]
 return cv2.resize((labels[y:y+h,x:x+w]==k).astype(np.float32),(28,42),interpolation=cv2.INTER_AREA)
templates={str(i):[] for i in range(10)}
for t,score in seeds.items():
 cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read();assert ok
 for i,digit in enumerate(score):
  g=glyph(frame,i)
  if g is not None:templates[digit].append(g)
assert all(templates.values()),{k:len(v) for k,v in templates.items()}
cap.set(cv2.CAP_PROP_POS_FRAMES,0);index=0;reads=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 t=index/fps;index+=1
 if not 9.3<t<99.5:continue
 digits=[];confidence=[]
 for i in range(7):
  g=glyph(frame,i)
  if g is None:digits.append('0');continue
  distances=sorted((min(float(np.mean((g-ref)**2)) for ref in refs),d) for d,refs in templates.items())
  confidence.append(distances[0][0]);digits.append(distances[0][1])
 value=int(''.join(digits));count=round(value*692/1000000);error=abs(value-count*1000000/692)
 if error<2 and 0<=count<=692 and max(confidence,default=0)<.18:reads.append({'videoTime':round(t,6),'score':value,'count':count,'pixelError':round(max(confidence,default=0),4)})
 if index%600==0:print('Score observations',round(t,1),flush=True)
cap.release()
events=[];count=0
for r in reads:
 if r['count']<count or r['count']>count+12:continue
 if r['count']>count:
  events.append({**r,'delta':r['count']-count});count=r['count']
result={'fps':fps,'denominator':692,'lastCount':count,'acceptedFrames':len(reads),'events':events,'reads':reads,'seedScores':seeds}
(args.out/'score-observations.json').write_text(json.dumps(result,separators=(',',':')))
print(json.dumps({'acceptedFrames':len(reads),'events':len(events),'lastCount':count,'largeJumps':[e for e in events if e['delta']>4]}),flush=True)
