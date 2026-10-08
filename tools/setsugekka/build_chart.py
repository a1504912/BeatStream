"""Compile the reviewed second reconstruction against the supplied clean MP3.

The committed review is sufficient to rebuild the playable chart. Video
detectors produce candidates; this compiler never invents notes to fill gaps.
"""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

root = Path(__file__).resolve().parent
client = root.parents[1] / 'dist/client'
parser = argparse.ArgumentParser()
parser.add_argument('--review', type=Path, default=root / 'rebuild-reviewed.json')
args = parser.parse_args()
review = json.loads(args.review.read_text())
original_alignment = json.loads((root / 'audio-alignment.json').read_text())
recheck = json.loads((root / 'audio-recheck.json').read_text())
assert review['revision'] == 2
assert review['sourceVideoSHA256'] == recheck['videoSHA256']
assert hashlib.sha256((client / 'audio/setsugekka-clean.mp3').read_bytes()).hexdigest() == recheck['audioSHA256']

rate, offset = recheck['sourceRate'], recheck['sourceOffset']
duration = original_alignment['sourceAudioDuration']
phase = review['gridPhaseInVideo']
alignment = {
    **original_alignment,
    'sourceRate': rate,
    'sourceOffset': offset,
    'anchors': recheck['anchors'],
    'sourceSHA256': recheck['audioSHA256'],
    'videoTimeAtAudioStart': -offset / rate,
    'videoTimeAtAudioEnd': (duration - offset) / rate,
    'maximumResidualSeconds': recheck['maximumResidualSeconds'],
    'method': recheck['method'],
}

def clean_time(t):
    return round(t * rate + offset, 5)

def physical_target(note):
    # Six Ripple circles and the eight inner bars are different touch targets.
    return ('ripple' if note['type'] == 'ripple' else 'beat', note['lane'])

notes, evidence, occupied = [], [], {}
for observed in sorted(review['notesInVideo'], key=lambda n: (n['t'], n['lane'])):
    t, end = clean_time(observed['t']), clean_time(observed['end'])
    assert 0 < t <= end < duration, observed
    key = physical_target(observed)
    assert t - occupied.get(key, -100) >= .049, observed
    notes.append({
        't': t, 'end': end, 'lane': observed['lane'], 'type': observed['type'],
        'skin': 'touch' if observed['type'] == 'ripple' else 'beat',
        'drum': 'hat' if observed['type'] == 'flick' else 'tom' if observed['type'] == 'hold' else 'snare',
    })
    evidence.append({**observed, 't': t, 'end': end, 'arrivalInVideo': observed['t'], 'endInVideo': observed['end']})
    occupied[key] = end

# NORMAL keeps the same recorded rhythm, with at most two fingers occupied.
groups = defaultdict(list)
for note in notes:
    groups[note['t']].append(note)
normal, active, last_target, last_group = [], [], {}, -100
priority = {'hold': 0, 'ripple': 1, 'tap': 2, 'flick': 3}
for t, group in sorted(groups.items()):
    if t - last_group < .22:
        continue
    active = [n for n in active if n['end'] > t + .05]
    budget, before = 2 - len(active), len(normal)
    for note in sorted(group, key=lambda n: (priority[n['type']], n['lane'])):
        key = physical_target(note)
        if budget <= 0 or t - last_target.get(key, -100) < .22:
            continue
        normal.append(note.copy())
        last_target[key] = note['end']
        budget -= 1
        if note['type'] == 'hold':
            active.append(note)
    if len(normal) > before:
        last_group = t

chart = {
    'revision': 2, 'bpm': 160, 'source': review['source'],
    'sourceFPS': review['sourceFPS'], 'sourceVideoSHA256': review['sourceVideoSHA256'],
    'trimStart': alignment['videoTimeAtAudioStart'], 'trimEnd': alignment['videoTimeAtAudioEnd'],
    'gridPhaseInVideo': phase, 'uncertaintySeconds': .067,
    'method': review['method'], 'reviewedHoldsInVideo': review['holds'],
    'audioAlignment': alignment, 'comboCheckpoints': review['comboCheckpoints'],
    'intervalAudit': review['intervalAudit'], 'evidence': evidence,
    'normal': normal, 'hard': notes,
}
song = {
    # A new edition keeps existing cloud edits intact without letting an old
    # saved chart silently replace this requested reconstruction on reload.
    'id': 'setsugekka-video-r2', 'sourceRevision': 2,
    'title': '回レ！雪月花', 'artist': '歌組雪月花', 'bpm': 160,
    'duration': duration, 'offset': round((phase * rate + offset) % (60 / 160), 5),
    'file': 'audio/setsugekka-clean.mp3', 'cover': 'covers/setsugekka-video.jpg',
    'color': '#ffb32d', 'tag': 'VIDEO / BEAST', 'version': 'VIDEO REFERENCE',
    'uploaded': True, 'videoReference': True, 'previewAt': 46, 'description': '',
    'charts': {'normal': normal, 'hard': notes},
}
(client / 'setsugekka-chart.json').write_text(json.dumps(chart, ensure_ascii=False, separators=(',', ':')) + '\n')
(client / 'setsugekka-song.js').write_text("'use strict';\nSONGS.unshift(" + json.dumps(song, ensure_ascii=False, separators=(',', ':')) + ");\n")
print(json.dumps({
    'BEAST': len(notes), 'NORMAL': len(normal),
    'types': dict(Counter(n['type'] for n in notes)),
    'chords': sum(count > 1 for count in Counter(n['t'] for n in notes).values()),
    'lastEnd': max(n['end'] for n in notes),
}))
