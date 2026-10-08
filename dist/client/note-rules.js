'use strict';
const streamStates=new Map();
function validateStreamGroups(list){
 for(const n of list.filter(n=>n.type==='stream'&&!n.path))if(typeof n.streamId!=='string'||!/^[a-zA-Z0-9_-]{1,48}$/.test(n.streamId))throw Error('舊滑動路徑缺少有效 ID。');
 for(const n of list.filter(n=>n.type==='stream'&&n.path))if(!validStreamPath(n))throw Error('滑動路徑需有 2–32 個不同位置，結束至少晚於起點 0.05 秒。');
 for(const [id,group] of groupStreamNotes(list.filter(n=>!n.path))){
  if(group.length<2||group.length>64)throw Error('舊滑動路徑 '+id+' 需有 2–64 個節點。');
  if(group.some(({n},i)=>i&&(n.t-group[i-1].n.t<.05||n.lane===group[i-1].n.lane)))throw Error('舊滑動路徑 '+id+' 的相鄰節點需間隔至少 0.05 秒，並位於不同方向。');
 }
}
function prepareNotes(){
 streamStates.clear();notes=normalizeStreamNotes(notes);
 notes.forEach(n=>{if(['swipe','direction'].includes(n.type)){n.type='flick';n.skin='beat'}if(n.skin==='touch'&&n.type==='tap'){n.type='ripple';n.skin='touch';n.lane%=6}n.simultaneous=null;if(n.type==='stream')streamStates.set(n,{next:1,owner:null,keyboard:false,broken:false,finished:false,steps:streamKeyboardSteps(n),keyNext:1})});
 markSimultaneousNotes(notes);
}
function markSimultaneousNotes(list){const groups=new Map();for(const n of list){n.simultaneous=null;const key=Math.round(n.t*1000);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n)}let group=0;for(const [,ns] of [...groups].sort((a,b)=>a[0]-b[0]))if(ns.length>1){const col=group++%2?'#19efff':'#ffe641';ns.forEach(n=>n.simultaneous=col)}}
function noteTarget(n){return playfieldTarget(n,{w,h,cx,cy,R,scale})}
function notePointerRadius(n){return playfieldPointerRadius(n,{w,h,cx,cy,R,scale})}
function noteVisualPosition(n,t,approach,travel){return playfieldPosition(n,t,approach,travel,{w,h,cx,cy,R,scale})}
function segmentDistance(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy,p=d?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/d)):0;return Math.hypot(x-x1-p*dx,y-y1-p*dy)}
function canPressStream(n){return n.type!=='stream'||!!streamStates.get(n)&&!streamStates.get(n).broken&&!n.active}
function streamDelta(n,endDelta){return Math.abs(n.delta||0)>Math.abs(endDelta)?n.delta:endDelta}
function pressStream(n,id,p,t,pointer){
 const state=streamStates.get(n);if(!state||!canPressStream(n))return;
 state.owner=id;state.keyboard=!pointer;state.lastX=p.x;state.lastY=p.y;n.active=true;n.delta=t-n.t;
 if(pointer)p.streamNote=n;
}
function pressStreamKey(lane,t){
 let handled=false;
 for(const [n,state] of streamStates){
  if(n.done||!n.active||!state.keyboard||state.broken)continue;
  const step=state.steps[state.keyNext];if(!step||step.lane!==lane||Math.abs(t-step.t)>.20)continue;
  handled=true;state.keyNext++;if(state.keyNext===state.steps.length){n.gesture=playfieldStreamCursor(n,n.end,{w,h,cx,cy,R,scale}).rotation;judge(n,streamDelta(n,t-n.end))}
 }
 return handled;
}
function breakStream(n){const state=streamStates.get(n);if(state)state.broken=true}
function finishStream(n,state,t){state.finished=true;const early=n.path.some(p=>p.curve)?.05:.20;if(t>=n.end-early&&t<=n.end+.20)judge(n,streamDelta(n,t-n.end))}
function streamSegmentProjection(points,cumulative,start,end,x,y,preferred,maxForward=Infinity){
 let best={distance:Infinity,along:0,score:Infinity};
 for(let i=start+1;i<=end;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),f=len?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(len*len))):0,distance=Math.hypot(x-a.x-dx*f,y-a.y-dy*f),along=cumulative[i-1]-cumulative[start]+f*len;if(preferred!==undefined&&along>preferred+maxForward)continue;const score=distance+(preferred===undefined?0:Math.abs(along-preferred)*(along>=preferred?.001:.005));if(score<best.score)best={distance,along,score}}
 return best;
}
function moveCurvedStream(n,state,x1,y1,x,y,t,radius){
 const route=playfieldStreamRoute(n,{w,h}),start=route.nodeIndices[state.next-1],end=route.nodeIndices[state.next],length=route.cumulative[end]-route.cumulative[start],target=route.points[end],moved=Math.hypot(x-x1,y-y1),projection=streamSegmentProjection(route.points,route.cumulative,start,end,x,y,state.curveDistance||0,moved*2+radius);
 // Check the swept pointer too: jumping across a curve cannot complete it.
 const checks=Math.max(1,Math.ceil(moved/Math.max(8,radius*.4)));for(let i=1;i<=checks;i++){const f=i/checks,p=streamSegmentProjection(route.points,route.cumulative,start,end,x1+(x-x1)*f,y1+(y-y1)*f);if(p.distance>radius*1.4){miss(n);return}}
 if(projection.distance>radius*1.4){miss(n);return}
 if(projection.along<(state.curveDistance||0)-radius*.7){miss(n);return}
 if(moved<1)return;state.curveDistance=Math.max(state.curveDistance||0,projection.along);n.gesture=Math.atan2(y-y1,x-x1);
 if(projection.along<length*.9||Math.hypot(x-target.x,y-target.y)>Math.min(radius,length*.1))return;
 state.lastX=x;state.lastY=y;state.curveDistance=0;
 if(state.next<route.nodeIndices.length-1){state.next++;return}
 finishStream(n,state,t);
}
function moveStream(p,id,x1,y1,x,y,t){
 const n=p.streamNote,state=streamStates.get(n);if(!state||state.broken||n.done||state.owner!==id||state.keyboard)return;
 const points=playfieldStreamPoints(n,{w,h,cx,cy,R,scale}),radius=notePointerRadius(n),target=points[state.next],previous=points[state.next-1];
 if(!target)return;
 if(state.finished&&n.path.some(v=>v.curve)){if(Math.hypot(x-target.x,y-target.y)>radius*1.4){miss(n);return}finishStream(n,state,t);return}
 if(n.path[state.next-1].curve){moveCurvedStream(n,state,x1,y1,x,y,t,radius);return}
 const dx=x-x1,dy=y-y1,vx=target.x-previous.x,vy=target.y-previous.y,moved=Math.hypot(dx,dy),length=Math.hypot(vx,vy);
 if(segmentDistance(x,y,previous.x,previous.y,target.x,target.y)>radius*1.4){miss(n);return}
 // Accept the next bend only after real forward travel. No judgments at bends.
 if(moved<1||dx*vx+dy*vy<moved*length*.15)return;
 if(Math.hypot(x-target.x,y-target.y)>Math.min(radius,length*.28))return;
 if(Math.hypot(x-state.lastX,y-state.lastY)<length*.5)return;
 state.lastX=x;state.lastY=y;n.gesture=Math.atan2(dy,dx);
 if(state.next<points.length-1){state.next++;return}
 finishStream(n,state,t);
}
function updateStream(n,t){
 const state=streamStates.get(n);if(!state||n.done)return;
 if(auto){if(t>=n.t)n.active=true;if(t>=n.end)judge(n,0);return}
 if(!n.active&&t>n.t+.20){miss(n);return}
 if(n.active&&state.finished&&t>=n.end){const p=held.get(state.owner),end=playfieldStreamPoints(n,{w,h,cx,cy,R,scale}).at(-1);if(p&&Math.hypot(p.lastX-end.x,p.lastY-end.y)<=notePointerRadius(n))judge(n,streamDelta(n,0));else miss(n);return}
 if(t>n.end+.20)miss(n);
}
function moveGesture(id,x,y){
 const p=held.get(id);if(!p||mode!=='playing'||auto)return;
 const x1=p.lastX??p.x,y1=p.lastY??p.y;p.lastX=x;p.lastY=y;
 if(p.n?.type==='hold'&&!p.n.done)return;
 if(p.streamNote){moveStream(p,id,x1,y1,x,y,clock());return}
 if(Math.hypot(x-p.x,y-p.y)<Math.max(14,18*scale)&&!p.swiping)return;
 p.swiping=true;if(Math.hypot(x-x1,y-y1)<2)return;
 const t=clock(),radius=Math.max(24,36*scale);
 // A moving finger may enter the note; pressing exactly on its head is not required.
 for(const n of notes){if(n.done||n.type!=='flick'||Math.abs(t-n.t)>.20)continue;const target=noteTarget(n);if(segmentDistance(target.x,target.y,x1,y1,x,y)<=radius){n.gesture=Math.atan2(y-p.y,x-p.x);judge(n,t-n.t)}}
}
function rulesPracticeChart(){notes=[];const add=(lane,t,type,end=t)=>notes.push({lane,t,type,end,done:false,drum:'snare'});for(let i=0;i<4;i++)add(i*2,2+i,'tap');add(2,7,'hold',9);add(6,10,'hold',12);add(1,14,'tap');add(5,14,'tap');add(2,16,'tap');add(6,16,'tap');for(let i=0;i<6;i++)add(i,19+i,'ripple');add(2,27,'flick');add(6,29,'flick');notes.push({lane:3,t:33,end:34.5,type:'stream',path:streamPreset('right')},{lane:5,t:37,end:38.5,type:'stream',path:streamPreset('left')});prepareNotes()}
