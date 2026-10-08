const assert=require('node:assert/strict'),fs=require('node:fs');
const files=['lostone-song.js','chernobog-song.js','papipu-song.js','amanojaku-song.js','setsugekka-song.js'];
const source=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=source.slice(0,source.indexOf('(async()=>{'))
 .replace("'songs.js','reference-visuals.js'",`'songs.js',${files.map(f=>JSON.stringify(f)).join(',')},'reference-visuals.js'`);
const {run,el}=new Function('require',harness+'return {run,el};')(require);
const songs=JSON.parse(run('JSON.stringify(SONGS.filter(s=>s.videoReference))'));
assert.equal(songs.length,5);
run('gamePlayfield.render=()=>{};hitSoundEnabled=false;');
function reset(){run(`mode='playing';auto=false;combo=maxCombo=points=0;life=65;counts={perfect:0,great:0,miss:0};held.clear();fx=[];`)}
// Complete actual game loops for every current song and difficulty, including
// chords and long-hold completions; check both HUD and the final result.
for(const song of songs)for(const level of ['light','normal','hard']){
 reset();
 run(`ac=new AudioContext();currentSong=SONGS.find(s=>s.id===${JSON.stringify(song.id)});BPM=currentSong.bpm;beat=60/BPM;duration=currentSong.duration;chart('${level}');auto=true;startAt=0;lastBeat=-1;`);
 const expected=run('notes.length');assert.ok(expected>0);
 for(let i=0;i<=Math.ceil((song.duration+.1)*30);i++)run(`ac.currentTime=${i/30};draw(${i/30*1000});`);
 assert.equal(run('mode'),'result');assert.equal(run('counts.perfect'),expected);assert.equal(run('counts.miss'),0);
 assert.equal(run('points'),1000000,`${song.title} ${level}: exact full score`);
 assert.equal(el('#score').textContent,'1000000');
 assert.match(el('#overlay .panel').innerHTML,/1,000,000/);
}
// Cloud/custom charts must use their actual count. Three equal shares cannot
// be rounded separately to 333333 each or the last point would be lost.
reset();run(`currentSong={id:'score-custom',title:'Custom',bpm:120,duration:8};window.customCharts={'score-custom':{hard:{notes:[{t:1,end:1,lane:0,type:'tap'},{t:2,end:2,lane:2,type:'ripple'},{t:3,end:3,lane:4,type:'flick'}]}}};chart('hard');`);
for(const [i,expected] of [[0,333333],[1,666667],[2,1000000]]){
 run(`judge(notes[${i}],0);`);assert.equal(run('points'),expected);
 run(`judge(notes[${i}],0);`);assert.equal(run('points'),expected,'repeat judgment adds nothing');
}
reset();run(`chart('hard');notes.forEach(n=>judge(n,.1));`);assert.equal(run('points'),650000,'all Great retains 65% weight');
reset();run(`chart('hard');judge(notes[0],0);judge(notes[1],.1);miss(notes[2]);`);assert.equal(run('points'),550000);
assert.equal(run('combo'),0);run('finish()');assert.match(el('#overlay .panel').innerHTML,/550,000/);
// Starting a long hold gives no score, completion scores once, and early
// release awards none. Round/square/Ripple behavior still uses one judgment.
reset();run(`ac=new AudioContext();startAt=4;notes=[{t:1,end:2,lane:2,type:'hold'},{t:3,end:4,lane:6,type:'hold'},{t:5,end:5,lane:0,type:'tap'},{t:6,end:6,lane:4,type:'flick'}];prepareNotes();press(2,'KeyD');`);
assert.equal(run('notes[0].active'),true);assert.equal(run('points'),0);
run(`ac.currentTime=6;release('KeyD');`);assert.equal(run('points'),250000);
run(`release('KeyD');judge(notes[0],0);`);assert.equal(run('points'),250000);
run(`ac.currentTime=7;press(6,'KeyA');ac.currentTime=7.1;release('KeyA');`);
assert.equal(run('points'),250000);assert.equal(run('counts.miss'),1);
run(`judge(notes[2],.1);judge(notes[3],0);`);assert.equal(run('points'),662500);
// All misses and empty charts show zero without NaN or accidental full marks.
reset();run(`chart('hard');notes.forEach(n=>miss(n));`);assert.equal(run('points'),0);
reset();run(`notes=[];updateHUD();finish();`);assert.equal(run('points'),0);
assert.equal(el('#score').textContent,'0000000');assert.doesNotMatch(el('#overlay .panel').innerHTML,/NaN|Infinity/);
// Starting the next game clears a completed million-point result.
(async()=>{
 run(`mode='result';points=1000000;counts={perfect:3,great:0,miss:0};currentSong={id:'score-restart',title:'Restart',bpm:120,duration:8,file:'audio/restart.mp3',charts:{hard:[{t:2,end:2,lane:0,type:'tap'}]}};songBuffers.set(currentSong.id,{duration:8});$('#difficulty').value='hard';$('#auto').checked=false;`);
 await run('start()');assert.equal(run('mode'),'playing');assert.equal(run('points'),0);
 assert.equal(el('#score').textContent,'0000000');assert.equal(run('counts.perfect'),0);
 console.log('PASS exact 1,000,000 across five songs × three difficulties, HUD/results, custom-chart rounding, Great/Miss weights, long holds, repeat judgments, zero/empty charts and restart');
})().catch(error=>{console.error(error);process.exitCode=1});
