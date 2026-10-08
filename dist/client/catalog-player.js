'use strict';
let officialPreviewActive=false,importGeneration=0;
function playableSong(song=currentSong){return !song.official||!!song.file}
function stopOfficialPreview(){officialPreviewActive=false;const host=document.querySelector('#official-preview');if(host)host.replaceChildren()}
function playOfficialPreview(){if(muted){showToast('聲音目前關閉，請先開啟聲音');return}const song=currentSong,host=document.querySelector('#official-preview');if(!host)return;if(!song.youtube){showToast('此曲請由官方歌曲頁播放');return}const frame=document.createElement('iframe');frame.src='https://www.youtube.com/embed/'+encodeURIComponent(song.youtube)+'?autoplay=1&playsinline=1&rel=0';frame.title=song.title+' · 官方 MV';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;host.replaceChildren(frame);officialPreviewActive=true;updatePreviewButton()}
function updateOfficialUI(){
 const song=currentSong,tools=document.querySelector('#official-tools');if(!tools)return;tools.hidden=!song.official;
 const link=document.querySelector('#official-page');link.href=song.officialPage||'#';
 document.querySelector('#import-audio').disabled=mode==='loading';document.querySelector('#import-audio').onchange=importOfficialAudio;
 document.querySelector('#import-status').textContent='';
 document.querySelector('#start').disabled=mode==='loading'||!playableSong();document.querySelector('#start strong').textContent=playableSong()?'PLAY START':'請先匯入音檔';
}
function importOfficialAudio(e){
 const file=e.target.files?.[0];if(file&&currentSong.official&&mode!=='loading')window.openMediaImport({file,song:currentSong,autoStart:true});e.target.value='';
}
