'use strict';
(() => {
 const screen=document.querySelector('#title-screen');
 if(!screen)return;
 const cabinet=document.querySelector('#cabinet'),startButton=document.querySelector('#title-start');
 const surfaces=[...cabinet.children].filter(node=>node!==screen&&node.id!=='toast');
 let titleOpen=true,entering=false,timer;
 const modalOpen=()=>settingsOpen||window.chartEditorOpen||window.mediaImportOpen||!!document.querySelector('dialog[open]');
 function setTitleOpen(open){
  titleOpen=open;window.beatstreamTitleOpen=open;cabinet.classList.toggle('title-active',open);
  for(const surface of surfaces){surface.inert=open;if(open)surface.setAttribute('aria-hidden','true');else surface.removeAttribute('aria-hidden')}
  screen.inert=!open;screen.setAttribute('aria-hidden',String(!open));
 }
 function dismissTitleScreen({focus=false}={}){
  clearTimeout(timer);entering=false;screen.classList.remove('is-entering');screen.hidden=true;
  setTitleOpen(false);startButton.disabled=false;
  screen.querySelectorAll('button').forEach(button=>button.disabled=false);
  if(focus)(document.querySelector('.song-card[aria-pressed="true"]')||document.querySelector('#start'))?.focus({preventScroll:true});
 }
 function enterSelection(){
  if(!titleOpen||entering||modalOpen())return;
  entering=true;screen.classList.add('is-entering');screen.inert=true;
  screen.querySelectorAll('button').forEach(button=>button.disabled=true);
  document.querySelector('#title-status').textContent='正在進入選歌…';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  timer=setTimeout(()=>dismissTitleScreen({focus:true}),reducedMotion?0:220);
 }
 function showTitleScreen(){
  if(mode!=='idle'||modalOpen())return;
  clearTimeout(timer);entering=false;closeGameMenu();stopPreview();
  screen.hidden=false;screen.classList.remove('is-entering');
  document.querySelector('#title-status').textContent='';
  screen.querySelectorAll('button').forEach(button=>button.disabled=false);
  setTitleOpen(true);startButton.focus({preventScroll:true});
 }
 window.dismissTitleScreen=dismissTitleScreen;
 window.showTitleScreen=showTitleScreen;
 startButton.onclick=enterSelection;
 document.addEventListener('click',event=>{if(event.target.closest('[data-return-title]'))showTitleScreen()});
 addEventListener('keydown',event=>{
  if(!titleOpen||entering||modalOpen()||event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
  const control=event.target.closest?.('button,a,input,select,textarea,[contenteditable="true"]');
  if(control&&control!==startButton)return;
  if(['Enter','NumpadEnter','Space'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();enterSelection()}
 },true);
 // Reuse the actual tutorial symbols so the entrance matches the playfield.
 const titleMark=screen.querySelector('[data-title-mark]');
 if(titleMark)titleMark.innerHTML=noteMarkSvg(160,160,66,'#f7f1ff','#130d20');
 screen.querySelectorAll('[data-title-note]').forEach(node=>node.innerHTML=ruleIcon(node.dataset.titleNote));
 setTitleOpen(true);
})();
