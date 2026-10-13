import json,math
R=1.000081;C=-14.95668
runs=json.load(open('an/tmplruns.json'));T=json.load(open('an/tmplscan.json'))['templates']
cust={r['name']:r for r in json.load(open('an/custom-runs.json'))+json.load(open('an/custom-sq.json'))}
g=lambda v:R*v+C
out=[]
used=set()
for r in runs:
  a=g(r['appear'])
  if a>125.9:continue
  k=r['tmpl']
  if k.startswith('short'):
    x=int(k[5:])
    if any(q['tmpl']=='col%d'%x and abs(q['appear']-r['appear'])<0.2 for q in runs):continue
    if x in (271,374):poly=[(x,228),(x,52)]
    else:continue  # down shorts handled as custom
  elif k=='hmid':
    continue  # handled as custom (short/long)
  else:
    p=T[k];arrow_at_end=r['arrowAtEnd']>=r['arrowAtStart']
    poly=[tuple(p[0]),tuple(p[1])] if arrow_at_end else [tuple(p[1]),tuple(p[0])]
  out.append({'name':k,'appear':a,'start':g(r['lastFull']),'end':g(r['gone']),'poly':poly})
for nm,(a0,s0,e0) in {'hlong13':(13.41,14.11,14.35),'hlong20':(20.18,20.88,20.88),'hlong28':(28.65,29.31,29.31)}.items():
  out.append({'name':nm,'appear':a0,'start':s0,'end':e0,'poly':[(226,238),(700,238)]})
for nm,c in cust.items():
  if nm=='square1':continue
  out.append({'name':nm,'appear':c['appear'],'start':c['lastFull'],'end':c['gone'],'poly':[tuple(p) for p in c['poly']]})
out.sort(key=lambda s:s['start'])
json.dump(out,open('an/streams.json','w'))
for s in out:print('%-9s appear %.2f start %.2f end %.2f %s'%(s['name'],s['appear'],s['start'],s['end'],s['poly']))
print(len(out))
