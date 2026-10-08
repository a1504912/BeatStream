"""Recreate the arcade-length edit using ONLY the supplied clean MP3, never video audio."""
import argparse,json,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile

p=argparse.ArgumentParser();p.add_argument('mp3',type=Path);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
edit=json.loads(Path(__file__).with_name('audio-edit.json').read_text())
sr=edit['sampleRate'];count=round(edit['outputDuration']*sr);clock=np.arange(count)/sr
with tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary);decoded=root/'clean.wav'
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(args.mp3),'-vn','-ac','2','-ar',str(sr),'-c:a','pcm_f32le',str(decoded)],check=True)
    actual_sr,clean=wavfile.read(decoded);assert actual_sr==sr
    def sample(segment,times):
        index=np.round((times-segment['gameStart']+segment['sourceStart'])*sr).astype(np.int64)
        valid=(index>=0)&(index<len(clean));out=np.zeros((len(times),2),dtype=np.float32)
        out[valid]=clean[index[valid]];return out
    segments=edit['segments'];result=np.zeros((count,2),dtype=np.float32)
    for segment in segments:
        ids=np.where((clock>=segment['gameStart'])&(clock<segment['gameEnd']))[0];result[ids]=sample(segment,clock[ids])
    half=edit['crossfadeSeconds']/2
    for left,right in zip(segments[:-1],segments[1:]):
        cut=right['gameStart'];ids=np.where(abs(clock-cut)<half)[0];weight=(clock[ids]-cut+half)/(2*half)
        result[ids]=sample(left,clock[ids])*(1-weight[:,None])+sample(right,clock[ids])*weight[:,None]
    if not np.all(np.isfinite(result)):raise ValueError('invalid edited audio')
    wavfile.write(root/'edited.wav',sr,result)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(root/'edited.wav'),'-c:a','libmp3lame','-b:a','192k','-metadata','title=最終鬼畜妹フランドール・S','-metadata','artist=ビートまりお (COOL&CREATE)',str(args.output)],check=True)
print(json.dumps({'output':str(args.output),'duration':count/sr,'source':'clean MP3 only','segments':len(segments)}))
