日文知識庫 PWA 套件

檔案：
- index.html：以 v53 效能優化版為基礎，加入 PWA 設定
- manifest.webmanifest：安裝名稱、顯示模式與圖示設定
- sw.js：Service Worker，提供基本離線快取
- icons/：PWA 圖示

部署方法：
1. 將 ZIP 解壓縮。
2. 把 index.html、manifest.webmanifest、sw.js 及 icons 資料夾內的檔案，完整放在同一個網站目錄。
3. 發佈到支援 HTTPS 的靜態網站（例如 GitHub Pages）。
4. 用手機瀏覽器開啟網站網址，先連線載入一次，再使用瀏覽器的「加入主畫面／安裝應用程式」。

注意：
- PWA 需要 HTTPS（localhost 開發除外）；直接點開本機 HTML 檔案不會完整啟用安裝功能。
- Service Worker 只快取本網站檔案，不會快取 Supabase API；雲端備份／同步仍需網絡連線。
- 更新網站後，重新整理或關閉再開啟 PWA，Service Worker 會更新 HTML 快取。
- 本套件以 v53 為基礎；未更改字卡資料、版面與編輯邏輯。
