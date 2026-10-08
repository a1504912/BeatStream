"""Restore one complete STREAM per reviewed phrase; audio stays untouched.

Old adapted-route checkpoints remain as provenance in evidence/sourcePoints.
Screen geometry follows the user's two rising arrow-ribbon reference images;
these reference paths are not claimed to be exact coordinates in each video.
"""
import json
import subprocess
from collections import defaultdict
from pathlib import Path

CLIENT = Path(__file__).resolve().parents[1] / 'dist/client'
CHERNOBOG_ROUTES = [
    (15.90866, .15, [7, 6, 5, 6, 7, 0]),
    (15.90866, .15, [3, 4, 3, 2, 1, 2]),
    (27.30866, .225, [7, 6, 5, 4, 3, 2]),
    (119.25866, .15, [2, 1, 0, 7, 6, 5]),
    (119.25866, .15, [6, 5, 4, 3, 2, 1]),
    (121.50866, .225, [2, 3, 4, 5, 4, 3]),
]


def preset(side):
    points = [(.17, .79), (.145, .64), (.14, .49), (.155, .34), (.18, .20)]
    return [dict(x=round(1-x, 4) if side == 'right' else x, y=y) for x, y in points]


def restore(name):
    chart_file = CLIENT / (name + '-chart.json')
    data = json.loads(chart_file.read_text())
    raw = data.get('adaptedRoutesInVideo') or [
        dict(start=start, spacing=spacing, lanes=lanes)
        for start, spacing, lanes in CHERNOBOG_ROUTES
    ]
    # Idempotent: archived checkpoint arrays are only needed to reproduce the
    # source-clock phrase boundaries, never to create extra scored notes.
    sources = data.get('streamSourcePoints', {})
    originals = {level: sources.get(level, data[level]) for level in ['hard', 'normal']}
    eligible = {(round(n['t'], 5), n['lane']) for n in data['evidence']
                if n.get('origin') == 'adapted-route'}
    assignment = {}
    for i, route in enumerate(raw):
        matched = []
        for step, lane in enumerate(route['lanes']):
            expected = route['start'] + step * route['spacing'] - data['trimStart']
            candidates = [n for n in originals['hard'] if n['lane'] == lane
                          and (round(n['t'], 5), lane) in eligible
                          and (round(n['t'], 5), lane) not in assignment
                          and abs(n['t'] - expected) < .045]
            if candidates:
                matched.append(min(candidates, key=lambda n: abs(n['t'] - expected)))
        if len(matched) >= 2:
            for n in matched:
                assignment[(round(n['t'], 5), n['lane'])] = 'video-route-' + str(i + 1)
    data['streamSourcePoints'] = originals
    for level, source in originals.items():
        groups = defaultdict(list)
        for n in source:
            route = assignment.get((round(n['t'], 5), n['lane']))
            if route:
                groups[route].append(n)
        removed = set()
        new = []
        for route, group in groups.items():
            group.sort(key=lambda n: n['t'])
            if len(group) < 2:
                continue
            side = 'left' if group[0]['lane'] >= 4 else 'right'
            new.append(dict(t=group[0]['t'], end=group[-1]['t'], lane=5 if side == 'left' else 3,
                            type='stream', skin='beat', drum='snare', path=preset(side)))
            removed.update((round(n['t'], 5), n['lane']) for n in group)
        for n in source:
            if (round(n['t'], 5), n['lane']) not in removed:
                value = dict(n)
                # A single retained checkpoint in NORMAL is a Slash, not a
                # second incomplete STREAM object.
                if value['type'] == 'stream':
                    value['type'] = 'flick'
                    value.pop('streamId', None)
                new.append(value)
        data[level] = sorted(new, key=lambda n: (n['t'], n['lane']))
    data['streamRestoration'] = {
        'revision': 2,
        'method': 'One triangle-start, continuous arrow-ribbon path per reviewed phrase. '
                  'Finish is one scored note. Start/end use retained video-clock points; '
                  'left/right rising screen geometry follows user reference screenshots, '
                  'not independently recovered exact original coordinates.',
        'paths': {level: sum(n['type'] == 'stream' for n in data[level]) for level in ['normal', 'hard']},
    }
    chart_file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    song_file = CLIENT / (name + '-song.js')
    source = song_file.read_text()
    prefix = "'use strict';\nSONGS.unshift("
    assert source.startswith(prefix) and source.endswith(');\n')
    song = json.loads(source[len(prefix):-3])
    for level in ['normal', 'hard']:
        song['charts'][level] = data[level]
    if 'light' not in song['charts']:
        result = subprocess.run(['node', '-e', "const fs=require('node:fs'),d=require(process.argv[1]);const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(d.simplify(input.notes,input.bpm)));", str(CLIENT / 'chart-difficulties.js')], input=json.dumps(dict(notes=originals['normal'], bpm=song['bpm'])), text=True, capture_output=True, check=True)
        song['charts']['light'] = json.loads(result.stdout)
    song_file.write_text(prefix + json.dumps(song, ensure_ascii=False, separators=(',', ':')) + ');\n')
    print(name, {level: len(data[level]) for level in ['normal', 'hard']}, data['streamRestoration']['paths'])


if __name__ == '__main__':
    for name in ['chernobog', 'papipu', 'amanojaku']:
        restore(name)
