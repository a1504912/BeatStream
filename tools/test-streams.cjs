const fs=require('node:fs'),assert=require('node:assert/strict');
const base=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=base.slice(0,base.indexOf('(async()=>{')).replace("'songs.js','reference-visuals.js'","'songs.js','chernobog-song.js','papipu-song.js','amanojaku-song.js','reference-visuals.js'");
const {run}=new Function('require',harness+'return {run};')(require);
const path=side=>JSON.parse(run(`JSON.stringify(streamPreset('${side}'))`));
const route=(side='left',t=1,end=2)=>({lane:side==='left'?5:3,t,end,type:'stream',path:path(side)});
function reset(list){run(`ac=new AudioContext();ac.currentTime=1;startAt=0;mode='playing';auto=false;counts={perfect:0,great:0,miss:0};combo=maxCombo=points=0;life=65;held.clear();notes=${JSON.stringify(list)};fx=[];prepareNotes();`)}
function points(i=0){return JSON.parse(run(`JSON.stringify(playfieldStreamPoints(notes[${i}],{w,h,cx,cy,R,scale}))`))}
function press(i=0,id=101,delta=0){const p=points(i)[0];run(`ac.currentTime=notes[${i}].t+${delta};press(notes[${i}].lane,${id},${p.x},${p.y});`)}
function trace(i=0,id=101,delta=0){const ps=points(i),times=run(`({t:notes[${i}].t,end:notes[${i}].end})`);const lengths=ps.slice(1).map((p,j)=>Math.hypot(p.x-ps[j].x,p.y-ps[j].y)),total=lengths.reduce((a,b)=>a+b,0);let travelled=0;
 for(let j=1;j<ps.length;j++){const a=ps[j-1],b=ps[j];for(let k=1;k<=10;k++){const p=k/10,t=times.t+(times.end-times.t+Math.min(0,delta))*(travelled+lengths[j-1]*p)/total+(j===ps.length-1&&k===10?Math.max(0,delta):0);run(`ac.currentTime=${t};moveGesture(${id},${a.x+(b.x-a.x)*p},${a.y+(b.y-a.y)*p});`);if(j<ps.length-1)assert.equal(run('counts.perfect+counts.great'),0,'bends never award score');}travelled+=lengths[j-1]}
}
// A triangle starts a held path. Only the whole completed route scores once.
reset([route()]);press();assert.equal(run('notes[0].active'),true);assert.equal(run('points'),0);assert.equal(run('combo'),0);trace();run('release(101)');assert.equal(run('counts.perfect'),1);assert.equal(run('combo'),1);assert.equal(run('points'),1000000);assert.equal(run('fx.length'),1);assert.equal(run('fx[0].x'),points().at(-1).x);assert.equal(run('fx[0].y'),points().at(-1).y);run('judge(notes[0],0)');assert.equal(run('combo'),1);
reset([route()]);run('auto=true;ac.currentTime=1;draw(1000)');assert.equal(run('points'),0);run('ac.currentTime=1.5;draw(1500)');assert.equal(run('points'),0);run('ac.currentTime=2;draw(2000)');assert.equal(run('points'),1000000);
// Cannot start from the top, skip a bend, leave the rail, or release midway.
reset([route()]);const end=points().at(-1);run(`press(5,101,${end.x},${end.y});ac.currentTime=1.21;draw(1210)`);assert.equal(run('counts.miss'),1);
reset([route()]);press();run('release(101);ac.currentTime=2.3;draw(2300)');assert.equal(run('counts.miss'),1);assert.equal(run('points'),0);
reset([route()]);press();run(`ac.currentTime=2;moveGesture(101,${end.x},${end.y})`);assert.equal(run('counts.perfect'),0);assert.equal(run('counts.miss'),1,'shortcut cannot jump directly to endpoint');
reset([route()]);press();const first=points()[0];run(`moveGesture(101,${first.x+150},${first.y})`);assert.equal(run('counts.miss'),1);
reset([route()]);press();run(`ac.currentTime=2.21;draw(2210)`);assert.equal(run('counts.miss'),1,'stationary hold is not a slide');
// Worst of start/end timing chooses Fantastic or Great; not per-bend timing.
reset([route()]);press(0,101,.1);trace();assert.equal(run('counts.great'),1);assert.equal(run('points'),650000);
// Two pointers complete independent mirrored routes; another finger cannot steal.
reset([route('left'),route('right')]);press(0,201);press(1,202);
const a=points(0),b=points(1);for(let j=1;j<a.length;j++)for(let k=1;k<=10;k++){const p=k/10;run(`ac.currentTime=${1+(j-1+p)/4};moveGesture(201,${a[j-1].x+(a[j].x-a[j-1].x)*p},${a[j-1].y+(a[j].y-a[j-1].y)*p});moveGesture(202,${b[j-1].x+(b[j].x-b[j-1].x)*p},${b[j-1].y+(b[j].y-b[j-1].y)*p})`)}assert.equal(run('counts.perfect'),2);assert.equal(run('combo'),2);assert.equal(run('points'),1000000);
reset([route()]);press(0,201);run(`press(5,202,${first.x},${first.y});ac.currentTime=2;moveGesture(202,${end.x},${end.y})`);assert.equal(run('points'),0);assert.equal(run('!!notes[0].done'),false);
// Keyboard follows lane transitions and presses the finish key at the end.
reset([route()]);const steps=JSON.parse(run('JSON.stringify(streamKeyboardSteps(notes[0]))'));for(const step of steps)run(`ac.currentTime=${step.t};press(${step.lane},'key-${step.lane}');release('key-${step.lane}');`);assert.equal(run('counts.perfect'),1);assert.equal(run('points'),1000000);
// Early arrival may wait on the endpoint while still held, then scores at end.
reset([route()]);press();run('notes[0].end=3');trace(0,101,-.4);assert.equal(run('points'),0);run('ac.currentTime=3;draw(3000)');assert.equal(run('points'),1000000);
// Legacy cloud checkpoint groups migrate in memory, never rewrite their source.
const old=[5,6,7].map((lane,i)=>({lane,t:1+i*.3,end:1+i*.3,type:'stream',streamId:'old'}));const original=JSON.stringify(old);reset(old);assert.equal(run('notes.length'),1);assert.equal(run('notes[0].end'),1.6);assert.equal(JSON.stringify(old),original);
// Every direction and reversal follows the configured path, with one judgment.
const directionIds=JSON.parse(run('JSON.stringify(STREAM_DIRECTIONS.map(d=>d.id))'));
for(const direction of directionIds){
 const points=JSON.parse(run(`JSON.stringify(streamPreset('${direction}'))`));
 const n={t:1,end:2,lane:run(`streamStartLane(${JSON.stringify(points)})`),type:'stream',path:points};
 reset([n]);press();trace();assert.equal(run('counts.perfect'),1,direction);assert.equal(run('points'),1000000);
 const reversed={...n,path:[...points].reverse()};reversed.lane=run(`streamStartLane(${JSON.stringify(reversed.path)})`);
 reset([reversed]);press();trace();assert.equal(run('counts.perfect'),1,direction+' reversed');
 const field=run('playfieldGeometry(1280,720)'),ps=JSON.parse(run(`JSON.stringify(playfieldStreamPoints(notes[0],playfieldGeometry(1280,720)))`)),cursor=run('playfieldStreamCursor(notes[0],1.5,playfieldGeometry(1280,720))');
 assert.ok(Math.abs(cursor.x-(ps[0].x+ps.at(-1).x)/2)<.1);assert.ok(Math.abs(cursor.y-(ps[0].y+ps.at(-1).y)/2)<.1);
}
for(const custom of [
 [{x:.15,y:.2},{x:.65,y:.2},{x:.65,y:.7},{x:.3,y:.7},{x:.3,y:.35}],
 [{x:.2,y:.7},{x:.7,y:.7},{x:.7,y:.35},{x:.25,y:.35}],
 [{x:.2,y:.6},{x:.6,y:.6},{x:.2,y:.6}],
 [{x:.15,y:.2},{x:.75,y:.75},{x:.2,y:.75},{x:.7,y:.2}]
]){
 const n={t:1,end:2,lane:run(`streamStartLane(${JSON.stringify(custom)})`),type:'stream',path:custom};reset([n]);press();trace();assert.equal(run('counts.perfect'),1,'multiple turns / U-turn / crossing');
 for(const action of ['reverse','mirror-x','mirror-y']){const changed=run(`transformStreamPath(${JSON.stringify(custom)},'${action}')`);assert.equal(run(`validStreamPath(${JSON.stringify({...n,path:changed})})`),true);assert.equal(JSON.stringify(run(`transformStreamPath(${JSON.stringify(changed)},'${action}')`)),JSON.stringify(custom),'transform is reversible')}
}
// One count per actual restored phrase, source clock retained, LIGHT unchanged.
for(const [name,count,routes] of [['chernobog',598,6],['papipu',492,18],['amanojaku',468,6]]){
 const c=JSON.parse(fs.readFileSync(`dist/client/${name}-chart.json`));assert.equal(c.hard.length,count);assert.equal(c.hard.filter(n=>n.type==='stream').length,routes);run(`validateStreamGroups(${JSON.stringify(c.hard)});validateStreamGroups(${JSON.stringify(c.normal)})`);
 for(const n of c.hard.filter(n=>n.type==='stream')){assert.ok(c.evidence.some(e=>e.origin==='adapted-route'&&e.t===n.t));assert.ok(c.evidence.some(e=>e.origin==='adapted-route'&&e.t===n.end));reset([n]);press();trace();assert.equal(run('counts.perfect'),1,`${name} ${n.t}`)}
 run(`currentSong=SONGS.find(s=>s.id==='${name}-video');chart('light')`);assert.equal(run("notes.some(n=>n.type==='stream')"),false);
}
// First only the triangle; path unfolds later. Renderer stays pure at all sizes.
reset([route(),route('right')]);assert.equal(run('streamVisualPhase(notes[0],-.2,2.6/1.7).reveal'),0);assert.equal(run('streamVisualPhase(notes[0],.7,2.6/1.7).reveal'),1);
for(const [w,h] of [[1280,720],[390,844],[320,568],[844,390]]){const before=run('JSON.stringify(notes)');for(const t of [.25,.7,1.4,1.9]){const regions=run(`gamePlayfield.render({geometry:playfieldGeometry(${w},${h}),time:${t},now:${t*1000},bpm:120,energy:100,speed:1.7,bindings:bindingCodes,notes,preview:true,showKeyboardLabels:false})`);assert.equal(regions.length,2);for(const p of regions){assert.ok(p.x>0&&p.x<w);assert.ok(p.y>0&&p.y<h)}}assert.equal(run('JSON.stringify(notes)'),before)}
for(const n of [{...route(),end:1},{...route(),path:[{x:.2,y:.5}]},{...route(),path:[{x:.2,y:.5},{x:1.2,y:.2}]}])assert.throws(()=>run(`validateStreamGroups([${JSON.stringify(n)}])`),/2–32/);
console.log('PASS triangle-first arrow reveal, whole-path scoring, ordered continuous tracing, finish timing, early release, no shortcuts, keyboard, multi-touch, legacy migration, all real paths, responsive pure preview and exact million');
