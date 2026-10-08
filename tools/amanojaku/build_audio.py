"""Recreate the short edit using ONLY the supplied clean MP3, never video audio."""
import argparse,json,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile

p=argparse.ArgumentParser();p.add_argument('mp3',type=Path);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
edit=json.loads(Path(__file__).with_name('audio-edit.json').read_text())
sr=edit['sampleRate'];count=round(edit['outputDuration']*sr)
clock=np.arange(count,dtype=np.float64)/sr+edit['outputTrimStartInVideo']
with tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary);decoded=root/'clean.wav'
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.mp3),'-vn','-ac','2','-ar',str(sr),'-c:a','pcm_f32le',str(decoded)],check=True)
    actual_sr,clean=wavfile.read(decoded);assert actual_sr==sr
    def sample(segment,times):
        source=(times*segment['sourceRate']+segment['sourceOffset'])*sr
        # Fractional interpolation retains the measured sub-frame offsets and
        # tiny source-clock drift without changing the output/chart duration.
        index=np.floor(source).astype(np.int64);fraction=source-index
        index=np.clip(index,0,len(clean)-2)
        return clean[index]*(1-fraction[:,None])+clean[index+1]*fraction[:,None]
    result=np.zeros((count,2),dtype=np.float32)
    segments=edit['segments']
    for segment in segments:
        ids=np.where((clock>=segment['videoStart'])&(clock<segment['videoEnd']))[0]
        result[ids]=sample(segment,clock[ids])
    half=edit['crossfadeSeconds']/2
    for left,right in zip(segments[:-1],segments[1:]):
        cut=right['videoStart'];ids=np.where(abs(clock-cut)<half)[0]
        weight=(clock[ids]-cut+half)/(2*half)
        result[ids]=sample(left,clock[ids])*(1-weight[:,None])+sample(right,clock[ids])*weight[:,None]
    fade=np.clip((segments[-1]['videoEnd']-clock)/(segments[-1]['videoEnd']-edit['fadeOutInVideo']),0,1)
    result*=fade[:,None]*edit.get('gain',1.0)
    if not np.all(np.isfinite(result)):raise ValueError('invalid edited audio')
    wavfile.write(root/'edited.wav',sr,result)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(root/'edited.wav'),'-c:a','libmp3lame','-b:a','192k','-metadata','title=天ノ弱','-metadata','artist=164 feat. GUMI',str(args.output)],check=True)
print(json.dumps({'output':str(args.output),'duration':count/sr,'source':'clean MP3 only','segments':len(segments)}))
