import fs from 'node:fs';import assert from 'node:assert/strict';
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('dist/server/index.js','utf8')).toString('base64'));
const records=new Map();const env={BUCKET:{list:async({prefix})=>({objects:[...records.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false}),get:async key=>records.has(key)?{json:async()=>JSON.parse(records.get(key))}:null,put:async(key,v)=>records.set(key,v)},ASSETS:{fetch:async()=>new Response('asset')}};
const data={duration:90,gridBpm:162,gridOffset:.1,notes:[{t:1,end:1,type:'tap',lane:0},{t:2,end:3,type:'hold',lane:2},{t:4,end:4,type:'ripple',lane:5}]};
const call=(path,method='GET',body=null,user='a',origin='https://game.test')=>worker.fetch(new Request('https://game.test'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
assert.equal((await call('/api/charts/song/hard','PUT',data)).status,200);
let saved=await(await call('/api/charts')).json();assert.equal(saved.length,1);assert.equal(saved[0].notes[1].end,3);
assert.deepEqual(await(await call('/api/charts','GET',null,'b')).json(),[]);
assert.equal((await call('/api/charts','GET',null,null)).status,401);
assert.equal((await call('/api/charts/song/hard','PUT',data,'a','https://evil.test')).status,403);
assert.equal((await call('/api/charts/song/hard','PUT',{...data,notes:[{t:1,end:0,type:'hold',lane:0}]})).status,400);
assert.equal((await call('/api/charts/song/hard','PUT',{...data,notes:[{t:1,end:1,type:'ripple',lane:7}]})).status,400);
assert.equal((await call('/api/charts/song/normal','PUT',{...data,notes:[]})).status,200);
assert.equal((await(await call('/api/charts')).json()).length,2);
assert.equal((await call('/api/charts/song/light','PUT',data)).status,200);
const all=await(await call('/api/charts')).json();assert.equal(all.length,3);assert.equal(all.find(x=>x.difficulty==='light').notes[1].end,3);assert.equal(all.find(x=>x.difficulty==='hard').notes[1].end,3);assert.equal(all.find(x=>x.difficulty==='normal').notes.length,0);
assert.deepEqual(await(await call('/api/charts','GET',null,'b')).json(),[]);
assert.equal((await call('/api/charts/song/light','PUT',{...data,notes:[{t:1,end:0,type:'hold',lane:0}]})).status,400);
assert.equal((await call('/api/charts/song/master','PUT',data)).status,400);
const streamNotes=[{t:1,end:1,lane:7,type:'stream',streamId:'left-1'},{t:1.25,end:1.25,lane:6,type:'stream',streamId:'left-1'},{t:1.5,end:1.5,lane:5,type:'stream',streamId:'left-1'}];
assert.equal((await call('/api/charts/stream-song/hard','PUT',{...data,notes:streamNotes})).status,200);
saved=await(await call('/api/charts')).json();assert.deepEqual(saved.find(n=>n.id==='stream-song').notes,streamNotes.map(n=>({...n,skin:'beat'})));
assert.deepEqual(await(await call('/api/charts','GET',null,'b')).json(),[]);
for(const invalid of [[streamNotes[0]],streamNotes.map(n=>({...n,streamId:'bad/id'})),streamNotes.map(n=>({...n,lane:7})),streamNotes.map(n=>({...n,t:1,end:1}))])assert.equal((await call('/api/charts/stream-song/hard','PUT',{...data,notes:invalid})).status,400);
assert.deepEqual((await(await call('/api/charts')).json()).find(n=>n.id==='stream-song').notes,streamNotes.map(n=>({...n,skin:'beat'})),'bad updates preserve saved route');
const whole={t:1,end:2.5,lane:5,type:'stream',path:[{x:.17,y:.79},{x:.14,y:.49},{x:.18,y:.2}]};
assert.equal((await call('/api/charts/whole-path/hard','PUT',{...data,notes:[whole]})).status,200);
const readWhole=async()=> (await(await call('/api/charts')).json()).find(n=>n.id==='whole-path').notes;
assert.deepEqual(await readWhole(),[{...whole,skin:'beat'}]);
for(const invalid of [{...whole,end:1},{...whole,end:91},{...whole,path:[]},{...whole,path:[whole.path[0]]},{...whole,path:[...whole.path,{x:1.1,y:.4}]},{...whole,path:[whole.path[0],whole.path[0]]},{...whole,path:null},{...whole,t:NaN},{...whole,path:Array(33).fill(whole.path[0])}]){
 assert.equal((await call('/api/charts/whole-path/hard','PUT',{...data,notes:[invalid]})).status,400);
 assert.deepEqual(await readWhole(),[{...whole,skin:'beat'}],'invalid path must preserve existing cloud data');
}
assert.deepEqual(await(await call('/api/charts','GET',null,'other')).json(),[]);
const curved={...whole,path:[{x:.25,y:.65,curve:{x:.5,y:.15}},{x:.75,y:.65,curve:{x:.86,y:.8}},{x:.86,y:.3}]};
assert.equal((await call('/api/charts/curve-path/hard','PUT',{...data,notes:[curved]})).status,200);
const readCurve=async()=> (await(await call('/api/charts')).json()).find(n=>n.id==='curve-path').notes;
assert.deepEqual(await readCurve(),[{...curved,skin:'beat'}],'curve control handles survive chart reload');
for(const invalid of [null,{x:.5,y:2},{x:'0.5',y:.2},[],{}]){
 assert.equal((await call('/api/charts/curve-path/hard','PUT',{...data,notes:[{...curved,path:[{...curved.path[0],curve:invalid},...curved.path.slice(1)]}]})).status,400);
 assert.deepEqual(await readCurve(),[{...curved,skin:'beat'}]);
}
assert.equal((await call('/api/charts/curve-path/hard','PUT',{...data,notes:[{...curved,path:curved.path.map((p,i)=>i===2?{...p,curve:{x:.5,y:.5}}:p)}]})).status,400,'endpoint cannot own an outgoing curve');
// The music-upload metadata cleaner preserves a whole path and its end too.
const form=new FormData();form.set('audio',new Blob([new Uint8Array(12)],{type:'audio/mpeg'}),'track.mp3');form.set('metadata',JSON.stringify({kind:'custom',title:'Route',duration:12,bpm:120,charts:{hard:[curved],normal:[whole]}}));
const musicReq=new Request('https://game.test/api/music/my-path',{method:'PUT',headers:{'oai-authenticated-user-id':'a',Origin:'https://game.test'},body:form});
assert.equal((await worker.fetch(musicReq,env)).status,200);
const music=await(await call('/api/music')).json();assert.deepEqual(music[0].charts.hard,[{...curved,skin:'beat'}]);assert.equal(music[0].charts.normal[0].end,2.5);
assert.equal(await(await call('/index.html')).text(),'asset');console.log('PASS chart save, reload, independent difficulties, user isolation, whole-path and legacy STREAM persistence/validation, music metadata and static routing');
