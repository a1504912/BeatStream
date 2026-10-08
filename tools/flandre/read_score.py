"""Read the cabinet SCORE counter frame by frame from the user-supplied recording.

The recording is a PERFECT play (1,000,000 points, 724 Fantastic): every
judgment adds 1,000,000/724, so the displayed score is a cumulative judgment
count. Each frame is decoded as the count k whose rendered seven digits best
match glyphs from the same video (summed per-cell correlation), so one
occluded digit cannot change the reading; low-scoring frames are dropped. Accepted counts are then
forced monotone. Output: score-steps.json (frame time of each increase).
"""
import argparse,json
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('--out',type=Path,required=True)
p.add_argument('--total',type=int,default=724);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
X0,PITCH,W=466.5,25.2,24;T=a.total
valid={str(round(k*1e6/T)):k for k in range(1,T+1)}
def cells(frame):
    hsv=cv2.cvtColor(frame[0:44,455:640],cv2.COLOR_BGR2HSV)
    m=np.pad(((hsv[...,2]>150)&(hsv[...,1]<80)).astype(np.float32),((0,0),(0,12)))
    return [m[1:40,int(round(X0+PITCH*k))-457:int(round(X0+PITCH*k))-455+W+2] for k in range(7)]
cap=cv2.VideoCapture(str(a.video));fps=cap.get(cv2.CAP_PROP_FPS);frames,times=[],[];i=0
while True:
    ok,f=cap.read()
    if not ok:break
    t=i/fps;i+=1
    if 11.0<=t<=148.0:frames.append(cells(f));times.append(t)
cap.release();times=np.array(times)
# seed glyphs: four frames whose scores were read by eye
seed={30.0:'0071823',62.0:'0323204',100.0:'0709944',120.0:'0856353'}
def glyphs(samples):
    out={}
    for cs,text in samples:
        lead=len(text)-len(text.lstrip('0'))
        for j,(c,ch) in enumerate(zip(cs,text)):
            if j>=lead:out.setdefault(ch,[]).append(c[:,2:2+W])
    return {k:np.mean(v,0) for k,v in out.items()}
def corr(c,g):
    best=-1.0;b=g-g.mean();nb=np.sqrt((b*b).sum())
    for dx in range(5):
        x=c[:,dx:dx+W];xa=x-x.mean();d=np.sqrt((xa*xa).sum())*nb
        if d>0:best=max(best,float((xa*b).sum()/d))
    return best
DIGITS='0123456789'
TEXT=[str(round(k*1e6/T)).rjust(7,'0') for k in range(T+1)]
def per_cell(cs,G):
    # returns (7, 11) table: correlation with digits 0-9 and 'blank' (index 10)
    tab=np.zeros((7,11))
    for j,c in enumerate(cs):
        empty=c[:,3:-3].sum()<25
        tab[j,10]=1.0 if empty else 0.0
        for d,ch in enumerate(DIGITS):tab[j,d]=0.0 if empty else corr(c,G[ch])
    return tab
def decode(tab):
    best=None
    for k,text in enumerate(TEXT):
        lead=len(text)-len(text.lstrip('0')) if k else 7
        s=sum(tab[j,10] if j<lead else tab[j,int(ch)] for j,ch in enumerate(text))
        if best is None or s>best[0]:best=(s,k)
    return best
G=glyphs([(frames[int(np.argmin(abs(times-v)))],s) for v,s in seed.items()])
for rnd in range(2):
    decoded=[decode(per_cell(cs,G)) for cs in frames]
    good=[(n,k) for n,(s,k) in enumerate(decoded) if s>=7*0.62]
    G=glyphs([(frames[n],str(round(k*1e6/T)).rjust(7,'0')) for n,k in good[::4] if k>0])
    print(json.dumps({'round':rnd,'accepted':len(good),'frames':len(frames)}),flush=True)
# 3 and 8 differ only in their left stroke; with 724 judgments, k and k+362
# share the lower six digits, so resolve that one ambiguity by continuity.
HALF=T//2;est=0;fixed=[]
for n,k in good:
    options=[c for c in (k,k-HALF,k+HALF) if 0<=c<=T]
    c=min(options,key=lambda c:abs(c-est))
    if abs(c-est)<=40:fixed.append((n,c));est=c
good=fixed
# monotone count per frame: longest non-decreasing chain of accepted readings
ns=[n for n,_ in good];ks=[k for _,k in good];import bisect
tails,tidx,prev=[],[],[-1]*len(ks)
for j,k in enumerate(ks):
    pos=bisect.bisect_right(tails,k)
    if pos==len(tails):tails.append(k);tidx.append(j)
    else:tails[pos]=k;tidx[pos]=j
    prev[j]=tidx[pos-1] if pos else -1
chain=[];j=tidx[-1]
while j>=0:chain.append(j);j=prev[j]
chain=chain[::-1];kept=[(ns[j],ks[j]) for j in chain]
steps=[]
for (n0,k0),(n1,k1) in zip(kept[:-1],kept[1:]):
    if k1>k0:steps.append({'time':float(times[n1]),'previousReading':float(times[n0]),'gapFrames':n1-n0,'count':k1,'delta':k1-k0})
(a.out/'score-steps.json').write_text(json.dumps({'fps':fps,'total':T,'final':kept[-1][1],'accepted':len(good),'monotone':len(kept),'steps':steps},separators=(',',':')))
gaps=np.array([s['gapFrames'] for s in steps])
print(json.dumps({'steps':len(steps),'final':kept[-1][1],'rejectedAsNonMonotone':len(good)-len(kept),'deltaHistogram':np.bincount([s['delta'] for s in steps]).tolist(),'stepsWithGap>1frame':int((gaps>1).sum())}))
