# BeatStream · Neon Session

本次完整原始碼匯出：先閱讀 [START_HERE.md](START_HERE.md)，內含本機啟動、Git 上傳及備份範圍。

觸控、滑鼠與鍵盤音樂遊戲。程式直接寫在 `dist/client/`，這裡的 JavaScript 與 CSS 就是可編輯的原始碼；目前沒有框架編譯流程。

## 目前功能

- 八邊形判定框，點擊、長按、滑切、連續滑動及六處定點縮圈。
- 選曲試聽、LIGHT／NORMAL／BEAST、可設定按鍵與各符號命中音效。
- 開始時先顯示 1.5 秒 READY，結束後音符才入場；預留目前速度的完整移動時間，再依原譜時間對齊音樂。READY 期間不判定、暫停會連同倒數與音訊一起凍結。
- 依教學影片修正粉紅長按、黃／青同時押、爪印光圈與方塊閃電；滑切支援先按住再滑入。
- 預設短鼓邊音效，新增清脆鼓邊、乾脆電子、厚實鼓組三套，每套五種命中聲，可分符號試聽配對；保留舊錄音選項。
- 70% 過關線、量表配色及教學影片時間對照說明。
- 音檔與自訂譜面依登入使用者保存在雲端。
- 譜面編輯器：波形、時間軸、吸附格線、拖曳、復原／重做、JSON 匯入匯出。
- 自動譜面改為樂句式編排：跟隨音樂強弱、重複交替、重拍同時押及段落收尾；保留原聲音的到點時間。
- 編輯器可使用既有音檔「重新編排」，選擇密度、取消或復原；預覽後儲存才替換目前難度，不必重傳音樂。
- 同步遊戲預覽：播放、暫停、0.5×／0.75× 慢速、任意跳轉；修改音符立即更新。
- 在預覽中點選音符，或在時間軸選取音符並查看到點前的畫面；到點音效可切換。

選歌頁目前顯示 `天ノ弱`、`パ→ピ→プ→Yeah!`、`CHERNOBOG · VIDEO` 、`ロストワンの号哭` 和 `回レ！雪月花` 五首影片參考曲。`天ノ弱` 附使用者提供的乾淨 MP3 剪接；前三首保留既有錄影音軌。選曲與難度後按「編輯譜面」即可進入。舊曲與已儲存資料保留，但不再顯示；後續依使用者提供的實機影片製作並加入 `videoReference: true` 的參考曲。

LIGHT 沿用原譜節奏點，減少密度與同時押，以單顆點擊及少量長按為主。舊歌曲不必重傳；LIGHT 可獨立編輯及儲存至雲端。

`CHERNOBOG · VIDEO` 是使用者提供的 720p／60 fps BEAST 錄影參考版，附 15–127 秒音軌。BEAST 有 598 顆音符，包括 117 顆縮圈與 11 條長按；NORMAL 減量，LIGHT 沿用實際節奏點。保留原本官方曲目 ID、使用者匯入音樂與自訂譜面。錄影音軌含原命中聲；STREAM 已恢復沿連線滑過節點；影片推估與八方向投影不是官方完整逐顆譜。

重建工具在 `tools/chernobog/`：先用 `extract.py`、`ripples.py` 分析錄影至暫存目錄，再用 `build_chart.py --analysis PATH` 產生內建譜。需要 ffmpeg、numpy、scipy、OpenCV。原影片與辨識暫存未放入原始碼。

`パ→ピ→プ→Yeah!` 是使用者提供的 480p／30 fps NIGHTMARE Lv10 錄影參考版，附 15–121 秒錄影音軌。160 BPM 的 BEAST 參考譜保留圓形／方塊連打、六處縮圈、四鍵斜角長按與十字長按；NORMAL 與 LIGHT 使用相同節奏點減量。已核對的 STREAM 勾形與交叉段落恢復為連續滑動。錄影音軌含原命中聲；480p 影片估計與八方向投影不是官方完整逐顆譜。

