'use strict';
function closeGameMenu(){const dialog=document.querySelector('#game-menu');if(dialog.open)dialog.close();document.querySelector('#game-menu-toggle').setAttribute('aria-expanded','false')}
function openGameMenu(){
 if(mode==='loading'||settingsOpen||document.querySelector('#rules-dialog')?.open)return;
 if(mode==='playing'){togglePause();return}
 const dialog=document.querySelector('#game-menu');
 document.querySelector('#game-menu-track').textContent=currentSong.title;
 document.querySelector('#game-menu-title').textContent=mode==='paused'?'演奏暫停':'遊戲選單';
 document.querySelector('.game-menu-hint').hidden=mode!=='paused';
 if(!dialog.open)dialog.showModal();
 document.querySelector('#game-menu-toggle').setAttribute('aria-expanded','true');
 if(mode==='paused')document.querySelector('#pause').focus();
}
function resumeFromGameMenu(){closeGameMenu();if(mode==='paused')togglePause();document.querySelector('#game-menu-toggle').focus()}
document.querySelector('#game-menu-toggle').onclick=openGameMenu;
document.querySelector('#game-menu-close').onclick=resumeFromGameMenu;
document.querySelector('#game-menu').addEventListener('cancel',e=>{e.preventDefault();resumeFromGameMenu()});
document.querySelector('#game-menu').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)resumeFromGameMenu()}});
addEventListener('keydown',e=>{if(!document.querySelector('#game-menu').open)return;if(e.code==='Space'||e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();resumeFromGameMenu()}else if(!['Tab','Enter'].includes(e.key))e.stopImmediatePropagation()},true);
