const assert=require('node:assert/strict');
const generator=require('../dist/client/rhythm-generator.js');
const bpm=120,beat=.5,step=.01,duration=64,sampleRate=11025;
const samples=new Float32Array(duration*sampleRate),onsets=[];
function pulse(t,amp,hat=false){
 onsets.push(t);
 for(let j=0;j<sampleRate*.13&&t*sampleRate+j<samples.length;j++){
  const x=j/sampleRate,voice=hat?Math.sin(2*Math.PI*3800*x):Math.sin(2*Math.PI*(75*x+1.3*(1-Math.exp(-x*55))));
  samples[Math.floor(t*sampleRate)+j]+=amp*voice*Math.min(1,x/.003)*Math.exp(-x*(hat?85:38));
 }
}
for(let t=.54;t<duration-.5;t+=beat){
 if(t>32&&t<36)continue;
 const amp=t<16?.2:t<32?.8:.45;pulse(t,amp);
 if(t>=16&&t<32){pulse(t+.25,amp*.35,true);pulse(t+.375,amp*.25,true)}
}
const result=generator.analyzeSamples(samples,sampleRate,{bpm});
assert.equal(result.analysis.version,3);assert.equal(result.analysis.method,'audio-phrases');
assert.ok(result.analysis.sections.some(s=>s.kind==='calm'));assert.ok(result.analysis.sections.some(s=>s.kind==='peak'));assert.ok(result.analysis.sections.some(s=>s.kind==='rest'));
const inRange=(notes,a,b)=>notes.filter(n=>n.t>=a&&n.t<b).length;
assert.ok(inRange(result.charts.normal,18,30)>inRange(result.charts.normal,2,14),'energetic music must have more activity than the quiet verse');
assert.equal(inRange(result.charts.normal,32.5,35.5),0,'respect silence');
assert.ok(result.charts.hard.length>=result.charts.normal.length);
for(const notes of Object.values(result.charts)){
 const last=new Map(),at=new Map();
 for(const n of notes){
  assert.ok(onsets.some(t=>Math.abs(n.t-t)<.06)||n.type==='hold','use real audio timings');
  assert.ok(n.t>=0&&n.end<=duration);
  const key=(n.type==='ripple'?'r:':'b:')+n.lane,previous=last.get(key);if(previous)assert.ok(n.t>=previous.end+.035);last.set(key,n);
  if(n.type==='hold')assert.ok(n.end-n.t>=.8,'long notes must have a meaningful tail');
  const count=(at.get(n.t)||0)+1;at.set(n.t,count);assert.ok(count<=2,'no accidental multi-hand clusters');
 }
}
assert.deepEqual(result,generator.analyzeSamples(samples,sampleRate,{bpm}),'reproduce the same composition');
const comfortable=generator.analyzeSamples(samples,sampleRate,{bpm,density:'easy'});assert.ok(comfortable.charts.normal.length<result.charts.normal.length,'comfortable arrangement leaves more space');
// Steady, repeated music should have a recognizable phrase motif.
const peaks=Array.from({length:64},(_,i)=>({t:1+i*beat,strength:1,bass:1,mid:.3,high:.1}));
const steady=generator.buildCharts(peaks,{energy:new Float32Array(3400),step},{bpm,offset:1,duration:33});
const shape=(a,b)=>steady.normal.filter(n=>n.t>=a&&n.t<b).map(n=>({t:n.t-a,lane:n.lane,type:n.type}));
assert.deepEqual(shape(1,3),shape(9,11),'the same musical bar repeats its motif');
const sustained=generator.buildCharts(peaks,{energy:new Float32Array(3400).fill(.5),step},{bpm,offset:1,duration:33});
for(const ns of Object.values(sustained)){assert.ok(ns.some(n=>n.type==='hold'));for(const t of new Set(ns.map(n=>n.t))){const fingers=ns.filter(n=>n.t===t||(n.type==='hold'&&n.t<t&&n.end>t)).length;assert.ok(fingers<=2,'a held hand cannot be joined by a two-note chord')}}
console.log('PASS musical intensity, rests, real onset alignment, meaningful holds, two-hand limits, conflict-free lanes and repeating phrase motifs');
