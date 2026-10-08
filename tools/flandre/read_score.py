"""Read the cabinet SCORE counter frame by frame from the user-supplied recording.

The recording is a PERFECT play (1,000,000 points, 724 Fantastic). Every
judgment adds 1,000,000/724, so the displayed score reveals the cumulative
judgment count. A monotone Viterbi pass over all frames chooses the count
whose rendered digits best match glyph templates harvested from the same
video. Output: score-steps.json with the frame time of each increase.
"""
import argparse,json
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True)
p.add_argument('--total',type=int,default=724);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
cap=cv2.VideoCapture(str(a.video));fps=cap.get(cv2.CAP_PROP_FPS);T=a.total
X0,PITCH,W,Y0,Y1=466.5,25.2,24,1,40
def cells(frame):
    hsv=cv2.cvtColor(frame[0:44,455:640],cv2.COLOR_BGR2HSV);m=np.pad(((hsv[...,2]>150)&(hsv[...,1]<80)).astype(np.float32),((0,0),(0,12)))
    out=[]
    for k in range(7):
        x=int(round(X0+PITCH*k))-455;out.append(m[Y0:Y1,max(0,x-2):x+W+2])
    return out
frames,times=[],[];i=0
while True:
    ok,f=cap.read()
    if not ok:break
    t=i/fps;i+=1
    if 11.0<=t<=148.0:frames.append(cells(f));times.append(t)
cap.release()
def text(k):
    s=str(round(k*1e6/T)).rjust(7);return s
def match(c,tpl):
    # best shift within ±2 px; templates are W wide, cells W+4 wide
    best=-1
    for dx in range(0,c.shape[1]-tpl.shape[1]+1):
        x=c[:,dx:dx+tpl.shape[1]];a1=x-x.mean();b=tpl-tpl.mean();d=np.sqrt((a1*a1).sum()*(b*b).sum())
        v=(a1*b).sum()/d if d>1e-6 else (1.0 if x.sum()<3 and tpl.sum()<3 else 0.0)
        best=max(best,v)
    return best
# bootstrap glyphs from frames whose counts were read by eye
known={30.0:52,62.0:234,61.1:228,61.2:229}
tpl={}
def harvest(idx,k):
    for c,ch in zip(frames[idx],text(k)):
        tpl.setdefault(ch,[]).append(c[:,2:2+W])
for v,k in known.items():harvest(int(np.argmin(abs(np.array(times)-v))),k)
def build():return {ch:np.mean(v,axis=0) for ch,v in tpl.items()}
for rnd in range(2):
    G=build();N=len(frames)
    # emission: per frame per k; only score digits that have templates
    em=np.full((N,T+1),-1e9,dtype=np.float32);cache={}
    for n,c in enumerate(frames):
        per=[{ch:match(c[j],g) for ch,g in G.items()} for j in range(7)]
        for k in range(T+1):
            s=text(k);em[n,k]=sum(per[j].get(ch,0.3) for j,ch in enumerate(s))
    # monotone Viterbi with max step 12 per frame
    dp=em[0].copy();back=np.zeros((N,T+1),dtype=np.int32)
    for n in range(1,N):
        best=np.full(T+1,-1e18);arg=np.zeros(T+1,dtype=np.int32)
        for d in range(13):
            cand=np.full(T+1,-1e18);cand[d:]=dp[:T+1-d]-0.15*d
            upd=cand>best;best[upd]=cand[upd];arg[upd]=(np.arange(T+1)-d)[upd]
        dp=best+em[n];back[n]=arg
    path=np.zeros(N,dtype=np.int32);path[-1]=int(np.argmax(dp))
    for n in range(N-1,0,-1):path[n-1]=back[n,path[n]]
    # harvest all digits from confident frames for the next round
    conf=[n for n in range(N) if em[n,path[n]]>6.3];tpl={}
    for n in conf[::3]:harvest(n,int(path[n]))
    print(json.dumps({'round':rnd,'final':int(path[-1]),'confidentFrames':len(conf),'frames':N,'glyphs':sorted(tpl)}),flush=True)
steps=[]
for n in range(1,len(path)):
    if path[n]>path[n-1]:steps.append({'time':times[n],'frame':round(times[n]*fps),'count':int(path[n]),'delta':int(path[n]-path[n-1]),'match':float(em[n,path[n]])})
(a.out/'score-steps.json').write_text(json.dumps({'fps':fps,'total':T,'final':int(path[-1]),'steps':steps,'perFrame':[[round(t,4),int(k),round(float(em[n,k]),3)] for n,(t,k) in enumerate(zip(times,path))]},separators=(',',':')))
print(json.dumps({'steps':len(steps),'final':int(path[-1]),'deltaHistogram':np.bincount([s['delta'] for s in steps]).tolist()}))
