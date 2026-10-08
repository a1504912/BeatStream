'use strict';
const SYMBOL_SOUNDS=[['tap','一般點擊','Beat','#ff38bd'],['holdStart','長按開始','Long · 按住','#ff38bd'],['hold','長按結束','Long · 尾端','#ff38bd'],['ripple','定點縮圈','Ripple','#82ff35'],['flick','方塊劃除','Slash','#8fff47'],['stream','連續滑動','Stream','#b794ff']];
const SYNTH_PACKS=['arcade','taiko','clap','bubble','chime'];
EFFECT_PACKS.push(
 {id:'arcade',name:'街機脆擊',description:'清晰的高頻起音與短促電子鼓身。'},
 {id:'taiko',name:'和太鼓',description:'厚實鼓心與乾脆鼓邊，適合強拍。'},
 {id:'clap',name:'電子拍手',description:'多次短噪音疊成的俐落拍手。'},
 {id:'bubble',name:'水滴彈音',description:'快速滑音，適合定點縮圈。'},
 {id:'chime',name:'水晶鈴音',description:'明亮泛音與柔和尾韻，適合長按結束。'}
);
const SOUND_PROFILE_REVISION=4;
const defaultSymbolSounds=()=>({tap:{pack:'rhythm',voice:'kick',volume:.92,enabled:true},holdStart:{pack:'rhythm',voice:'longStart',volume:.70,enabled:true},hold:{pack:'rhythm',voice:'tom',volume:.78,enabled:true},ripple:{pack:'rhythm',voice:'snare',volume:.90,enabled:true},flick:{pack:'rhythm',voice:'hat',volume:.82,enabled:true},stream:{pack:'rhythm',voice:'snare',volume:.72,enabled:true}});
function hasSymbolVoices(pack){return RHYTHM_PACKS.includes(pack)||pack==='tutorial'||pack==='tutorial-raw'}
function symbolVoiceOptions(pack){return RHYTHM_PACKS.includes(pack)?[['kick','鼓邊・一般點擊'],['snare','木質・縮圈'],['hat','踩鈸・滑切'],['tom','鼓邊・長按尾端'],['longStart','通鼓・長按開始']]:pack==='tutorial'||pack==='tutorial-raw'?[['kick','一般點擊取樣'],['snare','縮圈取樣'],['hat','滑切取樣'],['tom','長按尾端取樣'],['longStart','長按開始取樣']]:[['kick','低音'],['snare','標準'],['hat','高音'],['tom','中低音']]}
let symbolSounds=defaultSymbolSounds(),draftSymbolSounds=defaultSymbolSounds();
function validateSymbolSounds(value,fallback=soundPack){const result=defaultSymbolSounds();for(const [id] of SYMBOL_SOUNDS){const v=value?.[id];if(!v)continue;if(v.pack==='inherit'||EFFECT_PACKS.some(p=>p.id===v.pack))result[id].pack=v.pack;const available=symbolVoiceOptions(result[id].pack==='inherit'?fallback:result[id].pack).map(v=>v[0]);result[id].voice=available.includes(v.voice)?v.voice:available.includes(result[id].voice)?result[id].voice:'snare';if(Number.isFinite(v.volume))result[id].volume=Math.max(0,Math.min(1,v.volume));if(typeof v.enabled==='boolean')result[id].enabled=v.enabled}return result}
function readSymbolSounds(){
 try{
  const s=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(!s)return;
  const previous={tap:['arcade','snare',.85],holdStart:['taiko','kick',.9],hold:['chime','tom',.65],ripple:['bubble','snare',.85],flick:['reference','hat',1]};
  const oldDefault=Object.entries(previous).every(([k,[pack,voice,volume]])=>{const p=s.symbolSounds?.[k];return p?.pack===pack&&p.voice===voice&&p.volume===volume&&p.enabled===true});
  const oldPack=soundPack,retired=['tutorial','tutorial-raw','reference'];symbolSounds=validateSymbolSounds(s.symbolSounds);
  if((s.soundProfileRevision||0)<SOUND_PROFILE_REVISION){
   const defaults=defaultSymbolSounds();let replaced=false;
   for(const [id,p] of Object.entries(symbolSounds))if(oldDefault||retired.includes(p.pack==='inherit'?oldPack:p.pack)){symbolSounds[id]={...defaults[id],enabled:p.enabled};replaced=true}
   if(retired.includes(soundPack)||oldDefault)soundPack='rhythm';
   if(replaced&&s.volume===.7)hitVolume=.8;
   // Upgrade recorded/default profiles once; keep custom packs and all controls.
   localStorage.setItem(SETTINGS_KEY,JSON.stringify({...s,soundPack,volume:hitVolume,soundProfileRevision:SOUND_PROFILE_REVISION,symbolSounds}));
  }
 }catch{}
}
function buildSynthEffect(id,kind,context){
 const sr=context.sampleRate,duration=id==='chime'?.28:id==='taiko'?.22:.13,b=context.createBuffer(1,Math.ceil(sr*duration),sr),data=b.getChannelData(0),pitch={kick:.65,snare:1,hat:1.65,tom:.85}[kind];let seed=7183,phase=0,previous=0,peak=0;
 for(let i=0;i<data.length;i++){const t=i/sr;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,high=noise-previous;previous=noise;let v;
 if(id==='arcade'){phase+=2*Math.PI*pitch*(180+1600*Math.exp(-t*160))/sr;v=.65*Math.sin(phase)*Math.exp(-t*65)+high*.24*Math.exp(-t*130)}
 else if(id==='taiko'){phase+=2*Math.PI*pitch*(75+125*Math.exp(-t*60))/sr;v=.85*Math.sin(phase)*Math.exp(-t*23)+.3*high*Math.exp(-t*140)}
 else if(id==='clap'){const env=[0,.009,.019].reduce((n,start)=>n+(t>=start?Math.exp(-(t-start)*80):0),0);v=.35*high*env+.12*Math.sin(t*2*Math.PI*700*pitch)*Math.exp(-t*55)}
 else if(id==='bubble'){phase+=2*Math.PI*pitch*(450+1250*Math.exp(-t*45))/sr;v=.8*Math.sin(phase)*Math.exp(-t*42)}
 else v=(.55*Math.sin(2*Math.PI*880*pitch*t)+.25*Math.sin(2*Math.PI*1320*pitch*t)+.13*Math.sin(2*Math.PI*2347*pitch*t))*Math.exp(-t*20);
 v*=Math.min(1,t/.001)*Math.min(1,(duration-t)/.008);data[i]=v;peak=Math.max(peak,Math.abs(v));
 }if(peak)for(let i=0;i<data.length;i++)data[i]*=.88/peak;return b;
}
async function loadSymbolPacks(context,profiles=symbolSounds,fallback=soundPack){const packs=new Set(Object.values(profiles).filter(p=>p.enabled).map(p=>p.pack==='inherit'?fallback:p.pack));await Promise.all([...packs].map(id=>loadEffectPack(context,id)))}
function playSymbolSound(type,when){const p=symbolSounds[type]||symbolSounds.tap;if(!p.enabled||p.volume<=0||!ac||ac.state!=='running'||!hitSoundEnabled||muted||hitVolume<=0)return;if(!sfxGain)initHitAudio();const pack=readyPacks.get(ac)?.get(p.pack==='inherit'?soundPack:p.pack);if(!pack)return;const source=ac.createBufferSource(),gain=ac.createGain();source.buffer=pack[p.voice];gain.gain.value=p.volume;source.connect(gain);gain.connect(sfxGain);source.onended=()=>{source.disconnect();gain.disconnect()};source.start(Math.max(ac.currentTime,when??ac.currentTime))}
function renderSymbolSounds(){const host=document.querySelector('#symbol-sounds');host.innerHTML=SYMBOL_SOUNDS.map(([id,title,caption,c])=>{const p=draftSymbolSounds[id];return `<article class="symbol-sound" style="--symbol-color:${c}" data-symbol="${id}"><div class="symbol-heading"><span class="symbol-badge">${id==='stream'?'▷':id==='flick'?'◇':id.startsWith('hold')||id==='hold'?'━':id==='ripple'?'◎':'●'}</span><div><strong>${title}</strong><small>${caption}</small></div><label class="symbol-enable"><input type="checkbox" data-control="enabled" ${p.enabled?'checked':''} aria-label="${title}音效開關">啟用</label></div><label>音效<select data-control="pack" aria-label="${title}音效">${[{id:'inherit',name:'跟隨共用風格'},...EFFECT_PACKS].map(e=>`<option value="${e.id}" ${e.id===p.pack?'selected':''}>${e.name}</option>`).join('')}</select></label><div class="symbol-voice"><label>音色<select data-control="voice" aria-label="${title}音色">${symbolVoiceOptions(p.pack==='inherit'?document.querySelector('#effect-pack').value:p.pack).map(([v,n])=>`<option value="${v}" ${v===p.voice?'selected':''}>${n}</option>`).join('')}</select></label><button type="button" data-preview="${id}">▶ 試聽</button></div><label class="symbol-volume">個別音量 <output>${Math.round(p.volume*100)}%</output><input data-control="volume" aria-label="${title}音量" type="range" min="0" max="100" step="5" value="${Math.round(p.volume*100)}"></label></article>`}).join('');
 host.oninput=e=>{const card=e.target.closest('[data-symbol]'),key=e.target.dataset.control;if(!card||!key)return;const p=draftSymbolSounds[card.dataset.symbol];p[key]=key==='enabled'?e.target.checked:key==='volume'?Number(e.target.value)/100:e.target.value;if(key==='volume')card.querySelector('output').textContent=e.target.value+'%';if(key==='pack'){const resolved=p.pack==='inherit'?document.querySelector('#effect-pack').value:p.pack,choices=symbolVoiceOptions(resolved);p.voice=hasSymbolVoices(resolved)?defaultSymbolSounds()[card.dataset.symbol].voice:choices.some(v=>v[0]===p.voice)?p.voice:'snare';card.querySelector('[data-control=voice]').innerHTML=choices.map(([v,n])=>`<option value="${v}" ${v===p.voice?'selected':''}>${n}</option>`).join('')}};
 host.onclick=e=>{const b=e.target.closest('[data-preview]');if(b)previewSymbolSound(b.dataset.preview)};
}
async function previewSymbolSound(id){stopEffectPreview();const token=effectPreviewToken,p=draftSymbolSounds[id],status=document.querySelector('#effect-status');if(!p.enabled||p.volume===0||Number(document.querySelector('#hit-volume').value)===0||!document.querySelector('#hit-sound-enabled').checked||muted){status.textContent='請先開啟此符號、命中音效與遊戲聲音，並提高音量。';return}status.textContent='載入試聽…';try{if(!effectPreviewContext){effectPreviewContext=new AudioContext({latencyHint:'interactive'});previewEffectGain=effectPreviewContext.createGain();connectHitOutput(effectPreviewContext,previewEffectGain,effectPreviewContext.destination)}await effectPreviewContext.resume();const pack=await loadEffectPack(effectPreviewContext,p.pack==='inherit'?document.querySelector('#effect-pack').value:p.pack);if(token!==effectPreviewToken||!settingsOpen)return;previewEffectGain.gain.value=Number(document.querySelector('#hit-volume').value)/100*.95*p.volume;const source=effectPreviewContext.createBufferSource();source.buffer=pack[p.voice];source.connect(previewEffectGain);previewEffectSources.push(source);source.onended=()=>{source.disconnect();previewEffectSources=previewEffectSources.filter(s=>s!==source)};source.start();status.textContent=SYMBOL_SOUNDS.find(s=>s[0]===id)[1]+'試聽；按儲存設定套用。'}catch{if(token===effectPreviewToken)status.textContent='試聽載入失敗，請重試。'}}
function openSymbolSettings(){draftSymbolSounds=validateSymbolSounds(symbolSounds);renderSymbolSounds()}
function initSymbolSettings(){
 readSymbolSounds();
 document.querySelector('#apply-pack-all').onclick=()=>{const pack=document.querySelector('#effect-pack').value,defaults=defaultSymbolSounds();for(const [id,p] of Object.entries(draftSymbolSounds)){p.pack=pack;if(hasSymbolVoices(pack))p.voice=defaults[id].voice;else if(p.voice==='longStart')p.voice='kick'}renderSymbolSounds();document.querySelector('#effect-status').textContent='已套用至各符號，按儲存設定套用。'};
 document.querySelector('#symbol-recommended').onclick=()=>{stopEffectPreview();draftSymbolSounds=defaultSymbolSounds();document.querySelector('#effect-pack').value='rhythm';document.querySelector('#hit-volume').value=80;document.querySelector('#hit-volume-value').textContent='80%';updateEffectDescription();renderSymbolSounds();document.querySelector('#effect-status').textContent='已配對鼓邊、木質短擊、踩鈸和長按收尾，命中音量 80%；可先試聽，按儲存設定套用。'};
}
