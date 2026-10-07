# Interval Timer 運動計時器

一個可以安裝在 iPad / iPhone 主畫面的間歇訓練計時器（PWA），不需要 App Store、也不需要 Mac。

## 功能

- **運動時間 / 休息時間 / 動作數 / 組數 / 組間休息** 都可以自由設定（滾輪選擇器 + 常用快捷值）
- 自動計算總時間
- 計時畫面依階段變色：準備（紫）、運動（綠）、休息（紅）、組間休息（黃）
- 暫停 / 繼續、上一段 / 下一段、隨時結束
- 最後 3 秒倒數嗶聲、中文語音播報（開始、休息、一半了、完成…），可在選單關閉
- 開始前的「準備倒數」（預設 5 秒，可調整）
- 儲存常用訓練、自動記錄最近使用的設定，一鍵載入
- 計時中螢幕保持開啟；App 切到背景再回來，時間會自動校正
- 安裝後可離線使用

## 安裝到 iPad

1. 用 iPad 的 **Safari** 打開網址：`https://joseph-1004.github.io/IntervalTimer/`
2. 點網址列旁的 **分享** 按鈕（方框加向上箭頭）
3. 選 **加入主畫面**，按 **新增**
4. 主畫面上會出現 Interval Timer 圖示，點開就是全螢幕 App

> 第一次部署：到 GitHub repo 的 **Settings → Pages**，把 **Source** 設成 **GitHub Actions**，之後每次 push 都會自動更新網站。

## 本機測試

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
```

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 畫面結構 |
| `styles.css` | 樣式 |
| `app.js` | 計時邏輯、設定、儲存 |
| `sw.js` | 離線快取（修改程式後把 `CACHE` 版本號 +1） |
| `manifest.webmanifest` | PWA 設定 |
