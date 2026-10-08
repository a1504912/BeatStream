'use strict';
function ruleIcon(kind){
 const c={tap:'#ff27bf',hold:'#ff27bf',double:'#ffe641',ripple:'#82ff35',flick:'#70ff49',stream:'#b794ff'}[kind];
 const blades=noteMarkSvg(50,44,14.5,'#fff','#140b21');
 let shape=kind==='flick'?'<rect x="20" y="14" width="60" height="60" stroke="#ffffffb3" stroke-width="1"/><rect x="25" y="19" width="50" height="50" fill="#0b1719" stroke-width="4"/><rect x="31" y="25" width="38" height="38" stroke="#eaffef" stroke-width="1.5"/><rect x="40" y="34" width="20" height="20" stroke="#fff" stroke-width="2"/>':`<circle cx="50" cy="44" r="29" fill="#140b21"/><circle cx="50" cy="44" r="25" stroke="#fff" stroke-width="1.5"/><circle cx="50" cy="44" r="21" stroke="${c}" stroke-width="6"/><circle cx="50" cy="44" r="16" stroke="#ffffffaa" stroke-width="1"/>`+blades;
 if(kind==='stream')shape='<path d="M30 70V40H19L35 24 51 40H40V27H29L45 11 61 27H51V6" fill="#ae56f1" stroke="#fff" stroke-width="1.2"/><path d="m35 55 17 25H18Z" fill="#ff38c9" stroke="#fff" stroke-width="1.5"/>' ;
 if(kind==='hold')shape='<path d="M50 3v20" stroke="#fff2fa" stroke-width="16" stroke-linecap="round"/><path d="M50 3v20" stroke="'+c+'" stroke-width="11" stroke-linecap="round"/>'+shape;
 if(kind==='ripple')shape='<circle class="rule-ripple-ring" cx="50" cy="44" r="38" opacity=".7" stroke-width="2"/>'+shape;
 if(kind==='double')shape='<g transform="translate(-15 0) scale(.8)">'+shape+'</g><g transform="translate(35 17) scale(.64)" stroke="#19efff"><circle cx="50" cy="44" r="29" fill="#140b21"/><circle cx="50" cy="44" r="22" stroke-width="6"/>'+blades+'</g>';
 return `<svg viewBox="0 0 100 88" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round">${shape}</g></svg>`;
}

