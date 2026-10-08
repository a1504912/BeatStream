"""Check the edited MP3 against the recording with the audio-edit.json video clock."""
import argparse,json,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfiltfilt,fftconvolve
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('edited',type=Path);args=p.parse_args()
edit=json.loads(Path(__file__).with_name('audio-edit.json').read_text());clock=edit['videoClock'];sr=48000
with tempfile.TemporaryDirectory() as d:
    def load(src):
        out=Path(d)/(src.stem+'.wav');subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(src),'-vn','-ac','1','-ar',str(sr),str(out)],check=True)
        return wavfile.read(out)[1].astype(np.float32)
    video,edited=load(args.video),load(args.edited)
sos=butter(4,[150,4000],'bandpass',fs=sr,output='sos');video=sosfiltfilt(sos,video);edited=sosfiltfilt(sos,edited)
rows=[]
for g in np.arange(1.0,131.0,2.5):
    v=(g-clock['offset'])/clock['rate'];i=int(v*sr);w=sr;seg=video[i:i+w];j=int((g-.02)*sr);ref=edited[j:j+w+int(.04*sr)]
    c=fftconvolve(ref,seg[::-1],'valid');k=int(np.argmax(c));norm=np.sqrt((seg@seg)*np.sum(ref[k:k+w]**2))
    rows.append({'game':round(float(g),2),'lagMs':round(((j+k)/sr-g)*1000,2),'correlation':round(float(c[k]/norm),3)})
lags=np.array([r['lagMs'] for r in rows]);cors=np.array([r['correlation'] for r in rows])
print(json.dumps({'windows':len(rows),'maxAbsLagMs':float(abs(lags).max()),'medianCorrelation':float(np.median(cors)),'minCorrelation':float(cors.min()),'worst':sorted(rows,key=lambda r:r['correlation'])[:3]}))
