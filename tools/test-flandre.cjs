const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const difficulty=require('../dist/client/chart-difficulties.js');
const reference=JSON.parse(fs.readFileSync('dist/client/flandre-chart.json','utf8'));
const review=JSON.parse(fs.readFileSync('tools/flandre/reviewed.json','utf8'));
const edit=JSON.parse(fs.readFileSync('tools/flandre/audio-edit.json','utf8'));
const data=vm.createContext({SONGS:[]});
vm.runInContext(fs.readFileSync('dist/client/flandre-song.js','utf8'),data);
const song=JSON.parse(JSON.stringify(data.SONGS[0]));
assert.equal(song.id,'flandre-video');assert.equal(song.videoReference,true);
assert.equal(song.file,'audio/flandre-clean.mp3');assert.equal(song.bpm,200);
assert.deepEqual(song.charts.hard,reference.hard);assert.deepEqual(song.charts.normal,reference.normal);
assert.ok(fs.existsSync('dist/client/'+song.cover));
const bytes=fs.readFileSync('dist/client/'+song.file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.playbackSHA256,'playback is the committed arcade edit');
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json','dist/client/'+song.file],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);const duration=Number(JSON.parse(probe.stdout).format.duration);
assert.ok(Math.abs(duration-song.duration)<.06,'MP3 duration '+duration);
// Arcade edit: three beat-aligned cuts of 8, 40 and 8 bars at 200 BPM.
const cuts=edit.segments.slice(1).map((s,i)=>s.sourceStart-(edit.segments[i].sourceStart+edit.segments[i].gameEnd-edit.segments[i].gameStart));
assert.deepEqual(cuts.map(c=>Math.round(c/1.2)),[8,40,8]);
for(const s of edit.segments)assert.ok(Math.abs(((s.gameStart-edit.beatPhaseSeconds)/.3)-Math.round((s.gameStart-edit.beatPhaseSeconds)/.3))<1e-6||s.gameStart===0);
const hard=song.charts.hard,light=difficulty.songNotes(song,'light');
assert.equal(hard.length,review.notes.length);assert.equal(reference.evidence.length,hard.length);
assert.ok(hard.length<=reference.cabinet.judgments&&hard.length>=reference.cabinet.judgments-6,'close to the 724 recorded judgments without padding');
assert.ok(light.length>60&&light.length<song.charts.normal.length);
assert.ok(song.charts.normal.length<hard.length*.65);
for(const n of hard){const k=(n.t-reference.gridPhase)/.075;assert.ok(Math.abs(k-Math.round(k))<1e-6,'sixteenth grid '+n.t)}
for(const [name,notes] of Object.entries({...song.charts,light})){
 const previous=new Map();let lastTime=-Infinity;
 for(const n of notes){
  assert.ok(Number.isFinite(n.t)&&Number.isFinite(n.end)&&0<n.t&&n.t<=n.end&&n.end<duration);
  assert.ok(['tap','hold','flick','ripple','stream'].includes(n.type));
  assert.ok(Number.isInteger(n.lane)&&n.lane>=0&&n.lane<(n.type==='ripple'?6:8));
  assert.ok(n.t>=lastTime);lastTime=n.t;
  const target=`${n.type==='ripple'?'ripple':'beat'}:${n.lane}`,before=previous.get(target);
  if(before)assert.ok(n.t-before.end>=.049,`${name}: physical-target conflict at ${n.t}`);
  previous.set(target,n);
  assert.ok(hard.some(source=>source.t===n.t),'reduced difficulties retain observed timings');
 }
}
const counts=hard.reduce((c,n)=>(c[n.type]=(c[n.type]||0)+1,c),{});
assert.equal(counts.stream,5);assert.ok(counts.hold>=30);assert.ok(counts.ripple>100);assert.ok(counts.flick>40);
assert.equal(new Set(hard.filter(n=>n.type==='ripple').map(n=>n.lane)).size,6);
for(const s of hard.filter(n=>n.type==='stream')){
 assert.ok(s.path.length>=2&&s.path.every(p=>p.x>=.04&&p.x<=.96&&p.y>=.08&&p.y<=.9));assert.ok(s.end-s.t>=.05);
}
// Final six-way hold: up, up-right, right, down, down-left and left together.
const finale=hard.filter(n=>n.type==='hold'&&Math.abs(n.t-125.9875)<1e-6);
assert.deepEqual(finale.map(n=>n.lane).sort(),[0,1,2,4,5,6]);assert.ok(finale.every(n=>Math.abs(n.end-131.3875)<1e-6));
for(const n of song.charts.normal){
 const held=song.charts.normal.filter(h=>h.end>h.t&&h.t<n.t&&h.end>n.t+.05);
 const chord=song.charts.normal.filter(h=>h.t===n.t);
 assert.ok(held.length+chord.length<=2,'NORMAL allows for already-held keys');
}
const before=JSON.stringify(song.charts),edited=[{t:2,end:2,lane:2,type:'tap'}];
assert.equal(difficulty.songNotes(song,'hard',{[song.id]:{hard:{notes:edited}}}),edited);
assert.equal(JSON.stringify(song.charts),before);
const html=fs.readFileSync('dist/client/index.html','utf8');
assert.ok(html.indexOf('flandre-song.js')<html.indexOf('src="game.js'));
const editorTest=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=editorTest.slice(0,editorTest.indexOf('(async()=>{'))
 .replace("'songs.js','reference-visuals.js'","'songs.js','flandre-song.js','reference-visuals.js'");
const {run,el}=new Function('require',harness+'return {run,el};')(require);
for(const [level,fps] of [['hard',30],['hard',60],['hard',120],['normal',60],['light',60]]){
 const expected=difficulty.songNotes(song,level).length;
 run(`ac=new AudioContext();currentSong=SONGS.find(s=>s.id==='flandre-video');BPM=currentSong.bpm;beat=60/BPM;duration=currentSong.duration;chart('${level}');gamePlayfield.render=()=>{};auto=true;hitSoundEnabled=false;startAt=0;mode='playing';lastBeat=-1;points=combo=maxCombo=0;life=65;counts={perfect:0,great:0,miss:0};`);
 for(let i=0;i<=Math.ceil((song.duration+.1)*fps);i++)run(`ac.currentTime=${i/fps};draw(${i/fps*1000})`);
 assert.equal(run('mode'),'result');assert.equal(run('counts.perfect'),expected);
 assert.equal(run('counts.miss'),0);assert.equal(run('maxCombo'),expected);
 assert.match(el('#overlay .panel').innerHTML,/100\.0%/);
}
console.log(`PASS 最終鬼畜妹フランドール・S arcade edit (8/40/8-bar cuts), sixteenth grid, ${counts.stream} STREAMs, six-way finale hold, physical-target conflicts, preserved cloud edits and complete AUTO at 30/60/120 fps (${hard.length}/${song.charts.normal.length}/${light.length})`);
