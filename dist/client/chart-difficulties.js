'use strict';
// LIGHT keeps real chart timings while removing chords and rapid patterns.
(()=>{
 const levels={light:'LIGHT',normal:'NORMAL',hard:'BEAST'};
 const normalize=value=>value===true?'hard':value===false?'normal':Object.hasOwn(levels,value)?value:'normal';
 function simplify(source,bpm=140){
  const beat=60/(Number(bpm)||140),gap=Math.max(.7,beat*2),result=[];
  const ordered=source.map(n=>({...n})).sort((a,b)=>a.t-b.t||(a.type==='ripple')-(b.type==='ripple'));
  let availableAt=-Infinity,lastHold=-Infinity;
  for(const n of ordered){
   if(n.t<availableAt-1e-6)continue;
   const hold=n.type==='hold'&&n.end-n.t>=.8&&n.t-lastHold>=beat*16;
   const note={t:n.t,end:hold?n.end:n.t,lane:n.lane,type:hold?'hold':'tap',skin:'beat'};
   if(n.drum)note.drum=n.drum;
   result.push(note);
   availableAt=Math.max(n.t+gap,hold?n.end+Math.max(.25,beat/2):n.t+gap);
   if(hold)lastHold=n.t;
  }
  return result;
 }
 function songNotes(song,value,customCharts={}){
  const level=normalize(value),edited=customCharts?.[song.id];
  if(edited?.[level])return edited[level].notes;
  if(level==='light'&&edited?.normal)return simplify(edited.normal.notes,song.bpm);
  if(song.charts?.[level])return song.charts[level];
  if(level==='light'){
   const source=edited?.normal?.notes??song.charts?.normal??song.charts?.hard;
   if(source)return simplify(source,song.bpm);
  }
 }
 const api={normalize,label:value=>levels[normalize(value)],simplify,songNotes};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else window.BeatStreamDifficulty=api;
})();
