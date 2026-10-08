'use strict';
(() => {
 const cache=new Map(),pending=new Map(),loads=new Map(),errors=new Map();
 let selected=null;
 const keyFor=(songId,difficulty)=>songId+':'+difficulty;
 const rank=records=>[...new Map(records.map(r=>[r.id,r])).values()]
  .sort((a,b)=>b.score-a.score||b.maxCombo-a.maxCombo||b.playedAt-a.playedAt).slice(0,5);
 const valid=r=>r&&typeof r.id==='string'&&Number.isInteger(r.score)&&r.score>=0&&r.score<=1000000&&Number.isInteger(r.maxCombo)&&r.maxCombo>=0&&r.maxCombo<=10000&&Number.isFinite(r.playedAt);
 const outstanding=key=>[...pending.values()].filter(r=>keyFor(r.songId,r.difficulty)===key);
 function paint(){
  const section=document.querySelector('#score-history');if(!section||!selected)return;
  const {key,difficulty}=selected,records=rank([...(cache.get(key)||[]),...outstanding(key)]);
  section.dataset.difficulty=difficulty;
  section.querySelector('[data-history-difficulty]').textContent=BeatStreamDifficulty.label(difficulty);
  section.querySelector('[data-history-rows]').innerHTML=Array.from({length:5},(_,i)=>{
   const r=records[i];return `<tr${r?'':' class="history-vacant"'}><td class="history-rank">${String(i+1).padStart(2,'0')}</td><td class="history-score">${r?r.score.toLocaleString('en-US'):'—'}</td><td class="history-combo">${r?r.maxCombo.toLocaleString('en-US'):'—'}</td></tr>`;
  }).join('');
  const saving=outstanding(key).length>0;
  section.querySelector('[data-history-status]').textContent=errors.get(key)||(saving?'SYNCING':loads.has(key)?'LOADING':records.length?'':'NO RECORD');
  const retry=section.querySelector('[data-history-retry]');retry.hidden=!errors.has(key);retry.onclick=()=>retrySelected();
  section.setAttribute('aria-busy',String(loads.has(key)||saving&&!errors.has(key)));
 }
 async function refresh(songId,difficulty){
  const key=keyFor(songId,difficulty);if(loads.has(key))return loads.get(key);
  const task=(async()=>{
   try{
    const response=await fetch('/api/scores/'+encodeURIComponent(songId)+'/'+difficulty,{cache:'no-store'});
    if(!response.ok)throw new Error('load');const records=await response.json();
    if(!Array.isArray(records)||!records.every(valid))throw new Error('format');
    cache.set(key,rank(records));if(!outstanding(key).length)errors.delete(key);
   }catch{errors.set(key,'讀取失敗');}
   finally{loads.delete(key);paint();}
  })();loads.set(key,task);paint();return task;
 }
 async function upload(record){
  const key=keyFor(record.songId,record.difficulty);errors.delete(key);paint();
  try{
   const response=await fetch('/api/scores/'+encodeURIComponent(record.songId)+'/'+record.difficulty,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
   if(!response.ok)throw new Error('save');const saved=await response.json();if(!valid(saved))throw new Error('format');
   pending.set(record.id,{...record,...saved});errors.delete(key);
   // Finish any older load first so its response cannot replace this new score.
   if(loads.has(key))await loads.get(key);
   cache.set(key,rank([...(cache.get(key)||[]),saved]));pending.delete(record.id);
   await refresh(record.songId,record.difficulty);
   return true;
  }catch{errors.set(key,'成績同步失敗');paint();return false;}
 }
 async function retrySelected(){
  if(!selected)return;const {key,songId,difficulty}=selected,records=outstanding(key);
  if(records.length)await Promise.all(records.map(upload));else await refresh(songId,difficulty);
 }
 function show(songId,value){
  const difficulty=BeatStreamDifficulty.normalize(value),key=keyFor(songId,difficulty);
  selected={key,songId,difficulty};paint();void refresh(songId,difficulty);
 }
 function begin(songId,difficulty,options){
  return {id:window.crypto?.randomUUID?.()||'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),songId,difficulty,...options,submitted:false};
 }
 async function record(run,result){
  if(!run||run.submitted||run.auto||run.practice||!run.noteCount)return false;
  run.submitted=true;
  const saved={id:run.id,songId:run.songId,difficulty:run.difficulty,...result,noteCount:run.noteCount,auto:false,completed:true,playedAt:Date.now()};
  pending.set(saved.id,saved);paint();return upload(saved);
 }
 window.BeatStreamScores={show,begin,record};
 window.addEventListener('online',()=>{for(const record of pending.values())void upload(record);});
})();
