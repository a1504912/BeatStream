'use strict';
// Shared deterministic analyzer, run in a Web Worker so uploads remain responsive.
((root)=>{
 const VERSION=3;
 const quantile=(values,q)=>{const sorted=Array.from(values).sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]||0};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=v=>+v.toFixed(4);
 function fft(real,imag,reverse){
  const size=real.length;for(let i=0;i<size;i++){const j=reverse[i];if(j>i){const temp=real[i];real[i]=real[j];real[j]=temp}}
  imag.fill(0);for(let len=2;len<=size;len*=2){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let begin=0;begin<size;begin+=len){let r=1,im=0;for(let j=0;j<len/2;j++){const x=begin+j,y=x+len/2,tr=r*real[y]-im*imag[y],ti=r*imag[y]+im*real[y];real[y]=real[x]-tr;imag[y]=imag[x]-ti;real[x]+=tr;imag[x]+=ti;const next=r*wr-im*wi;im=r*wi+im*wr;r=next}}}
 }
 function features(samples,sampleRate,progress){
  const size=512,hop=128,count=Math.ceil(samples.length/hop),step=hop/sampleRate,real=new Float64Array(size),imag=new Float64Array(size),prev=new Float64Array(size/2),reverse=new Uint16Array(size),window=new Float64Array(size);
  for(let i=0;i<size;i++){let v=i,r=0;for(let b=0;b<9;b++){r=(r<<1)|(v&1);v>>=1}reverse[i]=r;window[i]=.5-.5*Math.cos(2*Math.PI*i/(size-1))}
  const novelty=new Float32Array(count),bass=new Float32Array(count),energy=new Float32Array(count),high=new Float32Array(count),mid=new Float32Array(count);
  for(let frame=0;frame<count;frame++){
   let rms=0;for(let i=0;i<size;i++){const sample=samples[frame*hop+i-size/2]||0;rms+=sample*sample;real[i]=sample*window[i]}
   energy[frame]=Math.sqrt(rms/size);fft(real,imag,reverse);const flux=[0,0,0],bins=[0,0,0];
   for(let bin=2;bin<size/2;bin++){const freq=bin*sampleRate/size,band=freq<280?0:freq<2200?1:2,magnitude=Math.log1p(Math.hypot(real[bin],imag[bin])*8);flux[band]+=Math.max(0,magnitude-prev[bin]);bins[band]++;prev[bin]=magnitude}
   bass[frame]=flux[0]/Math.max(1,bins[0]);mid[frame]=flux[1]/Math.max(1,bins[1]);high[frame]=flux[2]/Math.max(1,bins[2]);novelty[frame]=bass[frame]*1.8+mid[frame]*1.3+high[frame]+Math.max(0,Math.log1p(energy[frame]*100)-Math.log1p((energy[frame-1]||0)*100))*.25;
   if(frame%2000===0)progress(.1+.5*frame/count,'分析鼓點與音樂強弱…');
  }return {novelty,bass,mid,high,energy,step,hop};
 }
 function detectPeaks(f,samples,sampleRate){
  const {novelty,energy,step}=f,n=novelty.length,baseline=new Float64Array(n+1),top=quantile(novelty,.98),energyFloor=Math.max(.00003,quantile(energy,.95)*.10),radius=Math.round(.35/step),peaks=[];
  for(let i=0;i<n;i++)baseline[i+1]=baseline[i]+novelty[i];
  for(let i=2;i<n-2;i++){
   const mean=(baseline[Math.min(n,i+radius)]-baseline[Math.max(0,i-radius)])/Math.max(1,Math.min(n,i+radius)-Math.max(0,i-radius));
   if(novelty[i]<Math.max(top*.14,mean*1.55,.002)||energy[i]<energyFloor||novelty[i]<novelty[i-1]||novelty[i]<=novelty[i+1]||novelty[i]<novelty[i-2]||novelty[i]<novelty[i+2])continue;
   // Refine the spectral peak against a short RMS rise, rather than snapping to a guessed grid.
   let bestRise=-Infinity,best=i*step;const window=Math.max(1,Math.round(sampleRate*.005));
   for(let at=Math.max(window,Math.round((i*step-.025)*sampleRate));at<Math.min(samples.length-window,Math.round((i*step+.012)*sampleRate));at+=Math.max(1,Math.round(sampleRate*.002))){let before=0,after=0;for(let j=0;j<window;j++){before+=samples[at-j-1]**2;after+=samples[at+j]**2}const rise=after-before;if(rise>bestRise){bestRise=rise;best=at/sampleRate}}
   const t=round(best),last=peaks.at(-1),peak={t,strength:novelty[i],bass:f.bass[i],mid:f.mid[i],high:f.high[i],energy:energy[i]};
   if(t<.08)continue;if(last&&t-last.t<.08){if(peak.strength>last.strength)peaks[peaks.length-1]=peak}else peaks.push(peak);
  }return peaks;
 }
 function tempo(f,peaks,override){
  const signal=new Float64Array(f.novelty.length),mean=f.novelty.reduce((s,v)=>s+v,0)/signal.length;
  for(let i=0;i<signal.length;i++)signal[i]=Math.max(0,f.novelty[i]-mean*.45)+f.bass[i]*1.5;
  const correlations=new Map(),corr=lag=>{lag=Math.max(1,Math.round(lag));if(correlations.has(lag))return correlations.get(lag);let sum=0,a=0,b=0;for(let i=lag;i<signal.length;i++){sum+=signal[i]*signal[i-lag];a+=signal[i]**2;b+=signal[i-lag]**2}const result=sum/Math.sqrt(Math.max(1e-15,a*b));correlations.set(lag,result);return result};
  let bpm=override||120,score=0;
  if(!override)for(let candidate=70;candidate<=220;candidate+=.5){const lag=60/candidate/f.step,value=corr(lag)+.45*corr(lag*2)+.2*corr(lag*4)+.07*Math.exp(-(((candidate-150)/55)**2));if(value>score){bpm=candidate;score=value}}
  if(!override&&peaks.length>8){let best=-1,refined=bpm;for(let candidate=Math.max(70,bpm-3);candidate<=Math.min(220,bpm+3);candidate+=.1){let x=0,y=0,total=0;for(const p of peaks){const weight=p.strength+p.bass*2,phase=p.t*candidate/60*Math.PI*2;x+=Math.cos(phase)*weight;y+=Math.sin(phase)*weight;total+=weight}const value=Math.hypot(x,y)/Math.max(1e-9,total);if(value>best){best=value;refined=candidate}}bpm=Math.round(refined*10)/10}
  const beat=60/bpm;let offset=0,phaseScore=-1;
  for(let phase=0;phase<96;phase++){const off=phase/96*beat;let value=0;for(const p of peaks){const d=Math.abs((p.t-off)/beat-Math.round((p.t-off)/beat));value+=(p.strength+p.bass)*Math.exp(-((d/.105)**2))}if(value>phaseScore){phaseScore=value;offset=off}}
  return {bpm:+bpm.toFixed(1),offset:round(offset),confidence:override?'manual':score>.8&&peaks.length>12?'high':'low'};
 }
 // Four-beat bars and repeating four-bar phrases provide recognizable patterns.
 function musicSections(peaks,f,{bpm,offset,duration}){
  const beat=60/bpm,barLength=beat*4,count=Math.max(1,Math.ceil((duration-offset)/barLength)),bars=[];
  for(let i=0;i<count;i++){
   const start=Math.max(0,offset+i*barLength),end=Math.min(duration,start+barLength),from=Math.max(0,Math.floor(start/f.step)),to=Math.min(f.energy.length,Math.ceil(end/f.step));
   let energy=0;for(let j=from;j<to;j++)energy+=f.energy[j];
   bars.push({start:round(start),end:round(end),energy:energy/Math.max(1,to-from),peaks:0,attack:0,kind:'flow'});
  }
  for(const p of peaks){const bar=bars[clamp(Math.floor((p.t-offset)/barLength),0,bars.length-1)];bar.peaks++;bar.attack+=p.strength+p.bass*.7+p.mid*.5}
  const active=bars.filter(b=>b.peaks>0),energyMedian=Math.max(.00001,quantile(active.map(b=>b.energy),.5)),attackMedian=Math.max(.00001,quantile(active.map(b=>b.attack),.5)),peakMedian=Math.max(1,quantile(active.map(b=>b.peaks),.5)),top=quantile(f.energy,.9);
  const intensity=bars.map(b=>b.energy/energyMedian*.4+b.attack/attackMedian*.35+b.peaks/peakMedian*.25),smoothed=intensity.map((value,i)=>(value*2+(intensity[i-1]??value)+(intensity[i+1]??value))/4);
  const low=quantile(smoothed,.25),high=quantile(smoothed,.75),dynamic=high>low*1.08;
  for(let i=0;i<bars.length;i++){
   const bar=bars[i],value=smoothed[i];
   bar.kind=bar.energy<top*.08&&bar.peaks<2?'rest':dynamic&&value<low*1.04?'calm':dynamic&&value>high*.96?'peak':'flow';
  }
  return bars;
 }
 function buildCharts(peaks,f,{bpm,offset,duration,density='balanced'}){
  const beat=60/bpm,bars=musicSections(peaks,f,{bpm,offset,duration}),strong=quantile(peaks.map(p=>p.strength),.78),soft=quantile(peaks.map(p=>p.strength),.25),energyTop=quantile(f.energy,.9);
  const motifs={calm:[6,2,6,2,7,1,7,1],flow:[6,7,2,1,5,6,3,2],peak:[6,2,7,1,5,3,0,4],rest:[6,2,6,2,7,1,7,1]};
  const make=hard=>{
   const division=hard?4:2,cells=new Map(),gap=Math.max(hard?.105:.19,beat*(hard?.29:.58))*(density==='easy'?1.2:density==='dense'?.88:1);
   for(let i=0;i<peaks.length;i++){
    const p=peaks[i];if(p.t<.15||p.t>duration-.15)continue;
    const at=(p.t-offset)/beat,barIndex=clamp(Math.floor(at/4),0,bars.length-1),bar=bars[barIndex],slot=Math.round(at*division),local=((slot%(4*division))+4*division)%(4*division),quarter=slot%division===0;
    const distance=Math.abs(at-slot/division),aligned=distance<(hard?.23:.20),next=peaks[i+1],melody=p.mid>p.bass*1.7&&p.mid>p.high*1.4&&(!next||next.t-p.t>beat*1.3);
    if(bar.kind==='rest'||(!aligned&&!melody))continue;
    // Quiet music breathes; fast runs appear only near phrase endings.
    const fill=barIndex%4===3&&local>=division*3&&bar.kind!=='calm',evenBeat=quarter&&Math.round(at)%2===0;
    let allowed=quarter;
    if(hard)allowed=quarter||(bar.kind!=='calm'&&slot%2===0)||(fill&&density!=='easy')||(bar.kind==='peak'&&density==='dense');
    else allowed=quarter||(bar.kind==='peak'&&local>=4&&barIndex%2===1)||(fill&&local>=6)||(density==='dense'&&bar.kind!=='calm'&&local%4===1);
    if(bar.kind==='calm'&&!hard)allowed=evenBeat;
    if(density==='easy'&&!hard)allowed=quarter&&(bar.kind==='peak'||evenBeat);
    if(!allowed&&!melody)continue;
    if(!hard&&p.high>p.bass+p.mid&&p.strength<soft*1.3)continue;
    const score=p.strength/Math.max(.001,strong)+(quarter?.8:0)+(local===0?.4:0)+p.bass/Math.max(.001,p.mid+p.high)*.15-distance;
    const key=melody&&!aligned?'melody:'+i:slot,prior=cells.get(key);
    if(!prior||score>prior.score)cells.set(key,{...p,barIndex,at,quarter,melody,score});
   }
   const selected=[];
   for(const p of [...cells.values()].sort((a,b)=>a.t-b.t)){
    const last=selected.at(-1);if(last&&p.t-last.t<gap){if(p.score>last.score*1.2)selected[selected.length-1]=p}else selected.push(p);
   }
   const result=[],busyUntil=new Map();let lastChord=-Infinity,lastSpecial=-Infinity,lastHold=-Infinity,lastRipple=0;
   const reserve=(n,preferred)=>{
    const order=n.type==='ripple'?[preferred%6,...[0,1,4,3,5,2]]:[preferred,(preferred+1)%8,(preferred+7)%8,(preferred+4)%8,...[6,2,7,1,5,3,0,4]];
    n.lane=order.find(lane=>n.t>=(busyUntil.get((n.type==='ripple'?'r:':'b:')+lane)??-1)+.04);
    if(n.lane===undefined)return false;
    busyUntil.set((n.type==='ripple'?'r:':'b:')+n.lane,n.end+.08);n.skin=n.type==='ripple'?'touch':'beat';result.push(n);return true;
   };
   for(let i=0;i<selected.length;i++){
    const p=selected[i],next=selected[i+1],bar=bars[p.barIndex],beatInBar=((p.at%4)+4)%4,phraseEnd=p.barIndex%4===3,motif=motifs[bar.kind],slot=((Math.round(p.at*2)%8)+8)%8;
    const preferred=p.barIndex%4>=2?(8-motif[slot])%8:motif[slot],onBar=p.quarter&&beatInBar<.22;
    let type='tap',end=p.t;
    // A long note follows a sustained musical tail, not every nth detected peak.
    const resolving=(phraseEnd&&beatInBar>=2)||(bar.kind==='calm'&&onBar)||p.melody;
    if(resolving&&p.t-lastHold>beat*(hard?8:12)){
     const desired=Math.min(duration-.12,p.t+beat*(p.melody?4:2.5),next&&next.t-p.t>beat*1.4?next.t-.14:Infinity),from=Math.ceil((p.t+.18)/f.step),to=Math.floor(desired/f.step);
     let sum=0,live=0,total=0;for(let j=from;j<=to;j++){const value=f.energy[j]||0;sum+=value;live+=value>energyTop*.18;total++}
     if(desired-p.t>=.8&&total&&sum/total>energyTop*.28&&live/total>.72){type='hold';end=round(desired);lastHold=p.t}
    }
    if(type==='tap'&&p.t-lastSpecial>beat*(hard?6:12)){
     if(hard&&phraseEnd&&beatInBar>=2&&p.high>p.bass*1.6&&p.high>p.mid*1.15&&(!next||next.t-p.t>beat*.4)){type='flick';lastSpecial=p.t}
     else if(p.quarter&&phraseEnd&&(bar.kind==='calm'||(bar.kind==='flow'&&beatInBar>=2))){type='ripple';lastSpecial=p.t}
    }
    if(!hard&&result.some(n=>n.type==='hold'&&p.t<n.end&&p.t>n.t&&(!p.quarter||p.t-n.t<beat*.9)))continue;
    const lane=type==='ripple'?[0,1,4,3,5,2][lastRipple++%6]:preferred,n={t:p.t,end,lane,type,drum:type==='flick'?'hat':type==='hold'?'tom':p.bass>p.mid?'kick':'snare'};
    if(!reserve(n,lane))continue;
    // Chords mark real strong accents, with clear space between them.
    if(type==='tap'&&bar.kind!=='calm'&&p.strength>=strong&&onBar&&p.t-lastChord>beat*(hard?7.5:15.5)&&!result.some(n=>n.type==='hold'&&n.t<p.t&&n.end>p.t)){
     const second={...n};if(reserve(second,(n.lane+4)%8))lastChord=p.t;
    }
   }
   return result.sort((a,b)=>a.t-b.t||a.lane-b.lane);
  };
  return {normal:make(false),hard:make(true)};
 }
 function analyzeSamples(samples,sampleRate,{bpm:override,density='balanced',duration=samples.length/sampleRate}={},progress=()=>{}){
  if(!(samples instanceof Float32Array)||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>48000||samples.length<sampleRate*4||duration<5||duration>600)throw Error('音軌長度或取樣資料不正確');
  if(override!==undefined&&override!==null&&(!Number.isFinite(override)||override<20||override>400))throw Error('BPM 請填 20–400，或留空自動偵測');
  let total=0;for(const sample of samples){if(!Number.isFinite(sample))throw Error('音軌資料不完整');total+=sample*sample}if(total/samples.length<1e-9)throw Error('這個檔案沒有可辨識的聲音，請確認影片含有音軌');
  const f=features(samples,sampleRate,progress);let peaks=detectPeaks(f,samples,sampleRate);progress(.65,'偵測速度與拍點…');const estimated=tempo(f,peaks,override);let fallback=false;
  if(peaks.length<8){fallback=true;const floor=Math.max(.00005,quantile(f.energy,.9)*.12),beat=60/estimated.bpm;for(let t=estimated.offset+.1;t<duration-.2;t+=beat)if(f.energy[Math.min(f.energy.length-1,Math.floor(t/f.step))]>floor)peaks.push({t:round(t),strength:1,bass:1,mid:0,high:0,energy:floor});peaks.sort((a,b)=>a.t-b.t);estimated.confidence='low'}
  progress(.87,'依樂句安排交替、重拍與收尾…');const charts=buildCharts(peaks,f,{...estimated,duration,density});if(!charts.normal.length||!charts.hard.length)throw Error('可用拍點太少，請選擇音樂較清楚的檔案');
  const sections=musicSections(peaks,f,{...estimated,duration}).map(({start,end,kind})=>({start,end,kind}));progress(1,'樂句式譜面已生成');return {...estimated,charts,analysis:{version:VERSION,method:'audio-phrases',confidence:estimated.confidence,fallback,peakCount:peaks.length,density,sections}};
 }
 const api={analyzeSamples,buildCharts,VERSION};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BeatStreamChartGenerator=api;
 if(typeof document==='undefined'&&typeof root.postMessage==='function')root.onmessage=e=>{try{const result=analyzeSamples(e.data.samples,e.data.sampleRate,e.data.options,(progress,message)=>root.postMessage({type:'progress',progress,message}));root.postMessage({type:'result',result})}catch(error){root.postMessage({type:'error',error:error.message})}};
})(typeof globalThis!=='undefined'?globalThis:this);
