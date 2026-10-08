'use strict';
(()=>{
 const dialog=document.createElement('dialog');dialog.id='media-import';dialog.setAttribute('aria-labelledby','mi-heading');
 dialog.innerHTML=`<div class="mi-heading"><div><small>MY MUSIC</small><h2 id="mi-heading">匯入音樂／影片</h2></div><button type="button" id="mi-close" aria-label="關閉匯入">×</button></div><p id="mi-target" class="mi-target" hidden></p><label class="mi-drop" id="mi-drop"><input type="file" id="mi-file" accept="audio/*,video/mp4,video/quicktime,video/webm,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.m4v,.webm"><span class="mi-file-icon" aria-hidden="true">＋</span><strong id="mi-file-name">選擇音樂或影片</strong><span>也可把檔案拖曳到這裡</span><small>音樂 100 MB／影片 250 MB 以內 · 5 秒–10 分鐘</small></label><div class="mi-fields"><label>歌曲名稱<input id="mi-title" type="text" maxlength="160" placeholder="自動使用檔名"></label><label>BPM（留空自動偵測）<input id="mi-bpm" type="number" min="20" max="400" step="0.5" inputmode="decimal" placeholder="自動"></label></div><fieldset class="mi-density"><legend>譜面密度</legend><div role="group" aria-label="譜面密度"><button type="button" data-mi-density="easy" aria-pressed="false">舒適</button><button type="button" data-mi-density="balanced" aria-pressed="true">標準</button><button type="button" data-mi-density="dense" aria-pressed="false">密集</button></div></fieldset><p class="mi-help">依樂句編排交替、重拍與長按。影片目前分析音軌；原版配置需匯入參考譜。</p><ol class="mi-steps" aria-label="匯入進度"><li>讀取音軌</li><li>分析節奏</li><li>生成譜面</li><li>儲存雲端</li></ol><progress id="mi-progress" max="100" value="0" aria-label="匯入進度"></progress><p id="mi-status" role="status" aria-live="polite">上傳後會新增歌曲與 LIGHT／NORMAL／BEAST 三份譜面。</p><button type="button" id="mi-resume" hidden>繼續擷取影片音軌</button><div id="mi-result" hidden><div class="mi-summary"><div><b id="mi-result-bpm"></b><span>BPM</span></div><div><b id="mi-result-light"></b><span>LIGHT 音符</span></div><div><b id="mi-result-normal"></b><span>NORMAL 音符</span></div><div><b id="mi-result-hard"></b><span>BEAST 音符</span></div></div><p id="mi-result-note"></p><div class="mi-result-actions"><button type="button" id="mi-play">開始遊玩</button><button type="button" id="mi-editor" data-edit-chart>預覽／編輯譜面</button></div></div><div class="mi-actions"><button type="button" id="mi-cancel">取消</button><button type="button" id="mi-generate" disabled>生成並存入曲庫</button></div>`;
 document.body.appendChild(dialog);const $=selector=>dialog.querySelector(selector);
 let file=null,target=null,pending=null,saved=null,density='balanced',controller=null,busy=false,saving=false,draftId=null;
 const sleep=()=>new Promise(resolve=>setTimeout(resolve,0));
 function progress(stage,value,message){$('#mi-progress').value=value;$('#mi-status').textContent=message;dialog.querySelectorAll('.mi-steps li').forEach((node,i)=>{node.classList.toggle('is-complete',i<stage);node.classList.toggle('is-current',i===stage)})}
 function lock(value){busy=value;$('#mi-file').disabled=value;$('#mi-title').disabled=value||!!saved||!!target;$('#mi-bpm').disabled=value||!!saved;dialog.querySelectorAll('[data-mi-density]').forEach(b=>b.disabled=value||!!saved);$('#mi-generate').disabled=value||!file||!!saved;$('#mi-close').disabled=saving;$('#mi-cancel').disabled=saving;dialog.classList.toggle('mi-busy',value);$('#mi-cancel').textContent=value?'停止處理':saved?'完成':'取消'}
 function resetResult(){pending=saved=null;$('#mi-result').hidden=true;$('#mi-generate').hidden=false;$('#mi-generate').textContent='生成並存入曲庫';$('#mi-resume').hidden=true;progress(-1,0,'上傳後會新增歌曲與 LIGHT／NORMAL／BEAST 三份譜面。')}
 function choose(incoming){try{BeatStreamMedia.validateFile(incoming);file=incoming;draftId=target?.id||'my-'+crypto.randomUUID();resetResult();$('#mi-file-name').textContent=file.name;$('#mi-title').value=target?.title||file.name.replace(/\.[^.]+$/,'');$('#mi-generate').disabled=false;$('#mi-status').textContent=(BeatStreamMedia.isVideo(file)?'影片':'音樂')+'已選擇，按「生成並存入曲庫」即可建立譜面。'}catch(e){file=null;resetResult();$('#mi-file-name').textContent='請重新選擇檔案';$('#mi-generate').disabled=true;$('#mi-status').textContent=e.message}lock(false)}
 function close(){if(saving)return;if(busy){controller?.abort();$('#mi-status').textContent='正在停止處理…';return}dialog.close();window.mediaImportOpen=false;file=pending=saved=null;target=null;controller=null}
 function runAnalysis(data,options,signal,onProgress=()=>{}){
  return new Promise((resolve,reject)=>{
   const worker=new Worker('rhythm-generator.js?v=phrases3');let done=false;
   const finish=(error,result)=>{if(done)return;done=true;worker.terminate();signal.removeEventListener('abort',cancel);error?reject(error):resolve(result)},cancel=()=>finish(signal.reason||new DOMException('已取消','AbortError'));
   worker.onmessage=e=>{if(done)return;if(e.data.type==='progress')onProgress(e.data.progress,e.data.message);else if(e.data.type==='result')finish(null,e.data.result);else if(e.data.type==='error')finish(Error(e.data.error))};worker.onerror=()=>finish(Error('節奏分析未能完成，請重試'));signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return}
   worker.postMessage({...data,options:{...options,duration:data.duration}},[data.samples.buffer]);
  });
 }
 window.analyzeSongRhythm=async(buffer,{bpm,density='balanced',signal=new AbortController().signal,onProgress=()=>{}}={})=>{
  signal.throwIfAborted();onProgress(.02,'讀取已有音軌…');const data=await BeatStreamMedia.analysisSamples(buffer,signal);signal.throwIfAborted();
  const result=await runAnalysis(data,{bpm,density},signal,onProgress);
  result.charts.light=BeatStreamDifficulty.simplify(result.charts.normal,result.bpm);return result;
 };
 function requestPlayback(play,signal){
  $('#mi-resume').hidden=false;$('#mi-status').textContent='瀏覽器需要你按一次播放，才能繼續擷取音軌。';
  return new Promise((resolve,reject)=>{const cancel=()=>{$('#mi-resume').hidden=true;reject(signal.reason)};signal.addEventListener('abort',cancel,{once:true});$('#mi-resume').onclick=async()=>{try{await ac.resume();await play();signal.removeEventListener('abort',cancel);$('#mi-resume').hidden=true;resolve()}catch{$('#mi-status').textContent='影片無法播放，請重試或換另一個檔案。'}}});
 }
 async function generate(){
  if(busy||!file||saved)return;const raw=$('#mi-bpm').value.trim(),bpm=raw?Number(raw):undefined;
  if(raw&&(!Number.isFinite(bpm)||bpm<20||bpm>400)){progress(-1,0,'BPM 請填 20–400，或留空自動偵測。');return}
  const title=$('#mi-title').value.trim()||file.name.replace(/\.[^.]+$/,'');controller=new AbortController();const signal=controller.signal;stopPreview();stopMusic();mode='loading';setBusy(true);lock(true);
  try{
   await initAudio();await musicRestoreReady;signal.throwIfAborted();
   if(!pending){
    progress(0,2,'正在讀取音軌…');await sleep();const decoded=await BeatStreamMedia.decodeMediaFile(file,ac,{signal,onProgress:(p,message)=>progress(0,2+p*28,message),onPlaybackRequired:play=>requestPlayback(play,signal)});
    signal.throwIfAborted();progress(1,32,'正在準備節奏分析…');const result=await window.analyzeSongRhythm(decoded.buffer,{bpm,density,signal,onProgress:(p,message)=>progress(p>.8?2:1,35+p*45,message)});signal.throwIfAborted();
    const song={...(target||{}),id:draftId,title,artist:target?.artist||'自訂匯入',file:'local:'+draftId,localName:file.name,customImport:!target,uploaded:!target||target.uploaded,sourceType:decoded.sourceType,color:target?.color||'#29efd6',tag:target?.tag||'MY MUSIC',version:target?.version||'AUTO CHART',duration:decoded.buffer.duration,bpm:result.bpm,offset:result.offset,charts:result.charts,analysis:result.analysis,savedImport:false,description:'已依'+(decoded.sourceType==='video'?'影片音軌':'音樂')+'生成 LIGHT／NORMAL／BEAST 譜面，可在編輯器調整。音樂與譜面已儲存至雲端。'};
    await applyVideoChart(song,decoded.buffer);signal.throwIfAborted();pending={song,audio:decoded.audio,buffer:decoded.buffer};
   }
   pending.song.title=title;saving=true;lock(true);progress(3,84,'正在將音樂與三份譜面存入雲端…');
   await saveImportedSong(pending.song,pending.audio,{signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])});
   const song=target||SONGS.find(s=>s.id===pending.song.id)||pending.song;Object.assign(song,pending.song);if(!SONGS.some(s=>s.id===song.id))SONGS.push(song);songBuffers.set(song.id,pending.buffer);currentSong=song;if(song.customImport)songCategory='my';$('#mi-result-bpm').textContent=song.bpm;$('#mi-result-light').textContent=song.charts.light.length;$('#mi-result-normal').textContent=song.charts.normal.length;$('#mi-result-hard').textContent=song.charts.hard.length;
   $('#mi-result-note').textContent=(song.analysis?.confidence==='low'?'這首音樂的拍點較不明確，建議先預覽；可在編輯器修正。':'譜面已依節奏生成，可直接試玩或調整配置。')+' 重新開啟網頁後會自動載入。';
   saved=song;pending=null;mode='idle';setBusy(false);renderSongs();progress(4,100,'已存入 '+(song.customImport?'MY MUSIC':'此曲')+'，音樂與三份譜面均已儲存。');$('#mi-result').hidden=false;$('#mi-generate').hidden=true;
  }catch(e){if(signal.aborted){progress(-1,0,'已停止處理。')}else{progress(-1,$('#mi-progress').value,'未完成：'+(e.name==='TimeoutError'?'儲存逾時，請重試。':e.message)+(pending?' 音軌與譜面已保留，按「重試儲存」即可繼續。':''));$('#mi-generate').textContent=pending?'重試儲存':'重新生成'}}
  finally{saving=false;mode='idle';setBusy(false);lock(false);if(signal.aborted)close()}
 }
 window.openMediaImport=({file:incoming,song,autoStart=false}={})=>{
  if(mode==='loading'||mode==='playing'||mode==='paused'||window.chartEditorOpen)return;stopPreview();closeGameMenu();target=song||null;file=pending=saved=null;draftId=null;density='balanced';$('#mi-title').value=target?.title||'';$('#mi-bpm').value='';$('#mi-file').value='';$('#mi-file-name').textContent='選擇音樂或影片';resetResult();$('#mi-target').hidden=!target;$('#mi-target').textContent=target?'匯入至：'+target.title+'。已編輯的自訂譜面會保留。':'';dialog.querySelectorAll('[data-mi-density]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.miDensity===density)));lock(false);dialog.showModal();window.mediaImportOpen=true;if(incoming){choose(incoming);if(autoStart)void generate()}
 };
 document.addEventListener('click',e=>{if(e.target.closest('[data-import-media]'))window.openMediaImport()});$('#mi-file').onchange=e=>{if(e.target.files?.[0])choose(e.target.files[0])};$('#mi-close').onclick=close;$('#mi-cancel').onclick=close;$('#mi-generate').onclick=()=>void generate();dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 for(const id of ['#mi-bpm','#mi-title'])$(id).oninput=()=>{if(saved)return;if(id==='#mi-bpm')pending=null;$('#mi-generate').textContent=pending?'重試儲存':'生成並存入曲庫'};
 dialog.querySelectorAll('[data-mi-density]').forEach(button=>button.onclick=()=>{density=button.dataset.miDensity;pending=null;$('#mi-generate').textContent='生成並存入曲庫';dialog.querySelectorAll('[data-mi-density]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))});
 $('#mi-play').onclick=()=>{if(!saved)return;document.querySelector('#auto').checked=false;auto=false;close();void start()};$('#mi-editor').onclick=()=>close();
 $('#mi-drop').addEventListener('dragover',e=>{e.preventDefault();if(!busy)$('#mi-drop').classList.add('is-dragging')});$('#mi-drop').addEventListener('dragleave',()=>$('#mi-drop').classList.remove('is-dragging'));$('#mi-drop').addEventListener('drop',e=>{e.preventDefault();$('#mi-drop').classList.remove('is-dragging');if(!busy&&e.dataTransfer.files?.[0])choose(e.dataTransfer.files[0])});
})();
