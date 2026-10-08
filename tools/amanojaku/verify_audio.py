"""Verify the encoded edit comes from the clean MP3 and matches video anchors."""
import argparse,json,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt,correlate
p=argparse.ArgumentParser();p.add_argument('clean',type=Path);p.add_argument('video',type=Path);p.add_argument('edited',type=Path);args=p.parse_args()
edit=json.loads(Path(__file__).with_name('audio-edit.json').read_text());sr=11025
with tempfile.TemporaryDirectory() as temporary:
    audio=[]
    for i,source in enumerate([args.clean,args.video,args.edited]):
        path=Path(temporary)/f'{i}.wav'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-vn','-ac','1','-ar',str(sr),'-c:a','pcm_f32le',str(path)],check=True)
        rate,samples=wavfile.read(path);assert rate==sr;audio.append(samples)
    clean,video,edited=audio
    assert abs(len(edited)/sr-edit['outputDuration'])<.01
    assert np.all(np.isfinite(edited))
    # Check channels separately at the original output sample rate. Mid-channel
    # cancellation in the guitar outro makes a mono-only comparison misleading.
    stereo=[]
    for i,source in enumerate([args.clean,args.edited]):
        path=Path(temporary)/f'stereo-{i}.wav'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-ac','2','-ar','48000','-c:a','pcm_f32le',str(path)],check=True)
        _,samples=wavfile.read(path);stereo.append(samples)
    clean_stereo,edited_stereo=stereo;quality=[]
    for t in [16,25,32,43,58,76,85,89,99,105,110,114,115.5,116]:
        segment=next(s for s in edit['segments'] if s['videoStart']<=t<s['videoEnd'])
        count=round(.75*48000);clock=t+np.arange(count)/48000
        expected=np.column_stack([np.interp((clock*segment['sourceRate']+segment['sourceOffset'])*48000,np.arange(len(clean_stereo)),clean_stereo[:,channel]) for channel in range(2)])
        actual=edited_stereo[round((t-edit['outputTrimStartInVideo'])*48000):round((t-edit['outputTrimStartInVideo'])*48000)+count]
        scores=[float(np.corrcoef(expected[:,channel],actual[:,channel])[0,1]) for channel in range(2)]
        assert min(scores)>.985,(t,scores)
        amplitude=float(np.linalg.norm(actual)/np.linalg.norm(expected));assert abs(amplitude-edit.get('gain',1))<.055,(t,amplitude)
        quality.append([t,*[round(z,4) for z in scores]])
    sos=butter(3,[500,3500],fs=sr,btype='bandpass',output='sos');v=sosfilt(sos,video);e=sosfilt(sos,edited)
    sync=[]
    for t in [12,20,30,45,60,80,90,100,110]:
        count=sr;q=v[round(t*sr):round(t*sr)+count];center=round((t-edit['outputTrimStartInVideo'])*sr);padding=round(.08*sr)
        patch=e[center-padding:center+count+padding];corr=correlate(patch,q,mode='valid',method='fft');energy=np.sqrt(np.convolve(patch*patch,np.ones(count),'valid'))
        corr/=np.maximum(energy,1e-12)*np.linalg.norm(q);peak=int(np.argmax(corr));lag=(peak-padding)/sr;score=float(corr[peak])
        assert abs(lag)<.02,(t,lag);assert score>.2,(t,score);sync.append([t,round(lag,5),round(score,4)])
print(json.dumps({'cleanSourceCorrelation':quality,'videoSyncAnchors':sync,'duration':len(edited)/sr}))
