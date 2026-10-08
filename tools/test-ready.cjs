const fs=require('node:fs'),assert=require('node:assert/strict');
const base=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=base.slice(0,base.indexOf('(async()=>{'));
const {run}=new Function('require',harness+'return {run};')(require);
run(`let readyFrame,readyRegions;const readyRenderer=gamePlayfield.render;
 gamePlayfield.render=frame=>{readyFrame=frame;return readyRegions=readyRenderer(frame)};`);

(async()=>{
 for(const speed of [.5,1.7,3])for(const offset of [-250,0,250]){
  run(`{mode='idle';ac=new AudioContext();ac.outputLatency=.08;speed=${speed};timingOffsetMs=${offset};
   const readyFactory=ac.createBufferSource.bind(ac);
   ac.createBufferSource=()=>{const source=readyFactory(),startSource=source.start.bind(source);source.start=(when,...args)=>{source.scheduledAt=when;return startSource(when,...args)};return source};
   currentSong={id:'ready-${speed}-${offset}',title:'Early notes',file:'audio/test.mp3',bpm:160,duration:3,charts:{hard:[
    {t:.03,end:.03,type:'tap',lane:0},{t:.03,end:.03,type:'flick',lane:2},
    {t:.03,end:.03,type:'ripple',lane:4},{t:.03,end:.405,type:'hold',lane:6},
    {t:.8,end:1.5,type:'stream',lane:5,path:streamPreset('left')}
   ]}};songBuffers.set(currentSong.id,{duration:3});$('#difficulty').value='hard';$('#auto').checked=true;}`);
  await run('start()');
  assert.equal(run('readyUntil-ac.currentTime'),1.5);
  assert.equal(run('musicSource.scheduledAt'),run('startAt'));
  assert.ok(run('startAt>readyUntil'),'music starts after READY');
  for(const elapsed of [0,.4,1.499]){
   run(`ac.currentTime=readyUntil-1.5+${elapsed};draw(100);auto=false;press(0,'KeyW');auto=true;`);
   assert.equal(run('readyFrame.ready'),true);
   assert.equal(run('readyRegions.length'),0,'no circles, squares, long ribbons or STREAM paths during READY');
   assert.equal(run('counts.perfect+counts.great+counts.miss'),0);
   assert.equal(run('held.size'),0,'READY ignores early inputs');
   assert.equal(run('lastBeat'),-1,'no synthesized beats during READY');
  }
  run('ac.currentTime=readyUntil-.5;togglePause();draw(101)');
  assert.equal(run('mode'),'paused');assert.equal(run('ac.state'),'suspended');
  assert.equal(run('readyFrame.ready'),true);assert.equal(run('readyRegions.length'),0);
  const scheduled=run('musicSource.scheduledAt');run('togglePause()');
  assert.equal(run('musicSource.scheduledAt'),scheduled,'pause preserves scheduled audio');
  run('ac.currentTime=readyUntil;draw(102)');
  assert.equal(run('readyFrame.ready'),false);
  assert.ok(Math.abs(run('clock()')+2.6/speed)<1e-9,'full approach begins after READY with latency and offset applied');
  run('ac.currentTime=readyUntil+.06;draw(103)');
  assert.ok(run('clock()')<0);assert.ok(run('readyRegions.length')>=4,'first notes approach before music zero');
  assert.equal(run('counts.perfect+counts.great+counts.miss'),0);
  run('ac.currentTime=startAt+ac.outputLatency+timingOffsetMs/1000+.031;draw(104)');
  assert.equal(run('counts.perfect'),3);assert.equal(run('counts.miss'),0);
  assert.equal(run('notes.find(n=>n.type==="hold").active'),true);
  run('ac.currentTime=startAt+ac.outputLatency+timingOffsetMs/1000+1.501;draw(105)');
  assert.equal(run('counts.perfect'),5);assert.equal(run('counts.miss'),0);
  assert.equal(run('points'),1000000);
 }
 console.log('PASS separate READY/approach/audio phases, all five symbols, early-input isolation, pause, three speeds, ±250 ms calibration and exact million-point AUTO');
})().catch(error=>{console.error(error);process.exitCode=1});
