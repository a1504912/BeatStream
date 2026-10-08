const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const difficulty=require('../dist/client/chart-difficulties.js');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('dist/client/rhythm-charts.js','utf8'),context);
const builtins=vm.runInContext('RHYTHM_CHARTS',context);
for(const [id,charts] of Object.entries(builtins)){
 const before=JSON.stringify(charts),normal=charts.normal,bpm=id==='asunoyozora'?185:140;
 const light=difficulty.songNotes({id,bpm,charts},'light');
 assert.ok(light.length>0&&light.length<normal.length,`${id}: LIGHT must reduce density`);
 assert.equal(JSON.stringify(charts),before,'existing charts must be unchanged');
 for(let i=0;i<light.length;i++){
  const n=light[i];assert.ok(normal.some(source=>source.t===n.t),'keep a real musical timing');
  assert.ok(['tap','hold'].includes(n.type));assert.ok(n.lane>=0&&n.lane<8);
  if(i){assert.ok(n.t-light[i-1].t>=.7-1e-6,'no fast repeats or simultaneous notes');assert.ok(n.t>=light[i-1].end+.25-1e-6,'no inputs during a hold')}
 }
 assert.deepEqual(light,difficulty.simplify(normal,bpm),'LIGHT must be deterministic');
}
const normal=Array.from({length:48},(_,i)=>({t:1+i*.25,end:1+i*.25,lane:i%8,type:i%4?'tap':'flick'}));
normal.push({t:4,end:6,lane:0,type:'hold'},{t:8,end:8,lane:4,type:'ripple'});
const legacy={id:'legacy',bpm:120,charts:{normal,hard:normal}},light=difficulty.songNotes(legacy,'light');
assert.ok(light.length<normal.length/2);assert.equal(difficulty.songNotes(legacy,'normal'),normal);
assert.equal(difficulty.songNotes(legacy,true),normal);
const edited=[{t:4,end:4,lane:2,type:'tap'}],custom={legacy:{light:{notes:edited}}};
assert.equal(difficulty.songNotes(legacy,'light',custom),edited,'use the edited LIGHT chart');
assert.equal(difficulty.songNotes(legacy,'normal',custom),normal,'keep NORMAL independent');
assert.deepEqual(difficulty.songNotes(legacy,'light',{legacy:{light:{notes:[]}}}),[],'an empty saved chart must stay empty');
const onlyEdited={id:'edited',bpm:120};
assert.deepEqual(difficulty.songNotes(onlyEdited,'light',{edited:{normal:{notes:normal}}}),difficulty.simplify(normal,120));
console.log('PASS LIGHT timing, reduced density, single inputs, hold spacing, immutable legacy charts, custom precedence and empty charts');