const ruleRows=[
 ['tap','① 一般音符｜Beat','粉紅圓形音符，中央三片扇形拼成完整圓形，從外側朝中央八邊形移動。','頭部與白色判定邊重疊時，點一下音符位置。','命中：粉紅爪印＋旋轉光圈。鍵盤按該方向的對應鍵。影片 01:25–01:50。'],
 ['hold','② 長按｜Long','粉紅圓形頭部，後方連著寬長條與圓弧尾端。','頭部到判定邊時按住原位置，直到尾端也到達。','按住時頭部持續旋轉發光、長條逐漸消耗；不用跟著尾巴移動，也不用另外點尾端。影片 02:09–02:16、04:17–04:33。'],
 ['double','③ 同時押｜同時音符','同拍音符會一起變成黃色或青色；形狀仍表示各自種類。','同一拍的每顆音符都要處理，可用兩指或多個按鍵。','黃色／青色代表同時押，不代表長按；看圓形、長尾、方塊或縮圈判斷操作。影片 01:35、01:43。'],
 ['ripple','④ 定點縮圈｜Ripple','外圍固定位置的綠色圓形音符，中央三片扇形拼成完整圓形，較大的外圈向內收縮。','外圈縮到粗的固定判定圈、兩圈重合時，點圓心。到點時判定圈會亮起。','音符不會飛向八邊形。命中使用爪印＋光圈；鍵盤用該音符旁顯示的鍵。影片 03:01、03:05。'],
 ['flick','⑤ 方塊劃除｜Slash','綠色正方形音符旋轉入場，接近判定點時逐漸轉正。細白外框同步旋轉，一開始與音符位置錯開，移動時逐漸對齊。','外框與方塊在中央判定邊重合時，手指或滑鼠從音符上快速滑過，方向不限；鍵盤按對應鍵。','可以先按住再滑入音符，不必先精準點中頭部；命中沿劃動方向分裂的方塊、綠色碎片與閃電斬擊；一般圓形則使用爪印與旋轉光圈。影片 02:37、02:41。'],
 ['stream','⑥ 連續滑動｜Stream','先出現粉紅三角形起點，接著沿滑動方向展開白邊箭頭路徑。箭頭從粉紫漸變至青色，三角游標沿路徑移動。','到點按住三角形起點，沿箭頭一路滑到底；中途轉折不另外點按，也不另外計分。整條完成只算一顆音符、一次 COMBO。','保持同一手指或滑鼠；離開路徑、跳過轉折、中途放開或逾時會 MISS。兩條路徑可用兩指；鍵盤依游標旁的對應鍵順序操作，最後在尾端節拍再按一次完成。Stream 完成音效可獨立調整。'],
];
const rulesDialog=document.createElement('dialog');rulesDialog.id='rules-dialog';rulesDialog.setAttribute('aria-labelledby','rules-title');
rulesDialog.innerHTML=`<div class="rules-heading"><div><small>HOW TO PLAY · TUTORIAL</small><h2 id="rules-title">音符與操作說明</h2></div><button id="rules-close" aria-label="關閉說明">×</button></div><p class="rules-intro">依你這次提供的 BeatStream 教學影片，重新核對圖案、操作與命中特效。下方時間可對照影片確認。</p><div class="rules-grid">${ruleRows.map(([type,title,look,action,note])=>`<article class="rule-card">${ruleIcon(type)}<div><h3>${title}</h3><p>${look}</p><p class="rule-action">${action}</p><p class="rule-limit">${note}</p></div></article>`).join('')}</div><section class="rules-system"><h3>遊戲與音效設定</h3><p>預設按鍵由上方順時針：W、E、D、C、X、Z、A、Q。可在「設定 → 鍵盤對應」更換。觸控支援多指；同時押可使用鍵盤或多指操作。</p><p>「設定 → 套用推薦音效」使用短鼓邊、木質短擊、踩鈸掃聲與長按收尾。另有乾脆電子、厚實鼓組兩套可切換；每種符號都能獨立試聽、調音量。短尾音方便辨認連打，遊戲與譜面預覽共用音效設定。</p><p>Stream 已恢復連續滑動；方塊 Slash 仍是方向不限的劃除。可在「編輯譜面」選取 Stream，使用八方向、起終點對調、鏡像及預覽控制點設定任意轉折；依每條箭頭指向滑動。</p><details><summary>目前網頁版的判定與差異</summary><p>Fantastic：誤差小於 55 ms；Great：其餘有效命中。點擊、縮圈與長按開始需在 150 ms 內；滑切、Stream 起點與尾端需在 200 ms 內。Stream 必須保持接觸沿完整路徑滑動，轉折不單獨評分；尾端提前到達時可保持按住等到尾端節拍。長按在尾端前超過 140 ms 放開會 MISS，持續按到尾端會自動完成。只點方塊不滑仍為 MISS，未實作原機較低判定。這些時間是本版設定，不是從影片推定的官方判定窗。</p><p>每份譜面滿分固定 1,000,000 分；Fantastic 取得完整配分，Great 取得 65%，MISS 不得分並中斷連擊。長按完整完成算一顆，不重複加分；Stream 整條完成也只算一顆；以起點與尾端中較大的時間誤差決定判定。歌曲結束時量表達到 70% 才過關；70% 以上中央變成粉紅色、以下為青色。每次命中 +1%、MISS −3%，加減值是網頁版規則；分數與自動譜面也仍是本版設定。</p><p><a href="https://www.konami.com/products_master_kam/jp_publish/am_beatstream/jp/ja/images/img_about.jpg" target="_blank" rel="noopener">官方教學圖 ↗</a> · 本版保留六個外圍縮圈位置。</p></details><p>影片參考譜保留辨識的節奏與配置；其他練習譜使用分句、左右交替及強拍組合，不是官方原始譜。自訂譜面優先使用你在編輯器儲存的版本。</p><p>成功匯入並顯示已儲存後，音樂與譜面會在下次開啟時自動載入。MY MUSIC 可找回自訂匯入歌曲；儲存失敗可直接按重試，不必再次選檔。</p></section><button id="rules-practice" class="start">開始符號練習</button><p class="rules-foot">單點 → 長按 → 同時押 → 縮圈 → 滑切 → 連續滑動；練習使用教學節拍。</p>`;
document.body.appendChild(rulesDialog);
let rulesTrigger;
document.addEventListener('click',e=>{const b=e.target.closest('[data-open-rules]');if(!b||mode==='loading')return;rulesTrigger=b;if(mode==='playing')togglePause();closeGameMenu();stopPreview();rulesDialog.showModal()});
function closeRules(){rulesDialog.close();rulesTrigger?.focus();if(mode==='paused')openGameMenu()}
document.querySelector('#rules-close').onclick=closeRules;
document.querySelector('#rules-practice').onclick=()=>{closeRules();showSongMenu();songCategory='all';currentSong=SONGS.find(s=>s.rulesPractice);selectedDifficulty='normal';document.querySelector('#difficulty').value='normal';void start()};

rulesDialog.addEventListener("cancel",e=>{e.preventDefault();closeRules()});