重建第三首：依序執行 `tools/papipu/extract.py VIDEO --out SCRATCH`、`classify.py VIDEO --out SCRATCH`、`build_chart.py --analysis SCRATCH`。圓形／方塊與縮圈模板取自同一支影片；長按邊界及重複路徑已逐段檢視，核對資料隨譜面 JSON 保存。工具依賴與 CHERNOBOG 相同。


`天ノ弱` 是使用者提供的 480p／30 fps BEAST Lv09 影片參考版。先觀察影片的到點、縮圈及長按，再把另附 `164 feat. GUMI` MP3 剪成 109 秒街機長度。BEAST 468 顆（32 條長按／84 顆縮圈），NORMAL 341 顆，LIGHT 114 顆。保留成對長按、交替連打及變速段落；部分已核對的 STREAM 恢復為連續滑動。播放音軌只由 MP3 製作，不含影片命中聲或結尾語音。影片推估、八方向投影與重複吉他段的剪接不是官方完整逐顆譜或原始機台音軌。

第四首重建工具在 `tools/amanojaku/`。先執行 `extract.py VIDEO --out SCRATCH`、`classify.py VIDEO --out SCRATCH --frames FRAMES`、`refine_heads.py --analysis SCRATCH --frames FRAMES`，再執行 `build_chart.py --analysis SCRATCH`。`FRAMES` 為以 ffmpeg 從影片 9 秒開始輸出的原尺寸逐幀 JPG，`-start_number 270`、30 fps；原影片與暫存留在專案外。`reviewed.json` 保留長按及路徑核對記錄，`audio-edit.json` 保留 MP3 的四段時間對照。`build_audio.py CLEAN_MP3 --output dist/client/audio/amanojaku-clean.mp3` 只讀取乾淨 MP3；`verify_audio.py CLEAN_MP3 VIDEO EDITED_MP3` 以音源相關性及九處影片對齊點檢查輸出。所有段落的對照也保存在 `amanojaku-chart.json`。

STREAM 先顯示粉紅三角形，再展開細白邊、粉紫至青色的完整箭頭路徑。按住起點沿路徑滑到底，途中轉折不另外計分；整條完成只有一次判定、一次音效及一次 COMBO。起點與尾端使用 ±200 ms 判定窗，較大的誤差決定 Fantastic／Great；中途放開、離開路徑或漏掉轉折會 MISS。可用兩指處理左右兩條路徑；鍵盤依游標旁對應鍵的方向轉換操作，在尾端節拍完成。所有難度全 Fantastic 恰好 1,000,000 分。

每條 `type: "stream"` 物件保存開始 `t`、結束 `end` 與 2–32 個正規化 `path` 節點。座標可以放在畫面任意可遊玩位置（x .04–.96、y .08–.90），不綁八方向判定框。點「＋ 畫滑動路徑」後在遊戲預覽逐點設定起點、節點與終點，再按「完成路徑」。可拖曳白色節點、輸入 X／Y、增減節點，開啟「整條移動」平移整段；「下一段彎度」與青色控制柄可調整二次 Bézier 曲線。方向範本、對調與鏡像收在次要選單。增加曲線上的節點會保留原曲線形狀；復原、重做、複製、JSON 匯入／匯出及雲端儲存都保留曲線。

JSON 版本 3 的節點可帶 `curve: {x,y}`，代表通往下一節點的控制柄；沒有 `curve` 的舊路徑仍是直線，末節點不能帶控制柄。游標、展開／消耗動畫及鍵盤節點時間均使用曲線弧長；触控檢查指標實際經過的軌跡，直接跨過彎線會 MISS。每條仍只計分一次。雲端仍接受舊 `streamId` 節點陣列，遊戲與編輯副本載入時轉成單條，不會自動寫回雲端。驗證工具：`tools/test-free-streams.cjs`、`tools/test-stream-editor.cjs`、`tools/test-streams.cjs`、`tools/test-chart-storage.mjs`。

