const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const difficulty=require('../dist/client/chart-difficulties.js');
const reference=JSON.parse(fs.readFileSync('dist/client/papipu-chart.json','utf8'));
const data=vm.createContext({SONGS:[]});
vm.runInContext(fs.readFileSync('dist/client/papipu-song.js','utf8'),data);
const song=JSON.parse(JSON.stringify(data.SONGS[0]));
assert.equal(song.id,'papipu-video');
assert.equal(song.originalSongId,'official-papipu');
assert.equal(song.videoReference,true);
assert.equal(song.bpm,160);
assert.deepEqual(song.charts.hard,reference.hard);
assert.deepEqual(song.charts.normal,reference.normal);
assert.ok(fs.existsSync('dist/client/'+song.cover));
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json','dist/client/'+song.file],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);
const duration=Number(JSON.parse(probe.stdout).format.duration);
assert.ok(Math.abs(duration-song.duration)<.08,'recording trim and chart clock must agree');
const light=difficulty.songNotes(song,'light');
assert.ok(light.length>70&&light.length<song.charts.normal.length);
assert.ok(song.charts.normal.length<song.charts.hard.length);
for(const [name,notes] of Object.entries({...song.charts,light})){
 const previous=new Map();
 for(const n of notes){
  assert.ok(Number.isFinite(n.t)&&Number.isFinite(n.end)&&0<n.t&&n.t<=n.end&&n.end<duration);
  assert.ok(['tap','hold','flick','ripple','stream'].includes(n.type));
  assert.ok(Number.isInteger(n.lane)&&n.lane>=0&&n.lane<(n.type==='ripple'?6:8));
  const key=(n.type==='ripple'?'r:':'b:')+n.lane;const before=n.type==='stream'?null:previous.get(key);
  if(before)assert.ok(n.t-before.end>=.049,`${name}: repeated or held key conflict at ${n.t}`);
  if(n.type!=='stream')previous.set(key,n);
  assert.ok(reference.evidence.some(source=>source.t===n.t),'simpler charts keep reference musical timings');
  const grid=(n.t+reference.trimStart-reference.gridPhaseInVideo)/(15/song.bpm);
  assert.ok(Math.abs(grid-Math.round(grid))<.001,'retain the measured sixteenth grid');
 }
}
const hard=song.charts.hard;
assert.ok(hard.filter(n=>n.type==='ripple').length>150,'retain the six-position passages');
assert.ok(hard.filter(n=>n.type==='hold').length>=35,'do not turn hold tails into taps');
for(const [videoTime,lanes] of [[74.25,[1,3,5,7]],[105.73,[0,2,4,6]]]){
 const t=Math.round((videoTime-reference.gridPhaseInVideo)/.09375)*.09375+reference.gridPhaseInVideo-reference.trimStart;
 const chord=hard.filter(n=>n.type==='hold'&&Math.abs(n.t-t)<.001);
 assert.deepEqual(chord.map(n=>n.lane).sort((a,b)=>a-b),lanes);
 assert.ok(chord.every(n=>n.end-n.t>1.1),'keep the sustained four-key phrase');
}
for(const n of song.charts.normal){
 const held=song.charts.normal.filter(h=>h.type==='hold'&&h.t<n.t&&h.end>n.t+.05);
 const chord=song.charts.normal.filter(h=>h.t===n.t);
 assert.ok(held.length+chord.length<=2,'NORMAL must account for already-held inputs');
}
assert.ok(reference.evidence.some(n=>n.origin==='adapted-route'));
assert.equal(reference.evidence.length,reference.streamSourcePoints.hard.length);
const before=JSON.stringify(song.charts),edited=[{t:2,end:2,lane:2,type:'tap'}];
assert.equal(difficulty.songNotes(song,'hard',{[song.id]:{hard:{notes:edited}}}),edited);
assert.equal(JSON.stringify(song.charts),before,'custom edits must not mutate built-in reference');
const html=fs.readFileSync('dist/client/index.html','utf8');
assert.ok(html.indexOf('papipu-song.js')<html.indexOf('src="game.js'));

// Reuse the existing DOM/audio harness, then exercise the actual game judgment
// loop through every source note and hold ending at three frame rates.
const editorTest=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=editorTest.slice(0,editorTest.indexOf('(async()=>{'))
 .replace("'songs.js','reference-visuals.js'","'songs.js','papipu-song.js','reference-visuals.js'");
assert.ok(harness.includes("'papipu-song.js'"));
const {run,el}=new Function('require',harness+'return {run,el};')(require);
for(const fps of [30,60,120]){
 run(`ac=new AudioContext();currentSong=SONGS.find(s=>s.id==='papipu-video');BPM=currentSong.bpm;beat=60/BPM;duration=currentSong.duration;chart('hard');gamePlayfield.render=()=>{};auto=true;hitSoundEnabled=false;startAt=0;mode='playing';lastBeat=-1;points=combo=maxCombo=0;life=65;counts={perfect:0,great:0,miss:0};`);
 for(let i=0;i<=Math.ceil((song.duration+.1)*fps);i++)run(`ac.currentTime=${i/fps};draw(${i/fps*1000})`);
 assert.equal(run('mode'),'result');
 assert.equal(run('counts.perfect'),hard.length);
 assert.equal(run('counts.miss'),0);
 assert.equal(run('maxCombo'),hard.length);
 assert.match(el('#overlay .panel').innerHTML,/100\.0%/);
}
console.log(`PASS パ→ピ→プ→Yeah! audio alignment, grid/key conflicts, sustained chords, difficulty reduction, custom overrides and full AUTO at 30/60/120 fps (${hard.length}/${song.charts.normal.length}/${light.length})`);
