import json,numpy as np
R=1.000081;C=-14.95668
d=json.load(open('an/tmplscan.json'));t=np.array(d['t']);rows=d['rows'];keys=list(rows[0].keys())
runs=[]
for k in keys:
  cov=np.array([r[k][0] for r in rows]);e0=np.array([r[k][1] for r in rows]);e1=np.array([r[k][2] for r in rows])
  hi=cov>0.7;i=0
  while i<len(t):
    if hi[i]:
      j=i
      while j+1<len(t) and (hi[j+1] or (j+2<len(t) and hi[j+2])):j+=1
      if t[j]-t[i]>=0.3:
        seg=slice(i,j+1);plat=np.percentile(cov[seg],80)
        # consumption: coverage decreasing at the end of the run
        k2=j
        after=np.arange(j,min(j+20,len(t)));lo=[a for a in after if cov[a]<0.15]
        end=t[lo[0]] if lo else t[j]
        arrow_end=np.median(e1[seg]);arrow_start=np.median(e0[seg])
        runs.append({'tmpl':k,'appear':float(t[i]),'lastFull':float(t[j]),'gone':float(end),'arrowAtEnd':float(arrow_end),'arrowAtStart':float(arrow_start),'cov':float(plat)})
      i=j+1
    else:i+=1
runs.sort(key=lambda r:r['appear'])
# conflicting overlapping templates: keep the one with best coverage among those sharing time & lines
json.dump(runs,open('an/tmplruns.json','w'))
for r in runs:print('g %.2f-%.2f-%.2f %-10s cov %.2f arrows start %.2f end %.2f'%(R*r['appear']+C,R*r['lastFull']+C,R*r['gone']+C,r['tmpl'],r['cov'],r['arrowAtStart'],r['arrowAtEnd']))
