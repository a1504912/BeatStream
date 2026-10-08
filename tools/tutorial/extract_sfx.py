"""Reproduce short hit samples from the user-provided tutorial recording.

Usage: python3 tools/tutorial/extract_sfx.py INPUT.mp4 [OUTPUT_DIR]
Requires ffmpeg, numpy and scipy. The recording itself is not bundled.
These are microphone recording samples, not isolated official game assets.
"""
from pathlib import Path
import json
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile


EVENTS = {
    "beat": {"onset": 245.8013, "duration": .235, "background": 253.8045,
             "visual": "04:05.5", "event": "single pink Beat success"},
    "slash": {"onset": 157.7812, "duration": .285, "background": 165.7844,
              "visual": "02:37.5", "event": "upper-left green diamond swipe and lightning"},
    "ripple": {"onset": 181.7862, "duration": .285, "background": 165.7798,
               "visual": "03:01.5", "event": "upper-right shrinking ring tap"},
    "long": {"onset": 264.8388, "duration": .26, "background": 256.8356,
             "visual": "04:24.5", "event": "upper-left Long tail finishes while held"},
    "long-start": {"onset": 257.8363, "duration": .2, "background": 249.8331,
                   "visual": "04:17.5", "event": "left Long head contact"},
}


def finish(samples, sr):
    samples = samples - np.mean(samples)
    # Remove microphone rumble without removing the body of the hit.
    samples = signal.sosfilt(signal.butter(2, 65, "highpass", fs=sr, output="sos"), samples)
    attack, tail = round(sr * .001), round(sr * .014)
    samples[:attack] *= np.linspace(0, 1, attack)
    samples[-tail:] *= np.linspace(1, 0, tail)
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples *= .88 / peak
    return (samples * 32767).astype(np.int16)


def extract(source, output):
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="beatstream-tutorial-") as temp:
        if source.suffix.lower() == ".wav":
            wav = source
        else:
            wav = Path(temp) / "recording.wav"
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i",
                            str(source), "-vn", "-acodec", "pcm_s16le", "-ar",
                            "44100", "-y", str(wav)], check=True)
        sr, data = wavfile.read(wav)
        data = data.astype(np.float64) / 32768
        if data.ndim > 1:
            data = data.mean(axis=1)
        manifest = {"source": "【BeatStream】Tutorial チュートリアル Arcade 20170831_720p60.mp4",
                    "kind": "user-provided arcade microphone recording",
                    "note": "Visual and audio times differ in the recording. Samples align to audio transients, not visual frame times. Background music/room sound can remain.",
                    "processing": "65 Hz rumble filter, conservative spectral suppression using a matching music passage, 1 ms/14 ms fades, peak 0.88, mono PCM16 44.1 kHz",
                    "samples": {}}
        for name, event in EVENTS.items():
            length = round(event["duration"] * sr)
            start = round(event["onset"] * sr)
            raw = data[start:start + length].copy()
            control = data[round(event["background"] * sr):round(event["background"] * sr) + length]
            _, _, spectrum = signal.stft(raw, sr, nperseg=512, noverlap=384)
            _, _, bg = signal.stft(control, sr, nperseg=512, noverlap=384)
            # Match average level conservatively; preserve original phase and 20% floor.
            ratio = min(1.15, np.sqrt(np.mean(raw[:round(sr*.014)] ** 2) /
                                      max(1e-10, np.mean(control[:round(sr*.014)] ** 2))))
            noise = np.abs(bg) * ratio
            magnitude = np.abs(spectrum)
            mask = np.sqrt(np.maximum(.04, 1 - .8 * noise ** 2 / np.maximum(1e-12, magnitude ** 2)))
            _, reduced = signal.istft(spectrum * mask, sr, nperseg=512, noverlap=384)
            for suffix, samples in [("", reduced[:length]), ("-raw", raw)]:
                wavfile.write(output / f"tutorial-{name}{suffix}.wav", sr, finish(samples.copy(), sr))
            manifest["samples"][name] = {**event, "file": f"tutorial-{name}.wav",
                                         "rawFile": f"tutorial-{name}-raw.wav"}
            print(f"{name}: {event['onset']:.4f}s, {event['duration']:.3f}s")
        (output / "tutorial-source.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    extract(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else Path("dist/client/sfx"))
