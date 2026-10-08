"""Build three short percussion kits for dense rhythm-game charts.

Original synthesis + short layers from the bundled Kenney CC0 sounds.
No voice, music, reverb or melodic chord is included. Run from repo root.
Requires numpy and scipy. Writes 48 kHz mono PCM16 WAV and provenance.
"""
from pathlib import Path
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = Path('dist/client/sfx')
ROLES = ['beat', 'ripple', 'slash', 'long', 'long-start']
STYLES = ['rhythm', 'pulse', 'heavy']
LAYERS = set()


def band(x, lo, hi):
    return signal.sosfilt(signal.butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def texture(file, size, seconds, weight):
    LAYERS.add(file)
    sr, x = wavfile.read(ROOT / file)
    x = x.astype(float) / 32768
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = signal.resample_poly(x, SR, sr)
    n = min(size, round(seconds * SR), len(x))
    result = np.zeros(size)
    result[:n] = x[:n] * np.exp(-np.arange(n) / SR * 90) * weight
    return result


def make(style, role):
    duration = {'beat': .09, 'ripple': .085, 'slash': .10, 'long': .12, 'long-start': .105}[role]
    if style == 'pulse':
        duration *= .75
    if style == 'heavy':
        duration *= 1.15
    t = np.arange(round(duration * SR)) / SR
    rng = np.random.default_rng(1500 + STYLES.index(style)*53 + ROLES.index(role)*107)
    noise = rng.standard_normal(len(t))
    noise /= np.max(np.abs(noise))
    snap = band(noise, 1500, 9500) * np.exp(-t*180)
    body = lambda hz, decay: np.sin(2*np.pi*hz*t) * np.exp(-t*decay)
    if role == 'beat':
        # Rimshot: wood attack, snare edge and rapidly damped, inharmonic modes.
        x = .72*texture('wood-snare.wav',len(t),.023,1)+.40*snap
        x += .34*body(260,65)+.22*body(455,100)+.15*body(790,135)
        x += .17*band(noise,1800,7000)*np.exp(-t*68)
    elif role == 'ripple':
        # Dry woodblock response, deliberately different from the regular rim.
        x = .8*texture('wood-hat.wav',len(t),.02,1)+.20*snap
        x += .28*body(640,95)+.19*body(1050,140)+.12*body(1710,170)
    elif role == 'slash':
        # Closed hat and a short noise sweep; no explosive bass or long whoosh.
        airy = band(noise,4200,13000)
        x = .55*airy*np.exp(-t*55)+.25*snap
        x += .11*(np.sin(2*np.pi*6310*t)+np.sin(2*np.pi*8960*t))*np.exp(-t*180)
        x += .15*texture('metal-hat.wav',len(t),.014,1)
    elif role == 'long-start':
        # Short damped tom body: pressing the head does not create a drone.
        phase = 2*np.pi*(120*t + 65*(1-np.exp(-t*65))/65)
        x = .45*np.sin(phase)*np.exp(-t*46)+.18*snap
        x += .30*texture('wood-kick.wav',len(t),.028,1)+.10*body(360,90)
    else:
        # Release accent: rim tail with a quiet second tick 17 ms later.
        x = .4*snap+.24*body(350,65)+.18*body(735,100)
        x += .42*texture('wood-tom.wav',len(t),.024,1)
        delay=round(.017*SR)
        x[delay:] += .15*snap[:-delay]
    if style == 'pulse':
        # Dry electronic transient, not the former pitched arcade beep.
        x = .55*x+.40*snap+.16*band(noise,2500,9000)*np.exp(-t*210)
    elif style == 'heavy':
        # More snare/tom body without a long sub-bass tail.
        hz = 170 if role in ['beat','long-start','long'] else 430
        x = .75*x+.30*body(hz,45)+.21*band(noise,800,4200)*np.exp(-t*60)
    x = signal.sosfilt(signal.butter(2,80,'highpass',fs=SR,output='sos'),x)
    # Body-preserving compression and explicit fades; consistent headroom.
    x /= max(1e-9,float(np.max(np.abs(x))))
    x = np.tanh(x*1.7)
    x[:48] *= np.linspace(0,1,48)
    x[-round(.009*SR):] *= np.linspace(1,0,round(.009*SR))
    x *= .78 / np.max(np.abs(x))
    pcm = np.round(x*32767).astype(np.int16)
    file = f'{style}-{role}.wav'
    wavfile.write(ROOT/file,SR,pcm)
    cumulative=np.cumsum(x*x);end95=int(np.searchsorted(cumulative,cumulative[-1]*.95))/SR
    return {'file':file,'seconds':len(pcm)/SR,'energy95ms':round(end95*1000,1),
            'peak':round(float(np.max(np.abs(x))),4),'rms':round(float(np.sqrt(np.mean(x*x))),4)}


manifest={'description':'Original short, dry percussion kits with bundled Kenney CC0 attack layers.',
          'sampleRate':SR,'kits':{}}
for style in STYLES:
    manifest['kits'][style]={role:make(style,role) for role in ROLES}
manifest['sources']={'synthesis':'Original deterministic noise, modal percussion and envelopes.',
                     'layers':sorted(LAYERS),'license':'Kenney layers: CC0 1.0',
                     'sourceUrls':['https://kenney.nl/assets/impact-sounds','https://kenney.nl/assets/interface-sounds']}
(ROOT/'rhythm-source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Built 15 percussion samples:', ', '.join(STYLES))
