import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "隱私權政策｜真藍瘦" };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="隱私權政策"
      summary="真藍瘦以裝置本機儲存為預設，讓你能清楚掌握哪些資料存在、何時連線，以及如何帶走或刪除資料。"
    >
      <section>
        <h2>1. 我們處理哪些資料</h2>
        <p>
          你主動填寫的生理性別、年齡、身高、體重、目標，以及飲食、運動、飲水、睡眠和提醒設定，會用於計算與顯示個人化結果。
        </p>
      </section>
      <section>
        <h2>2. 資料存放位置</h2>
        <p>
          目前版本沒有帳號系統。上述個人資料與健康紀錄預設只儲存在你使用的瀏覽器本機空間，不會由真藍瘦上傳到應用程式伺服器。清除瀏覽器資料、移除 App
          或更換裝置前，請先下載完整備份。
        </p>
      </section>
      <section>
        <h2>3. 何時會連線至第三方</h2>
        <ul>
          <li>
            條碼查詢會把商品條碼傳送至 Open Food Facts，以取得社群維護的產品名稱與營養資料；不會傳送你的健康紀錄。
          </li>
          <li>
            營養標示辨識在目前裝置執行。首次使用時，瀏覽器可能需要下載 Tesseract.js
            文字辨識模型；所選照片不會傳送至真藍瘦伺服器。
          </li>
        </ul>
      </section>
      <section>
        <h2>4. 相機與通知權限</h2>
        <p>
          相機只在你主動開啟條碼掃描時使用；通知只在你開啟提醒總開關並授權後使用。你可隨時在 App
          或裝置設定中關閉權限。
        </p>
      </section>
      <section>
        <h2>5. 分析、廣告與付費</h2>
        <p>
          目前版本未啟用第三方廣告、跨站追蹤、帳號分析或實際付款。PRO
          僅為功能規劃展示，不會扣款。未來若加入相關服務，本政策與同意流程會在啟用前更新。
        </p>
      </section>
      <section>
        <h2>6. 匯出、還原與刪除</h2>
        <p>
          在「資料管理」中可匯出 CSV、下載 JSON 完整備份、還原備份，或永久刪除這台裝置上的真藍瘦資料。刪除前建議先備份。
        </p>
      </section>
      <section>
        <h2>7. 適用年齡與健康資訊</h2>
        <p>
          個人化熱量功能以成年人為設計對象。真藍瘦提供的是生活紀錄與估算資訊，不是醫療診斷；孕期、哺乳期、慢性病、飲食失調或特殊營養需求者，應先諮詢合格專業人員。
        </p>
      </section>
      <section>
        <h2>8. 聯絡與政策變更</h2>
        <p>
          正式商店版本的支援與隱私聯絡方式，將以 App Store 或 Google Play
          商店頁所列開發者聯絡資訊為準。重大變更會更新日期並在產品內清楚告知。
        </p>
      </section>
    </LegalPage>
  );
}
