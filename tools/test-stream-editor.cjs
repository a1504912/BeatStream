const fs=require('node:fs'),assert=require('node:assert/strict');
const original=fs.readFileSync('tools/test-chart-editor.cjs','utf8'),harness=original.slice(0,original.indexOf('(async()=>{'));
const {run,ctx,el,nodes,native}=new Function('require',harness+'return {run,ctx,el,nodes,native};')(require);
const api=new Map();ctx.fetch=async(url,opts)=>{if(opts?.method==='PUT'){const data=JSON.parse(opts.body),record={...data,id:url.split('/')[3]};api.set(url,record);return{ok:true,json:async()=>record}}return{ok:true,json:async()=>[...api.values()]}};
const timeline=native.createCanvas(800,532);timeline.getBoundingClientRect=()=>({width:800,height:532,left:0,top:0});timeline.setPointerCapture=()=>{};nodes.set('#ce-canvas',timeline);
const preview=native.createCanvas(960,540);preview.getBoundingClientRect=()=>({width:960,height:540,left:0,top:0});preview.focus=()=>{};preview.setPointerCapture=()=>{};nodes.set('#ce-preview',preview);
for(const [id,value] of Object.entries({'#difficulty':'hard','#ce-snap':'0','#ce-type':'stream','#ce-lane':'5','#ce-note-time':'1','#ce-note-end':'2','#ce-stream-shape':'left'}))el(id).value=value;
run(`mode='idle';getSongBuffer=async()=>({duration:20,getChannelData:()=>new Float32Array(48000)});currentSong={id:'stream-editor',title:'STREAM',file:'audio/test.mp3',bpm:120,charts:{hard:[{type:'stream',t:1,end:2,lane:5,path:streamPreset('left')}]}};SONGS.unshift(currentSong);`);
const src=fs.readFileSync('dist/client/chart-editor.js','utf8').replace(/\}\)\(\);\s*$/, 'globalThis.streamEditor={open,payload,save,close,seek,state:()=>({notes:previewNotes,regions:previewRegions})};})();');run(src);
function click(region){preview.onpointerdown({button:0,pointerId:9,clientX:region.x*.75,clientY:region.y*.75,preventDefault(){}})}
(async()=>{
 await ctx.customChartsReady;await ctx.streamEditor.open();ctx.streamEditor.seek(.8);click(ctx.streamEditor.state().regions.find(n=>n.index===0));
 assert.equal(el('#ce-type').value,'stream');assert.equal(el('#ce-stream-shape').value,'left');assert.equal(el('#ce-stream-field').hidden,false);assert.equal(el('#ce-note-end').disabled,false);assert.equal(el('#ce-copy').textContent,'複製整條路徑');
 const sourceChart=run('JSON.stringify(currentSong.charts)');el('#ce-next-stream').onclick();let data=ctx.streamEditor.payload();assert.equal(data.notes.length,1,'a bend is not another scored note');assert.equal(data.notes[0].path.length,6);
 const region=ctx.streamEditor.state().regions.find(r=>r.pointIndex===2);const oldPoint={...data.notes[0].path[2]};click(region);preview.onpointermove({clientX:(region.x+30)*.75,clientY:region.y*.75});preview.onpointerup();data=ctx.streamEditor.payload();assert.ok(data.notes[0].path[2].x>oldPoint.x);assert.equal(el('#ce-stream-shape').value,'custom');
 el('#ce-undo').onclick();assert.equal(ctx.streamEditor.payload().notes[0].path[2].x,oldPoint.x);el('#ce-redo').onclick();assert.ok(ctx.streamEditor.payload().notes[0].path[2].x>oldPoint.x);
 ctx.streamEditor.seek(.8);click(ctx.streamEditor.state().regions.find(n=>n.index===0&&n.pointIndex===undefined));el('#ce-copy').onclick();data=ctx.streamEditor.payload();assert.equal(data.notes.length,2);assert.equal(data.notes[1].end-data.notes[1].t,1);assert.deepEqual(JSON.parse(JSON.stringify(data.notes[1].path)),JSON.parse(JSON.stringify(data.notes[0].path)));
 // A copied whole path has an independent geometry array.
 const other=ctx.streamEditor.state().regions.find(r=>r.index===1&&r.pointIndex===2);if(other){click(other);preview.onpointermove({clientX:(other.x+20)*.75,clientY:other.y*.75});preview.onpointerup();assert.notEqual(ctx.streamEditor.payload().notes[0].path[2].x,ctx.streamEditor.payload().notes[1].path[2].x)}
 el('#ce-note-time').value='3';el('#ce-note-end').value='4.2';el('#ce-apply').onclick();data=ctx.streamEditor.payload();assert.equal(data.notes.at(-1).t,3);assert.equal(data.notes.at(-1).end,4.2);
 await ctx.streamEditor.save();assert.equal(api.size,1);assert.equal(ctx.customCharts['stream-editor'].hard.notes.length,2);assert.equal(ctx.customCharts['stream-editor'].hard.notes.at(-1).end,4.2);assert.equal(run('JSON.stringify(currentSong.charts)'),sourceChart);
 ctx.streamEditor.close(true);await ctx.streamEditor.open();assert.equal(ctx.streamEditor.payload().notes.length,2);assert.equal(ctx.streamEditor.payload().notes.at(-1).path.length,6);ctx.streamEditor.close(true);run('chart("hard")');assert.equal(run('streamStates.size'),2);assert.equal(run('notes.length'),2);
 // Eight-way controls update the real path immediately, preserve timing,
 // and keep undo, custom points, reverse/mirror and cloud loading consistent.
 await ctx.streamEditor.open();ctx.streamEditor.seek(.8);click(ctx.streamEditor.state().regions.find(n=>n.index===0));
 for(const direction of JSON.parse(run('JSON.stringify(STREAM_DIRECTIONS.map(d=>d.id))'))){
  el('#ce-direction-'+direction).onclick();const n=ctx.streamEditor.payload().notes[0];assert.equal(JSON.stringify(n.path),run(`JSON.stringify(streamPreset('${direction}'))`));assert.equal(n.t,1);assert.equal(n.end,2);
 }
 let before=JSON.parse(JSON.stringify(ctx.streamEditor.payload().notes[0]));el('#ce-stream-reverse').onclick();assert.equal(JSON.stringify(ctx.streamEditor.payload().notes[0].path),JSON.stringify([...before.path].reverse()));assert.equal(ctx.streamEditor.payload().notes[0].lane,run(`streamStartLane(${JSON.stringify([...before.path].reverse())})`));
 el('#ce-stream-mirror-x').onclick();el('#ce-stream-mirror-x').onclick();assert.equal(JSON.stringify(ctx.streamEditor.payload().notes[0].path),JSON.stringify([...before.path].reverse()));
 el('#ce-stream-point').onchange({target:{value:'2'}});el('#ce-point-x').value='51';el('#ce-point-y').value='67';el('#ce-point-apply').onclick();assert.equal(ctx.streamEditor.payload().notes[0].path[2].x,.51);assert.equal(ctx.streamEditor.payload().notes[0].path[2].y,.67);
 before=JSON.parse(JSON.stringify(ctx.streamEditor.payload().notes[0]));el('#ce-point-x').value='200';el('#ce-point-apply').onclick();assert.equal(JSON.stringify(ctx.streamEditor.payload().notes[0]),JSON.stringify(before),'invalid edits preserve path');
 el('#ce-next-stream').onclick();assert.equal(ctx.streamEditor.payload().notes[0].path.length,6);el('#ce-point-delete').onclick();assert.equal(ctx.streamEditor.payload().notes[0].path.length,5);
 el('#ce-stream-point').onchange({target:{value:'0'}});assert.equal(el('#ce-point-delete').disabled,true);el('#ce-stream-point').onchange({target:{value:'4'}});assert.equal(el('#ce-point-delete').disabled,true);
 await ctx.streamEditor.save();const routeSaved=JSON.stringify(ctx.streamEditor.payload().notes);ctx.streamEditor.close(true);await ctx.streamEditor.open();assert.equal(JSON.stringify(ctx.streamEditor.payload().notes),routeSaved);ctx.streamEditor.close(true);
 // Legacy cloud objects are converted only into an editing draft, not written.
 ctx.customCharts['stream-editor'].hard.notes=[5,6,7].map((lane,i)=>({lane,t:1+i*.3,end:1+i*.3,type:'stream',streamId:'legacy'}));const saved=JSON.stringify(ctx.customCharts['stream-editor']);await ctx.streamEditor.open();assert.equal(ctx.streamEditor.payload().notes.length,1);assert.equal(ctx.streamEditor.payload().notes[0].end,1.6);assert.equal(JSON.stringify(ctx.customCharts['stream-editor']),saved);ctx.streamEditor.close(true);
 console.log('PASS whole-path preview selection, draggable bends, one count, independent copy, duration editing, undo/redo, cloud reload, legacy draft conversion and source isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
