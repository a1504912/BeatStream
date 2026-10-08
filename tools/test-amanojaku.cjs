const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const difficulty=require('../dist/client/chart-difficulties.js');
const reference=JSON.parse(fs.readFileSync('dist/client/amanojaku-chart.json','utf8'));
const data=vm.createContext({SONGS:[]});
vm.runInContext(fs.readFileSync('dist/client/amanojaku-song.js','utf8'),data);
const song=JSON.parse(JSON.stringify(data.SONGS[0]));
assert.equal(song.id,'amanojaku-video');assert.equal(song.videoReference,true);
assert.equal(song.file,'audio/amanojaku-clean.mp3');assert.equal(song.bpm,200);
assert.deepEqual(song.charts.hard,reference.hard);assert.deepEqual(song.charts.normal,reference.normal);
assert.ok(fs.existsSync('dist/client/'+song.cover));
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json','dist/client/'+song.file],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);const duration=Number(JSON.parse(probe.stdout).format.duration);
assert.ok(Math.abs(duration-song.duration)<.08,'full clean audio edit and chart duration agree');
assert.equal(reference.audioAlignment.outputTrimStartInVideo,reference.trimStart);
assert.equal(reference.audioAlignment.outputDuration,song.duration);
assert.equal(reference.audioAlignment.segments.length,4);
for(const [i,s] of reference.audioAlignment.segments.entries()){
 assert.ok(s.sourceRate>.999&&s.sourceRate<1.001);
 assert.ok(s.videoStart*s.sourceRate+s.sourceOffset>=0);
 assert.ok(s.videoEnd*s.sourceRate+s.sourceOffset<reference.audioAlignment.sourceAudioDuration);
 if(i)assert.equal(s.videoStart,reference.audioAlignment.segments[i-1].videoEnd);
}
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
  assert.ok(reference.evidence.some(source=>source.t===n.t),'reduced difficulties retain observed timings');
 }
}
const hard=song.charts.hard;
assert.equal(hard.filter(n=>n.type==='hold').length,32);
assert.ok(hard.some(n=>n.type==='hold'&&n.end-n.t>1.3),'keep the sustained opening top hold');
for(const lanes of [[2,7],[1,6],[2,5],[0,5]]){
 assert.ok(hard.some(n=>n.type==='hold'&&hard.some(h=>h.type==='hold'&&h.t===n.t&&lanes.includes(n.lane)&&h.lane!==n.lane&&lanes.includes(h.lane))),'keep reviewed two-key hold phrases');
}
assert.equal(hard.filter(n=>n.type==='ripple').length,84);
assert.ok(new Set(hard.filter(n=>n.type==='ripple').map(n=>n.lane)).size===6);
assert.equal(reference.evidence.length,reference.streamSourcePoints.hard.length);
assert.ok(reference.evidence.some(n=>n.origin==='adapted-route'));
assert.ok(reference.evidence.some(n=>n.origin==='observed-head'));
for(const n of song.charts.normal){
 const held=song.charts.normal.filter(h=>h.type==='hold'&&h.t<n.t&&h.end>n.t+.05);
 const chord=song.charts.normal.filter(h=>h.t===n.t);
 assert.ok(held.length+chord.length<=2,'NORMAL accounts for already-held keys');
}
const before=JSON.stringify(song.charts),edited=[{t:2,end:2,lane:2,type:'tap'}];
assert.equal(difficulty.songNotes(song,'hard',{[song.id]:{hard:{notes:edited}}}),edited);
assert.equal(JSON.stringify(song.charts),before);
const html=fs.readFileSync('dist/client/index.html','utf8');
assert.ok(html.indexOf('amanojaku-song.js')<html.indexOf('src="game.js'));
assert.match(html,/class="track-count">\d{2} TRACKS/);
const editorTest=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=editorTest.slice(0,editorTest.indexOf('(async()=>{'))
 .replace("'songs.js','reference-visuals.js'","'songs.js','amanojaku-song.js','reference-visuals.js'");
const {run,el}=new Function('require',harness+'return {run,el};')(require);
for(const [level,fps] of [['hard',30],['hard',60],['hard',120],['normal',60],['light',60]]){
 const expected=difficulty.songNotes(song,level).length;
 run(`ac=new AudioContext();currentSong=SONGS.find(s=>s.id==='amanojaku-video');BPM=currentSong.bpm;beat=60/BPM;duration=currentSong.duration;chart('${level}');gamePlayfield.render=()=>{};auto=true;hitSoundEnabled=false;startAt=0;mode='playing';lastBeat=-1;points=combo=maxCombo=0;life=65;counts={perfect:0,great:0,miss:0};`);
 for(let i=0;i<=Math.ceil((song.duration+.1)*fps);i++)run(`ac.currentTime=${i/fps};draw(${i/fps*1000})`);
 assert.equal(run('mode'),'result');assert.equal(run('counts.perfect'),expected);
 assert.equal(run('counts.miss'),0);assert.equal(run('maxCombo'),expected);
 assert.match(el('#overlay .panel').innerHTML,/100\.0%/);
}
console.log(`PASS 天ノ弱 clean-audio duration, retained holds/Ripples/chords, key conflicts, custom overrides and complete AUTO at 30/60/120 fps (${hard.length}/${song.charts.normal.length}/${light.length})`);
