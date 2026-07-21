import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "使用條款｜真藍瘦" };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="TERMS"
      title="使用條款"
      summary="使用真藍瘦前，請先了解資料估算的界線、你的資料責任，以及目前免費版與 PRO 展示的狀態。"
    >
      <section>
        <h2>1. 服務用途</h2>
        <p>
          真藍瘦協助記錄飲食、營養、運動、飲水、睡眠與體重，並根據你輸入的資料產生生活管理估算與一般性建議。
        </p>
      </section>
      <section>
        <h2>2. 不屬於醫療服務</h2>
        <p>
          本服務不是醫療器材，也不提供診斷、治療或個別醫療處方。若你有症狀、特殊疾病、用藥、孕期需求或飲食失調風險，請尋求醫師或營養師協助。
        </p>
      </section>
      <section>
        <h2>3. 資料正確性</h2>
        <p>
          食物份量、品牌配方、烹調方式、MET
          強度與穿戴裝置結果都可能造成差異。加入紀錄前應核對包裝或官方資訊，不應只依單一估算做高風險決策。
        </p>
      </section>
      <section>
        <h2>4. 使用者資料</h2>
        <p>
          你應維護輸入內容與備份。裝置本機資料可能因瀏覽器清除、裝置遺失或系統限制而消失；真藍瘦提供匯出與完整備份工具降低風險。
        </p>
      </section>
      <section>
        <h2>5. 免費版與 PRO</h2>
        <p>
          目前 PRO
          頁面僅顯示規劃中的 AI 功能，不會收費，也不代表承諾推出日期。正式啟用購買前，會另行揭露價格、額度、續訂與退款條件。
        </p>
      </section>
      <section>
        <h2>6. 合理使用與變更</h2>
        <p>
          不得利用本服務進行違法、侵權、破壞安全或干擾他人使用的行為。功能、資料來源與條款可能因品質、安全或法規需求調整，重大變更會更新版本與日期。
        </p>
      </section>
    </LegalPage>
  );
}
