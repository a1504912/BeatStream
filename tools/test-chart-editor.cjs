const vm=require('vm'),fs=require('fs'),assert=require('assert');const nodes=new Map(),store=new Map();let voices=0,arcs=[];const g=new Proxy({arc(...a){arcs.push(a)}},{get:(o,k)=>o[k]||(()=>{})});
function element(){return {style:{setProperty(){}},replaceChildren(...items){this.children=items},children:[],value:'normal',checked:false,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},blur(){},focus(){},setAttribute(){},showModal(){this.open=true},close(){this.open=false},getContext:()=>g,appendChild(b){b.parent=this;this.children.push(b)},remove(){this.parent.children=this.parent.children.filter(b=>b!==this)},querySelector(s){return el(s)},querySelectorAll(){return this.children}}}function el(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)}
const param=()=>({value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}});class AC{constructor(){this.sampleRate=48000;this.currentTime=5;this.state='running';this.destination={}}resume(){this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}createDynamicsCompressor(){return {threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}}}createGain(){return {gain:param(),connect(){},disconnect(){}}}createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){voices++},stop(){}}}createBuffer(c,n,sr){const samples=new Float32Array(n);return{length:n,sampleRate:sr,getChannelData:()=>samples}}createBufferSource(){return{playbackRate:param(),connect(){},disconnect(){},start(){voices++},stop(){}}}decodeAudioData(){return Promise.resolve({duration:180.245})}}
const native=require(process.env.BEATSTREAM_CANVAS_MODULE||'@napi-rs/canvas');const cv=native.createCanvas(1280,720);cv.addEventListener=()=>{};nodes.set('#game',cv);const ctx={document:{querySelector:el,querySelectorAll:s=>s==='#mapping-wheel .binding-key'?el('#mapping-wheel').children:[],createElement:element,addEventListener(){}},innerWidth:1280,innerHeight:720,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},performance:{now:()=>100},setTimeout,clearTimeout,Map,console,AudioContext:AC,AbortController,AbortSignal,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}),localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};ctx.cancelAnimationFrame=()=>{};ctx.window=ctx;ctx.confirm=()=>true;ctx.document.body=element();ctx.document.body.appendChild=()=>{};vm.createContext(ctx);for(const f of ['chart-difficulties.js','effects.js','symbol-sounds.js','settings.js','rhythm-charts.js','official-songs.js','catalog-player.js','songs.js','reference-visuals.js','note-rules.js','video-chart.js','game-menu.js','game.js'])vm.runInContext(fs.readFileSync('dist/client/'+f,'utf8'),ctx);const run=s=>vm.runInContext(s,ctx);function key(code){return{code,key:code.replace('Key','').toLowerCase(),target:{matches:()=>false},preventDefault(){},stopImmediatePropagation(){}}}


