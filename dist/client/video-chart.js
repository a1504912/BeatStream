'use strict';
let sumidaReferencePromise;
function isSumida(song){return song.id==='official-sumida'}
function describeVideoChart(song){
 if(!isSumida(song))return;
 song.bpm=180;song.version='VIDEO CHART / 180 BPM';
 song.description='依你提供的實機影片重建：同時押、交替、長按、滑切與外圍縮圈。BEAST 為完整參考配置，NORMAL 為減量版；已移除方向滑動。30 fps 影像辨識與人工校正版本，並非官方原始譜。'+(song.videoAlignment==='unmatched'?' 音檔版本未能可靠對齊，暫時保留原練習譜。':song.videoAlignment==='matched'?' 已與匯入音樂自動對齊。':' 播放時會自動對齊匯入音檔。');
}
function audioEnvelope(buffer){
 const data=buffer.getChannelData(0),rate=buffer.sampleRate,bins=Math.floor(buffer.duration*20),result=[];
 for(let i=0;i<bins;i++){let energy=0;for(let j=0;j<200;j++){const value=data[Math.min(data.length-1,Math.floor((i*200+j)*rate/4000))];energy+=value*value}result.push(Math.log1p(Math.sqrt(energy/200)*100))}return result;
}
function matchVideoAudio(reference,source){
 let best={score:-1,lag:0};
 for(let lag=-800;lag<=800;lag++){
  let n=0,x=0,y=0,xx=0,yy=0,xy=0;
  for(let i=300;i<Math.min(2300,reference.length);i+=3){const j=i+lag;if(j<0||j>=source.length)continue;const a=reference[i],b=source[j];n++;x+=a;y+=b;xx+=a*a;yy+=b*b;xy+=a*b}
  if(n<480)continue;const score=(xy-x*y/n)/Math.sqrt(Math.max(1e-9,(xx-x*x/n)*(yy-y*y/n)));
  if(score>best.score)best={score,lag:lag/20};
 }
 return best;
}
async function applyVideoChart(song,buffer){
 if(!isSumida(song)||song.videoChartBuffer===buffer)return buffer;
 try{
  if(!sumidaReferencePromise)sumidaReferencePromise=fetch('sumida-video.json').then(r=>{if(!r.ok)throw Error('reference unavailable');return r.json()}).catch(e=>{sumidaReferencePromise=null;throw e});
  const reference=await sumidaReferencePromise,match=matchVideoAudio(reference.envelope,audioEnvelope(buffer));
  song.videoChartBuffer=buffer;
  if(match.score<.32){song.videoAlignment='unmatched';describeVideoChart(song);if(currentSong===song)showToast('音檔與影片版本未能對齊，暫時保留原譜。請使用影片相同版本的音樂。');return buffer}
  const convert=ns=>ns.map(n=>({...n,t:Number((n.t+match.lag).toFixed(4)),end:Number((n.end+match.lag).toFixed(4)),drum:n.type==='flick'?'hat':n.type==='hold'?'tom':'snare'})).filter(n=>n.t>=0&&n.end<buffer.duration);
  song.charts={normal:convert(reference.normal),hard:convert(reference.notes)};song.bpm=180;song.offset=((match.lag% (1/3))+(1/3))%(1/3);song.videoAlignment='matched';song.videoChartRevision=reference.revision;song.videoChartLag=match.lag;describeVideoChart(song);
  if(currentSong===song&&mode==='idle')renderSongs();
 }catch{if(currentSong===song)showToast('影片參考譜暫時無法載入，這次使用已保存的譜面。')}
 return buffer;
}
