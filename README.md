# Pay Hub

LINE Pay / PX Pay / PayPal 的整合啟動介面。只是一個介面,實際付款、餘額、紀錄都在各自的 App 內。

## 一鍵下載 APK
手機瀏覽器開:https://github.com/b08140311-cpu/CLAUDE-PAY/releases/latest/download/pay-hub.apk

## 其他取得方式
1. 把這個專案推到 GitHub(main 分支)。
2. 到 repo 的 **Actions** 分頁 → **Build Android APK** → 點最新一次執行。
3. 頁面下方 **Artifacts** 下載 `pay-hub-debug-apk`,解壓縮得到 `app-debug.apk`。
4. 傳到手機安裝(要允許「安裝未知來源 App」)。這是測試版簽章,不能上架 Google Play。

## 設定要開啟的 App
編輯 `src/apps.js`:
- `androidPackage`:該 App 的 Android 套件名稱。**PX Pay 目前是空的,要填。**
  查法:在手機 Play 商店開該 App 頁面,網址 `?id=` 後面那串就是套件名稱。
- 改完 push,Actions 會自動重新編譯,`<queries>` 宣告也會跟著更新。

## 本機開發
```
npm install
npm run dev
```