(async()=>{

 // Tutorial corrections: actual position/timing, hold lifecycle, and swipe entry.
 run(`ac=new AudioContext();startAt=ac.currentTime-1;mode='playing';auto=false;notes=[{t:1,end:1,lane:0,type:'tap'}];counts={perfect:0,great:0,miss:0};`);
 run('press(0,101,cx,cy)');assert.equal(run('notes[0].done'),undefined);run('release(101)');
 run('press(0,102,cx,cy-targetRadius())');assert.equal(run('counts.perfect'),1);run('release(102)');
 run(`notes=[{t:1,end:1,lane:2,type:'ripple'}];const rp=noteTarget(notes[0]);press(2,103,cx+targetRadius(),cy)`);assert.equal(run('notes[0].done'),undefined);run('release(103)');
 run('press(2,104,rp.x,rp.y)');assert.equal(run('notes[0].done'),true);run('release(104)');
 run(`notes=[{t:1,end:2,lane:6,type:'hold'}];press(6,'KeyA');ac.currentTime+=.5;release('KeyA')`);assert.equal(run('counts.miss'),1);
 run(`notes=[{t:clock(),end:clock()+1,lane:6,type:'hold'}];press(6,'KeyA');ac.currentTime+=1;draw(100)`);assert.equal(run('notes[0].done'),true);run("release('KeyA')");
 run(`notes=[{t:clock(),end:clock(),lane:2,type:'flick'}];const sp=noteTarget(notes[0]);press(2,105,sp.x-90,sp.y)`);assert.equal(run('notes[0].active'),undefined);
 run('moveGesture(105,sp.x+45,sp.y)');assert.equal(run('notes[0].done'),true);run('release(105)');
 run(`notes=[{t:clock(),end:clock(),lane:2,type:'flick'}];press(2,106,sp.x,sp.y);release(106)`);assert.equal(run('counts.miss'),2);
 run(`notes=[{t:clock(),end:clock(),lane:2,type:'flick'}];press(2,107,sp.x-90,sp.y+90);moveGesture(107,sp.x+45,sp.y+90)`);assert.equal(run('notes[0].done'),undefined);run('release(107)');
 run(`notes=[{t:clock()-.25,end:clock()-.25,lane:2,type:'flick'}];press(2,108,sp.x-90,sp.y);moveGesture(108,sp.x+45,sp.y)`);assert.equal(run('notes[0].done'),undefined);run('release(108)');
 run(`notes=[{t:4,lane:0,type:'tap'},{t:4,lane:4,type:'hold'},{t:2,lane:1,type:'flick'},{t:2,lane:3,type:'ripple'}];prepareNotes()`);assert.equal(run('notes[0].simultaneous'), '#19efff');assert.equal(run('notes[2].simultaneous'),'#ffe641');
 run(`life=69;notes=[{t:1,end:1,lane:0,type:'tap'}];counts={perfect:1,great:0,miss:0};finish()`);assert.match(el('#overlay .panel').innerHTML,/STAGE FAILED/);run('life=70;finish()');assert.match(el('#overlay .panel').innerHTML,/STAGE CLEAR/);
 // Separate recorded files, actual playback routing, and preserved custom choices.
 const requests=[],played=[],audioContext=new AC();audioContext.decodeAudioData=async(bytes)=>({signature:require('crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex')});
 audioContext.createBufferSource=()=>({connect(){},disconnect(){},start(){played.push(this.buffer.signature)}});ctx.recordingContext=audioContext;
 ctx.fetch=async(url)=>{requests.push(url);const bytes=fs.readFileSync('dist/client/'+url);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
 await run('loadSymbolPacks(recordingContext)');assert.equal(new Set(requests).size,5);
 run('ac=recordingContext;sfxGain=ac.createGain();symbolSounds=defaultSymbolSounds();');
 for(const kind of ['tap','holdStart','hold','ripple','flick'])run(`playSymbolSound('${kind}')`);assert.equal(new Set(played).size,5);
 run('symbolSounds.tap.enabled=false;playSymbolSound("tap")');assert.equal(played.length,5);
 await run('loadEffectPack(recordingContext,"tutorial-raw")');assert.equal(new Set(requests).size,10);

 // Three complete five-voice kits and cached loading.
 const beforeReload=requests.length;await run('loadSymbolPacks(recordingContext)');assert.equal(requests.length,beforeReload);
 for(const kit of ['pulse','heavy']){const buffers=await run(`loadEffectPack(recordingContext,'${kit}')`);assert.equal(Object.keys(buffers).length,5);assert.equal(new Set(Object.values(buffers).map(v=>v.signature)).size,5)}
 assert.equal(new Set(requests).size,20);
 const tutorialProfiles=run('defaultSymbolSounds()');for(const p of Object.values(tutorialProfiles))p.pack='tutorial';tutorialProfiles.holdStart.enabled=false;tutorialProfiles.ripple={pack:'wood',voice:'snare',volume:.4,enabled:true};
 store.set('beatstream-controls-v1',JSON.stringify({soundProfileRevision:3,soundPack:'tutorial',bindings:['KeyI','KeyO','KeyL','Period','Comma','KeyM','KeyJ','KeyU'],volume:.7,musicVolume:.38,timingOffset:25,symbolSounds:tutorialProfiles}));
 run('readControlSettings();readSymbolSounds()');assert.equal(run('symbolSounds.tap.pack'),'rhythm');assert.equal(run('symbolSounds.holdStart.enabled'),false);assert.equal(run('symbolSounds.ripple.pack'),'wood');assert.equal(run('symbolSounds.ripple.volume'),.4);assert.equal(run('hitVolume'),.8);assert.equal(run('musicVolume'),.38);assert.equal(run('timingOffsetMs'),25);assert.equal(run('bindingCodes[0]'),'KeyI');assert.equal(JSON.parse(store.get('beatstream-controls-v1')).soundProfileRevision,4);
 // An explicit older pack chosen AFTER upgrading stays selected on reload.
 const kept=JSON.parse(store.get('beatstream-controls-v1'));kept.symbolSounds.tap.pack='tutorial-raw';store.set('beatstream-controls-v1',JSON.stringify(kept));run('readSymbolSounds()');assert.equal(run('symbolSounds.tap.pack'),'tutorial-raw');
 // Recommended preset and rhythm audition route every role, including Long start.
 el('#symbol-recommended').onclick();assert.equal(el('#effect-pack').value,'rhythm');assert.equal(el('#hit-volume').value,80);assert.equal(run('draftSymbolSounds.flick.voice'),'hat');
 const audition=[];audioContext.createBufferSource=()=>({connect(){},disconnect(){},stop(){},start(at){audition.push({signature:this.buffer.signature,at})}});
 run('effectPreviewContext=recordingContext;previewEffectGain=effectPreviewContext.createGain();settingsOpen=true');el('#hit-sound-enabled').checked=true;
 await run('previewEffectPack()');assert.equal(audition.length,9);assert.equal(new Set(audition.map(a=>a.signature)).size,5);assert.ok(Math.abs(audition.at(-1).at-audition[0].at-1.8)<.0001);run('stopEffectPreview();settingsOpen=false;bindingCodes=[...DEFAULT_BINDINGS];timingOffsetMs=0;musicVolume=.5;');assert.equal(run('previewEffectSources.length'),0);
 console.log('PASS three percussion kits, cache, recorded-preset upgrade, custom pack/controls preservation and nine-hit audition');
 const previous=JSON.stringify({soundProfileRevision:2,symbolSounds:{tap:{pack:'arcade',voice:'snare',volume:.85,enabled:true},holdStart:{pack:'taiko',voice:'kick',volume:.9,enabled:true},hold:{pack:'chime',voice:'tom',volume:.65,enabled:true},ripple:{pack:'bubble',voice:'snare',volume:.85,enabled:true},flick:{pack:'reference',voice:'hat',volume:1,enabled:true}}});
 store.set('beatstream-controls-v1',previous);run('readSymbolSounds()');assert.equal(run('symbolSounds.tap.pack'),'rhythm');
 const customized=JSON.parse(previous);customized.symbolSounds.tap.volume=.4;store.set('beatstream-controls-v1',JSON.stringify(customized));run('readSymbolSounds()');assert.equal(run('symbolSounds.tap.pack'),'arcade');assert.equal(run('symbolSounds.tap.volume'),.4);
 store.delete('beatstream-controls-v1');run(`ac=new AudioContext();symbolSounds=defaultSymbolSounds();mode='idle';notes=[];fx=[];auto=false;points=combo=maxCombo=0;counts={perfect:0,great:0,miss:0};life=65;`);
 const sampleNotes=[{t:1.4,end:1.4,lane:0,type:'tap'},{t:1.4,end:1.4,lane:4,type:'tap'},{t:.8,end:2.2,lane:6,type:'hold'},{t:1.35,end:1.35,lane:2,type:'flick'},{t:1.25,end:1.25,lane:1,type:'ripple'}];ctx.sampleNotes=sampleNotes;
 run(`markSimultaneousNotes(sampleNotes);const sampleRenderer=createPlayfieldRenderer(g);sampleRenderer.render({geometry:playfieldGeometry(1280,720),time:1,now:1000,bpm:120,speed:1.7,energy:100,bindings:bindingCodes,notes:sampleNotes,preview:true});`);fs.writeFileSync('/tmp/tutorial-gameplay.png',cv.toBuffer('image/png'));
 run(`sampleRenderer.render({geometry:playfieldGeometry(1280,720),time:1.46,now:1460,bpm:120,speed:1.7,energy:100,bindings:bindingCodes,notes:sampleNotes,preview:true});`);fs.writeFileSync('/tmp/tutorial-effects.png',cv.toBuffer('image/png'));
 console.log('PASS tutorial tap/ripple locations, hold release/completion, directionless swipe entry, chord colors, 70% clear threshold, five recorded sounds, raw variants and preference migration');
 const api=new Map();ctx.fetch=async(url,opts)=>{if(opts?.method==='PUT'){const data=JSON.parse(opts.body);const p=url.split('/');const record={...data,id:p[3],difficulty:p[4]};api.set(url,record);return {ok:true,json:async()=>record}}return {ok:true,json:async()=>[...api.values()]}};
 const ec=native.createCanvas(800,532);ec.getBoundingClientRect=()=>({width:800,height:532,left:0,top:0});ec.setPointerCapture=()=>{};nodes.set('#ce-canvas',ec);
 const pc=native.createCanvas(960,540);pc.getBoundingClientRect=()=>({width:960,height:540,left:0,top:0});pc.focus=()=>{};nodes.set('#ce-preview',pc);el('#ce-preview-sound').checked=true;
 for(const [id,value] of Object.entries({'#difficulty':'hard','#ce-snap':'4','#ce-bpm':'162','#ce-offset':'0','#ce-brush':'tap','#ce-type':'tap','#ce-lane':'0'}))el(id).value=value;
 run(`getSongBuffer=async()=>({duration:90,getChannelData:()=>new Float32Array(48000)});currentSong={id:'editor-test',title:'Test',file:'audio/test.mp3',bpm:162,offset:0,charts:{hard:[{t:1,end:1,lane:0,type:'tap'}]}};SONGS.unshift(currentSong);`);
 const src=fs.readFileSync('dist/client/chart-editor.js','utf8').replace(/\}\)\(\);\s*$/, 'globalThis.editorTest={open,payload,save,close,formNote,add,checkConflicts,play,seek,stop,tick,render,regenerate,state:()=>({time:current(),playing:!!source,notes:previewNotes,regions:previewRegions,rate})};})();');
 run(src);await ctx.customChartsReady;await ctx.editorTest.open();assert.equal(ctx.chartEditorOpen,true);
 const state=ctx.editorTest.state;const gameBefore=run('JSON.stringify({w,h,cx,cy,R,scale,mode,notes,combo,points,counts})');
 assert.equal(state().regions.length,1);assert.equal(state().regions[0].index,0);
 ctx.editorTest.seek(.65);assert.ok(state().regions[0].y<228);
 fs.writeFileSync('/tmp/editor-preview-tap.png',pc.toBuffer('image/png'));
 ctx.document.activeElement=el('#ce-time');el('#ce-time').value='30';ctx.editorTest.render();ctx.editorTest.tick();assert.equal(el('#ce-time').value,'30','preview frames must not erase a seek position being typed');el('#ce-time').oninput({target:el('#ce-time')});assert.equal(state().time,30);ctx.document.activeElement=null;el('#ce-time').onchange({target:el('#ce-time')});assert.equal(state().time,30);
 ctx.editorTest.seek(1.1);assert.equal(state().regions.length,0);assert.equal(gameBefore,run('JSON.stringify({w,h,cx,cy,R,scale,mode,notes,combo,points,counts})'));
 el('#ce-note-time').value='2';el('#ce-note-end').value='3';el('#ce-type').value='hold';el('#ce-lane').value='2';ctx.editorTest.add(ctx.editorTest.formNote());assert.equal(ctx.editorTest.payload().notes.length,2);assert.equal(state().regions.at(-1).index,1);assert.equal(state().notes[1].active,undefined);
 const oldX=state().regions.at(-1).x;el('#ce-note-time').value='4';el('#ce-note-end').value='5';el('#ce-lane').value='6';el('#ce-apply').onclick();assert.ok(state().regions.at(-1).x<640);assert.notEqual(oldX,state().regions.at(-1).x);
 el('#ce-undo').onclick();assert.equal(ctx.editorTest.payload().notes[1].t,2);
 el('#ce-undo').onclick();assert.equal(ctx.editorTest.payload().notes.length,1);el('#ce-redo').onclick();assert.equal(ctx.editorTest.payload().notes.length,2);
 const sounds=[];ctx.playSymbolSound=type=>sounds.push(type);ctx.loadSymbolPacks=async()=>{};
 ctx.editorTest.seek(1.9);await ctx.editorTest.play();run('ac.currentTime+=.2');ctx.editorTest.tick();assert.equal(state().time,2.1);assert.deepEqual(sounds,['holdStart']);ctx.editorTest.tick();assert.deepEqual(sounds,['holdStart']);
 el('#ce-rate').value='.5';el('#ce-rate').onchange({target:el('#ce-rate')});await new Promise(resolve=>setImmediate(resolve));run('ac.currentTime+=.4');assert.ok(Math.abs(state().time-2.3)<.0001);
 ctx.editorTest.seek(4);ctx.editorTest.seek(6);await new Promise(resolve=>setImmediate(resolve));assert.equal(state().time,6);assert.equal(state().playing,true);ctx.editorTest.tick();assert.deepEqual(sounds,['holdStart']);
 ctx.editorTest.stop();ctx.editorTest.seek(2.5);fs.writeFileSync('/tmp/editor-preview-hold.png',pc.toBuffer('image/png'));assert.equal(state().notes[1].active,undefined);
 ctx.editorTest.add({t:3,end:3,lane:1,type:'flick',skin:'beat'});ctx.editorTest.add({t:3,end:3,lane:3,type:'ripple',skin:'touch'});ctx.editorTest.seek(2.5);assert.equal(state().notes[2].simultaneous,state().notes[3].simultaneous);assert.ok(state().notes[2].simultaneous);
 const region=state().regions.find(n=>n.index===3);pc.onpointerdown({button:0,clientX:region.x*960/1280,clientY:region.y*540/720,preventDefault(){}});assert.equal(el('#ce-type').value,'ripple');fs.writeFileSync('/tmp/editor-preview-all.png',pc.toBuffer('image/png'));
 el('#ce-delete').onclick();el('#ce-undo').onclick();assert.equal(state().notes.length,4);el('#ce-redo').onclick();assert.equal(state().notes.length,3);el('#ce-delete').onclick();
 // Remove the extra slash before the existing persistence checks.
 ctx.editorTest.seek(2.5);const slash=state().regions.find(n=>n.index===2);pc.onpointerdown({button:0,clientX:slash.x*960/1280,clientY:slash.y*540/720,preventDefault(){}});el('#ce-delete').onclick();assert.equal(state().notes.length,2);
 await ctx.editorTest.save();assert.equal(api.size,1);assert.equal(ctx.customCharts['editor-test'].hard.notes[1].end,3);
 ctx.editorTest.close(true);await ctx.editorTest.open();assert.equal(ctx.editorTest.payload().notes.length,2);
 assert.throws(()=>ctx.editorTest.checkConflicts([{t:1,end:3,lane:0,type:'hold'},{t:2,end:2,lane:0,type:'tap'}]));
 run(`chart(true)`);assert.equal(run('notes.length'),2);assert.equal(run('notes[1].end'),3);
 ctx.editorTest.close(true);ctx.editorTest.seek(0);
 run(`mode='playing';auto=true;startAt=ac.currentTime-2.5;draw(100)`);assert.equal(run('counts.perfect'),1);assert.equal(run('notes[1].active'),true);run('ac.currentTime+=.6;draw(200)');assert.equal(run('counts.perfect'),2);
 run(`mode='idle';currentSong={id:'legacy-preview',title:'Legacy',file:'audio/test.mp3',bpm:162,charts:{hard:[{t:1,end:1,lane:7,type:'tap',beatIndex:4}]}}`);await ctx.editorTest.open();assert.equal(ctx.chartEditorOpen,true);assert.equal(state().notes[0].type,'ripple');assert.equal(state().notes[0].lane,1);assert.equal(state().regions[0].x,1036.8);
 pc.getBoundingClientRect=()=>({width:340,height:191.25,left:0,top:0});ctx.editorTest.render();assert.equal(pc.width,340);assert.equal(pc.height,191);assert.equal(state().regions[0].x,1036.8);
 const pending=ctx.editorTest.play();ctx.editorTest.close(true);await pending;assert.equal(state().playing,false);
 fs.writeFileSync('/tmp/editor-timeline.png',ec.toBuffer('image/png'));console.log('PASS live preview, note editing, selection, seek, slow playback, sound crossings, state isolation, save/reload and live game judgments');
 // Speed buttons remain usable after a real start and inside the pause dialog.
 ctx.originalSpeedSong=run('currentSong');
 run(`mode='idle';speed=1.7;updateSpeedControls();soundPack='rhythm';symbolSounds=defaultSymbolSounds();$('#difficulty').value='normal';$('#auto').checked=false;currentSong={id:'speed-test',title:'Speed Test',file:'audio/test.mp3',bpm:120,charts:{normal:[{t:2,end:2,lane:0,type:'tap'},{t:4,end:5,lane:2,type:'hold'}]}};songBuffers.set(currentSong.id,{duration:20});`);
 await run('start()');assert.equal(run('mode'),'playing');
 for(const id of ['#plus','#minus','#menu-speed-plus','#menu-speed-minus'])assert.equal(el(id).disabled,false);
 run(`ac.currentTime=startAt+1;const originalSpeedRender=gamePlayfield.render;let speedRegions;gamePlayfield.render=frame=>(speedRegions=originalSpeedRender(frame));draw(100);`);
 const sourceBeforeSpeed=run('musicSource'),slowY=run('speedRegions[0].y');
 const speedState=()=>run('JSON.stringify({time:clock(),startAt,notes,points,combo,life,counts,playbackRate:musicSource.playbackRate.value})');
 const beforeSpeed=speedState();
 el('#plus').onclick();assert.equal(el('#speed').textContent,'1.8');assert.equal(el('#menu-speed').textContent,'1.8');
 run('draw(101)');assert.ok(run('speedRegions[0].y')<slowY);assert.equal(speedState(),beforeSpeed);assert.equal(run('musicSource'),sourceBeforeSpeed);
 el('#minus').onclick();assert.equal(el('#speed').textContent,'1.7');
 run('togglePause()');assert.equal(run('mode'),'paused');assert.equal(el('#game-menu').open,true);assert.equal(run('ac.state'),'suspended');
 el('#menu-speed-plus').onclick();assert.equal(el('#speed').textContent,'1.8');assert.equal(run('mode'),'paused');assert.equal(speedState(),beforeSpeed);
 for(let i=0;i<30&&!el('#menu-speed-plus').disabled;i++)el('#menu-speed-plus').onclick();
 assert.equal(run('speed'),3);assert.equal(el('#plus').disabled,true);assert.equal(el('#menu-speed-plus').disabled,true);assert.equal(el('#minus').disabled,false);assert.equal(el('#menu-speed-minus').disabled,false);
 el('#menu-speed-plus').onclick();assert.equal(run('speed'),3);
 for(let i=0;i<30&&!el('#menu-speed-minus').disabled;i++)el('#menu-speed-minus').onclick();
 assert.equal(run('speed'),.5);assert.equal(el('#speed').textContent,'0.5');assert.equal(el('#menu-speed').textContent,'0.5');assert.equal(el('#minus').disabled,true);assert.equal(el('#menu-speed-minus').disabled,true);assert.equal(el('#plus').disabled,false);assert.equal(el('#menu-speed-plus').disabled,false);
 el('#menu-speed-minus').onclick();assert.equal(run('speed'),.5);
 el('#game-menu-close').onclick();assert.equal(run('mode'),'playing');assert.equal(el('#game-menu').open,false);assert.equal(run('ac.state'),'running');assert.equal(speedState(),beforeSpeed);assert.equal(run('musicSource'),sourceBeforeSpeed);
 run('finish()');assert.equal(el('#minus').disabled,true);assert.equal(el('#plus').disabled,false);
 run('gamePlayfield.render=originalSpeedRender;mode="idle";currentSong=originalSpeedSong;speed=1.7;updateSpeedControls();');
 console.log('PASS live and paused note speed, immediate travel changes, synchronized controls, bounds and unchanged music/chart/score');

 // Entry navigation: keyboard/touch, modal isolation, returning, and practice launch.
 const entryKeys=[],entryClicks=[],entryTimers=new Map();let entryTimerId=0,entryFocus;
 ctx.addEventListener=(type,callback)=>{if(type==='keydown')entryKeys.push(callback)};
 ctx.document.addEventListener=(type,callback)=>{if(type==='click')entryClicks.push(callback)};
 const originalQuery=ctx.document.querySelector;
 ctx.document.querySelector=s=>s==='dialog[open]'?[el('#settings-dialog'),el('#rules-dialog'),el('#game-menu')].find(d=>d.open)||null:originalQuery(s);
 ctx.setTimeout=(callback,delay)=>{entryTimers.set(++entryTimerId,{callback,delay});return entryTimerId};ctx.clearTimeout=id=>entryTimers.delete(id);
 ctx.matchMedia=()=>({matches:false});
 run(fs.readFileSync('dist/client/rules-help.js','utf8'));nodes.set('#rules-dialog',run('rulesDialog'));
 const entryScreen=el('#title-screen'),entryStart=el('#title-start'),entryRules=el('#title-rules'),entrySettings=el('#title-settings');
 const entryNotes=['tap','ripple','hold','flick'].map(type=>({...element(),dataset:{titleNote:type}}));
 const entrySurfaces=[cv,el('#overlay'),el('header'),el('footer')],entryCabinet=el('#cabinet'),entryToast=el('#toast');
 entryScreen.id='title-screen';entryToast.id='toast';entryCabinet.children=[...entrySurfaces,entryScreen,entryToast];
 entryScreen.querySelectorAll=s=>s==='button'?[entryStart,entryRules,entrySettings]:s==='[data-title-note]'?entryNotes:[];
 const entryClasses=new Set();entryCabinet.classList={toggle:(name,on)=>on?entryClasses.add(name):entryClasses.delete(name)};
 for(const node of [...entrySurfaces,entryScreen]){node.attributes=new Map();node.setAttribute=(name,value)=>node.attributes.set(name,value);node.removeAttribute=name=>node.attributes.delete(name)}
 entryStart.focus=()=>entryFocus='title';el('.song-card[aria-pressed="true"]').focus=()=>entryFocus='song';
 const entrySong=run('currentSong'),entryPreferences=run('JSON.stringify({bindingCodes,soundPack,speed,selectedDifficulty,auto,songCategory})');
 run(fs.readFileSync('dist/client/title-screen.js','utf8'));
 assert.equal(ctx.beatstreamTitleOpen,true);assert.equal(entryClasses.has('title-active'),true);
 assert.ok(entrySurfaces.every(node=>node.inert&&node.attributes.get('aria-hidden')==='true'));
 assert.ok(entryNotes.every(node=>node.innerHTML.includes('<svg')));assert.notEqual(entryToast.inert,true);
 function titleKey(code,target){let prevented=false,stopped=false;const event={...key(code),target:target||{closest:()=>null,matches:()=>false},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}};for(const callback of entryKeys)callback(event);return {prevented,stopped}}
 run('openSettings()');titleKey('Enter');assert.equal(entryTimers.size,0);assert.equal(ctx.beatstreamTitleOpen,true);run('closeSettings()');
 entryClicks.forEach(callback=>callback({target:{closest:s=>s==='[data-open-rules]'?entryRules:null}}));
 assert.equal(el('#rules-dialog').open,true);titleKey('Space');assert.equal(entryTimers.size,0);run('closeRules()');
 titleKey('Space',{closest:()=>entryRules,matches:()=>false});assert.equal(entryTimers.size,0);
 const entryEvent=titleKey('Enter');assert.deepEqual(entryEvent,{prevented:true,stopped:true});assert.equal(entryTimers.size,1);
 entryStart.onclick();assert.equal(entryTimers.size,1);assert.equal(entryStart.disabled,true);
 const entryTimer=[...entryTimers.values()][0];assert.equal(entryTimer.delay,220);entryTimers.clear();entryTimer.callback();
 assert.equal(ctx.beatstreamTitleOpen,false);assert.equal(entryScreen.hidden,true);assert.equal(entryFocus,'song');
 assert.ok(entrySurfaces.every(node=>!node.inert&&!node.attributes.has('aria-hidden')));
 assert.equal(run('currentSong'),entrySong);assert.equal(run('JSON.stringify({bindingCodes,soundPack,speed,selectedDifficulty,auto,songCategory})'),entryPreferences);
 let previewStopped=0;run('previewSource={stop(){globalThis.entryPreviewStopped=true},disconnect(){}}');
 entryClicks.forEach(callback=>callback({target:{closest:s=>s==='[data-return-title]'?{}:null}}));
 assert.equal(ctx.entryPreviewStopped,true);assert.equal(ctx.beatstreamTitleOpen,true);assert.equal(entryScreen.hidden,false);assert.equal(entryFocus,'title');
 const titleGameKey=key('KeyW');titleGameKey.preventDefault=()=>previewStopped++;run('handleGameKeyDown')(titleGameKey);assert.equal(previewStopped,0);
 ctx.matchMedia=()=>({matches:true});entryStart.onclick();assert.equal([...entryTimers.values()][0].delay,0);
 ctx.dismissTitleScreen();assert.equal(entryTimers.size,0);ctx.showTitleScreen();
 // Tutorial's actual start bypasses the entrance and makes the playfield interactive.
 el('#rules-practice').onclick();
 for(let i=0;i<10&&run('mode')==='loading';i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('mode'),'playing');assert.equal(run('currentSong.rulesPractice'),true);
 assert.equal(ctx.beatstreamTitleOpen,false);assert.equal(entryScreen.hidden,true);assert.equal(el('#overlay').inert,false);
 assert.equal(el('#overlay').style.display,'none');assert.equal(el('#game-menu').open,false);
 console.log('PASS entry buttons/keyboard, modal and game-key isolation, reduced motion, return focus, preferences and tutorial launch');

 // LIGHT has its own editable cloud record and loads it for play.
 run(`mode='idle';currentSong={id:'light-editor',title:'LIGHT Test',file:'audio/test.mp3',bpm:120,duration:20,charts:{normal:Array.from({length:32},(_,i)=>({t:1+i*.25,end:1+i*.25,lane:i%8,type:'tap'}))}};SONGS.unshift(currentSong);getSongBuffer=async()=>({duration:20,getChannelData:()=>new Float32Array(48000)});$('#difficulty').value='light';`);
 await ctx.editorTest.open();assert.equal(ctx.editorTest.payload().difficulty,'light');assert.match(el('#ce-subtitle').textContent,/LIGHT/);assert.ok(ctx.editorTest.payload().notes.length<32);
 const lightBase=run('JSON.stringify(currentSong.charts.normal)');ctx.editorTest.add({t:12,end:12,lane:0,type:'tap',skin:'beat'});await ctx.editorTest.save();assert.ok(ctx.customCharts['light-editor'].light);assert.equal(run('JSON.stringify(currentSong.charts.normal)'),lightBase);ctx.editorTest.close();run(`chart('light')`);assert.equal(run('notes.length'),ctx.customCharts['light-editor'].light.notes.length);
 console.log('PASS LIGHT editor preview, independent save and custom chart playback');
 // Recompose a draft from the existing buffer, without any cloud write.
 run(`mode='idle';$('#difficulty').value='normal';`);await ctx.editorTest.open();const beforeCompose=JSON.stringify(ctx.editorTest.payload().notes),writes=api.size;
 const generated=[{t:2,end:2,lane:6,type:'tap'},{t:3,end:5,lane:2,type:'hold'}];ctx.analyzeSongRhythm=async()=>({bpm:120,offset:.15,charts:{normal:generated}});
 await ctx.editorTest.regenerate();assert.equal(ctx.editorTest.payload().notes.length,2);assert.equal(api.size,writes);assert.equal(run('JSON.stringify(currentSong.charts.normal)'),lightBase);el('#ce-undo').onclick();assert.equal(JSON.stringify(ctx.editorTest.payload().notes),beforeCompose);
 ctx.analyzeSongRhythm=async()=>{throw Error('simulated analysis failure')};await ctx.editorTest.regenerate();assert.equal(JSON.stringify(ctx.editorTest.payload().notes),beforeCompose);assert.match(el('#ce-status').textContent,/原譜保留/);
 ctx.analyzeSongRhythm=async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));const inFlight=ctx.editorTest.regenerate();assert.equal(el('#ce-regenerate').disabled,true);el('#ce-generation-cancel').onclick();await inFlight;assert.equal(JSON.stringify(ctx.editorTest.payload().notes),beforeCompose);assert.equal(el('#ce-regenerate').disabled,false);assert.equal(el('#ce-generation-cancel').hidden,true);assert.equal(api.size,writes);
 ctx.analyzeSongRhythm=async()=>({bpm:120,offset:.15,charts:{normal:generated}});await ctx.editorTest.regenerate();await ctx.editorTest.save();assert.equal(ctx.customCharts['light-editor'].normal.notes.length,2);assert.equal(ctx.customCharts['light-editor'].light.notes.length,run('BeatStreamDifficulty.songNotes(currentSong,"light",customCharts).length'));ctx.editorTest.close(true);
 console.log('PASS recompose draft/undo, failure/cancel preservation, unchanged originals and save only the selected difficulty');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
