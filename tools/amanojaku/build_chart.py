"""Compile the reviewed 天ノ弱 recording into an independent reference song."""
import argparse,json
from collections import Counter,defaultdict
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,required=True);args=p.parse_args()
client=Path(__file__).resolve().parents[2]/'dist/client'
review=json.loads(Path(__file__).with_name('reviewed.json').read_text())
trim,duration,bpm=10.0,109.0,200
phase,step=.0075,.075
def timing(t):
    # The recording changes tempo after the opening section. Preserve measured
    # arrivals there instead of forcing the whole song onto one 200 BPM grid.
    nearest=round((t-phase)/step)*step+phase
    return nearest if t<65.6 and abs(nearest-t)<.032 else t

moving=[]
for n in json.loads((args.analysis/'refined.json').read_text()):
    score=n['scores'][n['type']]
    if score<(.55 if n['type']=='flick' else .58):continue
    if n.get('centroidError',0)>2.3:continue
    if 'centroidSamples' not in n and score<.74:continue
    if n['last'][1]>190 and score<.8:continue
    if not 12<n['t']<117.99:continue
    moving.append(n)

merged=[]
for lane in range(8):
    groups=[]
    for n in sorted((x for x in moving if x['lane']==lane),key=lambda x:x['t']):
        if groups and n['t']-groups[-1][0]['t']<.065:groups[-1].append(n)
        else:groups.append([n])
    for group in groups:
        n=max(group,key=lambda n:n['scores'][n['type']])
        t=timing(n['t'])
        merged.append({'t':t,'end':t,'lane':lane,'type':n['type'],'origin':'observed-head',
                       'tracks':[x['track'] for x in group],
                       'observedTimeInVideo':n['t'],'confidence':round(n['scores'][n['type']],3)})

for hold in review['holds']:
    start,end=timing(hold['start']),timing(hold['end'])
    for lane in hold['lanes']:
        merged=[n for n in merged if not(n['lane']==lane and start-.13<=n['t']<=end+.065)]
        merged.append({'t':start,'end':end,'lane':lane,'type':'hold','origin':'reviewed-hold'})

for n in json.loads((args.analysis/'ripple-events.json').read_text()):
    t=timing(n['t'])
    if not 12<t<117.99:continue
    merged.append({'t':t,'end':t,'lane':n['lane'],'type':'ripple','origin':'ripple-template',
                   'visibleStartInVideo':n['start'],'observedEndInVideo':n['t']})

for route in review['routes']:
    for i,lane in enumerate(route['lanes']):
        t=timing(route['start']+i*route['spacing'])
        if any(n['type']=='hold' and n['lane']==lane and n['t']-.1<=t<=n['end']+.1 for n in merged):continue
        if any(n['type']!='ripple' and n['lane']==lane and abs(n['t']-t)<.07 for n in merged):continue
        merged.append({'t':t,'end':t,'lane':lane,'type':'flick','origin':'adapted-route'})

# Normalize visually simultaneous heads to one timestamp while preserving rapid
# sequences. A group cannot contain the same perimeter direction twice.
aligned=[];group=[]
for n in sorted(merged,key=lambda n:n['t']):
    if group and (n['t']-group[0]['t']>.038 or any(x['lane']==n['lane'] for x in group)):
        aligned.append(group);group=[]
    group.append(n)
if group:aligned.append(group)
for group in aligned:
    t=timing(sum(n['t'] for n in group)/len(group))
    for n in group:
        length=n['end']-n['t'];n['t']=t;n['end']=t+length

notes,evidence,occupied,dropped=[],[],{},Counter()
for n in sorted(merged,key=lambda n:(n['t'],{'hold':0,'ripple':1,'tap':2,'flick':3}[n['type']],n['lane'])):
    t,end=round(n['t']-trim,5),round(n['end']-trim,5)
    if not 0<t<=end<duration:continue
    if t-occupied.get(n['lane'],-10)<.05:
        dropped['shared-key-conflict']+=1;continue
    notes.append({'t':t,'end':end,'lane':n['lane'],'type':n['type'],
                  'skin':'touch' if n['type']=='ripple' else 'beat',
                  'drum':'hat' if n['type']=='flick' else 'tom' if n['type']=='hold' else 'snare'})
    evidence.append({**n,'t':t,'end':end});occupied[n['lane']]=end

groups=defaultdict(list)
for n in notes:groups[n['t']].append(n)
normal,last,active,last_group=[],{},[],-10
for t,group in sorted(groups.items()):
    if t-last_group<.18:continue
    active=[n for n in active if n['end']>t+.05];budget=2-len(active);before=len(normal)
    for n in sorted(group,key=lambda n:({'hold':0,'ripple':1,'tap':2,'flick':3}[n['type']],n['lane'])):
        if budget<=0 or t-last.get(n['lane'],-10)<.18:continue
        normal.append(n.copy());last[n['lane']]=n['end'];budget-=1
        if n['type']=='hold':active.append(n)
    if len(normal)>before:last_group=t

chart={'revision':1,'bpm':bpm,'trimStart':trim,'trimEnd':trim+duration,
       'source':'User-supplied BeatStream 天ノ弱 BEAST Lv09_480p.mp4',
       'sourceFPS':30,'openingGridPhaseInVideo':phase,'tempoObservations':review['tempoObservation'],
       'method':'Radial trajectories, recording-derived circular/square masks, fitted head centroids and multiscale fixed Ripple templates. Reviewed hold heads/tail caps and selected STREAM routes projected to eight directions. Tempo changes retain observed arrivals instead of a single global grid. Approximate 480p/30 fps reference, not an official full cabinet chart.',
       'reviewedHoldsInVideo':review['holds'],'adaptedRoutesInVideo':review['routes'],
       'uncertaintySeconds':.067,'dropped':dict(dropped),'evidence':evidence,'normal':normal,'hard':notes}
alignment=args.analysis/'audio-alignment.json'
if alignment.exists():chart['audioAlignment']=json.loads(alignment.read_text())
(client/'amanojaku-chart.json').write_text(json.dumps(chart,separators=(',',':'))+'\n')
song={'id':'amanojaku-video','title':'天ノ弱','artist':'164 feat. GUMI',
      'bpm':bpm,'duration':duration,'offset':round((phase-trim)%(60/bpm),5),
      'file':'audio/amanojaku-clean.mp3','cover':'covers/amanojaku-video.jpg',
      'color':'#00cfb0','tag':'VIDEO / BEAST','version':'VIDEO REFERENCE',
      'uploaded':True,'videoReference':True,'previewAt':68,'description':'',
      'charts':{'normal':normal,'hard':notes}}
(client/'amanojaku-song.js').write_text("'use strict';\nSONGS.unshift("+json.dumps(song,ensure_ascii=False,separators=(',',':'))+");\n")
print(json.dumps({'BEAST':len(notes),'NORMAL':len(normal),'types':dict(Counter(n['type'] for n in notes)),
                  'chords':sum(c>1 for c in Counter(n['t'] for n in notes).values()),
                  'lastEnd':max(n['end'] for n in notes),'dropped':dict(dropped)}))
