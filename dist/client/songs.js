'use strict';
const SONGS=[
 {"id":"asunoyozora","title":"アスノヨゾラ哨戒班","artist":"ゆある（翻唱）","bpm":185,"duration":180.2449,"offset":0.076,"file":"audio/asunoyozora-yuaru.mp3","color":"#6dbbff","tag":"JAPANESE VOCAL / COVER","description":"你指定的ゆある翻唱版。完整 3 分鐘，NORMAL 採疏拍練習，HARD 挑戰連續節奏。","seed":7,"uploaded":true,"version":"FULL VERSION","previewAt":46,charts:RHYTHM_CHARTS.asunoyozora},
 {id:'shining',title:'シャイニングスター',artist:'詩歩',bpm:158,duration:94.51,offset:.016,file:'audio/14_shining_star.mp3',color:'#00ffe1',tag:'JAPANESE VOCAL / ANIME POP',description:'明亮的女聲與輕快旋律。先從 NORMAL 找到節奏，再挑戰連擊。',source:'https://maou.audio/14_shining_star/',seed:1},
 {id:'halzion',title:'ハルジオン',artist:'KEI',bpm:152,duration:92.94,offset:.012,file:'audio/05_halzion.mp3',color:'#ff41bf',tag:'JAPANESE VOCAL / DANCE POP',description:'流暢的女聲與四拍律動，帶一點感傷的旋律。',source:'https://maou.audio/05_halzion/',seed:3},
 {id:'12345',title:'12345',artist:'Mary',bpm:195,duration:92.68,offset:.025,file:'audio/19_12345.mp3',color:'#ffe451',tag:'JAPANESE VOCAL / ROCK',description:'快節奏日文人聲曲。195 BPM，適合想挑戰手速的你。',source:'https://maou.audio/19_12345/',seed:5},
 {id:'neon',title:'NEON CIRCUIT',artist:'合成示範曲',bpm:140,duration:60,offset:0,file:null,color:'#ad8aff',tag:'SYNTH / PRACTICE',description:'原本的電子節奏練習曲，適合熟悉點擊、長按與滑動。',seed:0}
];
SONGS.push({id:'rules-practice',title:'符號操作練習',artist:'教學節拍',bpm:120,duration:42,offset:0,file:null,color:'#42f5e4',tag:'TUTORIAL',description:'依序練習：單點 → 長按 → 同時押 → 定點縮圈 → 滑切。可開啟 AUTO 先觀看。',rulesPractice:true});
SONGS.push(...OFFICIAL_SONGS);
SONGS.forEach(song=>{if(RHYTHM_CHARTS[song.id])song.charts=RHYTHM_CHARTS[song.id]});
const BEAT_OFFSETS={"asunoyozora": 0.063, "shining": 0.015, "halzion": 0.012, "12345": 0.025};
SONGS.forEach(song=>{if(BEAT_OFFSETS[song.id]!==undefined)song.offset=BEAT_OFFSETS[song.id]});
const sessionGrades=new Map();let songCategory='all';
let currentSong=SONGS[0],musicGain,musicSource,previewSource,previewToken=0,previewLoading=false,loadToken=0;
const songBuffers=new Map();
function timeLabel(seconds){return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0')}
async function getSongBuffer(song){
 if(songBuffers.has(song.id))return applyVideoChart(song,await songBuffers.get(song.id));
 if(!song.file){const buffer=buildPracticePreview();songBuffers.set(song.id,buffer);return buffer;}
 const task=(async()=>{const bytes=await getSongAudioBytes(song);return ac.decodeAudioData(bytes)})();
 songBuffers.set(song.id,task);
 try{return await applyVideoChart(song,await task)}catch(e){songBuffers.delete(song.id);throw e}
}
function stopMusic(){if(musicSource){try{musicSource.stop()}catch{}musicSource.disconnect();musicSource=null}}
function buildPracticePreview(){
 const seconds=16*60/140,sr=ac.sampleRate,buffer=ac.createBuffer(1,Math.ceil(seconds*sr),sr),data=buffer.getChannelData(0);
 for(let beat=0;beat<16;beat++){const root=[130.81,103.83,155.56,116.54][Math.floor(beat/4)],start=Math.floor(beat*60/140*sr);for(let i=0;i<sr*.32&&start+i<data.length;i++){const t=i/sr;data[start+i]+=.36*Math.sin(2*Math.PI*(48*t+110*(1-Math.exp(-t*40))/40))*Math.exp(-t*28)+.18*Math.sin(2*Math.PI*root*t)*Math.exp(-t*14)+.10*Math.sin(2*Math.PI*root*3*t)*Math.exp(-t*20)}}return buffer;
}
function updatePreviewButton(){const b=document.querySelector('#preview');if(!b)return;b.disabled=mode==='loading';b.textContent=previewLoading?'■ 取消載入':(previewSource||officialPreviewActive)?'■ 停止播放':'▶ 播放歌曲';}
function stopPreview(){stopOfficialPreview();previewToken++;previewLoading=false;if(previewSource){try{previewSource.stop()}catch{}previewSource.disconnect();previewSource=null}updatePreviewButton()}
async function previewSong(){
 if(mode==='loading')return;
 if(previewSource||previewLoading||officialPreviewActive){stopPreview();return}
 const song=currentSong;stopPreview();if(song.official&&!song.file){playOfficialPreview();return}const token=previewToken;previewLoading=true;updatePreviewButton();
 try{await initAudio();if(token!==previewToken)return;const buffer=await getSongBuffer(song);if(token!==previewToken||mode!=='idle'||settingsOpen)return;const source=ac.createBufferSource();source.buffer=buffer;source.connect(musicGain);source.loop=true;source.loopStart=song.file?Math.max(0,Math.min(song.previewAt??25,buffer.duration-15)):0;source.loopEnd=Math.min(buffer.duration,source.loopStart+15);previewSource=source;source.start(0,source.loopStart);source.onended=()=>{if(previewSource===source){previewSource=null;source.disconnect();updatePreviewButton()}};
 }catch{if(token===previewToken)showToast('歌曲載入失敗，請再點一次重試')}finally{if(token===previewToken){previewLoading=false;updatePreviewButton()}}
}
function selectSong(song){stopPreview();currentSong=song;if(isSumida(song)||song.videoReference){if(selectedDifficulty!=='light'){selectedDifficulty='hard';document.querySelector('#difficulty').value='hard'}describeVideoChart(song)}renderSongs();const details=document.querySelector('.arcade-bottom');if(details)details.scrollTop=0;void previewSong()}
function setBusy(busy){document.querySelectorAll('.song-card,[data-category],[data-difficulty],#preview,#start,#again,#difficulty,#auto,[data-import-media],[data-return-title]').forEach(b=>b.disabled=busy||(b.id==='start'&&!playableSong()));const status=document.querySelector('#load-status');if(status)status.textContent=busy?'正在載入音樂…':'';}
function songGroup(song){return song.official?'official':song.uploaded?'my':song.file?'maou':'practice'}
function levelFor(song,value){if(!playableSong(song))return '—';const level=BeatStreamDifficulty.normalize(value),count=BeatStreamDifficulty.songNotes(song,level,window.customCharts)?.length??(level==='light'?60:124);return Math.min(10,Math.max(1,Math.round(count/song.duration*(level==='hard'?2.2:2.8))))}
function escapeMusicText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderSongs(){
 const list=document.querySelector('#song-list');if(!list)return;
 const scrollTop=document.querySelector('.arcade-board')?.scrollTop||0;
 // Only cabinet-video references appear in selection. Keep archived songs and
 // restored cloud imports available internally without putting them back here.
 const level=BeatStreamDifficulty.normalize(document.querySelector('#difficulty')?.value);const visible=SONGS.filter(s=>s.videoReference===true);
 if(!visible.includes(currentSong))currentSong=visible[0]||SONGS[0];
 document.querySelector('.track-count').textContent=String(visible.length).padStart(2,'0')+' TRACKS';document.querySelector('#track-version').textContent=currentSong.version||(currentSong.file?'SHORT VERSION':'PRACTICE');
 document.querySelector('.music-credit').innerHTML=currentSong.videoReference?'你提供的實機影片音軌（含打擊聲） · 影像辨識參考譜':currentSong.official?'出典：KONAMI BeatStream 公式 · '+(currentSong.file?'自製練習譜':'官方 MV，尚未匯入音檔'):currentSong.customImport?'你匯入的'+(currentSong.sourceType==='video'?'影片音軌':'音樂')+' · 自動生成譜面 · 雲端已儲存':currentSong.uploaded?'ゆある翻唱版 · 你提供的音檔 · 自製譜面':currentSong.file?'音楽：<a href="https://maou.audio/" target="_blank" rel="noopener">魔王魂／森田交一</a> · CC BY 4.0 · 自製譜面':'合成練習曲 · 自製譜面';
 const jackets={asunoyozora:['夜空','ASUNOYOZORA'],shining:['STAR','SHINING STAR'],halzion:['ハル','HALZION'],12345:['12345','ONE TWO THREE'],neon:['NEON','CIRCUIT']};
 list.innerHTML=visible.map(s=>{const jacket=jackets[s.id]||(s.customImport?['♪','MY MUSIC']:['MV','BeatStream']),grade=sessionGrades.get(s.id+':'+level)||'—';return `<button class="song-card" data-song="${s.id}" aria-pressed="${s===currentSong}" style="--song-color:${s.color}"><span class="song-jacket jacket-${s.id}"><small>${jacket[1]}</small>${s.cover?`<img src="${s.cover}" alt="" loading="lazy">`:""}<strong>${jacket[0]}</strong><em>${escapeMusicText(s.artist)}</em></span><span class="card-information"><span class="card-category">${s.official?'KONAMI / OFFICIAL MV':songGroup(s)==='maou'?'MAOU DAMASHII':songGroup(s)==='my'?'MY MUSIC':'ORIGINAL'}</span><span class="card-caption">M U S I C　T I T L E</span><b class="card-title">${escapeMusicText(s.title)}</b><span class="card-caption">${s.official?'S O U R C E':'A R T I S T'}</span><span class="card-artist">${escapeMusicText(s.artist)}</span><span class="card-bottom"><span class="grade-block"><small>GRADE</small><strong>${grade}</strong><small>${s.bpm?s.bpm+' BPM':'官方 MV'}</small></span><span class="level-block"><small>LEVEL</small><strong>${levelFor(s,level)}</strong><em>${!playableSong(s)?'MV':BeatStreamDifficulty.label(level)}</em></span></span></span><span class="selected-triangles" aria-hidden="true">▲▼▲</span></button>`}).join('');
 list.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectSong(SONGS.find(s=>s.id===b.dataset.song))});
 document.querySelectorAll('[data-category]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.category===songCategory));b.onclick=()=>{stopPreview();songCategory=b.dataset.category;document.querySelector('.arcade-board').scrollTop=0;renderSongs();void previewSong()}});
 document.querySelectorAll('[data-difficulty]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.difficulty===level));b.onclick=()=>{document.querySelector('#difficulty').value=b.dataset.difficulty;selectedDifficulty=BeatStreamDifficulty.normalize(b.dataset.difficulty);renderSongs()}});
 document.querySelector('#track-title').textContent=currentSong.title;document.querySelector('#track-artist').textContent=currentSong.customImport?currentSong.artist:currentSong.videoReference?currentSong.artist:currentSong.official?'KONAMI 官方 MV':currentSong.uploaded?'Vocal: '+currentSong.artist:currentSong.file?'魔王魂 · Vocal: '+currentSong.artist:currentSong.artist;
 document.querySelector('#track-bpm').textContent=currentSong.bpm?(currentSong.official?'≈ ':'')+currentSong.bpm:'—';document.querySelector('#track-time').textContent=currentSong.duration?timeLabel(currentSong.duration):'尚未匯入';document.querySelector('#track-tag').textContent='SELECTED / '+currentSong.tag;describeVideoChart(currentSong);document.querySelector('#track-description').textContent=currentSong.description;
 const b=document.querySelector('#preview');b.onclick=previewSong;updatePreviewButton();document.querySelector('#load-status').textContent='';updateOfficialUI();const cover=document.querySelector('#selected-cover');if(cover){cover.innerHTML=currentSong.cover?`<img src="${currentSong.cover}" alt="">`:`<span>${jackets[currentSong.id]?.[0]||(currentSong.customImport?'♪':'MV')}</span>`;cover.style.setProperty('--song-color',currentSong.color)}const board=document.querySelector('.arcade-board');if(board)board.scrollTop=scrollTop;window.BeatStreamScores?.show(currentSong.id,level);
}
function showSongMenu(){
 window.dismissTitleScreen?.();
 closeGameMenu();
 loadToken++;importGeneration++;stopMusic();stopPreview();if(ac?.state==='suspended')ac.resume();mode='idle';held.clear();notes=[];fx=[];
 const panel=document.querySelector('#overlay .panel');panel.classList.add('song-panel');panel.innerHTML=initialPanel;document.querySelector('#overlay').style.display='grid';document.querySelector('#pause').disabled=true;document.querySelector('#pause').textContent='暫停';updateSpeedControls();
 document.querySelector('#difficulty').value=selectedDifficulty;document.querySelector('#auto').checked=auto;bindStart();
}
