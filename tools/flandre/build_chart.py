"""Compile the reviewed 最終鬼畜妹フランドール・S reconstruction into the game.

reviewed.json already holds game-clock times on the 200 BPM sixteenth grid of
the arcade edit built by build_audio.py, so this compiler needs neither the
recording nor the original MP3. It never invents notes to reach the cabinet's
724 judgments.
"""
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parent
client = root.parents[1] / 'dist/client'
review = json.loads((root / 'reviewed.json').read_text())
edit = json.loads((root / 'audio-edit.json').read_text())
audio = client / 'audio/flandre-clean.mp3'
duration = edit['outputDuration']
assert review['revision'] == 1 and review['bpm'] == 200


def physical_target(note):
    # Six Ripple circles and the eight inner bars are separate touch targets.
    return ('ripple' if note['type'] == 'ripple' else 'beat', note['lane'])


DRUM = {'flick': 'hat', 'hold': 'tom', 'ripple': 'snare', 'tap': 'snare', 'stream': 'snare'}
notes, occupied = [], {}
for observed in sorted(review['notes'], key=lambda n: (n['t'], n['type'] == 'ripple', n['lane'])):
    t, end = observed['t'], observed['end']
    assert 0 < t <= end < duration, observed
    key = physical_target(observed)
    assert t - occupied.get(key, -100) >= .049, observed
    occupied[key] = end
    note = {'t': t, 'end': end, 'lane': observed['lane'], 'type': observed['type'],
            'skin': 'touch' if observed['type'] == 'ripple' else 'beat', 'drum': DRUM[observed['type']]}
    if observed['type'] == 'stream':
        note['path'] = observed['path']
    notes.append(note)

# NORMAL keeps the recorded rhythm with at most two fingers occupied,
# a 0.22 s gap between chords and no repeat on a target within 0.22 s.
groups = defaultdict(list)
for note in notes:
    groups[note['t']].append(note)
normal, active, last_target, last_group = [], [], {}, -100
priority = {'stream': 0, 'hold': 1, 'ripple': 2, 'tap': 3, 'flick': 4}
for t, group in sorted(groups.items()):
    if t - last_group < .22:
        continue
    active = [n for n in active if n['end'] > t + .05]
    budget, before = 2 - len(active), len(normal)
    for note in sorted(group, key=lambda n: (priority[n['type']], n['lane'])):
        key = physical_target(note)
        if budget <= 0 or t - last_target.get(key, -100) < .22:
            continue
        normal.append(json.loads(json.dumps(note)))
        last_target[key] = note['end']
        budget -= 1
        if note['end'] > note['t']:
            active.append(note)
    if len(normal) > before:
        last_group = t

chart = {
    'revision': 1, 'bpm': 200, 'source': review['source'],
    'sourceVideoSHA256': review['sourceVideoSHA256'], 'sourceAudioSHA256': review['sourceAudioSHA256'],
    'playbackSHA256': hashlib.sha256(audio.read_bytes()).hexdigest(),
    'gridPhase': review['gridPhase'], 'cabinet': review['cabinet'],
    'judgmentRules': review['judgmentRules'], 'method': review['method'],
    'unresolved': review['unresolved'], 'audioEdit': edit,
    'evidence': review['notes'], 'normal': normal, 'hard': notes,
}
song = {
    'id': 'flandre-video', 'title': '最終鬼畜妹フランドール・S', 'artist': 'ビートまりお (COOL&CREATE)',
    'bpm': 200, 'duration': duration, 'offset': round(review['gridPhase'] % .3, 5),
    'file': 'audio/flandre-clean.mp3', 'cover': 'covers/flandre-video.jpg',
    'color': '#ff3d7f', 'tag': 'VIDEO / BEAST', 'version': 'VIDEO REFERENCE',
    'uploaded': True, 'videoReference': True, 'previewAt': 87, 'description': '',
    'charts': {'normal': normal, 'hard': notes},
}
(client / 'flandre-chart.json').write_text(json.dumps(chart, ensure_ascii=False, separators=(',', ':')) + '\n')
(client / 'flandre-song.js').write_text("'use strict';\nSONGS.unshift(" + json.dumps(song, ensure_ascii=False, separators=(',', ':')) + ");\n")
print(json.dumps({
    'BEAST': len(notes), 'NORMAL': len(normal),
    'types': dict(Counter(n['type'] for n in notes)),
    'chords': sum(count > 1 for count in Counter(n['t'] for n in notes).values()),
    'lastEnd': max(n['end'] for n in notes),
}, ensure_ascii=False))
