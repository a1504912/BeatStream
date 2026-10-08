"""Compile reviewed CHERNOBOG video observations into an editable, separate song.

Run from the repository: python3 tools/chernobog/build_chart.py --analysis PATH
The supplied recording itself and analysis frames are deliberately not committed.
"""
import argparse, json
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--analysis', type=Path, required=True)
args = parser.parse_args()
client = Path(__file__).resolve().parents[2] / 'dist' / 'client'
bpm, step, phase, trim, duration = 200, .075, .00866, 15, 112

def snap(t):
    return round((t - phase) / step) * step + phase

observations = json.loads((args.analysis / 'valid.json').read_text())
moving = []
for item in observations:
    # Slower trajectories are path arrows, judgement effects and combo text.
    if item['slope'] >= -305 or item['center'] <= .23:
        continue
    moving.append({**item, 'type': 'flick' if item['center'] < .52 else 'tap'})
merged = []
for lane in range(8):
    items = sorted((n for n in moving if n['lane'] == lane), key=lambda n: n['t'])
    out = []
    for n in items:
        gap = .14 if out and n['type'] == out[-1]['type'] == 'flick' else .065
        if out and n['t'] - out[-1]['t'] < gap:
            old = out[-1]
            old['t'] = (old['t'] * old['frames'] + n['t'] * n['frames']) / (old['frames'] + n['frames'])
            old['frames'] += n['frames']
        else:
            out.append(n.copy())
    merged.extend({'t': snap(n['t']), 'end': snap(n['t']), 'lane': lane, 'type': n['type'], 'origin': 'trajectory'} for n in out)

# Hold head silhouettes can merge into their rectangular tails. These boundaries
# were checked in consecutive frames, including the long two-finger ending.
holds = [(27.00866, 29.10866, 1), (27.00866, 29.10866, 2),
         (77.70866, 78.30866, 6), (78.30866, 78.90866, 2),
         (78.90866, 79.50866, 6), (79.50866, 80.10866, 2),
         (80.10866, 80.70866, 5), (80.70866, 81.30866, 1),
         (89.40866, 90.90866, 6),
         (120.60866, 125.33366, 6), (120.60866, 125.33366, 7)]
for start, end, lane in holds:
    merged = [n for n in merged if not (n['lane'] == lane and start - .1 <= n['t'] <= end + .025)]
    merged.append({'t': start, 'end': end, 'lane': lane, 'type': 'hold', 'origin': 'reviewed-hold'})
for n in json.loads((args.analysis / 'ripple-events.json').read_text()):
    t = snap(n['t'])
    merged.append({'t': t, 'end': t, 'lane': n['lane'], 'type': 'ripple', 'origin': 'ripple-template'})

# Reviewed loop/hook phrases become a sparse perimeter sweep. The web game has
# direction-free FLICK instead of the cabinet's continuous STREAM tracing.
# These are adaptations, not claims to reproduce the cabinet's tick combo.
routes = [
    (15.90866, .15, [7, 6, 5, 6, 7, 0]),
    (15.90866, .15, [3, 4, 3, 2, 1, 2]),
    (27.30866, .225, [7, 6, 5, 4, 3, 2]),
    (119.25866, .15, [2, 1, 0, 7, 6, 5]),
    (119.25866, .15, [6, 5, 4, 3, 2, 1]),
    (121.50866, .225, [2, 3, 4, 5, 4, 3]),
]
for start, spacing, lanes in routes:
    for i, lane in enumerate(lanes):
        t = snap(start + i * spacing)
        if any(n['type'] == 'hold' and n['lane'] == lane and n['t'] - .08 <= t <= n['end'] + .08 for n in merged):
            continue
        if any(n['type'] != 'ripple' and n['lane'] == lane and abs(n['t'] - t) < .14 for n in merged):
            continue
        merged.append({'t': t, 'end': t, 'lane': lane, 'type': 'flick', 'origin': 'adapted-route'})

notes, evidence, occupied = [], [], {}
for n in sorted(merged, key=lambda n: (n['t'], n['type'] != 'ripple', n['lane'])):
    t, end = round(n['t'] - trim, 4), round(n['end'] - trim, 4)
    # Fixed Ripple positions share keyboard bindings with the perimeter; retain
    # the Ripple if projection produces a same-key chord the keyboard cannot play.
    key = n['lane']
    if not (0 < t <= end < duration) or t - occupied.get(key, -10) < .05:
        continue
    note = {'t': t, 'end': end, 'lane': n['lane'], 'type': n['type'],
            'skin': 'touch' if n['type'] == 'ripple' else 'beat',
            'drum': 'hat' if n['type'] == 'flick' else 'tom' if n['type'] == 'hold' else 'snare'}
    notes.append(note)
    evidence.append({'t': t, 'lane': n['lane'], 'type': n['type'], 'origin': n['origin']})
    occupied[key] = end

# NORMAL keeps the source's phrases and hold boundaries, with fewer sixteenth
# notes and no more than two keys held/pressed at once.
normal, last, active, groups = [], {}, [], {}
for n in notes:
    slot = round((n['t'] + trim - phase) / step)
    if n['type'] == 'tap' and slot % 2:
        continue
    active = [h for h in active if h['end'] > n['t'] + .05]
    if len(active) + groups.get(n['t'], 0) >= 2 or n['t'] - last.get(n['lane'], -10) < .18:
        continue
    normal.append(n.copy())
    last[n['lane']] = n['end']
    groups[n['t']] = groups.get(n['t'], 0) + 1
    if n['type'] == 'hold':
        active.append(n)

chart = {'revision': 1, 'bpm': bpm, 'trimStart': trim, 'trimEnd': trim + duration,
         'source': 'User-supplied CHERNOBOG(BEAST) PERFECT_720p60 cabinet recording',
         'sourceFPS': 60, 'gridPhaseInVideo': phase,
         'method': 'Radial color trajectory tracking and rotating multiscale Ripple-center templates; quantized to the observed 200 BPM grid. Hold boundaries reviewed against video frames. Selected STREAM loops adapted to direction-free FLICK sweeps. Duplicate shared-key inputs reduced after eight-lane projection. Approximate video reference, not an official or complete cabinet chart.',
         'evidence': evidence, 'normal': normal, 'hard': notes}
(client / 'chernobog-chart.json').write_text(json.dumps(chart, separators=(',', ':')) + '\n')
song = {'id': 'chernobog-video', 'title': 'CHERNOBOG · VIDEO',
        'artist': '影片參考譜', 'bpm': bpm, 'duration': duration,
        'offset': round((phase - trim) % .3, 4), 'file': 'audio/chernobog-video.mp3',
        'cover': 'covers/official-chernobog.jpg', 'color': '#ff2cc4',
        'tag': 'VIDEO / BEAST', 'version': 'VIDEO REFERENCE',
        'uploaded': True, 'videoReference': True, 'originalSongId': 'official-chernobog',
        'previewAt': 42, 'description': '', 'charts': {'normal': normal, 'hard': notes}}
(client / 'chernobog-song.js').write_text("'use strict';\nSONGS.unshift(" + json.dumps(song, ensure_ascii=False, separators=(',', ':')) + ");\n")
print(json.dumps({'BEAST': len(notes), 'types': dict(Counter(n['type'] for n in notes)),
                  'NORMAL': len(normal), 'chords': sum(c > 1 for c in Counter(n['t'] for n in notes).values()),
                  'lastEnd': max(n['end'] for n in notes),
                  'origins': dict(Counter(n['origin'] for n in evidence))}))
