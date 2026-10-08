'use strict';
// Browser-local extraction. Only the resulting audio is sent to the music API.
((root)=>{
 const MAX_AUDIO_BYTES=100*1024*1024,MAX_VIDEO_BYTES=250*1024*1024;
 const abort=signal=>signal?.throwIfAborted();
 const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
 const error=(message,code)=>Object.assign(new Error(message),{code});
 function boxes(bytes,start=0,end=bytes.length){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];
  for(let at=start;at<end;){
   if(at+8>end||out.length>100000)throw error('影片容器資料不完整','CONTAINER');
   let size=view.getUint32(at),header=8;const type=String.fromCharCode(...bytes.subarray(at+4,at+8));
   if(size===1){if(at+16>end)throw error('影片容器資料不完整','CONTAINER');size=Number(view.getBigUint64(at+8));header=16}else if(size===0)size=end-at;
   if(!Number.isSafeInteger(size)||size<header||at+size>end)throw error('影片容器資料不完整','CONTAINER');
   out.push({type,start:at,data:at+header,end:at+size,size});at+=size;
  }return out;
 }
 function child(bytes,box,type){const found=boxes(bytes,box.data,box.end).find(b=>b.type===type);if(!found)throw error('這個影片需要以播放方式擷取音軌','CONTAINER');return found}
 function makeBox(type,parts){const size=8+parts.reduce((n,p)=>n+p.length,0),result=new Uint8Array(size);new DataView(result.buffer).setUint32(0,size);for(let i=0;i<4;i++)result[4+i]=type.charCodeAt(i);let at=8;for(const part of parts){result.set(part,at);at+=part.length}return result}
 function extractMP4Audio(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),top=boxes(bytes),moov=top.find(b=>b.type==='moov');
  if(!moov||top.some(b=>b.type==='moof'))throw error('分段影片需要以播放方式擷取音軌','CONTAINER');
  const tracks=boxes(bytes,moov.data,moov.end).filter(b=>b.type==='trak');
  const track=tracks.find(t=>{try{const handler=child(bytes,child(bytes,t,'mdia'),'hdlr');return String.fromCharCode(...bytes.subarray(handler.data+8,handler.data+12))==='soun'}catch{return false}});
  if(!track)throw error('這個影片沒有可用的音軌','NO_AUDIO');
  const stbl=child(bytes,child(bytes,child(bytes,track,'mdia'),'minf'),'stbl'),tables=boxes(bytes,stbl.data,stbl.end);
  const sz=tables.find(b=>b.type==='stsz'),sc=tables.find(b=>b.type==='stsc'),co=tables.find(b=>b.type==='stco'||b.type==='co64');
  if(!sz||!sc||!co)throw error('這個影片需要以播放方式擷取音軌','CONTAINER');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),read=(box,at)=>{if(at+4>box.end)throw error('音軌資料不完整','CONTAINER');return view.getUint32(at)};
  const fixed=read(sz,sz.data+4),samples=read(sz,sz.data+8),chunkCount=read(co,co.data+4),runCount=read(sc,sc.data+4),runs=[];
  if(!samples||samples>2000000||!chunkCount||chunkCount>samples||!runCount||runCount>chunkCount)throw error('音軌索引格式不支援','CONTAINER');
  for(let i=0;i<runCount;i++){const at=sc.data+8+i*12,first=read(sc,at),count=read(sc,at+4);if(!count||first<1||first>chunkCount||(i&&first<=runs[i-1].first))throw error('音軌索引格式不支援','CONTAINER');runs.push({first,count})}
  if(runs[0].first!==1)throw error('音軌索引格式不支援','CONTAINER');
  const chunks=[];let sample=0,run=0,total=0;
  for(let i=0;i<chunkCount;i++){
   while(run+1<runs.length&&runs[run+1].first<=i+1)run++;
   const at=co.data+8+i*(co.type==='co64'?8:4);if(at+(co.type==='co64'?8:4)>co.end)throw error('音軌索引資料不完整','CONTAINER');
   const offset=co.type==='co64'?Number(view.getBigUint64(at)):view.getUint32(at);let length=0;
   for(let j=0;j<runs[run].count;j++){if(sample>=samples)throw error('音軌樣本數不正確','CONTAINER');length+=fixed||read(sz,sz.data+12+sample*4);sample++}
   if(!Number.isSafeInteger(offset)||offset<0||offset+length>bytes.length)throw error('音軌範圍不正確','CONTAINER');
   total+=length;if(total>MAX_AUDIO_BYTES)throw error('擷取後的音軌超過 100 MB','SIZE');chunks.push({offset,length});
  }
  if(sample!==samples)throw error('音軌樣本數不正確','CONTAINER');
  const ftyp=makeBox('ftyp',[Uint8Array.from([77,52,65,32,0,0,0,0,105,115,111,109,109,112,52,50,77,52,65,32])]);
  const mvhd=child(bytes,moov,'mvhd'),packedMoov=makeBox('moov',[bytes.subarray(mvhd.start,mvhd.end),bytes.subarray(track.start,track.end)]);
  const packedTrack=child(packedMoov,boxes(packedMoov)[0],'trak'),packedTable=child(packedMoov,child(packedMoov,child(packedMoov,packedTrack,'mdia'),'minf'),'stbl'),packedCo=child(packedMoov,packedTable,co.type),packedView=new DataView(packedMoov.buffer);
  let position=ftyp.length+packedMoov.length+8;
  for(let i=0;i<chunks.length;i++){const at=packedCo.data+8+i*(co.type==='co64'?8:4);if(co.type==='co64')packedView.setBigUint64(at,BigInt(position));else packedView.setUint32(at,position);position+=chunks[i].length}
  const header=new Uint8Array(8);new DataView(header.buffer).setUint32(0,total+8);header.set([109,100,97,116],4);
  return new Blob([ftyp,packedMoov,header,...chunks.map(c=>bytes.subarray(c.offset,c.offset+c.length))],{type:'audio/mp4'});
 }
 function isVideo(file){return file.type?.startsWith('video/')||/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name)}
 function validateFile(file){if(!file||!file.size)throw Error('請選擇音樂或影片');if(file.size>(isVideo(file)?MAX_VIDEO_BYTES:MAX_AUDIO_BYTES))throw Error(isVideo(file)?'影片請小於 250 MB':'音檔請小於 100 MB')}
 function validateDuration(buffer){if(!Number.isFinite(buffer.duration)||buffer.duration<5||buffer.duration>600)throw Error('請選擇長度 5 秒到 10 分鐘的音樂或影片')}
 async function encodeWav(buffer,signal){
  validateDuration(buffer);let channels=Math.min(2,buffer.numberOfChannels),frames=buffer.length;
  if(44+frames*channels*2>MAX_AUDIO_BYTES)channels=1;
  const output=new ArrayBuffer(44+frames*channels*2),v=new DataView(output),label=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};
  label(0,'RIFF');v.setUint32(4,output.byteLength-8,true);label(8,'WAVE');label(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);label(36,'data');v.setUint32(40,output.byteLength-44,true);
  const data=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  for(let begin=0;begin<frames;begin+=65536){abort(signal);const end=Math.min(frames,begin+65536);for(let i=begin;i<end;i++)for(let c=0;c<channels;c++){let sample=channels===1?data.reduce((sum,d)=>sum+d[i],0)/data.length:data[c][i];sample=Math.max(-1,Math.min(1,sample));v.setInt16(44+(i*channels+c)*2,Math.round(sample*(sample<0?32768:32767)),true)}await pause()}
  return new Blob([output],{type:'audio/wav'});
 }
 async function recordVideoAudio(file,context,{signal,onProgress=()=>{},onPlaybackRequired}={}){
  if(!root.MediaRecorder||!context.createMediaStreamDestination)throw Error('這個瀏覽器無法擷取此影片音軌，請使用 MP4／MOV（AAC 音軌）或音樂檔');
  const video=document.createElement('video'),url=URL.createObjectURL(file);video.src=url;video.preload='auto';video.playsInline=true;video.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';document.body.appendChild(video);
  let source,destination,recorder,timer;
  try{
   await new Promise((resolve,reject)=>{const done=fn=>{video.onloadedmetadata=video.onerror=null;signal?.removeEventListener('abort',cancel);fn()},cancel=()=>done(()=>reject(signal.reason));video.onloadedmetadata=()=>done(resolve);video.onerror=()=>done(()=>reject(Error('瀏覽器無法播放這個影片，請改用 MP4 或 MOV')));signal?.addEventListener('abort',cancel,{once:true});video.load()});abort(signal);validateDuration(video);
   source=context.createMediaElementSource(video);destination=context.createMediaStreamDestination();source.connect(destination);
   const mime=['audio/webm;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('這個瀏覽器無法錄製影片音軌，請改用音樂檔');
   try{await video.play()}catch(e){if(e.name!=='NotAllowedError'||!onPlaybackRequired)throw Error('請允許影片播放後再匯入');await onPlaybackRequired(()=>video.play());abort(signal)}
   recorder=new MediaRecorder(destination.stream,{mimeType:mime,audioBitsPerSecond:192000});
   const audio=await new Promise((resolve,reject)=>{const parts=[];let settled=false;const done=(err,blob)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',cancel);err?reject(err):resolve(blob)},cancel=()=>{try{recorder.stop()}catch{}done(signal.reason)};
    recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.onstop=()=>done(null,new Blob(parts,{type:recorder.mimeType}));recorder.onerror=()=>done(Error('影片音軌擷取失敗，請重試'));video.onerror=()=>done(Error('影片播放中斷，請重試'));video.onended=()=>{if(recorder.state==='recording')recorder.stop()};signal?.addEventListener('abort',cancel,{once:true});recorder.start(1000);
    timer=setInterval(()=>onProgress(Math.min(1,video.currentTime/video.duration),'正在擷取音軌，請保持此頁開啟（'+Math.ceil(video.currentTime)+'／'+Math.ceil(video.duration)+' 秒）'),500);
   });abort(signal);return {audio,buffer:await context.decodeAudioData(await audio.arrayBuffer())};
  }finally{clearInterval(timer);video.pause();if(recorder?.state==='recording')recorder.stop();source?.disconnect();destination?.stream.getTracks().forEach(t=>t.stop());video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url)}
 }
 async function decodeMediaFile(file,context,options={}){
  const {signal,onProgress=()=>{}}=options;validateFile(file);abort(signal);onProgress(.05,'正在讀取音軌…');let audio=file,buffer;
  if(isVideo(file)&&/\.(mp4|mov|m4v)$/i.test(file.name)){
   try{const data=await file.arrayBuffer();abort(signal);audio=extractMP4Audio(data);onProgress(.55,'已擷取影片音軌，正在解碼…');buffer=await context.decodeAudioData(await audio.arrayBuffer())}catch(e){abort(signal);if(e.code==='NO_AUDIO'||e.code==='SIZE')throw e;audio=null}
  }
  if(!buffer&&audio){try{buffer=await context.decodeAudioData(await audio.arrayBuffer())}catch{abort(signal);if(!isVideo(file))throw Error('無法解碼這個音檔，請使用 MP3、WAV、M4A 或 OGG');audio=null}}
  if(!buffer){const captured=await recordVideoAudio(file,context,options);audio=captured.audio;buffer=captured.buffer}else if(isVideo(file)&&audio===file){validateDuration(buffer);audio=await encodeWav(buffer,signal)}
  abort(signal);validateDuration(buffer);const ext=audio.type.includes('mp4')?'m4a':audio.type.includes('webm')?'webm':audio.type.includes('wav')?'wav':file.name.split('.').pop();
  onProgress(1,'音軌已就緒');return {buffer,audio:new File([audio],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type:audio.type||'audio/'+(ext==='mp3'?'mpeg':ext)}),sourceType:isVideo(file)?'video':'audio'};
 }
 async function analysisSamples(buffer,signal){
  const sampleRate=11025,length=Math.floor(buffer.duration*sampleRate),samples=new Float32Array(length),channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,i)=>buffer.getChannelData(i)),ratio=buffer.sampleRate/sampleRate;
  for(let begin=0;begin<length;begin+=65536){abort(signal);for(let i=begin;i<Math.min(length,begin+65536);i++){const from=Math.floor(i*ratio),to=Math.min(buffer.length,Math.max(from+1,Math.floor((i+1)*ratio)));let sum=0;for(let j=from;j<to;j++)for(const channel of channels)sum+=channel[j];samples[i]=sum/((to-from)*channels.length)}await pause()}
  let energy=0;for(let i=0;i<length;i++)energy+=samples[i]*samples[i];if(energy<length*1e-9&&channels.length>1)for(let i=0;i<length;i++)samples[i]=channels[0][Math.floor(i*ratio)];
  return {samples,sampleRate,duration:buffer.duration};
 }
 const api={extractMP4Audio,decodeMediaFile,analysisSamples,encodeWav,validateFile,isVideo};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BeatStreamMedia=api;
})(typeof globalThis!=='undefined'?globalThis:this);
