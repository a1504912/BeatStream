"""Independently recheck the supplied clean MP3 against nine video windows."""
import argparse,hashlib,json,subprocess
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt,correlate
p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('audio',type=Path);p.add_argument('--out',type=Path,required=True);args=p.parse_args()
rate=22050
def decode(path):
 r=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-vn','-ac','1','-ar',str(rate),'-f','f32le','-'],capture_output=True,check=True)
 return sosfilt(butter(4,[350,1800],btype='bandpass',fs=rate,output='sos'),np.frombuffer(r.stdout,dtype=np.float32)).astype(np.float32)
video,clean=decode(args.video),decode(args.audio);anchors=[]
for t in [12,20,32,44,56,68,80,88,92]:
 a,b=round(t*rate),round((t+1.3)*rate);sample=video[a:b];expected=t-9.665
 lo,hi=round((expected-.25)*rate),round((expected+1.55)*rate);window=clean[lo:hi]
 corr=correlate(window,sample,mode='valid',method='fft');energy=np.cumsum(np.r_[0.,window.astype(float)**2]);energy=energy[len(sample):]-energy[:-len(sample)]
 score=corr/np.sqrt(np.maximum(1e-10,energy*np.sum(sample.astype(float)**2)));i=int(np.argmax(score));anchors.append({'video':t,'clean':(lo+i)/rate,'correlation':float(score[i])})
fit=np.polyfit([a['video'] for a in anchors],[a['clean'] for a in anchors],1);residual=max(abs(a['clean']-(fit[0]*a['video']+fit[1])) for a in anchors)
result={'sourceRate':float(fit[0]),'sourceOffset':float(fit[1]),'anchors':anchors,'maximumResidualSeconds':residual,'audioSHA256':hashlib.sha256(args.audio.read_bytes()).hexdigest(),'videoSHA256':hashlib.sha256(args.video.read_bytes()).hexdigest(),'method':'Fresh decoding of both supplied files; normalized 350–1800 Hz waveform correlation in nine separated 1.3-second windows. This is an alignment check; playback uses the supplied clean MP3.'}
args.out.write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
assert min(a['correlation'] for a in anchors)>.4 and residual<.004
