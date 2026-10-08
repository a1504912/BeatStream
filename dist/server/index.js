const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const scoreColumns='run_id AS id,song_id AS songId,difficulty,score,max_combo AS maxCombo,note_count AS noteCount,played_at AS playedAt';
const bestScores=async(db,user,song,difficulty)=>{
 const result=await db.prepare('SELECT '+scoreColumns+' FROM scores WHERE user_id=? AND song_id=? AND difficulty=? ORDER BY score DESC,max_combo DESC,played_at DESC,run_id ASC LIMIT 5').bind(user,song,difficulty).all();
 return result.results;
};
async function scoreRequest(request,env,url,user){
 if(!env.DB)return json({error:'成績儲存暫時無法使用'},503);
 const match=url.pathname.match(/^\/api\/scores\/([a-zA-Z0-9_-]{1,96})\/(light|normal|hard)$/);
 if(!match)return json({error:'歌曲或難度不正確'},400);
 const [,songId,difficulty]=match;
 if(request.method==='GET'){
  try{return json(await bestScores(env.DB,user,songId,difficulty));}
  catch(e){console.error('Score history unavailable',e);return json({error:'成績讀取失敗'},503);}
 }
 if(request.method!=='POST')return json({error:'不支援的成績操作'},405);
 if(Number(request.headers.get('Content-Length'))>4096)return json({error:'成績資料過大'},413);
 let data;
 try{const text=await request.text();if(text.length>4096)return json({error:'成績資料過大'},413);data=JSON.parse(text);}
 catch{return json({error:'成績格式錯誤'},400);}
 if(!data||typeof data.id!=='string'||!/^[a-zA-Z0-9_-]{12,64}$/.test(data.id)||data.songId!==songId||data.difficulty!==difficulty||data.completed!==true||data.auto!==false||songId==='rules-practice'||!Number.isInteger(data.score)||data.score<0||data.score>1000000||!Number.isInteger(data.noteCount)||data.noteCount<1||data.noteCount>10000||!Number.isInteger(data.maxCombo)||data.maxCombo<0||data.maxCombo>data.noteCount)return json({error:'成績格式不正確'},400);
 try{
  await env.DB.prepare('INSERT INTO scores(user_id,run_id,song_id,difficulty,score,max_combo,note_count,played_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,run_id) DO NOTHING').bind(user,data.id,songId,difficulty,data.score,data.maxCombo,data.noteCount,Date.now()).run();
  const saved=await env.DB.prepare('SELECT '+scoreColumns+' FROM scores WHERE user_id=? AND run_id=?').bind(user,data.id).first();
  if(!saved||saved.songId!==songId||saved.difficulty!==difficulty||saved.score!==data.score||saved.maxCombo!==data.maxCombo||saved.noteCount!==data.noteCount)return json({error:'此場成績已儲存'},409);
  return json(saved);
 }catch(e){console.error('Score save failed',e);return json({error:'成績儲存失敗'},503);}
}
const validStreamPath=n=>n.end-n.t>=.05&&Array.isArray(n.path)&&n.path.length>=2&&n.path.length<=32&&n.path.every((p,i)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.04&&p.x<=.96&&p.y>=.08&&p.y<=.9&&(p.curve===undefined||i<n.path.length-1&&p.curve&&Number.isFinite(p.curve.x)&&Number.isFinite(p.curve.y)&&p.curve.x>=.04&&p.curve.x<=.96&&p.curve.y>=.08&&p.curve.y<=.9)&&(!i||Math.hypot(p.x-n.path[i-1].x,p.y-n.path[i-1].y)>=.015));
const validNote=(n,duration)=>n&&['tap','hold','flick','ripple','stream'].includes(n.type)&&Number.isInteger(n.lane)&&n.lane>=0&&n.lane<(n.type==='ripple'?6:8)&&Number.isFinite(n.t)&&n.t>=0&&n.t<duration&&Number.isFinite(n.end)&&n.end>=n.t&&n.end<=duration&&(n.type!=='hold'||n.end-n.t>=.05)&&(n.type!=='stream'||(n.path!==undefined?validStreamPath(n):typeof n.streamId==='string'&&/^[a-zA-Z0-9_-]{1,48}$/.test(n.streamId)));
const validStreams=notes=>{const groups=new Map();for(const n of notes)if(n.type==='stream'&&!n.path){if(!groups.has(n.streamId))groups.set(n.streamId,[]);groups.get(n.streamId).push(n)}return [...groups.values()].every(group=>{group.sort((a,b)=>a.t-b.t);return group.length>=2&&group.length<=64&&group.every((n,i)=>!i||n.t-group[i-1].t>=.05&&n.lane!==group[i-1].lane)})};
const cleanNote=n=>({t:n.t,end:n.type==='hold'||n.type==='stream'&&n.path?n.end:n.t,lane:n.lane,type:n.type,skin:n.type==='ripple'?'touch':'beat',...(n.type==='stream'?(n.path?{path:n.path.map(p=>({x:p.x,y:p.y,...(p.curve?{curve:{x:p.curve.x,y:p.curve.y}}:{})}))}:{streamId:n.streamId}):{}),...(['kick','snare','hat','tom'].includes(n.drum)?{drum:n.drum}:{})});
export default {async fetch(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/music')&&!url.pathname.startsWith('/api/charts')&&!url.pathname.startsWith('/api/scores'))return env.ASSETS.fetch(request);
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'請先登入再儲存資料'},401);
 if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'來源不符'},403);
 if(url.pathname.startsWith('/api/scores'))return scoreRequest(request,env,url,user);
 if(!env.BUCKET)return json({error:'音樂儲存暫時無法使用'},503);
 if(url.pathname.startsWith('/api/charts')){
  const prefix='charts/'+encodeURIComponent(user)+'/';
  try{
   if(url.pathname==='/api/charts'&&request.method==='GET'){
    let cursor,records=[];do{const page=await env.BUCKET.list({prefix,cursor});records.push(...await Promise.all(page.objects.map(async o=>{const v=await env.BUCKET.get(o.key);return v?await v.json():null})));cursor=page.truncated?page.cursor:undefined}while(cursor);return json(records.filter(Boolean));
   }
   const m=url.pathname.match(/^\/api\/charts\/([a-zA-Z0-9_-]+)\/(light|normal|hard)$/);
   if(!m||request.method!=='PUT')return json({error:'不支援的譜面操作'},400);
   if(Number(request.headers.get('Content-Length'))>2000000)return json({error:'譜面過大'},413);
   const text=await request.text();if(text.length>2000000)return json({error:'譜面過大'},413);const data=JSON.parse(text);
   if(!Number.isFinite(data.duration)||data.duration<=0||data.duration>3600||!Number.isFinite(data.gridBpm)||data.gridBpm<20||data.gridBpm>400||!Number.isFinite(data.gridOffset)||Math.abs(data.gridOffset)>3600||!Array.isArray(data.notes)||data.notes.length>10000||!data.notes.every(n=>validNote(n,data.duration))||!validStreams(data.notes))return json({error:'譜面時間或音符格式不正確'},400);
   const record={id:m[1],difficulty:m[2],duration:data.duration,gridBpm:data.gridBpm,gridOffset:data.gridOffset,notes:data.notes.map(cleanNote),updatedAt:Date.now()};
   await env.BUCKET.put(prefix+m[1]+'/'+m[2],JSON.stringify(record));return json(record);
  }catch(e){console.error('Chart storage failed',e);return json({error:'譜面儲存失敗，請再試一次'},503)}
 }
 const prefix='music/'+encodeURIComponent(user)+'/',match=url.pathname.match(/^\/api\/music\/([a-zA-Z0-9_-]+)(\/audio)?$/);
 try{
  if(url.pathname==='/api/music'&&request.method==='GET'){
   let cursor,songs=[];do{const list=await env.BUCKET.list({prefix:prefix+'meta/',cursor});songs.push(...await Promise.all(list.objects.map(async o=>{const v=await env.BUCKET.get(o.key);return v?await v.json():null})));cursor=list.truncated?list.cursor:undefined}while(cursor);return json(songs.filter(Boolean));
  }
  if(!match)return json({error:'找不到歌曲'},404);const id=match[1],key=prefix+'meta/'+id;
  if(request.method==='GET'&&match[2]){const meta=await env.BUCKET.get(key);if(!meta)return json({error:'尚未儲存'},404);const data=await meta.json(),audio=await env.BUCKET.get(data.audioKey);if(!audio)return json({error:'音檔不存在'},404);return new Response(audio.body,{headers:{'Content-Type':data.contentType||'application/octet-stream','Cache-Control':'private, no-store'}})}
  if(request.method!=='PUT'||match[2])return json({error:'不支援的操作'},405);
  if(Number(request.headers.get('Content-Length'))>102*1024*1024)return json({error:'音檔請小於 100 MB'},413);
  const form=await request.formData(),audio=form.get('audio');let meta;try{const text=form.get('metadata');if(typeof text!=='string'||text.length>2000000)return json({error:'譜面過大'},413);meta=JSON.parse(text)}catch{return json({error:'譜面格式錯誤'},400)}
  if(!meta||!audio||typeof audio.arrayBuffer!=='function'||audio.size>100*1024*1024||!audio.size||!Number.isFinite(meta.duration)||meta.duration<5||meta.duration>600||!Number.isFinite(meta.bpm)||meta.bpm<20||meta.bpm>400||!['normal','hard'].every(k=>Array.isArray(meta.charts?.[k])&&meta.charts[k].length<=10000&&meta.charts[k].every(n=>validNote(n,meta.duration))&&validStreams(meta.charts[k]))||(meta.charts?.light!==undefined&&(!Array.isArray(meta.charts.light)||meta.charts.light.length>10000||!meta.charts.light.every(n=>validNote(n,meta.duration))||!validStreams(meta.charts.light)))||((meta.offset??0)!==0&&(!Number.isFinite(meta.offset)||Math.abs(meta.offset)>meta.duration))||(meta.kind==='custom'&&(!id.startsWith('my-')||typeof meta.title!=='string'||!meta.title.trim())))return json({error:'音檔或譜面格式錯誤'},400);
  if(audio.type&&!audio.type.startsWith('audio/')&&!['application/octet-stream','video/mp4'].includes(audio.type))return json({error:'請先擷取影片音軌再儲存'},400);
  const old=await env.BUCKET.get(key),previous=old?await old.json():null,audioKey=prefix+'audio/'+id+'/'+crypto.randomUUID();
  const custom=meta.kind==='custom',analysis=meta.analysis&&typeof meta.analysis==='object'?{version:meta.analysis.version===3?3:1,method:meta.analysis.method==='audio-phrases'?'audio-phrases':'audio-onsets',confidence:['high','low','manual'].includes(meta.analysis.confidence)?meta.analysis.confidence:'low',fallback:!!meta.analysis.fallback,density:['easy','balanced','dense'].includes(meta.analysis.density)?meta.analysis.density:'balanced'}:null;
  const record={id,kind:custom?'custom':'official',title:String(meta.title||meta.localName||'自訂歌曲').trim().slice(0,160),artist:String(meta.artist||'自訂匯入').slice(0,160),sourceType:meta.sourceType==='video'?'video':'audio',localName:String(meta.localName||'音檔').slice(0,255),duration:meta.duration,bpm:meta.bpm,offset:meta.offset||0,analysis,charts:Object.fromEntries(['light','normal','hard'].filter(k=>meta.charts[k]!==undefined).map(k=>[k,meta.charts[k].map(cleanNote)])),audioKey,contentType:audio.type||'application/octet-stream',updatedAt:Date.now()};
  await env.BUCKET.put(audioKey,audio.stream());try{await env.BUCKET.put(key,JSON.stringify(record))}catch(e){await env.BUCKET.delete(audioKey);throw e}
  if(previous?.audioKey)await env.BUCKET.delete(previous.audioKey).catch(()=>{});return json({saved:true,audioRevision:audioKey.split('/').pop()});
 }catch(e){console.error('Music storage failed',e);return json({error:'音樂儲存暫時失敗，請再試一次'},503)}
}};
