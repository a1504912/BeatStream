"""Compile reviewed パ→ピ→プ→Yeah! observations without replacing existing cloud data."""
import argparse,json
from collections import Counter,defaultdict
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,required=True);args=p.parse_args()
client=Path(__file__).resolve().parents[2]/'dist'/'client'
bpm,step,phase,trim,duration=160,.09375,.07125,15,106
def snap(t):return round((t-phase)/step)*step+phase

moving=[]
for n in json.loads((args.analysis/'classified.json').read_text()):
    # Paw feedback and route fragments also move across radial strips. Keep the
    # reviewed circular/square silhouette matches, not generic colored peaks.
    score=n['scores'][n['type']]
    if score < (.58 if n['type']=='flick' else .54):continue
    if n['last'][1]>190 and score<.7:continue
    if n['t']>119.6:continue
    moving.append({**n,'t':n['t']+(.035 if n['type']=='flick' else 0)})

merged=[]
for lane in range(8):
    out=[]
    for n in sorted((x for x in moving if x['lane']==lane),key=lambda x:x['t']):
        # A rotating square produces front/back edge peaks for one head.
        gap=.145 if out and n['type']==out[-1]['type']=='flick' else .075
        if out and n['t']-out[-1]['t']<gap:
            old=out[-1]
            if n['scores'][n['type']]>old['scores'][old['type']]:out[-1]=n.copy()
        else:out.append(n.copy())
    for n in out:
        merged.append({'t':snap(n['t']),'end':snap(n['t']),'lane':lane,'type':n['type'],
                       'origin':'trajectory','track':n['track'],'confidence':round(n['scores'][n['type']],3)})

# Start/end silhouettes were reviewed in consecutive recording frames. Long
# colored strips are tails, not extra taps. Keep the four-key diagonal and cross
# holds; keyboard users can hold four independent keys, just as touch can.
holds=[(40.79,41.10,[1,7]),(41.25,42.0,[3,5]),(42.76,43.14,[1]),
       (62.25,63.0,[3,5]),(65.24,65.62,[6,7]),(65.99,66.37,[1,2]),
       (66.77,67.90,[2,6]),(68.26,69.01,[1,2]),(70.32,70.88,[3,5]),
       (73.50,73.88,[1,7]),(73.88,74.16,[2,6]),(74.25,75.38,[1,3,5,7]),
       (75.78,76.34,[6,7]),(76.53,76.90,[1,2]),
       (85.44,85.82,[2]),(88.50,88.88,[1]),(88.79,89.17,[2]),
       (97.23,97.61,[6]),(97.51,97.89,[2]),
       (100.50,100.88,[1]),(100.78,101.16,[2]),(105.73,106.86,[0,2,4,6])]
for start,end,lanes in holds:
    start,end=snap(start),snap(end)
    for lane in lanes:
        merged=[n for n in merged if not(n['lane']==lane and start-.14<=n['t']<=end+.07)]
        merged.append({'t':start,'end':end,'lane':lane,'type':'hold','origin':'reviewed-hold'})

for n in json.loads((args.analysis/'ripple-events.json').read_text()):
    t=snap(n['t'])
    if t>119.6:continue
    merged.append({'t':t,'end':t,'lane':n['lane'],'type':'ripple','origin':'ripple-template',
                   'visibleStartInVideo':round(n['start'],4),'observedEndInVideo':round(n['t'],4)})

# Direction-requiring STREAM remains disabled, as requested. The visible right
# hook, left hook and mirrored X phrases become brief direction-free FLICK
# sweeps. Repeated phrases retain the same route and rhythmic spacing.
routes=[]
for start in [24.13,45.13,114.13]:
    routes.extend([(start,.1875,[1,2,3]),(start+1.125,.1875,[7,6,5])])
for start in [27.13,48.13,117.13]:
    routes.extend([(start,.1875,[1,2,3]),(start+1.125,.1875,[7,6,5]),
                   (start+1.125,.1875,[1,2,3])])
routes.extend([(63.88,.1875,[5,6,7]),(63.88,.1875,[1,2,3])])
for start in [101.13,103.38]:
    routes.extend([(start,.1875,[1,2,3,2,1,0]),(start,.1875,[7,6,5,6,7,0])])
