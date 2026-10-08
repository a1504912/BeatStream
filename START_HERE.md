# BeatStream 原始碼備份與 Git 上傳

這份備份對應 2026-10-08 確認的網站第 60 版，包含自由曲線編輯。原始版本記錄在 `SOURCE_VERSION.txt`。

## 1. 在自己的電腦執行

先安裝 Node.js 24。解壓縮後，在含有 `package.json` 的 `BeatStream-source` 資料夾開啟終端機或 PowerShell，執行：

```sh
npm ci
npm run dev
```

瀏覽器開啟 `http://localhost:4173/`。停止時在終端機按 Ctrl+C。

這個本機伺服器支援內建歌曲、譜面編輯／儲存、音樂匯入與歷史成績，使用固定的本機測試身分。它會自動建立 `.sites-runtime/`，以檔案與 SQLite 保存本機資料，重新啟動後仍會保留。它不會連到正式網站的個人資料。

如果 4173 已被占用：

```sh
npm run dev -- --port 4174
```

改開啟 `http://localhost:4174/`。不要直接雙擊 `index.html`，瀏覽器讀取音樂、譜面與 API 需要 HTTP 伺服器。

## 2. 上傳到新的 GitHub 儲存庫

先在 GitHub 建立你要使用的儲存庫。這份備份含歌曲、封面與第三方素材，可先使用 Private 保存；素材來源保留於各 `CREDITS`／`SOURCES` 檔。

如果用 GitHub Desktop：

1. 解壓缩 ZIP，選擇 File → Add local repository，指定 `BeatStream-source`。
2. 若提示尚無 Git repository，選擇建立 repository。
3. 提交全部檔案，再 Publish repository；要保留私密請勾選 Keep this code private。

如果用 Git 指令，以下流程適用於「未初始化、沒有 README 的空白遠端儲存庫」。先把最後兩行的網址替換成你實際建立的網址：

```sh
git init
git add .
git commit -m "Backup BeatStream source with free curve editor"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

若 Git 提示缺少作者資訊，先用自己的姓名及 GitHub 提交信箱設定 `git config user.name`、`git config user.email`，再重試提交。登入請使用 GitHub Desktop、Git Credential Manager 或 GitHub 提供的登入流程。

若遠端已有程式或 README，請先 clone 該儲存庫，再將這份原始碼複製到適合的位置、檢查差異並提交；不要用 force push 覆蓋既有歷史。

ZIP 是用來下載備份的；GitHub 儲存庫應放入解壓後的各個檔案，才能逐檔追蹤版本。

## 3. 主要程式在哪裡

| 路徑 | 內容 |
| --- | --- |
| `dist/client/` | 完整前端原始碼、歌曲、音效、封面、內建譜面 |
| `dist/client/game.js` | 遊戲流程、輸入、計分與判定 |
| `dist/client/chart-editor.js` | 譜面與自由路徑編輯 |
| `dist/client/reference-visuals.js` | 遊戲畫面、曲線幾何與預覽 |
| `dist/server/index.js` | Cloudflare Worker 後端 API |
| `db/`、`drizzle/` | 歷史成績資料表與遷移 |
| `tools/preview-server.mjs` | 本機開發伺服器 |
| `tools/` | 譜面分析、製作與驗證程式 |
| `README.md`、`CLAUDE.md` | 功能、架構與接手說明 |

`dist/client/` 和 `dist/server/` 就是這個專案的可編輯原始碼，不要因為資料夾叫 `dist` 就刪掉或忽略。專案目前沒有前端編譯步驟。

## 4. 備份範圍

包含目前版全部 238 個已追蹤檔案、內建歌曲／素材、資料表定義、驗證程式及本機預覽伺服器。這次匯出另外補上本說明、版本記錄與 `.gitignore` 排除規則；遊戲程式和素材保持原樣。

不包含：

- 原始 `.git` 歷史、`node_modules`、暫存及本機測試資料。
- 正式網站 R2 中後來匯入的音樂與自訂譜面。
- 正式網站 D1 中的 BEST 5 歷史成績。
- 瀏覽器內保存的個人按鍵、音效等設定。
- 未放入專案的原始參考影片及辨識暫存。

因此，這份是完整程式及內建資源備份，不是正式網站所有個人資料的備份。

## 5. Git 與網站部署的差別

上傳 GitHub 只是在保存程式，不會自動替換目前的遊戲網站，也不會自動搬移雲端資料。

原版正式網站由 Sites 部署，`.openai/hosting.json` 保留原網站識別及 `BUCKET`／`DB` 綁定，並非登入密碼。它不是可直接套到另一個 Cloudflare 帳號的完整部署設定。

若改用別的平台部署，仍需設定 Worker、靜態資源 `ASSETS`、R2 `BUCKET`、D1 `DB`、資料表遷移及正式登入驗證。現有後端依賴 Sites 可信任的身分標頭；本機 preview 使用固定身分，只適合開發，不能直接當公開網站的登入機制。

## 6. 可選的驗證

基本儲存驗證不需要額外 Canvas 套件：

```sh
node tools/test-chart-storage.mjs
```

自由曲線及遊戲判定的驗證另需 Canvas：

```sh
npm install --no-save --package-lock=false @napi-rs/canvas
node tools/test-free-streams.cjs
```

僅啟動遊戲不需要 Python、ffmpeg 或 Canvas。只有重新分析參考影片的 Python 工具才需要相應依賴與原影片。
