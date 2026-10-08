'use strict';
let musicRestoreReady;
async function saveImportedSong(song,file,{signal}={}){
 if(!song.charts.light)song.charts.light=BeatStreamDifficulty.simplify(song.charts.normal,song.bpm);
 const form=new FormData();form.append('audio',file);form.append('metadata',JSON.stringify({kind:song.customImport?'custom':'official',title:song.title,artist:song.artist,sourceType:song.sourceType,localName:song.localName||file.name,duration:song.duration,bpm:song.bpm,offset:song.offset||0,analysis:song.analysis,charts:song.charts}));
 const response=await fetch('/api/music/'+encodeURIComponent(song.id),{method:'PUT',body:form,signal:signal||AbortSignal.timeout(120000)});if(!response.ok){let message;try{message=(await response.json()).error}catch{}throw Error(message||'儲存失敗，請重試')}const saved=await response.json();song.savedImport=true;song.audioRevision=saved.audioRevision;song.file='/api/music/'+encodeURIComponent(song.id)+'/audio';await cacheSongAudio(song,file);
}
async function restoreImportedSongs(){
 try{const response=await fetch('/api/music',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('載入失敗');const saved=await response.json();
  for(const record of saved){let song=SONGS.find(s=>s.id===record.id);const custom=record.kind==='custom'&&record.id.startsWith('my-');if(!song&&custom){song={id:record.id,title:record.title||record.localName,artist:record.artist||'自訂匯入',uploaded:true,customImport:true,color:'#29efd6',tag:'MY MUSIC',version:'AUTO CHART',seed:0};SONGS.push(song)}if(!song||(!custom&&!song.official)||song.file)continue;Object.assign(song,{file:'/api/music/'+encodeURIComponent(song.id)+'/audio',localName:record.localName,duration:record.duration,bpm:record.bpm,charts:record.charts,offset:record.offset||0,analysis:record.analysis,sourceType:record.sourceType||'audio',savedImport:true,audioRevision:record.audioKey?.split('/').pop(),description:custom?'已依'+(record.sourceType==='video'?'影片音軌':'音樂')+'生成 LIGHT／NORMAL／BEAST 譜面，可在編輯器調整。音樂與譜面已儲存至雲端。':'依匯入音檔產生的節奏練習譜，非官方譜面。音檔與譜面已儲存。'})}
  await Promise.all(SONGS.filter(s=>s.savedImport).map(async song=>{try{const cache=await caches.open(MUSIC_CACHE);song.audioCached=!!(await cache.match(audioCacheKey(song)))}catch{song.audioCached=false}}));if(mode==='idle')renderSongs();
 }catch{showToast('已儲存的音樂暫時無法載入，請重新整理再試；原有資料不會刪除。')}
}
const MUSIC_CACHE='beatstream-audio-v1';
function audioCacheKey(song){return new URL('/__audio-cache/'+encodeURIComponent(song.id)+'/'+encodeURIComponent(song.audioRevision),location.origin).href}
async function cacheSongAudio(song,bytes){
 if(!song.savedImport||!song.audioRevision)return false;
 try{const cache=await caches.open(MUSIC_CACHE);await cache.put(audioCacheKey(song),new Response(bytes));song.audioCached=true;return true}catch{song.audioCached=false;return false}
}
async function getSongAudioBytes(song){
 const eligible=song.savedImport&&song.audioRevision;
 if(eligible){try{const cache=await caches.open(MUSIC_CACHE),saved=await cache.match(audioCacheKey(song));if(saved){song.audioCached=true;return await saved.arrayBuffer()}}catch{}}
 const response=await fetch(song.file,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Audio unavailable');const bytes=await response.arrayBuffer();
 if(eligible){await cacheSongAudio(song,bytes);if(currentSong===song)updateOfficialUI()}
 return bytes;
}
musicRestoreReady=restoreImportedSongs();
