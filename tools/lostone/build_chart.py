import json,math
from pathlib import Path
from collections import Counter
root=Path('lostone-analysis');step=60/162/4;phase=-.028;trim=5.5
v=json.load(open(root/'valid.json'));moving=[]
for t in v:
 typ='hold' if t['center']>.87 else 'flick' if t['center']<.48 else 'tap'
 # Exclude short fragments around the central combo text.
 if t['lane']==0 and t['center']<.2 and t['frames']<10:continue
 moving.append(dict(t=t['t'],lane=t['lane'],type=typ,frames=t['frames']))
merged=[]
for lane in range(8):
 items=sorted([n for n in moving if n['lane']==lane],key=lambda n:n['t']);out=[]
 for n in items:
  if out and n['t']-out[-1]['t']<(.145 if n['type']==out[-1]['type']=='flick' else .075):
   old=out[-1];old['t']=(old['t']*old['frames']+n['t']*n['frames'])/(old['frames']+n['frames']);old['frames']+=n['frames'];continue
  out.append(n)
 # Filled long-note head and tail observations become one hold.
 for i,n in enumerate(out):
  if n.get('consumed'):continue
  n['end']=n['t']
  if n['type']=='hold':
   nxt=out[i+1] if i+1<len(out) else None
   if nxt and nxt['type']=='hold' and .15<nxt['t']-n['t']<.8:n['end']=nxt['t'];nxt['consumed']=True
   else:n['end']=n['t']+60/162*.5
   if nxt and not nxt.get('consumed'):n['end']=min(n['end'],nxt['t']-.08)
   if n['end']-n['t']<.12:n['type']='tap';n['end']=n['t']
  merged.append(n)
for n in json.load(open(root/'ripple-events.json')):merged.append(dict(n,type='ripple',end=n['t'],frames=10))
notes=[];occupied={}
for n in sorted(merged,key=lambda n:n['t']):
 t=round((n['t']-phase)/step)*step+phase-trim;end=round((n['end']-phase)/step)*step+phase-trim if n['type']=='hold' else t
 if not(0<t<133):continue
 if t-occupied.get(n['lane'],-10)<.07:continue
 if n['type']=='hold' and end<=t:end=t+step*2
 notes.append(dict(t=round(t,4),end=round(end,4),lane=n['lane'],type=n['type'],skin='touch' if n['type']=='ripple' else 'beat',drum='hat' if n['type']=='flick' else 'tom' if n['type']=='hold' else 'snare'));occupied[n['lane']]=t
# Resolve same-key notes during a hold rather than creating impossible input.
for i,n in enumerate(notes):
 if n['type']=='hold':
  nxt=next((m for m in notes[i+1:] if m['lane']==n['lane']),None)
  if nxt and n['end']>=nxt['t']-.07:n['end']=round(nxt['t']-.08,4)
  if n['end']-n['t']<.12:n['type']='tap';n['end']=n['t']
normal=[];last={};groups={}
for n in notes:
 beat=round((n['t']+trim-phase)/step)
 if beat%2 and n['type']=='tap':continue
 if n['t']-last.get(n['lane'],-10)<.24 or groups.get(n['t'],0)>=2:continue
 normal.append(n.copy());last[n['lane']]=n['end'];groups[n['t']]=groups.get(n['t'],0)+1
chart={'revision':1,'bpm':162,'trimStart':trim,'method':'30 fps color trajectory tracking, silhouette estimates, rotated Ripple template; quantized to 162 BPM. Approximate hold tails; not an official chart.','normal':normal,'hard':notes}
Path('beatstream/dist/client/lostone-chart.json').write_text(json.dumps(chart,separators=(',',':')))
song={'id':'lostone-video','title':'ロストワンの号哭','artist':'Neru · 影片錄影音軌','bpm':162,'duration':133.5,'offset':round((phase-trim)%(60/162),4),'file':'audio/lostone-video.mp3','cover':'covers/lostone-video.jpg','color':'#ffe546','tag':'VIDEO REFERENCE / BEAST Lv10','version':'影片參考譜 · 2:13','uploaded':True,'videoReference':True,'previewAt':30,'description':'依你提供的 BEAST Lv10 影片重建節拍與配置；含同時押、連打、長按、滑切、定點縮圈。BEAST 為參考版，NORMAL 為減量版。480p／30 fps 辨識，部分音符與長按尾端為近似，並非官方原始譜。音軌直接擷取此影片，含原有打擊聲。','charts':{'normal':normal,'hard':notes}}
Path('beatstream/dist/client/lostone-song.js').write_text("'use strict';\nSONGS.unshift("+json.dumps(song,ensure_ascii=False,separators=(',',':'))+");\n")
print('BEAST',len(notes),dict(Counter(n['type'] for n in notes)),'NORMAL',len(normal),'chords',sum(c>1 for c in Counter(n['t'] for n in notes).values()),'last',notes[-1]['t'])
