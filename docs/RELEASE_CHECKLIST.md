# 真藍瘦正式上線檢查表

最後更新：2026-07-21

## 目前已完成的網頁版上線條件

- [x] 正式建置可產生 Cloudflare Worker 部署成品
- [x] TypeScript 前端與 Worker 分開做嚴格型別檢查
- [x] ESLint 通過
- [x] 正式依賴漏洞掃描為 0
- [x] 核心公式、MET、通知排程、文字份量、備份與資料庫自動測試
- [x] 本機資料損壞復原、儲存失敗提示、外部查詢逾時與條碼快取容錯
- [x] CSV 匯出、JSON 完整備份、備份還原與確認式刪除
- [x] 隱私權政策、使用條款、計算方法與健康免責聲明
- [x] 安全回應標頭、404 與錯誤復原頁
- [x] 深色模式、鍵盤 Escape 關閉彈窗、ARIA switch 與即時訊息區
- [x] PWA manifest、192／512 圖示與 1024 無透明背景商店圖示
- [x] PRO 明確標示為規劃功能，現階段不會扣款

## 每次發佈前必跑

1. `npm ci`
2. `npm run check`
3. 用乾淨瀏覽器測試下方「真人裝置矩陣」
4. 確認隱私政策內容與實際 SDK、網路請求完全一致
5. 更新版本號、變更說明與商店截圖
6. 備份前一個可回復版本，再部署新版本
7. 部署後檢查首頁、隱私權、使用條款、計算方法與 404

## 真人裝置矩陣

### 共通主流程

- 首次開啟 → 完成個人設定 → 加入單品 → 修改份量 → 刪除
- 搜尋官方食品、常見外食與最近吃過
- 一句話輸入「茶葉蛋2顆＋雞胸肉200g」
- 手動新增食品並測試 0、負數、極大值與空白名稱
- 記錄運動、體重、飲水與睡眠；切換日期後再回到今天
- 建立食譜與常用組合
- 開關總提醒、飲食提醒與喝水提醒，並拒絕一次通知權限
- 切換淺色／深色，重新啟動後確認設定保留
- 匯出 CSV、完整備份、還原備份；另以錯誤檔測試還原失敗
- 輸入「刪除」後刪除資料，再重新啟動確認個人紀錄消失
- 離線、慢速網路與條碼服務逾時時，主流程不能崩潰

### 建議裝置

- iPhone：目前最低支援版本、最新正式版、至少一台小螢幕
- iPad：直向與橫向
- Android：Google Pixel、Samsung，至少涵蓋小／中／大螢幕
- 瀏覽器：Safari、Chrome、Firefox、Edge 最新兩個主要版本
- 無障礙：200% 字級、VoiceOver／TalkBack、只用鍵盤操作

## 原生 iOS／Android 上架前仍需完成

目前專案是可部署的正式網頁版，不是已簽章的 iOS／Android 原生專案。不要把網站直接包成空殼後送審；應先完成下列原生整合：

- [ ] 建立唯一 Bundle ID／Application ID 與正式 App 名稱
- [ ] 建立 iOS、Android 原生殼層，並讓主要資料與功能可在 App 內可靠運作
- [ ] 將網頁計時提醒改為 iOS／Android 本機排程通知，處理時區、重開機與權限拒絕
- [ ] 相機、照片、通知只申請實際需要的權限，申請前顯示用途
- [ ] JSON／CSV 匯出改用原生分享面板並在真機驗證
- [ ] 若加入 PRO，使用 StoreKit 2 與 Google Play Billing；做購買恢復、收據／權益驗證、退款與離線狀態
- [ ] 加入崩潰回報前，先更新隱私政策與商店資料揭露；不得把健康資料用於廣告或跨服務追蹤
- [ ] iOS 以 TestFlight、Android 以內部／封閉測試至少跑一輪真人測試
- [ ] 產生簽章 Release build、AAB／IPA，保存簽章金鑰與復原資料

## 商店後台必填

### Apple App Store Connect

- [ ] 開發者帳號、稅務與合約有效
- [ ] App 名稱、副標題、描述、關鍵字、分類、支援 URL、行銷 URL
- [ ] 公開可存取的隱私權政策 URL；App Privacy 回答涵蓋所有第三方 SDK
- [ ] 年齡分級（Unrated 無法發佈）
- [ ] 各尺寸截圖、1024×1024 App icon、版本更新說明
- [ ] Review Notes 清楚說明資料只存本機、條碼外部查詢、OCR 與提醒測試方式
- [ ] 選取正確 build；若首次提交 IAP／訂閱，與新 App 版本一起送審

Apple 官方資料：

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app

### Google Play Console

- [ ] 開發者身分、付款設定與聯絡資料有效
- [ ] Store listing、內容分級、目標受眾、廣告聲明、App access、Data safety
- [ ] 隱私政策需在商店與 App 內可見，並列出開發者身分、聯絡方式、保存與刪除政策
- [ ] Health apps declaration 至少核對：Activity and Fitness、Nutrition and Weight Management、Sleep Management
- [ ] 2026-08-31 起新 App／更新 target Android 16（API 36）以上
- [ ] 上傳簽章 AAB，通過 pre-launch report、內部／封閉測試與正式發布檢查

Google 官方資料：

- https://support.google.com/googleplay/android-developer/answer/14738291
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://developer.android.com/google/play/requirements/target-sdk

## 發佈阻擋條件

以下任一項未完成，不應宣稱已可提交商店：

- 沒有開發者法定名稱、公開支援信箱與公開隱私 URL
- 沒有 Apple／Google 開發者帳號與唯一 App ID
- 沒有原生通知、權限拒絕與背景行為真機測試
- 開啟 PRO 卻沒有商店內購、購買恢復與權益驗證
- 隱私政策、App Privacy／Data safety 與實際 SDK 行為不一致
- Release build 未經 TestFlight／封閉測試

## 上線後

- 首 72 小時觀察崩潰、啟動失敗、資料遺失、通知與購買問題
- 保留可立即回復的前一版
- 食品資料與第三方服務每季抽查；重大配方或政策變更立即更新
- 每次新增 SDK、AI、分析、帳號或雲端同步時，同步更新隱私揭露與資料刪除流程