內建 CHERNOBOG／パ→ピ→プ→Yeah!／天ノ弱分別有 6／18／6 條完整 BEAST 路徑，原始核對點保存在 `evidence` 與 `streamSourcePoints`。起訖沿用影片時鐘，非滑動音符、音檔和原 LIGHT 譜均保留；BEAST 顆數為 598／492／468。原辨識工具重建後執行 `python3 tools/restore-streams.py`，可重複執行而不改變結果。雲端已儲存的各難度譜面仍優先使用。

## 檔案位置

| 檔案 | 用途 |
| --- | --- |
| `dist/client/index.html` | 頁面與腳本載入順序 |
| `dist/client/game.js` | 遊戲時間、輸入、判定與主循環 |
| `dist/client/reference-visuals.js` | 遊戲／編輯器共用 Canvas renderer、音符與特效 |
| `dist/client/note-rules.js` | 音符類型、同時押與位置規則 |
| `dist/client/chart-editor.js`、`chart-editor.css` | 譜面編輯與同步預覽 |
| `dist/client/settings.js`、`symbol-sounds.js`、`effects.js` | 按鍵與命中音效 |
| `dist/client/music-storage.js` | 音樂匯入、雲端還原與瀏覽器快取 |
| `dist/client/rhythm-charts.js`、`lostone-song.js`、`sumida-video.json` | 內建／影片參考譜面 |
| `dist/client/chernobog-song.js`、`chernobog-chart.json` | CHERNOBOG 影片參考版與辨識方法／音符來源 |
| `dist/client/papipu-song.js`、`papipu-chart.json` | パ→ピ→プ→Yeah! 影片參考版、長按與路徑核對記錄 |
| `dist/client/amanojaku-song.js`、`amanojaku-chart.json` | 天ノ弱 影片參考譜與乾淨 MP3 剪接時間對照 |
| `dist/server/index.js` | Cloudflare Worker 音樂與譜面 API |
| `tools/` | 譜面分析與驗證程式 |

## 執行與部署

目前網站由 Sites 部署。`.openai/hosting.json` 保留原網站的綁定設定；沒有內嵌登入憑證。

完整正式服務需要 Worker 提供 `env.ASSETS`、R2 `env.BUCKET` 與 D1 `env.DB`。音樂 API 為 `/api/music`，譜面 API 為 `/api/charts`，歷史成績 API 為 `/api/scores`。

現在的身分來自 Sites 注入的 `oai-authenticated-user-id` 標頭。搬到其他平台時，應由可信任的登入驗證產生使用者身分，再接到儲存 API；不能直接信任公開請求自行提供的這個標頭。

只檢視前端與遊玩內建歌曲，可從專案根目錄執行：

```sh
python3 -m http.server 8080 --directory dist/client
```

再開啟 `http://localhost:8080/`。此靜態伺服器沒有雲端 API，因此不支援音樂雲端匯入、雲端譜面還原及譜面編輯器的完整操作。完整本機開發可使用 Node.js 24 執行 `npm ci`、`npm run dev`，再開啟 `http://localhost:4173/`；內附預覽伺服器提供本機檔案及 SQLite 儲存，與正式雲端資料分開。

## 驗證

建議使用 Node.js 24（本機預覽使用 `node:sqlite`）。Canvas 驗證需要 `@napi-rs/canvas`：

```sh
npm install --no-save @napi-rs/canvas
node tools/test-chart-editor.cjs
node tools/test-ready.cjs
node tools/test-chart-storage.mjs
node tools/test-streams.cjs
node tools/test-stream-editor.cjs
node tools/test-million-score.cjs
node tools/test-chernobog.cjs
node tools/test-papipu.cjs
node tools/test-amanojaku.cjs
node tools/test-setsugekka.cjs
```

也可用 `BEATSTREAM_CANVAS_MODULE` 指定既有 Canvas 模組的位置。

