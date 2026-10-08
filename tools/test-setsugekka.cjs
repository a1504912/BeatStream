const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const difficulty=require('../dist/client/chart-difficulties.js');
const reference=JSON.parse(fs.readFileSync('dist/client/setsugekka-chart.json','utf8'));
const data=vm.createContext({SONGS:[]});
vm.runInContext(fs.readFileSync('dist/client/setsugekka-song.js','utf8'),data);
const song=JSON.parse(JSON.stringify(data.SONGS[0]));
assert.equal(song.id,'setsugekka-video-r2');assert.equal(song.videoReference,true);
assert.equal(song.sourceRevision,2);assert.equal(reference.revision,2);
assert.equal(song.file,'audio/setsugekka-clean.mp3');assert.equal(song.bpm,160);
assert.deepEqual(song.charts.hard,reference.hard);assert.deepEqual(song.charts.normal,reference.normal);
assert.ok(fs.existsSync('dist/client/'+song.cover));
const bytes=fs.readFileSync('dist/client/'+song.file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.audioAlignment.sourceSHA256,'playback contains the unchanged clean MP3');
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json','dist/client/'+song.file],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);const duration=Number(JSON.parse(probe.stdout).format.duration);
assert.ok(Math.abs(duration-song.duration)<.01);
const fit=reference.audioAlignment;
assert.equal(fit.anchors.length,9);assert.ok(Math.abs(fit.sourceRate-1)<.0002);
for(const a of fit.anchors){assert.ok(a.correlation>.5);assert.ok(Math.abs(a.clean-(a.video*fit.sourceRate+fit.sourceOffset))<.002)}
assert.ok(Math.abs(reference.trimStart*fit.sourceRate+fit.sourceOffset)<1e-9);
assert.ok(Math.abs(reference.trimEnd*fit.sourceRate+fit.sourceOffset-duration)<1e-9);
const light=difficulty.songNotes(song,'light');
assert.ok(light.length>60&&light.length<song.charts.normal.length);
assert.ok(song.charts.normal.length<song.charts.hard.length*.65);
for(const [name,notes] of Object.entries({...song.charts,light})){
 const previous=new Map();let lastTime=-Infinity;
 for(const n of notes){
  assert.ok(Number.isFinite(n.t)&&Number.isFinite(n.end)&&0<n.t&&n.t<=n.end&&n.end<duration);
  assert.ok(['tap','hold','flick','ripple'].includes(n.type));
  assert.ok(Number.isInteger(n.lane)&&n.lane>=0&&n.lane<(n.type==='ripple'?6:8));
  assert.ok(n.t>=lastTime);lastTime=n.t;
  const target=`${n.type==='ripple'?'ripple':'beat'}:${n.lane}`,before=previous.get(target);
  if(before)assert.ok(n.t-before.end>=.049,`${name}: physical-target conflict at ${n.t}`);
  previous.set(target,n);
  assert.ok(song.charts.hard.some(source=>source.t===n.t),'reduced difficulties retain observed timings');
 }
}
const hard=song.charts.hard;
assert.equal(hard.filter(n=>n.type==='hold').length,52);
assert.ok(hard.some(n=>n.type==='hold'&&n.end-n.t>.74));
for(const hold of reference.reviewedHoldsInVideo){
 const t=hold.start*fit.sourceRate+fit.sourceOffset,end=hold.end*fit.sourceRate+fit.sourceOffset;
 for(const lane of hold.lanes)assert.ok(hard.some(n=>n.type==='hold'&&n.lane===lane&&Math.abs(n.t-t)<.035&&Math.abs(n.end-end)<.035),'keep each reviewed simultaneous hold and cap');
}
assert.ok(hard.filter(n=>n.type==='ripple').length>100);
assert.equal(new Set(hard.filter(n=>n.type==='ripple').map(n=>n.lane)).size,6);
assert.ok(hard.filter(n=>n.type==='flick').length>25);
assert.equal(reference.evidence.length,hard.length);
for(const n of song.charts.normal){
 const held=song.charts.normal.filter(h=>h.type==='hold'&&h.t<n.t&&h.end>n.t+.05);
 const chord=song.charts.normal.filter(h=>h.t===n.t);
 assert.ok(held.length+chord.length<=2,'NORMAL allows for already-held keys');
}
const before=JSON.stringify(song.charts),edited=[{t:2,end:2,lane:2,type:'tap'}];
assert.equal(difficulty.songNotes(song,'hard',{[song.id]:{hard:{notes:edited}}}),edited);
assert.deepEqual(difficulty.songNotes(song,'hard',{'setsugekka-video':{hard:{notes:edited}}}),song.charts.hard,'old cloud edition does not mask the rebuilt chart');
assert.equal(JSON.stringify(song.charts),before);
const html=fs.readFileSync('dist/client/index.html','utf8');
assert.ok(html.indexOf('setsugekka-song.js')<html.indexOf('src="game.js'));
assert.ok(html.includes('05 TRACKS'));
const editorTest=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=editorTest.slice(0,editorTest.indexOf('(async()=>{'))
 .replace("'songs.js','reference-visuals.js'","'songs.js','setsugekka-song.js','reference-visuals.js'");
const {run,el}=new Function('require',harness+'return {run,el};')(require);
for(const [level,fps] of [['hard',30],['hard',60],['hard',120],['normal',60],['light',60]]){
 const expected=difficulty.songNotes(song,level).length;
 run(`ac=new AudioContext();currentSong=SONGS.find(s=>s.id==='setsugekka-video-r2');BPM=currentSong.bpm;beat=60/BPM;duration=currentSong.duration;chart('${level}');gamePlayfield.render=()=>{};auto=true;hitSoundEnabled=false;startAt=0;mode='playing';lastBeat=-1;points=combo=maxCombo=0;life=65;counts={perfect:0,great:0,miss:0};`);
 for(let i=0;i<=Math.ceil((song.duration+.1)*fps);i++)run(`ac.currentTime=${i/fps};draw(${i/fps*1000})`);
 assert.equal(run('mode'),'result');assert.equal(run('counts.perfect'),expected);
 assert.equal(run('counts.miss'),0);assert.equal(run('maxCombo'),expected);
 assert.match(el('#overlay .panel').innerHTML,/100\.0%/);
}
console.log(`PASS 回レ！雪月花 revision 2, unchanged MP3, nine clock anchors, 52 reviewed holds, Ripple positions, physical-target conflicts, preserved cloud edits and complete AUTO at 30/60/120 fps (${hard.length}/${song.charts.normal.length}/${light.length})`);
