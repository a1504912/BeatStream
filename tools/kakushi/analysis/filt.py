import json
G0=0.10986;U=0.1056338
n=json.load(open('an/combined3.json'));S=json.load(open('an/streams.json'))
LANES={'hlong':(2,6),'hshort':(2,),'vmid':(0,4),'diagTLBR':(7,3),'diagTRBL':(1,5)}
rm=[]
def lanes_of(nm):
  for k,v in LANES.items():
    if nm.startswith(k):return v
  return ()
keep=[]
for x in n:
  g=G0+U*x['k'];ge=G0+U*x['kend'];drop=False
  if x['type'] in ('hold','tap','flick'):
    for s in S:
      if x['lane'] in lanes_of(s['name']) and s['appear']-0.3<=g<=s['end']+0.3 and (x['type']=='hold' or abs(g-s['start'])<0.25 or abs(g-s['end'])<0.25):
        drop=True;rm.append((round(g,2),x['type'],x['lane'],s['name']));break
  if not drop:keep.append(x)
json.dump(keep,open('an/combined3f.json','w'))
print(len(n),'->',len(keep));print(rm)
