const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const difficulty=require('../dist/client/chart-difficulties.js');
const reference=JSON.parse(fs.readFileSync('dist/client/chernobog-chart.json','utf8'));
const context=vm.createContext({SONGS:[]});
vm.runInContext(fs.readFileSync('dist/client/chernobog-song.js','utf8'),context);
const song=JSON.parse(JSON.stringify(context.SONGS[0]));
assert.equal(song.id,'chernobog-video');
assert.equal(song.originalSongId,'official-chernobog');
assert.equal(song.bpm,200);
assert.deepEqual(song.charts.hard,reference.hard);
assert.deepEqual(song.charts.normal,reference.normal);
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json','dist/client/'+song.file],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);
const duration=Number(JSON.parse(probe.stdout).format.duration);
assert.ok(Math.abs(duration-song.duration)<.08,'decoded recording must match chart time');
const light=difficulty.songNotes(song,'light');
assert.ok(light.length>50&&light.length<song.charts.normal.length);
for(const [name,notes] of Object.entries({...song.charts,light})){
 const previous=new Map();
 for(const n of notes){
  assert.ok(Number.isFinite(n.t)&&Number.isFinite(n.end)&&n.t>0&&n.t<=n.end&&n.end<duration);
  assert.ok(['tap','hold','flick','ripple','stream'].includes(n.type));
  assert.ok(Number.isInteger(n.lane)&&n.lane>=0&&n.lane<(n.type==='ripple'?6:8));
  const key=(n.type==='ripple'?'r:':'b:')+n.lane;const before=n.type==='stream'?null:previous.get(key);
  if(before)assert.ok(n.t-before.end>=.049,`${name}: repeated key overlaps at ${n.t}`);
  if(n.type!=='stream')previous.set(key,n);
  assert.ok(reference.evidence.some(source=>source.t===n.t),'reduced charts must retain observed musical timings');
  const grid=(n.t+reference.trimStart-reference.gridPhaseInVideo)/.075;
  assert.ok(Math.abs(grid-Math.round(grid))<.001,'keep the measured 200 BPM grid');
 }
}
const holds=song.charts.hard.filter(n=>n.type==='hold');
assert.equal(holds.length,11);
assert.equal(holds.filter(n=>n.end-n.t>4.7).length,2,'keep both long final holds');
assert.ok(song.charts.hard.filter(n=>n.type==='ripple').length>100,'retain fixed-position Ripple passages');
const groups=new Map();for(const n of song.charts.hard)groups.set(n.t,(groups.get(n.t)||0)+1);
assert.ok([...groups.values()].filter(n=>n>1).length>90,'retain simultaneous phrases');
const sourceBefore=JSON.stringify(song.charts),edited=[{t:2,end:2,lane:2,type:'tap'}];
assert.equal(difficulty.songNotes(song,'hard',{[song.id]:{hard:{notes:edited}}}),edited);
assert.equal(JSON.stringify(song.charts),sourceBefore);
console.log(`PASS CHERNOBOG recording alignment, timing grid, key conflicts, long holds, simultaneous notes, Ripple passages, editable overrides and three difficulties (${song.charts.hard.length}/${song.charts.normal.length}/${light.length})`);
