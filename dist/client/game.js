'use strict';
const $=s=>document.querySelector(s),canvas=$('#game'),g=canvas.getContext('2d');
let w=1280,h=720,cx=640,cy=360,R=110,scale=1,mode='idle',notes=[],fx=[],combo=0,maxCombo=0,points=0,life=65,counts={perfect:0,great:0,miss:0},speed=1.7,auto=false,muted=false,ac,master,audioBus,startAt=0,readyUntil=0,pauseAt=0,lastBeat=-1,held=new Map(),duration=60,raf=0,selectedDifficulty='normal';
let BPM=140,beat=60/BPM,scoreRun=null;
const keys=['w','e','d','c','x','z','a','q'],colors={tap:'#ff63c4',hold:'#ff63c4',flick:'#a6f879',ripple:'#82ff35',stream:'#b794ff'},angles=Array.from({length:8},(_,i)=>-Math.PI/2+i*Math.PI/4);
function resize(){const d=Math.min(devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect?.();const field=playfieldGeometry(rect?.width||innerWidth,rect?.height||innerHeight);({w,h,cx,cy,R,scale}=field);canvas.width=w*d;canvas.height=h*d;g.setTransform(d,0,0,d,0,0);document.querySelector('#combo').style.top=(cy-targetRadius()-Math.max(32,36*scale))+'px';document.querySelector('#combo strong').style.fontSize=Math.max(28,Math.min(w*.075,h*.11,80))+'px'}addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();
const gamePlayfield=createPlayfieldRenderer(g);
function clock(){return ac?ac.currentTime-startAt-(ac.outputLatency||0)-timingOffsetMs/1000:0}
function inReady(){return !!ac&&(mode==='playing'||mode==='paused')&&ac.currentTime<readyUntil}
function initAudio(){if(!ac){ac=new AudioContext({latencyHint:'interactive'});audioBus=ac.createDynamicsCompressor();audioBus.threshold.value=-2;audioBus.knee.value=0;audioBus.ratio.value=20;audioBus.attack.value=.003;audioBus.release.value=.08;audioBus.connect(ac.destination);master=ac.createGain();master.gain.value=muted?0:.22;master.connect(audioBus);musicGain=ac.createGain();musicGain.gain.value=muted?0:musicVolume;musicGain.connect(audioBus);initHitAudio()}return ac.resume()}
function tone(freq,t,len,type='sine',vol=.3){const o=ac.createOscillator(),v=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(vol,t+.005);v.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(v);v.connect(master);o.start(t);o.stop(t+len+.02)}
function scheduleBeat(i){if(currentSong.file)return;let t=startAt+i*beat;if(t<ac.currentTime-.02)return;const root=[130.81,103.83,155.56,116.54][Math.floor(i/16)%4];tone(110,t,.16,'sine',.8);const kick=ac.createOscillator(),gain=ac.createGain();kick.frequency.setValueAtTime(150,t);kick.frequency.exponentialRampToValueAtTime(35,t+.16);gain.gain.setValueAtTime(.8,t);gain.gain.exponentialRampToValueAtTime(.001,t+.2);kick.connect(gain);gain.connect(master);kick.start(t);kick.stop(t+.22);tone(root,t,.23,'triangle',.5);for(let j=0;j<2;j++){tone(5500,t+j*beat/2,.035,'square',.045);let arp=[1,1.5,2,1.25,2,1.5,2.5,1.5][(i*2+j)%8];tone(root*arp*2,t+j*beat/2,.13,'triangle',.2)}if(i%2)tone(180,t,.07,'sawtooth',.17)}
function chart(value){
 const level=BeatStreamDifficulty.normalize(value),hard=level==='hard';
 const source=BeatStreamDifficulty.songNotes(currentSong,level,window.customCharts);
 if(source){notes=source.map(n=>({...n,done:false,skin:n.skin||(n.type==='tap'&&n.beatIndex%8===4?'touch':'beat')}));prepareNotes();return}
 if(currentSong.rulesPractice){rulesPracticeChart();if(level==='light'){notes=BeatStreamDifficulty.simplify(notes,currentSong.bpm);prepareNotes()}return}
 notes=[];const seed=currentSong.seed||0,offset=currentSong.offset||0,lastLaneEnd=Array(8).fill(-1);
 for(let i=8;i*beat+offset<duration-2;i++){
  if(!hard&&i%4===3)continue;
  const motifs=[[6,2,7,1,6,2,5,3],[7,0,1,2,1,0,7,6],[6,5,4,3,2,3,4,5]],phrase=Math.floor(i/16),pattern=motifs[(phrase+seed)%3],lane=phrase%2?(8-pattern[i%8])%8:pattern[i%8],t=i*beat+offset;
  if(t<lastLaneEnd[lane]+.25)continue;
  const type=i%16===14?'hold':i%16===8?'flick':i%16===4?'ripple':'tap',end=t+(type==='hold'?beat*1.5:0);
  notes.push({lane:type==='ripple'?lane%6:lane,t,type,end,done:false});lastLaneEnd[lane]=end;
  const extraLane=(lane+3)%8,extraTime=t+beat/2;
  if(hard&&i%3===0&&extraTime>lastLaneEnd[extraLane]+.25){notes.push({lane:extraLane,t:extraTime,type:'tap',end:extraTime,done:false});lastLaneEnd[extraLane]=extraTime}
 }notes.sort((a,b)=>a.t-b.t);if(level==='light')notes=BeatStreamDifficulty.simplify(notes,currentSong.bpm);prepareNotes()
}
async function start(){
 if(typeof musicRestoreReady!=='undefined')await musicRestoreReady;
 if(mode==='playing'||mode==='loading')return;closeGameMenu();
 if(!playableSong()){showToast('請先匯入這首歌的音檔');return}
 window.dismissTitleScreen?.();
 if($('#difficulty'))selectedDifficulty=BeatStreamDifficulty.normalize($('#difficulty').value);auto=$('#auto')?.checked??auto;
 stopPreview();stopMusic();mode='loading';setBusy(true);const token=++loadToken;
 try{
  await window.customChartsReady;await initAudio();await Promise.all([loadEffectPack(ac,soundPack),loadSymbolPacks(ac)]);const buffer=currentSong.file?await getSongBuffer(currentSong):null;
  if(token!==loadToken)return;
  BPM=currentSong.bpm;beat=60/BPM;duration=buffer?buffer.duration:(currentSong.duration||60);chart(selectedDifficulty);if(!notes.length){mode='idle';setBusy(false);showToast('這份譜面沒有音符，請先在編輯器新增。');return}
  combo=maxCombo=points=0;life=65;counts={perfect:0,great:0,miss:0};scoreRun=window.BeatStreamScores?.begin(currentSong.id,selectedDifficulty,{auto,practice:!!currentSong.rulesPractice,noteCount:notes.length})||null;held.clear();fx=[];readyUntil=ac.currentTime+1.5;
  // READY ends before the approach window. Early notes get their full travel
  // time, while the original chart clock keeps audio/output-offset alignment.
  const compensation=(ac.outputLatency||0)+timingOffsetMs/1000;
  startAt=readyUntil+Math.max(2.6/speed,compensation+.05)-compensation;lastBeat=-1;
  if(buffer){musicSource=ac.createBufferSource();musicSource.buffer=buffer;musicSource.connect(musicGain);musicSource.start(startAt)}
  mode='playing';setBusy(false);$('#overlay').style.display='none';$('#pause').disabled=false;$('#pause').textContent='暫停';updateSpeedControls();
  $('#now-track').textContent=currentSong.title+' · '+BPM+' BPM · '+BeatStreamDifficulty.label(selectedDifficulty);$('#start')?.blur();$('#again')?.blur();updateHUD();
 }catch(e){if(token!==loadToken)return;mode='idle';setBusy(false);showToast('音樂載入失敗，請再試一次');const status=$('#load-status');if(status)status.textContent='無法載入音樂，請檢查連線後重試。';}
}
function calculateScore(){return notes.length?Math.min(1000000,Math.round(1000000*(counts.perfect*100+counts.great*65)/(notes.length*100))):0}
function updateHUD(){points=calculateScore();$('#score').textContent=String(points).padStart(7,'0');$('#combo strong').textContent=combo;$('#life').style.height=life+'%';$('#life').style.background=life>=70?'linear-gradient(#ffa2e3,#ff27bf)':'linear-gradient(#a2ffef,#00e6c8)'}
function judge(n,delta){if(n.done)return;n.done=true;hitFeedback(n.lane,n.type,n.type==='hold'?'tom':n.drum,n);const perfect=Math.abs(delta)<.055,label=perfect?'Fantastic':'Great';counts[perfect?'perfect':'great']++;combo++;maxCombo=Math.max(combo,maxCombo);life=Math.min(100,life+1);const pos=playfieldFeedbackTarget(n,{w,h,cx,cy,R,scale});fx.push({x:pos.x,y:pos.y,gesture:n.gesture,t:performance.now(),text:label,detail:Math.abs(delta)<.055?'JUST':(delta<0?'偏早 ':'偏晚 ')+Math.round(Math.abs(delta)*1000)+' ms',type:n.type,col:colors[n.type]});updateHUD()}
function miss(n){if(n.done)return;if(n.type==='stream'){n.streamMiss=true;breakStream(n)}n.done=true;counts.miss++;combo=0;life=Math.max(0,life-3);const pos=noteTarget(n);fx.push({x:pos.x,y:pos.y,t:performance.now(),text:'MISS',col:'#ff267d'});updateHUD()}
function press(lane,id,x=0,y=0){if(mode!=='playing'||inReady()||auto||held.has(id))return;const t=clock(),pointer=typeof id==='number';if(!pointer)pressStreamKey(lane,t);const n=notes.filter(n=>!n.done&&!n.active&&canPressStream(n,pointer)&&Math.abs(n.t-t)<(n.type==='stream'?.20:.15)&&(pointer?Math.hypot(noteTarget(n).x-x,noteTarget(n).y-y)<notePointerRadius(n):n.lane===lane)).sort((a,b)=>{const d=n=>pointer?Math.hypot(noteTarget(n).x-x,noteTarget(n).y-y):0;return d(a)-d(b)+(Math.abs(a.t-t)-Math.abs(b.t-t))*80})[0];held.set(id,{lane,x,y,lastX:x,lastY:y,n});if(!n)return;if(n.type==='stream'){pressStream(n,id,held.get(id),t,pointer)}else if(n.type==='hold'){n.active=true;n.delta=t-n.t;hitFeedback(n.lane,'holdStart',n.drum||'kick',n)}else if(n.type==='flick'&&pointer){n.active=true}else judge(n,t-n.t)}
function release(id){const p=held.get(id);if(p?.n&&!p.n.done){const n=p.n;if(n.type==='stream'&&typeof id==='number')miss(n);else if(n.type==='hold'){if(clock()>=n.end-.14)judge(n,n.delta);else miss(n)}else if(n.type==='flick')miss(n)}held.delete(id)}
function xy(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}function laneAt(x,y){let a=Math.atan2(y-cy,x-cx)+Math.PI/2;return(Math.round(a/(Math.PI/4))+8)%8}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);let p=xy(e);press(laneAt(p.x,p.y),e.pointerId,p.x,p.y)});canvas.addEventListener('pointermove',e=>{const p=xy(e);moveGesture(e.pointerId,p.x,p.y)});canvas.addEventListener('pointerup',e=>release(e.pointerId));canvas.addEventListener('pointercancel',e=>release(e.pointerId));canvas.addEventListener('lostpointercapture',e=>release(e.pointerId));addEventListener('keydown',handleGameKeyDown);addEventListener('keyup',e=>release(e.code||e.key.toLowerCase()));
function togglePause(){if(settingsOpen||document.querySelector('#rules-dialog')?.open)return;if(mode==='playing'){pauseAt=ac.currentTime;ac.suspend();mode='paused';$('#pause').textContent='繼續';openGameMenu()}else if(mode==='paused'){ac.resume();mode='playing';$('#pause').textContent='暫停';closeGameMenu()}}document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')togglePause()});
function showToast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>$('#toast').style.opacity=0,2200)}
function finish(){stopMusic();updateHUD();if(scoreRun&&mode==='playing'&&counts.perfect+counts.great+counts.miss===scoreRun.noteCount)void window.BeatStreamScores?.record(scoreRun,{score:points,maxCombo});mode='result';$('#overlay .panel').classList.remove('song-panel');$('#pause').disabled=true;updateSpeedControls();const accuracy=notes.length?(counts.perfect+counts.great*.65)/notes.length*100:0,cleared=life>=70;if(!auto)sessionGrades.set(currentSong.id+':'+selectedDifficulty,accuracy>95?'AAA':accuracy>85?'AA':accuracy>70?'A':'B');$('#overlay').style.display='grid';$('#overlay .panel').innerHTML=`<div class="eyebrow">${auto?'AUTO PLAY · DEMONSTRATION':cleared?'STAGE CLEAR':'STAGE FAILED'}</div><h1 style="color:${cleared?'#00ffdb':'#ff638f'}">${cleared?(accuracy>95?'AAA':accuracy>85?'AA':accuracy>70?'A':'B'):'FAILED'}</h1><p class="subtitle">${currentSong.title}</p><div class="slash"></div><div class="results"><div><b>${points.toLocaleString()}</b><span>SCORE</span></div><div><b>${maxCombo}</b><span>MAX COMBO</span></div><div><b>${accuracy.toFixed(1)}%</b><span>ACCURACY</span></div></div><p class="keys">ENERGY ${Math.round(life)}% · GOAL 70%</p><p class="keys">Fantastic ${counts.perfect}　 Great ${counts.great}　 Miss ${counts.miss}</p><button class="start" id="again">再玩一次 <span>▶</span></button><button class="start" id="menu" style="margin-top:14px;background:#192b35;color:#fff">回到選單</button>`;$('#again').onclick=start;$('#menu').onclick=showSongMenu}
const initialPanel=$('#overlay .panel').innerHTML;function bindStart(){$('#start').onclick=start;renderSongs();updateMappingLabels()}bindStart();$('#choose').onclick=showSongMenu;$('#pause').onclick=togglePause;$('#sound').onclick=()=>{if(officialPreviewActive)stopPreview();muted=!muted;if(master)master.gain.value=muted?0:.22;if(musicGain)musicGain.gain.value=muted?0:musicVolume;updateHitGain();$('#sound').textContent=muted?'聲音 OFF':'聲音 ON'};$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{showToast('這個瀏覽器不支援全螢幕')}};
const MIN_NOTE_SPEED=.5,MAX_NOTE_SPEED=3,NOTE_SPEED_STEP=.1;
function updateSpeedControls(){
 for(const selector of ['#speed','#menu-speed'])$(selector).textContent=speed.toFixed(1);
 for(const selector of ['#plus','#menu-speed-plus'])$(selector).disabled=speed>=MAX_NOTE_SPEED;
 for(const selector of ['#minus','#menu-speed-minus'])$(selector).disabled=speed<=MIN_NOTE_SPEED;
}
function changeSpeed(delta){speed=Math.max(MIN_NOTE_SPEED,Math.min(MAX_NOTE_SPEED,Math.round((speed+delta)*10)/10));updateSpeedControls()}
for(const selector of ['#plus','#menu-speed-plus'])$(selector).onclick=()=>changeSpeed(NOTE_SPEED_STEP);
for(const selector of ['#minus','#menu-speed-minus'])$(selector).onclick=()=>changeSpeed(-NOTE_SPEED_STEP);
updateSpeedControls();
function draw(now){
 if(window.beatstreamTitleOpen){raf=requestAnimationFrame(draw);return}
 const t=mode==='playing'||mode==='paused'?clock():now/1000,approach=2.6/speed,ready=inReady();
 if(mode==='playing'&&!ready)for(const n of notes){
  if(n.done||n.t-t>approach)continue;
  if(n.type==='stream'){updateStream(n,t);continue}
  if(auto&&t>=n.t&&n.type!=='hold'){judge(n,0);continue}
  if(auto&&n.type==='hold'&&t>=n.t&&!n.active){n.active=true;hitFeedback(n.lane,'holdStart',n.drum||'kick',n)}
  if(n.type==='hold'&&n.active&&t>=n.end){judge(n,n.delta||0);continue}
  if(!n.active&&n.t-t<-(['flick','stream'].includes(n.type)?.20:.15)){miss(n);continue}
  if(n.type==='flick'&&n.active&&n.t-t<-.20)miss(n);
 }
 let visual=notes;if(mode==='idle'||mode==='result')visual=Array.from({length:6},(_,i)=>({lane:(i*3)%8,t:t+.4+(i%3)*.45,end:t+1.2+(i%3)*.45,type:['tap','hold','flick'][i%3],done:false}));
 fx=fx.filter(f=>now-f.t<650);
 gamePlayfield.render({geometry:{w,h,cx,cy,R,scale},time:t,now,bpm:BPM,offset:currentSong.offset||0,energy:life,speed,bindings:bindingCodes,judgmentStyle,showArrivalHints,showKeyboardLabels,held,hitUntil:laneHitUntil,hitColors:laneHitColor,notes:visual,effects:fx,playing:mode==='playing'&&!ready,paused:mode==='paused',ready,readyTime:ready?ac.currentTime-readyUntil:0});
 if(mode==='playing'&&!ready){while((lastBeat+1)*beat<t+.12&&(lastBeat+1)*beat<duration){lastBeat++;scheduleBeat(lastBeat)}if(t>duration)finish()}
 raf=requestAnimationFrame(draw);
}requestAnimationFrame(draw);
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'read_game_status',description:'Read the current rhythm game state and score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({mode,score:points,combo,maxCombo,counts,autoPlay:auto,song:currentSong.title,bpm:BPM})})}catch{}}

initSettings();