for start,spacing,lanes in routes:
    for i,lane in enumerate(lanes):
        t=snap(start+i*spacing)
        if any(n['type']=='hold' and n['lane']==lane and n['t']-.1<=t<=n['end']+.1 for n in merged):continue
        if any(n['type']!='ripple' and n['lane']==lane and abs(n['t']-t)<.14 for n in merged):continue
        merged.append({'t':t,'end':t,'lane':lane,'type':'flick','origin':'adapted-route'})

notes,evidence,occupied,dropped=[],[],{},Counter()
for n in sorted(merged,key=lambda x:(x['t'],{'hold':0,'ripple':1,'tap':2,'flick':3}[x['type']],x['lane'])):
    t,end=round(n['t']-trim,5),round(n['end']-trim,5)
    if not 0<t<=end<duration:continue
    key=n['lane']
    # Ripple and perimeter inputs share the configured keyboard key. Do not
    # create a note on a key that is already held, or a duplicate same-key chord.
    if t-occupied.get(key,-10)<.05:
        dropped['shared-key-conflict']+=1;continue
    notes.append({'t':t,'end':end,'lane':n['lane'],'type':n['type'],
                  'skin':'touch' if n['type']=='ripple' else 'beat',
                  'drum':'hat' if n['type']=='flick' else 'tom' if n['type']=='hold' else 'snare'})
    evidence.append({**n,'t':t,'end':end})
    occupied[key]=end

# NORMAL retains the recording's phrases, source timings and hold lengths while
# reducing sixteenths and limiting active inputs to two, including held keys.
groups=defaultdict(list)
for n in notes:groups[n['t']].append(n)
normal,last,active,last_group=[],{},[],-10
for t,group in sorted(groups.items()):
    if t-last_group<.18:continue
    active=[n for n in active if n['end']>t+.05]
    budget=2-len(active)
    before=len(normal)
    for n in sorted(group,key=lambda n:({'hold':0,'ripple':1,'tap':2,'flick':3}[n['type']],n['lane'])):
        slot=round((n['t']+trim-phase)/step)
        if n['type']=='tap' and slot%2:continue
        if budget<=0 or t-last.get(n['lane'],-10)<.18:continue
        normal.append(n.copy());last[n['lane']]=n['end'];budget-=1
        if n['type']=='hold':active.append(n)
    if len(normal)>before:last_group=t

chart={'revision':1,'bpm':bpm,'trimStart':trim,'trimEnd':trim+duration,
       'source':'User-supplied BeatStream パ→ピ→プ→Yeah! NIGHTMARE Lv10_480p.mp4',
       'sourceFPS':30,'gridPhaseInVideo':phase,
       'method':'Recording-derived radial color trajectories, rotating circular/square silhouette masks and multiscale Ripple-center templates. Observed 160 BPM sixteenth grid, checked against recording audio. Hold boundaries reviewed in consecutive frames. Selected STREAM hooks and mirrored X routes adapted to direction-free FLICK; shared-key conflicts removed. Approximate 480p/30 fps video reference, not an official or complete cabinet chart.',
       'reviewedHoldsInVideo':[{'start':snap(a),'end':snap(b),'lanes':ls} for a,b,ls in holds],
       'adaptedRoutesInVideo':[{'start':snap(a),'spacing':b,'lanes':ls} for a,b,ls in routes],
       'dropped':dict(dropped),'evidence':evidence,'normal':normal,'hard':notes}
(client/'papipu-chart.json').write_text(json.dumps(chart,separators=(',',':'))+'\n')
song={'id':'papipu-video','originalSongId':'official-papipu','title':'パ→ピ→プ→Yeah!',
      'artist':'ヒゲドライバー join. shully & Nimo','bpm':bpm,'duration':duration,
      'offset':round((phase-trim)%(60/bpm),5),'file':'audio/papipu-video.mp3',
      'cover':'covers/official-papipu.jpg','color':'#00e5cb','tag':'VIDEO / NIGHTMARE',
      'version':'VIDEO REFERENCE','uploaded':True,'videoReference':True,'previewAt':53,
      'description':'','charts':{'normal':normal,'hard':notes}}
(client/'papipu-song.js').write_text("'use strict';\nSONGS.unshift("+json.dumps(song,ensure_ascii=False,separators=(',',':'))+");\n")
print(json.dumps({'BEAST':len(notes),'NORMAL':len(normal),'types':dict(Counter(n['type'] for n in notes)),
                  'chords':sum(c>1 for c in Counter(n['t'] for n in notes).values()),
                  'lastEnd':max(n['end'] for n in notes),'origins':dict(Counter(n['origin'] for n in evidence)),
                  'dropped':dict(dropped)}))
