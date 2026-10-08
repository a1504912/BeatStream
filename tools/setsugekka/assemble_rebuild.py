"""Assemble only observed heads, reviewed shafts/caps and Ripple arrivals.

Recording COMBO checkpoints limit low-confidence candidate duplicates;
missing observations remain missing instead of inventing keyboard patterns.
"""
import argparse,json,math
from pathlib import Path
from collections import Counter
p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,required=True);p.add_argument('--baseline',type=Path,required=True,help='The original revision-1 chart JSON, before reconstruction');args=p.parse_args();root=Path(__file__).parent
old=json.loads(args.baseline.read_text());assert old['revision']==1,'Candidate weights require the original revision-1 baseline'
review=json.loads((root/'reviewed.json').read_text());holds=review['holds'];a=args.analysis
groups=json.loads((a/'validated-groups.json').read_text());wide=json.loads((a/'classified.json').read_text());ripples=json.loads((a/'merged-ripples.json').read_text())
phase,step=review['gridPhaseInVideo'],review['subdivisionSeconds'];fit=old['audioAlignment'];rate,offset=fit['sourceRate'],fit['sourceOffset']
existing={(n['lane'],round(((n['t']-offset)/rate-phase)/step)) for n in old['hard'] if n['type'] not in ['hold','ripple']}
reject=[(6,17.85),(6,23.75),(5,22.72),(3,30.32),(5,39.13),(6,35.57),(4,44.47),(4,43.91),(5,44.10),(5,44.66),(4,44.19),(5,44.75),(0,59.28),(7,57.19),(3,72.41),(7,75.60),(6,71.85),(5,88.07),(5,91.72),(7,95.57)]
square=[(6,35.00),(6,72.22),(2,92.00),(6,92.00)]
bykey={(g['lane'],round((g['videoTime']-phase)/step)):g for g in groups}
for n in wide:
 if n['scores'][n['type']]<.64 or n.get('centroidError',0)>2.5 or n['last'][1]>180 or not 9.6<n['t']<97.6:continue
 key=(n['lane'],round((n['t']-phase)/step))
 if key in bykey:bykey[key]['observations'].append({**n,'origin':'wide-speed-head'})
 else:bykey[key]={'lane':n['lane'],'videoTime':phase+key[1]*step,'observations':[{**n,'origin':'wide-speed-head'}],'headCompactness':.3}
moving=[]
for key,g in bykey.items():
 t=g['videoTime'];lane=g['lane']
 if any(lane==l and abs(t-v)<.04 for l,v in reject):continue
 if any(lane in h['lanes'] and h['start']-.13<=t<=h['end']+.18 for h in holds):continue
 observations=g['observations'];prior=[n for n in observations if n['origin']!='refined'];fresh=[n for n in observations if n['origin']=='refined']
 best=max(prior,key=lambda n:n['scores'][n['type']]) if prior else max(fresh,key=lambda n:n['confidence'])
 kind=best['type'] if prior else 'tap';kind='tap' if kind=='hold' else kind
 if kind=='flick' and best.get('hue',0)>115:kind='tap'
 if any(lane==l and abs(t-v)<.04 for l,v in square):kind='flick'
 confidence=best.get('confidence',best.get('scores',{}).get(best['type'],0));weight=confidence+(0.4 if prior and fresh else 0)+(0.6 if key in existing else 0)
 moving.append({'t':round(t,5),'end':round(t,5),'lane':lane,'type':kind,'weight':weight,'origin':'rechecked-moving-head','confidence':round(confidence,3),'tracks':[{'pass':n['origin'],'track':n['track'],'observedTime':round(n['t'],5),'velocity':round(n['slope'],2),'frames':n['frames']} for n in observations]})
# Every retained observation has evidence in the recording. Checkpoints only
# remove candidate aliases; a deficient interval is never synthetically filled.
anchors=[(9.5,0),(15,38),(20,75),(30,166),(35,207),(40,252),(45,311),(55,409),(65,460),(85,623),(90,652),(95,690),(98,712)]
selected=[];audit=[]
for (start,before),(end,after) in zip(anchors,anchors[1:]):
 hs=sum(len(h['lanes']) for h in holds if start+.04<=h['start']<end+.04);rs=sum(start+.04<=n['t']<end+.04 for n in ripples);candidates=[n for n in moving if start+.04<=n['t']<end+.04];budget=max(0,after-before-hs-rs)
 chosen=sorted(candidates,key=lambda n:n['weight'],reverse=True)[:budget];selected+=chosen;audit.append({'videoStart':start,'videoEnd':end,'cabinetComboDelta':after-before,'retainedMovingHeads':len(chosen),'retainedRippleHeads':rs,'retainedHolds':hs,'unrecoveredDelta':max(0,budget-len(chosen))})
for h in holds:
 for lane in h['lanes']:selected.append({'t':h['start'],'end':h['end'],'lane':lane,'type':'hold','origin':'reviewed-continuous-shaft-and-cap'})
for n in ripples:
 nearest=round((n['t']-phase)/step)*step+phase;t=nearest if abs(nearest-n['t'])<.055 else n['t'];selected.append({'t':round(t,5),'end':round(t,5),'lane':n['lane'],'type':'ripple','origin':n['origin'],'observedTime':n['t'],'visibleStart':n['start']})
selected.sort(key=lambda n:(n['t'],n['lane']));accepted=[];last={}
for n in selected:
 family='ripple' if n['type']=='ripple' else 'beat';key=(family,n['lane'])
 if n['t']-last.get(key,-100)<.05:continue
 accepted.append(n);last[key]=n['end']
result={'revision':2,'source':'User-supplied 【BeatStream】回レ！雪月花 BEAST_1080p.mp4','sourceFPS':30000/1001,'sourceVideoSHA256':json.loads((a/'audio-recheck.json').read_text())['videoSHA256'],'gridPhaseInVideo':phase,'subdivisionSeconds':step,'holds':holds,'notesInVideo':accepted,'comboCheckpoints':anchors,'intervalAudit':audit,'manualExcludedGhostsAndCaps':[{'lane':l,'videoTime':v} for l,v in reject],'manualSquareHeads':[{'lane':l,'videoTime':v} for l,v in square],'method':'Second symbol-core pass plus reclassification of trajectories; centered complete Ripple core plus prior Ripple detector; manually checked evidence crops reject paw effects, empty scenery, stationary Ripple outlines and long-note caps. Recording COMBO checkpoints reject surplus low-confidence aliases, without inserting missing notes. Eight-direction projection remains an adaptation; incomplete or occluded observations are not official cabinet chart data.'}
(root/'rebuild-reviewed.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');(root/'audio-recheck.json').write_text((a/'audio-recheck.json').read_text());print(json.dumps({'notes':len(accepted),'types':dict(Counter(n['type'] for n in accepted)),'intervalAudit':audit}),flush=True)
