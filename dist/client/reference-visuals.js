'use strict';
function groupStreamNotes(list){
 const groups=new Map();
 list.forEach((n,index)=>{if(n.type!=='stream'||!n.streamId)return;if(!groups.has(n.streamId))groups.set(n.streamId,[]);groups.get(n.streamId).push({n,index})});
 for(const group of groups.values())group.sort((a,b)=>a.n.t-b.n.t);
 return groups;
}
// One STREAM object owns its complete normalized screen-space route.
const STREAM_DIRECTIONS=[
 {id:'up-left',label:'左上',glyph:'↖',from:[.78,.78],to:[.22,.2]},
 {id:'up',label:'上',glyph:'↑',from:[.22,.78],to:[.22,.2]},
 {id:'up-right',label:'右上',glyph:'↗',from:[.22,.78],to:[.78,.2]},
 {id:'leftward',label:'左',glyph:'←',from:[.78,.23],to:[.22,.23]},
 {id:'rightward',label:'右',glyph:'→',from:[.22,.23],to:[.78,.23]},
 {id:'down-left',label:'左下',glyph:'↙',from:[.78,.2],to:[.22,.78]},
 {id:'down',label:'下',glyph:'↓',from:[.22,.2],to:[.22,.78]},
 {id:'down-right',label:'右下',glyph:'↘',from:[.22,.2],to:[.78,.78]}
];
function streamPreset(shape='left'){
 const direction=STREAM_DIRECTIONS.find(d=>d.id===shape);
 if(direction)return Array.from({length:5},(_,i)=>({x:+(direction.from[0]+(direction.to[0]-direction.from[0])*i/4).toFixed(4),y:+(direction.from[1]+(direction.to[1]-direction.from[1])*i/4).toFixed(4)}));
 const points=[{x:.17,y:.79},{x:.145,y:.64},{x:.14,y:.49},{x:.155,y:.34},{x:.18,y:.20}];
 return points.map(p=>({x:shape==='right'?1-p.x:p.x,y:p.y}));
}
function streamStartLane(path){const p=path[0];return (Math.round((Math.atan2((p.y-.5)*720,(p.x-.5)*1280)+Math.PI/2)/(Math.PI/4))+8)%8}
function streamPathPointValid(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.04&&p.x<=.96&&p.y>=.08&&p.y<=.9}
function cloneStreamPath(path){return path.map(p=>({x:p.x,y:p.y,...(p.curve?{curve:{x:p.curve.x,y:p.curve.y}}:{})}))}
function transformStreamPath(path,action){
 if(action==='reverse')return path.map((p,i)=>({x:p.x,y:p.y,...(i&&path[i-1].curve?{curve:{...path[i-1].curve}}:{})})).reverse();
 const point=p=>({x:action==='mirror-x'?+(1-p.x).toFixed(4):p.x,y:action==='mirror-y'?+(.98-p.y).toFixed(4):p.y});
 return path.map(p=>({...point(p),...(p.curve?{curve:point(p.curve)}:{})}));
}
function validStreamPath(n){return n.end-n.t>=.05&&Array.isArray(n.path)&&n.path.length>=2&&n.path.length<=32&&n.path.every((p,i)=>streamPathPointValid(p)&&(p.curve===undefined||i<n.path.length-1&&streamPathPointValid(p.curve))&&(!i||Math.hypot(p.x-n.path[i-1].x,p.y-n.path[i-1].y)>=.015))}
function splitStreamPath(path,index){
 const out=cloneStreamPath(path),a=out[index],b=out[index+1];if(!b)return out;
 const mid=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
 if(a.curve){const left=mid(a,a.curve),right=mid(a.curve,b),node=mid(left,right);a.curve=left;out.splice(index+1,0,{...node,curve:right})}
 else out.splice(index+1,0,mid(a,b));return out;
}
function translateStreamPath(path,dx,dy){
 const all=path.flatMap(p=>p.curve?[p,p.curve]:[p]);dx=Math.max(.04-Math.min(...all.map(p=>p.x)),Math.min(.96-Math.max(...all.map(p=>p.x)),dx));dy=Math.max(.08-Math.min(...all.map(p=>p.y)),Math.min(.9-Math.max(...all.map(p=>p.y)),dy));
 const move=p=>({x:+(p.x+dx).toFixed(6),y:+(p.y+dy).toFixed(6)});return path.map(p=>({...move(p),...(p.curve?{curve:move(p.curve)}:{})}));
}
// A control handle belongs to the outgoing edge. Old XY-only routes stay straight.
const streamRouteCache=new WeakMap();
function playfieldStreamRoute(n,field){
 const path=n.path||streamPreset(n.lane>=4?'left':'right'),key=field.w+':'+field.h;let cache=streamRouteCache.get(path);if(cache?.has(key))return cache.get(key);
 const pixel=p=>({x:p.x*field.w,y:p.y*field.h}),points=[pixel(path[0])],nodeIndices=[0];
 for(let i=0;i<path.length-1;i++){
  const a=pixel(path[i]),b=pixel(path[i+1]),c=path[i].curve&&pixel(path[i].curve);
  if(c){const divisions=Math.max(8,Math.min(192,Math.ceil((Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y))/8)));for(let j=1;j<=divisions;j++){const t=j/divisions,u=1-t;points.push({x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y})}}
  else points.push(b);nodeIndices.push(points.length-1);
 }
 const value={points,nodeIndices,...streamPathMeasure(points)};if(!cache){cache=new Map();streamRouteCache.set(path,cache)}cache.set(key,value);return value;
}
function normalizeStreamNotes(list){
 const groups=groupStreamNotes(list.filter(n=>!n.path)),converted=new Map(),removed=new Set();
 for(const group of groups.values()){
  if(group.length<2)continue;
  const first=group[0].n,last=group.at(-1).n,side=first.lane>=4?'left':'right';
  converted.set(first,{...first,type:'stream',end:last.t,path:streamPreset(side)});
  for(const {n} of group.slice(1))removed.add(n);
 }
 return list.filter(n=>!removed.has(n)).map(n=>{
  const value=converted.get(n)||n;
  if(value.type!=='stream')return {...value};
  if(!validStreamPath(value)){const fallback={...value,type:'flick',end:value.t};delete fallback.path;delete fallback.streamId;return fallback}
  const result={...value,path:cloneStreamPath(value.path)};delete result.streamId;delete result.streamIndex;return result;
 });
}
function playfieldStreamPoints(n,field){return (n.path||streamPreset(n.lane>=4?'left':'right')).map(p=>({x:p.x*field.w,y:p.y*field.h}))}
function streamPathMeasure(points){const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));return {cumulative,length:cumulative.at(-1)}}
function streamPointAt(points,progress){
 const {cumulative,length}=streamPathMeasure(points),distance=Math.max(0,Math.min(1,progress))*length;let i=1;while(i<points.length-1&&cumulative[i]<distance)i++;
 const a=points[i-1],b=points[i],p=(distance-cumulative[i-1])/(cumulative[i]-cumulative[i-1]||1);
 return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,rotation:Math.atan2(b.y-a.y,b.x-a.x)};
}
function streamVisualPhase(n,time,approach){return {reveal:Math.max(0,Math.min(1,(time-(n.t-approach*.52))/(approach*.28))),progress:Math.max(0,Math.min(1,(time-n.t)/(n.end-n.t)))}}
function streamKeyboardSteps(n){
 const field=playfieldGeometry(1280,720),points=playfieldStreamPoints(n,field),{cumulative,length,nodeIndices}=playfieldStreamRoute(n,field),steps=[{lane:n.lane,t:n.t}];
 points.forEach((p,i)=>{const lane=(Math.round((Math.atan2(p.y-field.cy,p.x-field.cx)+Math.PI/2)/(Math.PI/4))+8)%8;if(i&&lane!==steps.at(-1).lane)steps.push({lane,t:n.t+(n.end-n.t)*cumulative[nodeIndices[i]]/length})});
 // A final repeat of the last key explicitly completes the path at its end beat.
 if(steps.at(-1).t<n.end-.025)steps.push({lane:steps.at(-1).lane,t:n.end});return steps;
}
function playfieldFeedbackTarget(n,field){return n.type==='stream'?playfieldStreamPoints(n,field).at(-1):playfieldTarget(n,field)}
const NOTE_PALETTE={tap:'#ff27bf',hold:'#ff27bf',flick:'#70ff49',ripple:'#82ff35',stream:'#b794ff'};
function playfieldFeedbackColor(note){return note.simultaneous||NOTE_PALETTE[note.type==='holdStart'?'hold':note.type]||NOTE_PALETTE.tap}
function playfieldUpcomingNotes(notes,time,approach){
 const upcoming=Array(8).fill(null);
 for(const n of notes){if(n.done||n.active||!['tap','hold','flick'].includes(n.type)||n.t<time||n.t-time>approach)continue;if(!upcoming[n.lane]||n.t<upcoming[n.lane].t)upcoming[n.lane]=n}
 return upcoming;
}
const PLAYFIELD_ANGLES=Array.from({length:8},(_,i)=>-Math.PI/2+i*Math.PI/4);
const PLAYFIELD_RIPPLES=[[-.31,-.28],[.31,-.28],[.36,0],[.31,.28],[-.31,.28],[-.36,0]];
const COMPACT_RIPPLES=[[-.25,-.28],[.25,-.28],[.30,0],[.25,.28],[-.25,.28],[-.30,0]];
const RIPPLE_JUDGE_RATIO=1.42,HOLD_RIBBON_STRETCH=1.75;
// Three equal circular sectors share one perimeter and a narrow Y-shaped seam.
// Use the same proportions for the title, rules and both Canvas playfields.
const NOTE_MARK_ANGLES=[-Math.PI/2,Math.PI/6,Math.PI*5/6];
const NOTE_MARK_SEAM=.09;
function noteMarkSvg(x,y,r,color='#fff',seam='#100b20'){
 const sectors=[0,120,240].map(a=>`<path data-note-sector transform="rotate(${a})" d="M0 0 L0 -1 A1 1 0 0 1 .8660254 .5 Z" fill="${color}" stroke="none"/>`).join('');
 const dividers=NOTE_MARK_ANGLES.map(a=>`M0 0 L${Math.cos(a)} ${Math.sin(a)}`).join(' ');
 return `<g transform="translate(${x} ${y}) rotate(-9) scale(${r})">${sectors}<path d="${dividers}" fill="none" stroke="${seam}" stroke-width="${NOTE_MARK_SEAM}" stroke-linecap="butt"/><circle r="1" fill="none" stroke="${seam}" stroke-width="${NOTE_MARK_SEAM}"/></g>`;
}
function drawRoundNoteMark(g,x,y,r,color='#fff',seam='#100b20',rotation=-Math.PI/20){
 g.save();g.translate(x,y);g.rotate(rotation);g.fillStyle=color;
 for(const a of NOTE_MARK_ANGLES){g.beginPath();g.moveTo(0,0);g.arc(0,0,r,a,a+Math.PI*2/3);g.closePath();g.fill()}
 g.beginPath();for(const a of NOTE_MARK_ANGLES){g.moveTo(0,0);g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
 g.strokeStyle=seam;g.lineWidth=r*NOTE_MARK_SEAM;g.lineCap='butt';g.stroke();
 g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();g.restore();
}
function playfieldGeometry(w,h){const scale=Math.max(.55,Math.min(w/1280,h/720));return {w,h,cx:w/2,cy:h/2,scale,R:Math.max(w<700?42:54,Math.min(110*scale,w*(w<700?.145:.18),h*.2))}}
function playfieldJudgmentBar(lane,field){
 const {cx,cy,R,scale}=field,a=PLAYFIELD_ANGLES[lane],apothem=R*1.2,thickness=Math.max(7,12*scale);
 // Leave room for both rounded ends at each corner of the octagon.
 const trim=thickness*.75+Math.max(3,4*scale),halfLength=Math.max(thickness*.7,apothem*Math.tan(Math.PI/8)-trim);
 return {x:cx+Math.cos(a)*apothem,y:cy+Math.sin(a)*apothem,rotation:a+Math.PI/2,halfLength,thickness};
}
function playfieldNoteRadius(n,field){return n.type==='ripple'?Math.max(23,32*field.scale):Math.max(19,25*field.scale)}
function playfieldPointerRadius(n,field){return n.type==='ripple'?playfieldNoteRadius(n,field)*RIPPLE_JUDGE_RATIO:Math.max(25,32*field.scale)}
function playfieldTarget(n,field){
 const {w,h,cx,cy,R}=field;
 if(n.type==='stream')return playfieldStreamPoints(n,field)[0];
 if(n.type==='ripple'){const v=(w<700?COMPACT_RIPPLES:PLAYFIELD_RIPPLES)[n.lane%6];return {x:cx+v[0]*w,y:cy+v[1]*h}}
 const a=PLAYFIELD_ANGLES[n.lane],radius=R*(n.type==='stream'?1.9:1.2);return {x:cx+Math.cos(a)*radius,y:cy+Math.sin(a)*radius};
}
function playfieldPosition(n,t,approach,travel,field){const target=playfieldTarget(n,field);if(n.type==='ripple'||n.type==='stream')return target;const distance=Math.max(0,(n.t-t)/approach)*travel,a=PLAYFIELD_ANGLES[n.lane];return {x:target.x+Math.cos(a)*distance,y:target.y+Math.sin(a)*distance}}
function playfieldStreamCursor(n,time,field){return streamPointAt(playfieldStreamRoute(n,field).points,Math.max(0,(time-n.t)/(n.end-n.t)))}
function playfieldHoldTail(n,t,approach,travel,field){const head=playfieldPosition(n,t,approach,travel,field),a=PLAYFIELD_ANGLES[n.lane],length=Math.max(0,n.end-Math.max(n.t,t))/approach*travel*HOLD_RIBBON_STRETCH;return {x:head.x+Math.cos(a)*length,y:head.y+Math.sin(a)*length,length}}
function rippleApproachGeometry(x,y,r,dt,approach,field){const progress=Math.max(0,Math.min(1,dt/approach)),target=r*RIPPLE_JUDGE_RATIO,edge=Math.min(x,field.w-x,y,field.h-y)-8,outer=Math.max(target+6,Math.min(r*4.7,edge));return {target,outer,radius:target+(outer-target)*progress,progress}}
function squareApproachRotation(dt,approach){const progress=Math.max(0,Math.min(1,dt/approach));return -Math.PI/4*progress*progress}
function playfieldSquareFrame(n,t,approach,travel,field){
 const pos=playfieldPosition(n,t,approach,travel,field),progress=Math.max(0,Math.min(1,(n.t-t)/approach)),r=playfieldNoteRadius(n,field),a=PLAYFIELD_ANGLES[n.lane],offset=Math.min(travel*.08,r*.6)*progress;
 return {x:pos.x-Math.cos(a)*offset,y:pos.y-Math.sin(a)*offset,rotation:squareApproachRotation(n.t-t,approach),half:r*(1.20+.04*progress)};
}
// Each canvas owns its drawing state. Rendering never changes the live game or chart.
function createPlayfieldRenderer(g){
 let w,h,cx,cy,R,scale,life,bindingCodes,held,laneHitUntil,laneHitColor,judgmentStyle,activeCentralNotes,upcomingNotes,showKeyboardLabels;
 const angles=PLAYFIELD_ANGLES;
 function targetRadius(){return R*1.2}
 function circle(x,y,r,col,line=1){g.beginPath();g.arc(x,y,Math.max(0,r),0,Math.PI*2);g.strokeStyle=col;g.lineWidth=line;g.stroke()}
 function line(x,y,x2,y2,col,width=1){g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.strokeStyle=col;g.lineWidth=width;g.stroke()}
function octagonPath(apothem){
 const circumradius=apothem/Math.cos(Math.PI/8);g.beginPath();
 for(let i=0;i<8;i++){const a=-Math.PI/2-Math.PI/8+i*Math.PI/4,x=cx+Math.cos(a)*circumradius,y=cy+Math.sin(a)*circumradius;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();
}
function strokeOctagon(apothem,color,width){g.save();g.lineJoin='miter';octagonPath(apothem);g.strokeStyle=color;g.lineWidth=width;g.stroke();g.restore()}
function judgmentBarPath(halfLength,thickness){
 const r=thickness/2;g.beginPath();g.moveTo(-halfLength,-r);g.lineTo(halfLength,-r);g.arc(halfLength,0,r,-Math.PI/2,Math.PI/2);g.lineTo(-halfLength,r);g.arc(-halfLength,0,r,Math.PI/2,Math.PI*1.5);g.closePath();
}
function drawJudgmentRing(now){
 const radius=targetRadius();
 const contacts=[...held.values()].map(p=>p.n).filter(n=>n&&!n.done&&!['ripple','stream'].includes(n.type)).concat(activeCentralNotes);
 angles.forEach((a,i)=>{const contact=contacts.find(n=>n.lane===i),hit=laneHitUntil[i]>now,lit=!!contact||hit,cue=!!upcomingNotes[i]&&!lit,bar=playfieldJudgmentBar(i,{cx,cy,R,scale}),color=hit?laneHitColor[i]:contact?playfieldFeedbackColor(contact):'#22ffe2';g.save();g.translate(bar.x,bar.y);g.rotate(bar.rotation);
 judgmentBarPath(bar.halfLength,bar.thickness);
 g.strokeStyle='#030508';g.lineWidth=Math.max(3,4*scale);g.stroke();
 if(judgmentStyle==='filled'){g.fillStyle='#ffffff';g.fill()}
 g.strokeStyle=lit?color:judgmentStyle==='outline'?'#dfe7edb3':'#ff76cd';g.lineWidth=Math.max(1,1.3*scale);g.stroke();
 if(cue){g.shadowColor='#28f5e5';g.shadowBlur=6*scale;g.lineCap='round';line(-bar.halfLength,0,bar.halfLength,0,'#28f5e5',Math.max(2,bar.thickness*.35))}
 if(lit){g.shadowBlur=16*scale;g.shadowColor=color;g.strokeStyle=color;g.lineWidth=Math.max(2,2.4*scale);g.stroke();if(judgmentStyle==='filled'){g.lineCap='round';line(-bar.halfLength,0,bar.halfLength,0,color,bar.thickness*.55)}}
 g.restore();g.fillStyle=lit||cue?'#fff':'#c3dce0';g.font=`bold ${Math.max(12,13*scale)}px Arial`;if(showKeyboardLabels)g.fillText(keyLabel(bindingCodes[i]),cx+Math.cos(a)*(radius+Math.max(19,26*scale)),cy+Math.sin(a)*(radius+Math.max(19,26*scale)));
 });
}
function arcStroke(x,y,r,start,end,color,width=1){g.beginPath();g.arc(x,y,Math.max(.1,r),start,end);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
function noteDisk(x,y,r,fill){g.beginPath();g.arc(x,y,Math.max(.1,r),0,Math.PI*2);g.fillStyle=fill;g.fill()}
function referenceNote(x,y,r,type,a=0,skin='beat',tint){
 const kind=skin==='touch'?'ripple':type,c=tint||NOTE_PALETTE[kind]||NOTE_PALETTE.tap;
 g.save();g.translate(x,y);g.lineJoin='round';g.lineCap='round';
 const face=g.createLinearGradient(-r,-r,r,r);face.addColorStop(0,'#ffffff');face.addColorStop(.16,c);face.addColorStop(.55,tint?'#46606b':kind==='ripple'||kind==='flick'?'#247d24':'#a10079');face.addColorStop(1,'#18072c');
 g.shadowColor=c;g.shadowBlur=kind==='flick'?r*.18:r*.6;
 if(kind==='flick'){
  g.rotate(a);
  g.lineJoin='miter';g.fillStyle='#080812';g.fillRect(-r*1.08,-r*1.08,r*2.16,r*2.16);g.lineWidth=r*.13;g.strokeStyle=c;g.strokeRect(-r*1.08,-r*1.08,r*2.16,r*2.16);g.shadowBlur=0;
  g.fillStyle=face;g.fillRect(-r*.88,-r*.88,r*1.76,r*1.76);g.strokeStyle='#e4ffdb';g.lineWidth=Math.max(1,r*.055);g.strokeRect(-r*.88,-r*.88,r*1.76,r*1.76);
  g.fillStyle='#071a20';g.fillRect(-r*.46,-r*.46,r*.92,r*.92);g.strokeStyle='#eaffef';g.lineWidth=r*.09;g.strokeRect(-r*.46,-r*.46,r*.92,r*.92);
  g.fillStyle='#cadfd6';g.fillRect(-r*.26,-r*.26,r*.52,r*.52);
 }else{
  noteDisk(0,0,r*1.12,'#090713');circle(0,0,r*1.1,c,Math.max(2,r*.1));g.shadowBlur=0;
  circle(0,0,r*.94,'#fff3fc',Math.max(1.2,r*.055));noteDisk(0,0,r*.82,face);circle(0,0,r*.80,c,Math.max(1,r*.05));
  noteDisk(0,0,r*.59,'#100b20');circle(0,0,r*.59,'#ffffffa0',Math.max(1,r*.045));
  drawRoundNoteMark(g,0,0,r*.54);
  arcStroke(0,0,r*.72,-2.9,-1.05,'#ffffffb0',Math.max(1,r*.045));
  if(kind!=='ripple')for(const sign of [-1,1]){g.save();g.rotate(a);g.fillStyle='#0a0813';g.strokeStyle='#e9fff8';g.lineWidth=Math.max(1,r*.045);g.fillRect(-r*.12,sign>0?r*.98:-r*1.46,r*.24,r*.48);g.strokeRect(-r*.12,sign>0?r*.98:-r*1.46,r*.24,r*.48);g.restore()}
 }
 if(tint&&kind!=='flick'){circle(0,0,r*1.32,tint,Math.max(1.5,r*.07));for(const sign of [-1,1]){g.fillStyle=tint;g.beginPath();g.moveTo(sign*r*1.5,0);g.lineTo(sign*r*1.24,-r*.13);g.lineTo(sign*r*1.24,r*.13);g.closePath();g.fill()}}
 if(kind==='ripple'){circle(0,0,r*1.31,'#d6fff9a0',Math.max(1,r*.04));for(let j=0;j<16;j++){const a=j*Math.PI/8;arcStroke(0,0,r*1.18,a,a+.13,'#e7ffeca0',Math.max(1,r*.055))}}
 g.restore();
}
function drawSquareApproach(frame,dt){
 const ready=dt<=.14&&dt>=-.20,s=frame.half;
 g.save();g.translate(frame.x,frame.y);g.rotate(frame.rotation);g.lineJoin='miter';g.shadowBlur=0;
 g.strokeStyle=ready?'#fffffff0':'#ffffffb3';g.lineWidth=Math.max(1,1.1*scale);g.strokeRect(-s,-s,s*2,s*2);g.restore();
}
function drawTouchApproach(x,y,r,dt,approach,now,tint,key){
 const {target,radius}=rippleApproachGeometry(x,y,r,dt,approach,{w,h}),c=tint||NOTE_PALETTE.ripple,ready=dt<=.14&&dt>=-.15;
 g.save();g.lineCap='round';
 circle(x,y,target,'#060c14',Math.max(7,r*.24));
 circle(x,y,target,ready?'#fff':c,Math.max(3.5,r*.12));
 circle(x,y,target-4,'#ecfff6b0',Math.max(1.5,r*.045));
 for(let i=0;i<4;i++){const a=i*Math.PI/2;line(x+Math.cos(a)*(target-2),y+Math.sin(a)*(target-2),x+Math.cos(a)*(target+5),y+Math.sin(a)*(target+5),'#f3fff7',Math.max(2,r*.075))}
 circle(x,y,radius,'#061211',Math.max(8,r*.24));g.shadowColor=c;g.shadowBlur=ready?18:8;
 circle(x,y,radius,ready?'#fff':c,Math.max(4,r*.15));g.shadowBlur=0;circle(x,y,radius,'#eafff4',Math.max(1.2,r*.04));
 if(key){const font=Math.max(14,18*scale),labelY=y+target+font+8;
  g.font=`900 ${font}px Arial`;const textWidth=g.measureText?.(key)?.width||key.length*font;
  g.fillStyle=ready?'#dffff0':'#081619ee';g.fillRect(x-textWidth/2-8,labelY-font*.65,textWidth+16,font+7);
  g.fillStyle=ready?'#063923':'#d9fff0';g.fillText(key,x,labelY)}g.restore();
}
function drawHoldRibbon(x,y,endX,endY,r,active,tint){
 const c=tint||NOTE_PALETTE.hold,dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
 g.save();g.translate(x,y);g.rotate(a);g.lineCap='round';
 line(0,0,length,0,'#080810',r*1.60);line(0,0,length,0,'#fff2fa',r*1.40);line(0,0,length,0,c,r*1.15);line(0,0,length,0,active?'#ffffff':'#ffbded',r*.34);
 line(0,-r*.44,length,-r*.44,'#ffffffdd',Math.max(1.5,r*.06));line(0,r*.44,length,r*.44,'#ffffffb0',Math.max(1.5,r*.06));
 g.setLineDash([r*.18,r*.58]);line(0,0,length,0,'#fff2fa',Math.max(2,r*.13));g.setLineDash([]);
 circle(length,0,r*.64,'#fff2fa',Math.max(2,r*.085));g.restore();
}
function drawLongContact(x,y,r,now){
 g.save();g.translate(x,y);g.rotate(now*.007);g.shadowColor='#ff63dc';g.shadowBlur=r*.35;
 for(let j=0;j<12;j++){const a=j*Math.PI/6;arcStroke(0,0,r*1.33,a,a+.27,'#fff2fc',Math.max(1.5,r*.13));line(Math.cos(a)*r*1.35,Math.sin(a)*r*1.35,Math.cos(a)*r*1.55,Math.sin(a)*r*1.55,'#ffe9fb',Math.max(1,r*.06))}
 circle(0,0,r*1.04,'#ffffff',Math.max(1,r*.06));g.restore();
}
function streamTriangle(x,y,r,rotation,color,outline=false){
 g.save();g.translate(x,y);g.rotate(rotation);g.lineJoin='miter';g.beginPath();g.moveTo(r,0);g.lineTo(-r*.72,-r*.88);g.lineTo(-r*.72,r*.88);g.closePath();
 if(!outline){g.fillStyle='#111021';g.fill();g.strokeStyle='#050919';g.lineWidth=Math.max(4,r*.25);g.stroke();g.fillStyle=color;g.fill()}
 g.strokeStyle=outline?'#ffffffe0':'#fff5fe';g.lineWidth=Math.max(1.1,r*.065);g.stroke();
 if(!outline){g.scale(.65,.65);g.strokeStyle='#fce4ff';g.lineWidth=Math.max(1.2,r*.08);g.stroke();g.beginPath();g.moveTo(0,0);g.lineTo(r,0);g.moveTo(0,0);g.lineTo(-r*.72,-r*.88);g.moveTo(0,0);g.lineTo(-r*.72,r*.88);g.strokeStyle='#541444';g.stroke()}
 g.restore();
}
function drawStreamRoutes(visual,t,approach,field,preview,regions){
 visual.forEach((n,index)=>{
  const editing=preview&&index===frameEditingIndex;
  if(n.type!=='stream'||!editing&&(n.done||n.t-t>approach||t>n.end+.2||preview&&t>=n.end))return;
  const points=playfieldStreamPoints(n,field),route=playfieldStreamRoute(n,field),phase=editing?{reveal:1,progress:0}:streamVisualPhase(n,t,approach),r=playfieldNoteRadius(n,field),active=!editing&&(preview?t>=n.t:n.active),broken=n.streamMiss;
  const alpha=editing?1:Math.min(1,(approach-n.t+t)*3),width=Math.max(5,7*scale),arrow=Math.max(13,20*scale),count=points.length-1,measure=streamPathMeasure(points);
  g.save();g.globalAlpha=Math.max(0,alpha)*(broken?.25:1);g.lineJoin='miter';g.lineCap='butt';
  // Each section is a broad solid arrow connected to the next by its stem.
  // The rail reveals from the triangle toward the endpoint, then is consumed.
  const consumed=active?phase.progress:0;
  if(n.path.some(p=>p.curve)){
   const lo=consumed*route.length,hi=phase.reveal*route.length,rail=[];
   if(hi>lo){rail.push(streamPointAt(route.points,consumed));route.points.forEach((p,i)=>{if(route.cumulative[i]>lo&&route.cumulative[i]<hi)rail.push(p)});rail.push(streamPointAt(route.points,phase.reveal));
    g.beginPath();rail.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.lineJoin='round';g.lineCap='round';g.strokeStyle='#050c20';g.lineWidth=width*2+5*scale;g.stroke();g.strokeStyle='#f4f5ff';g.lineWidth=width*2+1.5*scale;g.stroke();
    const fill=g.createLinearGradient(points[0].x,points[0].y,points.at(-1).x,points.at(-1).y);fill.addColorStop(0,'#d832ec');fill.addColorStop(.6,'#794dff');fill.addColorStop(1,'#34edea');g.strokeStyle=fill;g.lineWidth=width*2-1.5*scale;g.stroke();
    for(let d=Math.max(lo+24*scale,45*scale);d<hi-10*scale;d+=65*scale){const p=streamPointAt(route.points,d/route.length);g.save();g.translate(p.x,p.y);g.rotate(p.rotation);g.beginPath();g.moveTo(-6*scale,-6*scale);g.lineTo(2*scale,0);g.lineTo(-6*scale,6*scale);g.strokeStyle='#fff';g.lineWidth=2*scale;g.stroke();g.restore()}
   }
  }else for(let i=0;i<count;i++){
   const lo=measure.cumulative[i]/measure.length,hi=measure.cumulative[i+1]/measure.length;if(phase.reveal<=lo||consumed>=hi)continue;
   const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),visible=Math.min(1,(phase.reveal-lo)/(hi-lo)),used=Math.max(0,(consumed-lo)/(hi-lo));
   const top=length*visible,base=Math.max(length*used,top-arrow*.95);
   g.save();g.translate(a.x,a.y);g.rotate(Math.atan2(dy,dx));g.beginPath();g.moveTo(length*used,-width);g.lineTo(base,-width);g.lineTo(base,-arrow);g.lineTo(top,0);g.lineTo(base,arrow);g.lineTo(base,width);g.lineTo(length*used,width);g.closePath();
   const fill=g.createLinearGradient(0,0,length,0),color=p=>p<.5?'#d832ec':p<.8?'#794dff':'#34edea';fill.addColorStop(0,color(lo));fill.addColorStop(1,color(hi));g.strokeStyle='#050c20';g.lineWidth=Math.max(4,5*scale);g.stroke();g.fillStyle=fill;g.fill();g.strokeStyle='#f4f5ff';g.lineWidth=Math.max(1,1.25*scale);g.stroke();g.restore();
  }
  const cursor=active?playfieldStreamCursor(n,t,field):streamPointAt(route.points,0);
  if(!active){const dt=Math.max(0,n.t-t);streamTriangle(cursor.x,cursor.y,r*(1.25+Math.min(1,dt/approach)*.70),cursor.rotation,'#ff38c9',true)}
  streamTriangle(cursor.x,cursor.y,r*1.04,cursor.rotation,broken?'#718098':'#ff38c9');
  if(showKeyboardLabels){const steps=streamKeyboardSteps(n),step=steps.find(v=>v.t>=t-.025)||steps.at(-1);g.font=`bold ${Math.max(11,12*scale)}px Arial`;g.fillStyle='#f6e9ff';g.fillText(keyLabel(bindingCodes[step.lane]),cursor.x,cursor.y+r*1.8)}
  regions.push({index,x:cursor.x,y:cursor.y,r:preview?Math.max(r*1.6,22*frameHandleScale):r*1.6});if(preview&&framePathSelection&&phase.reveal>consumed){const visible=[streamPointAt(route.points,consumed)];route.points.forEach((p,i)=>{if(route.cumulative[i]>consumed*route.length&&route.cumulative[i]<phase.reveal*route.length)visible.push(p)});visible.push(streamPointAt(route.points,phase.reveal));regions.push({index,routePoints:visible})}
  if(editing||index===frameSelectedIndex){
   const handleScale=scale*frameHandleScale;
   n.path.forEach((p,curveIndex)=>{if(!p.curve||curveIndex!==frameSelectedPoint)return;const c={x:p.curve.x*field.w,y:p.curve.y*field.h};g.setLineDash([5*handleScale,5*handleScale]);g.beginPath();g.moveTo(points[curveIndex].x,points[curveIndex].y);g.lineTo(c.x,c.y);g.lineTo(points[curveIndex+1].x,points[curveIndex+1].y);g.strokeStyle='#46eee0';g.lineWidth=1.5*handleScale;g.stroke();g.setLineDash([]);g.save();g.translate(c.x,c.y);g.rotate(Math.PI/4);g.fillStyle='#112e3e';g.fillRect(-8*handleScale,-8*handleScale,16*handleScale,16*handleScale);g.strokeStyle='#46fff0';g.lineWidth=2*handleScale;g.strokeRect(-8*handleScale,-8*handleScale,16*handleScale,16*handleScale);g.restore();regions.push({index,curveIndex,x:c.x,y:c.y,r:22*handleScale})});
   points.forEach((p,pointIndex)=>{const chosen=pointIndex===frameSelectedPoint;circle(p.x,p.y,(chosen?10:8)*handleScale,'#080b1b',5*handleScale);circle(p.x,p.y,(chosen?10:8)*handleScale,chosen?'#ffe641':'#fff',2*handleScale);g.font=`bold ${Math.max(11,12*handleScale)}px Arial`;g.fillStyle=chosen?'#ffe641':'#fff';g.strokeStyle='#07091b';g.lineWidth=3*handleScale;const label=pointIndex===0?'START':pointIndex===points.length-1?'END':String(pointIndex);g.strokeText(label,p.x,p.y-19*handleScale);g.fillText(label,p.x,p.y-19*handleScale);regions.push({index,pointIndex,x:p.x,y:p.y,r:20*handleScale})});
  }
  g.restore();
 });
}
let frameSelectedIndex=-1,frameSelectedPoint=-1,frameEditingIndex=-1,frameHandleScale=1,framePathSelection=false;
function paw(x,y,r,angle,color){
 g.save();g.translate(x,y);g.rotate(angle);g.fillStyle=color;
 g.beginPath();g.moveTo(-r*.53,r*.24);g.bezierCurveTo(-r*.7,r*.65,-r*.13,r*.78,0,r*.55);g.bezierCurveTo(r*.4,r*.79,r*.75,r*.49,r*.49,r*.16);g.bezierCurveTo(r*.22,-r*.2,-r*.23,-r*.24,-r*.53,r*.24);g.fill();
 for(const [x,y,rx,ry,a] of [[-.65,-.2,.21,.28,-.5],[-.25,-.59,.22,.28,-.2],[.25,-.59,.22,.28,.2],[.65,-.2,.21,.28,.5]]){g.beginPath();g.ellipse(x*r,y*r,rx*r,ry*r,a,0,Math.PI*2);g.fill()}
 g.restore();
}
function drawReferenceHit(f,now){
 const age=(now-f.t)/650,p=Math.max(0,age),fade=Math.max(0,1-p);g.save();g.globalAlpha=fade;
 if(f.text!=='MISS'&&f.type!=='flick'){
  const rr=playfieldNoteRadius(f,{scale}),r=rr*(1.12+p*.8),hitColor=f.type==='stream'?NOTE_PALETTE.stream:'#ff29c9';g.globalAlpha=fade*.22;noteDisk(f.x,f.y,r,hitColor);g.globalAlpha=fade;
  circle(f.x,f.y,r,f.type==='stream'?hitColor:'#ff8bdf',Math.max(1.5,3*scale));circle(f.x,f.y,r*.82,'#fff',Math.max(1,scale));
  for(let j=0;j<18;j++){const a=j*Math.PI/9+p*2.1;arcStroke(f.x,f.y,r*1.1,a,a+.14,j%3?'#f5fffb':'#25ffe5',Math.max(1,2.5*scale))}
  for(let j=0;j<3;j++){const a=-Math.PI/2+(j-1)*1.65,d=rr*(1.8+p*1.8);g.globalAlpha=fade*(j===1?.75:.5);paw(f.x+Math.cos(a)*d,f.y+Math.sin(a)*d,rr*(.54-p*.18),a+.5,f.type==='stream'?hitColor:'#ff28bd')}
  g.globalAlpha=fade;
 }
 if(f.text!=='MISS'&&f.type==='flick'){
  const r=Math.max(19,25*scale);g.save();g.translate(f.x,f.y);g.rotate(f.gesture??-.3);
  for(const side of [-1,1]){g.save();g.translate(0,side*p*r*1.3);g.rotate(side*p*.5);g.beginPath();g.moveTo(-r,0);g.lineTo(r,0);g.lineTo(r*.7,side*r);g.lineTo(-r*.7,side*r);g.closePath();g.fillStyle='#17412e';g.fill();g.strokeStyle='#91ff63';g.lineWidth=2;g.stroke();g.restore()}
  line(-r*(1+2*p),0,r*(1+2*p),0,'#f8fff1',Math.max(1,4*fade));
  for(let j=0;j<8;j++){const a=j*Math.PI/4,d=r*(1+p*2.5);g.save();g.translate(Math.cos(a)*d,Math.sin(a)*d);g.rotate(a+p*2);g.fillStyle=j%2?'#fff':'#a6ff68';g.fillRect(-3,-3,6*fade,6*fade);g.restore()}g.restore();
  g.save();g.translate(f.x,f.y);g.rotate(-.3);g.fillStyle='#ffff6e';g.strokeStyle='#263514';g.lineWidth=2*scale;g.beginPath();g.moveTo(-5*scale,-19*scale);g.lineTo(11*scale,-30*scale);g.lineTo(4*scale,-8*scale);g.lineTo(14*scale,-11*scale);g.lineTo(-7*scale,17*scale);g.lineTo(-2*scale,-2*scale);g.lineTo(-14*scale,3*scale);g.closePath();g.fill();g.stroke();g.restore();
 }
 g.font=`900 ${Math.max(17,26*scale)}px Arial`;g.lineWidth=4*scale;g.strokeStyle='#070610';const y=f.y-37*scale-p*13;g.strokeText(f.text,f.x,y);let grad=g.createLinearGradient(f.x-58*scale,0,f.x+60*scale,0);grad.addColorStop(0,'#ffff85');grad.addColorStop(.35,'#ccff25');grad.addColorStop(.58,'#4affee');grad.addColorStop(.8,'#df8fff');grad.addColorStop(1,'#ff00dc');g.fillStyle=f.text==='MISS'?'#ee6b9b':grad;g.fillText(f.text,f.x,y);
 if(f.detail){g.font=`bold ${Math.max(11,12*scale)}px Arial`;g.fillStyle='#eaffff';g.strokeText(f.detail,f.x,f.y-17*scale-p*13);g.fillText(f.detail,f.x,f.y-17*scale-p*13)}g.restore();
}
function drawReferenceCore(t,pulse){
 g.save();g.textAlign='center';g.textBaseline='middle';
 const clear=life>=70,c=clear?'#ff27bf':'#27f8e4';
 const face=g.createRadialGradient(cx,cy,0,cx,cy,R);face.addColorStop(0,clear?'#230829':'#062b2a');face.addColorStop(.75,'#0b1b30');face.addColorStop(1,clear?'#740651':'#075c59');g.fillStyle=face;octagonPath(R*1.08);g.fill();
 g.shadowColor=c;g.shadowBlur=12+8*pulse;strokeOctagon(R*1.055,c,Math.max(3,7*scale));g.shadowBlur=0;
 strokeOctagon(R*.94,clear?'#ff9ddd':'#a1fff4',Math.max(1,1.2*scale));strokeOctagon(R*.84,clear?'#98226c':'#226f69',Math.max(1,2*scale));
 for(let i=0;i<48;i++){const a=i*Math.PI/24,rr=R*.72;g.save();g.translate(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);g.rotate(a);g.fillStyle=i/48<life/100?c:'#34303d';g.fillRect(-R*.035,-Math.max(.7,R*.007),R*.07,Math.max(1.4,R*.014));g.restore()}
 g.fillStyle='#fff1fc';g.font=`900 ${Math.max(19,32*scale)}px Arial`;g.fillText(Math.round(life)+'%',cx,cy-Math.max(5,4*scale));g.fillStyle=c;g.font=`700 ${Math.max(8,10*scale)}px Arial`;g.fillText(clear?'CLEAR ZONE':'GOAL 70%',cx,cy+Math.max(13,23*scale));g.restore();
}
function drawArcadeField(t){
 g.save();g.lineWidth=1;g.strokeStyle='#00dfef0b';const step=Math.max(38,56*scale);
 for(let x=cx%step;x<w;x+=step){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}
 for(let y=cy%step;y<h;y+=step){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
 for(const [x,y,c] of [[w*.08,h*.23,'#ff00b7'],[w*.92,h*.77,'#00efda']]){g.save();g.translate(x,y);g.rotate(t*.025);g.globalAlpha=.14;for(const rr of [140,156,195])circle(0,0,rr*scale,c,Math.max(1,scale));for(let i=0;i<24;i++){const a=i*Math.PI/12;line(Math.cos(a)*160*scale,Math.sin(a)*160*scale,Math.cos(a)*180*scale,Math.sin(a)*180*scale,c,5*scale)}g.restore()}
 g.restore();
}
function readyBanner(t){
 if(t>=0)return;
 const alpha=Math.min(1,-t*2),height=Math.max(44,74*scale),fontSize=Math.max(20,43*scale);
 g.save();g.globalAlpha=alpha;g.translate(cx,cy);g.rotate(-.08);
 g.fillStyle='#e500e0';g.fillRect(-w*.56,-height/2,w*1.12,height);
 g.fillStyle='#fff';g.fillRect(-w*.24,-height/2+2,w*.48,height-4);
 g.textAlign='center';g.textBaseline='middle';g.fillStyle='#080914';g.font=`900 ${fontSize}px Arial`;g.fillText('READY?',0,0,w*.43);g.restore();
}

 function render(frame){
  ({w,h,cx,cy,R,scale}=frame.geometry);life=frame.energy??100;bindingCodes=frame.bindings;held=frame.held||new Map();laneHitUntil=frame.hitUntil||Array(8).fill(0);laneHitColor=frame.hitColors||Array(8).fill('#22ffe2');judgmentStyle=frame.judgmentStyle==='outline'?'outline':'filled';
  const t=frame.time,now=frame.now??t*1000,approach=2.6/frame.speed,travel=Math.min(w*.34,h*.4),visual=frame.ready?[]:frame.notes||[],regions=[],effects=[...(frame.effects||[])];
  showKeyboardLabels=frame.showKeyboardLabels!==false;upcomingNotes=frame.showArrivalHints===false?Array(8).fill(null):playfieldUpcomingNotes(visual,t,approach);
  activeCentralNotes=visual.filter(n=>n.type==='hold'&&n.active&&!n.done);
  if(frame.preview){
   held=new Map();laneHitUntil=Array(8).fill(0);laneHitColor=Array(8).fill('#22ffe2');
   for(const n of visual){
    if(n.type==='hold'&&t>=n.t&&t<n.end)held.set(n,{lane:n.lane,n});
    const hitTime=['hold','stream'].includes(n.type)?n.end:n.t,age=t-hitTime;
    if(age>=0&&age<.65){const pos=playfieldFeedbackTarget(n,frame.geometry);effects.push({x:pos.x,y:pos.y,t:now-age*1000,type:n.type,text:'Fantastic',detail:'JUST'});if(!['ripple','stream'].includes(n.type)&&age<.15){laneHitUntil[n.lane]=now+1;laneHitColor[n.lane]=playfieldFeedbackColor(n)}}
   }
  }
  g.save();g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';
  const bg=g.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.65);bg.addColorStop(0,'#162d48');bg.addColorStop(.45,'#0a1b30');bg.addColorStop(1,'#040d1d');g.fillStyle=bg;g.fillRect(0,0,w,h);drawArcadeField(t);
  for(let i=0;i<6;i++){const p=playfieldTarget({type:'ripple',lane:i},frame.geometry),rr=playfieldNoteRadius({type:'ripple'},frame.geometry)*RIPPLE_JUDGE_RATIO;circle(p.x,p.y,rr,'#93ffc952',Math.max(2,2.2*scale));circle(p.x,p.y,rr-4,'#c6ffe82b',Math.max(1,scale))}
  for(let i=0;i<45;i++){const x=w*.08+i*w*.0185;g.fillStyle=i%4?'#efffff99':'#fe00ef';g.beginPath();g.moveTo(x,h*.91);g.lineTo(x+4*scale,h*.905);g.lineTo(x+4*scale,h*.915);g.fill()}
  const beatPosition=(t-(frame.offset||0))/(60/frame.bpm),pulse=(frame.playing||frame.preview)&&beatPosition>=0?Math.pow(1-(beatPosition%1),4):.2;drawReferenceCore(t,pulse);drawJudgmentRing(now);
  frameSelectedIndex=frame.selectedIndex??-1;frameSelectedPoint=frame.selectedPointIndex??-1;frameEditingIndex=frame.editingIndex??-1;frameHandleScale=Math.max(1,frame.editHandleScale||1);framePathSelection=!!frame.pathSelection;drawStreamRoutes(visual,t,approach,frame.geometry,frame.preview,regions);
  for(let i=0;i<4;i++){const active=(frame.playing||frame.preview)&&beatPosition>=0&&Math.floor(beatPosition)%4===i;g.beginPath();g.arc(cx+(i-1.5)*18*scale,cy+66*scale,(active?4.5:3)*scale,0,Math.PI*2);g.fillStyle=active?(i===0?'#ffe641':'#00ffe1'):'#415261';g.fill()}
  for(let index=0;index<visual.length;index++){
   const n=visual[index],dt=n.t-t,active=frame.preview?n.type==='hold'&&t>=n.t&&t<n.end:n.active;
   if(n.type==='stream')continue;
   if(n.done||dt>approach||(frame.preview&&t>=(n.type==='hold'?n.end:n.t)))continue;
   const a=angles[n.lane],pos=playfieldPosition(n,t,approach,travel,frame.geometry),r=playfieldNoteRadius(n,frame.geometry);g.save();
   if(n.type==='hold'){const tail=playfieldHoldTail(n,t,approach,travel,frame.geometry);drawHoldRibbon(pos.x,pos.y,tail.x,tail.y,r,active,n.simultaneous)}
   if(n.type==='ripple')drawTouchApproach(pos.x,pos.y,r,dt,approach,now,n.simultaneous,showKeyboardLabels?keyLabel(bindingCodes[n.lane]):'');
   if(n.type==='flick')drawSquareApproach(playfieldSquareFrame(n,t,approach,travel,frame.geometry),dt);
   referenceNote(pos.x,pos.y,r,n.type,n.type==='flick'?squareApproachRotation(dt,approach):a,n.type==='ripple'?'touch':'beat',n.simultaneous);
   if(n.type==='hold'&&active)drawLongContact(pos.x,pos.y,r,now);
   if(index===frame.selectedIndex){g.setLineDash([5*scale,4*scale]);circle(pos.x,pos.y,r*1.65,'#ffffff',2*scale);g.setLineDash([]);g.fillStyle='#fff';g.font=`bold ${Math.max(12,15*scale)}px Arial`;g.fillText('已選取',pos.x,pos.y-r*2)}
   regions.push({index,x:pos.x,y:pos.y,r:r*1.7});g.restore();
  }
  for(const f of effects)drawReferenceHit(f,now);
  if(frame.ready)readyBanner(frame.readyTime??t);
  if(frame.paused){g.fillStyle='#0009';g.fillRect(w*.06,0,w*.88,h);g.font='900 32px Arial';g.fillStyle='#fff';g.fillText('PAUSED',cx,cy)}
  g.restore();return regions;
 }
 return {render};
}