同步預覽已驗證音符新增／修改／刪除、選取、快轉、慢速播放、音效事件、復原／重做、雲端儲存／還原及實際遊戲判定。Canvas 畫面已檢視；已在瀏覽器檢查桌面與手機的遊戲預覽；Canvas 驗證另涵蓋三角起點、箭頭展開、連續路徑判定及單次配分。

## 資料範圍

原始碼包包含內建音檔、封面、音效、內建譜面與來源標註。使用者後來上傳到 R2 的音檔與自訂譜面是另一份雲端資料，沒有包含在此原始碼包內。搬遷時需另外匯出。

音檔與圖像的來源分別保留在 `dist/client/audio/CREDITS.txt`、`dist/client/covers/SOURCES.txt` 與 `dist/client/sfx/` 中。影片參考譜面是依錄影推估，不代表官方逐顆譜面。

## 教學音效來源

使用者提供的教學影片是麥克風實機錄音，取樣含背景音樂／現場聲，並非獨立官方資源。時間、片段種類與處理方式記錄在 `dist/client/sfx/tutorial-source.json`。可用 `python3 tools/tutorial/extract_sfx.py INPUT.mp4` 重建 WAV 檔，需要 ffmpeg、numpy、scipy。

三套新打擊聲由 `python3 tools/build-rhythm-sfx.py` 重建，使用原創合成與已內建的 Kenney CC0 打擊層；來源與聲音長度見 `dist/client/sfx/rhythm-source.json`。

`回レ！雪月花`（歌組雪月花）第二版重新對照使用者提供的影片及另附 90 秒乾淨 MP3。BEAST 685 顆、NORMAL 341 顆、LIGHT 101 顆；修正重疊連打辨識、六處縮圈與方塊，保留 52 條長按及同時押。MP3 位元原樣內建，重新核對九段音訊同步，不混入影片打擊聲。這是影片參考譜，遮蔽處仍可能漏音，不是官方完整逐顆譜。新版曲目 ID 為 `setsugekka-video-r2`；舊版雲端自訂譜面仍保留，不會蓋住新版。

執行 `python3 tools/setsugekka/build_chart.py` 可從已核對的 `rebuild-reviewed.json` 和重新對齊的 `audio-recheck.json` 重建成品，不需下載原影片。觀察工具 `refine_heads.py`、`refine_ripples.py`、`observe_score.py` 與 `verify_audio.py` 用於產生候選與交叉核對；分數／COMBO 只協助排除重複，不自動補造音符。`reviewed.json` 保存 52 條長按的影片起終點。各類觸控區分開檢查重疊，NORMAL 至多同時占用兩個手指。

## 選歌歷史成績

右側 BEST 5 顯示目前歌曲、目前難度的最佳五次正式遊玩成績，包含 SCORE 與 MAX COMBO；先按分數、再按最高連擊及完成時間排序。完成遊玩才保存，AUTO、教學及中途離開不列入。左側黃色選取框有低幅度呼吸動畫，尊重減少動態效果設定。

歷史成績以可信任使用者身分保存於 D1 `DB`，歌曲與音檔繼續使用既有 R2 `BUCKET`。新資料表定義在 `db/schema.ts`，Drizzle 產生的 `drizzle/` 由 Sites 發布時套用；不可在正式請求內建立資料表。前端 `score-history.js` 的快取只提供畫面更新，雲端是持久資料來源。同步失敗可在選歌頁重試，相同場次 ID 不會重複保存。啟用前沒有保存分數，因此只能累積新成績。

預覽的 SQLite 存在 `.sites-runtime/preview-scores.sqlite`，不會上傳正式資料。執行 `node tools/test-score-history.mjs` 驗證成績排序、身分／歌曲／難度隔離、正式完成、AUTO／中途離開排除、重試、重新載入及競態處理；原生 Canvas 路徑可用既有 `BEATSTREAM_CANVAS_MODULE` 指定。
