'use strict';
const EFFECT_PACKS=[
 {id:'rhythm',name:'清脆鼓邊（推薦）',description:'圓形用短鼓邊，縮圈用木質短擊，滑切用踩鈸掃聲，長按用短通鼓與收尾鼓邊。尾音短，連打時仍能分辨每一下。'},
 {id:'pulse',name:'乾脆電子',description:'五種乾燥電子打擊，起音更俐落、尾音更短，適合高速或密集譜面。'},
 {id:'heavy',name:'厚實鼓組',description:'鼓邊與通鼓增加鼓身，踩鈸較厚，適合想要較強打擊感的曲目。'},
 {id:'tutorial',name:'教學影片音效・降低背景聲',description:'從這次的實機教學錄音分別擷取點擊、縮圈、滑切與長按。保留命中起音並降低背景聲；仍可能有少量音樂殘留。'},
 {id:'tutorial-raw',name:'教學影片音效・原錄音',description:'相同命中片段的原錄音短切，僅調整音量與淡入淡出；包含影片的背景音樂及現場聲。'},
 {id:'reference',name:'影片打擊聲（處理版）',description:'從你提供的 BeatStream 影片擷取短打擊聲，降低背景音樂並縮短尾音；不是獨立原版音效檔。'},
 {id:'wood',name:'木質敲擊',description:'乾脆的木頭敲擊聲，短促、有顆粒感。'},
 {id:'click',name:'清脆按鍵',description:'輕快的喀噠與按鍵聲，尾音很短。'},
 {id:'glass',name:'玻璃輕敲',description:'明亮、清透的玻璃敲擊聲。'},
 {id:'metal',name:'金屬打擊',description:'帶金屬質感的短打擊，聲音較銳利。'},
 {id:'soft',name:'低沉碰擊',description:'較厚實、低沉的碰擊感。'},
 {id:'pluck',name:'電子彈音',description:'有音高的彈撥與電子提示音。'},
 {id:'drum',name:'原本鼓組',description:'原本的底鼓、小鼓、踩鈸與通鼓。'}
];
const TUTORIAL_FILES={kick:'beat',snare:'ripple',hat:'slash',tom:'long',longStart:'long-start'};
const RHYTHM_PACKS=['rhythm','pulse','heavy'];
let soundPack='rhythm',effectPreviewContext,previewEffectGain,previewEffectSources=[],effectPreviewToken=0,settingsGeneration=0;
const packPromises=new WeakMap(),readyPacks=new WeakMap(),effectBytes=new Map();
async function loadEffectPack(context,id){
 if(!EFFECT_PACKS.some(p=>p.id===id))throw Error('Unknown sound pack');
 let pending=packPromises.get(context);if(!pending){pending=new Map();packPromises.set(context,pending)}
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{const result={},tutorial=id==='tutorial'||id==='tutorial-raw',rhythm=RHYTHM_PACKS.includes(id);await Promise.all((tutorial||rhythm?Object.keys(TUTORIAL_FILES):['kick','snare','hat','tom']).map(async kind=>{
  if(SYNTH_PACKS.includes(id)){result[kind]=buildSynthEffect(id,kind,context);return}
  if(id==='drum'){result[kind]=buildDrumBuffer(kind,context);return}
  const url=rhythm?'sfx/'+id+'-'+TUTORIAL_FILES[kind]+'.wav':tutorial?'sfx/tutorial-'+TUTORIAL_FILES[kind]+(id==='tutorial-raw'?'-raw':'')+'.wav':id==='reference'?'sfx/reference-hit.wav':'sfx/'+id+'-'+kind+'.wav';
  if(!effectBytes.has(url))effectBytes.set(url,fetch(url,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Sound file unavailable');return r.arrayBuffer()}).catch(e=>{effectBytes.delete(url);throw e}));
  const bytes=await effectBytes.get(url);result[kind]=await context.decodeAudioData(bytes.slice(0));
 }));if(!readyPacks.has(context))readyPacks.set(context,new Map());readyPacks.get(context).set(id,result);return result})();
 pending.set(id,task);try{return await task}catch(e){pending.delete(id);throw e}
}
function connectHitOutput(context,input,destination){const limiter=context.createDynamicsCompressor();limiter.threshold.value=-4;limiter.knee.value=3;limiter.ratio.value=10;limiter.attack.value=.001;limiter.release.value=.06;input.connect(limiter);limiter.connect(destination);return limiter}
function stopEffectPreview(){effectPreviewToken++;for(const source of previewEffectSources){try{source.stop()}catch{}source.disconnect()}previewEffectSources=[];const b=document.querySelector('#preview-effect');if(b){b.disabled=false;b.textContent='▶ 試聽節奏'}}
function updateEffectDescription(){const id=document.querySelector('#effect-pack').value;document.querySelector('#effect-description').textContent=EFFECT_PACKS.find(p=>p.id===id)?.description||''}
async function previewEffectPack(){
 if(previewEffectSources.length){stopEffectPreview();return}
 stopEffectPreview();const token=effectPreviewToken,id=document.querySelector('#effect-pack').value,b=document.querySelector('#preview-effect'),status=document.querySelector('#effect-status');
 const volume=Number(document.querySelector('#hit-volume').value)/100;
 if(muted||!document.querySelector('#hit-sound-enabled').checked||volume===0){status.textContent='請先開啟聲音與命中音效，並提高音效音量。';return}
 b.disabled=true;b.textContent='載入音效…';status.textContent='';
 try{
  if(!effectPreviewContext){effectPreviewContext=new AudioContext({latencyHint:'interactive'});previewEffectGain=effectPreviewContext.createGain();connectHitOutput(effectPreviewContext,previewEffectGain,effectPreviewContext.destination)}
  await effectPreviewContext.resume();const pack=await loadEffectPack(effectPreviewContext,id);if(token!==effectPreviewToken||!settingsOpen)return;
  previewEffectGain.gain.value=volume*.95;const t=effectPreviewContext.currentTime+.03;
  const pattern=[['kick',0],['kick',.30],['kick',.45],['snare',.60],['kick',.90],['hat',1.05],['kick',1.20],['longStart',1.50],['tom',1.80]];
  pattern.forEach(([kind,at])=>{const source=effectPreviewContext.createBufferSource();source.buffer=pack[kind]||pack.kick;source.connect(previewEffectGain);previewEffectSources.push(source);source.onended=()=>{source.disconnect();previewEffectSources=previewEffectSources.filter(s=>s!==source);if(token===effectPreviewToken&&!previewEffectSources.length){b.textContent='▶ 再試聽';status.textContent='已試聽連打、縮圈、滑切與長按；按「套用到所有符號」後儲存設定。'}};source.start(t+at)});
  b.disabled=false;b.textContent='■ 停止試聽';
 }catch{if(token===effectPreviewToken){status.textContent='音效載入失敗，請再試一次。';b.disabled=false;b.textContent='▶ 重試試聽'}}
}
function initEffectOptions(){const select=document.querySelector('#effect-pack');select.innerHTML=EFFECT_PACKS.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('');select.value=soundPack;select.onchange=()=>{stopEffectPreview();updateEffectDescription();draftSymbolSounds=validateSymbolSounds(draftSymbolSounds,select.value);renderSymbolSounds();document.querySelector('#effect-status').textContent='按試聽比較，儲存後套用到遊戲。'};document.querySelector('#preview-effect').onclick=previewEffectPack;updateEffectDescription()}
