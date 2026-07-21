import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "計算方法｜真藍瘦" };

export default function MethodologyPage() {
  return (
    <LegalPage
      eyebrow="METHODOLOGY"
      title="計算方法與資料來源"
      summary="每個數字都應該知道從哪裡來。這裡說明真藍瘦目前使用的公式、資料層級與限制。"
    >
      <section>
        <h2>基礎代謝與每日消耗</h2>
        <p>
          基礎代謝採 Mifflin–St Jeor 公式：男性為 10×體重(kg)＋6.25×身高(cm)－5×年齡＋5；女性最後一項改為－161。再乘以你選擇的非運動日常活動係數，得到基準消耗。已記錄的運動消耗會另外加入當日總消耗。
        </p>
      </section>
      <section>
        <h2>熱量目標與赤字</h2>
        <p>
          減脂模式最多從基準消耗減少 20% 或 500 kcal；增肌模式最多增加 15% 或 350 kcal。安全下限目前設定為女性 1,200 kcal、男性 1,500 kcal。當日熱量平衡＝攝取－（基準消耗＋運動消耗）；負值代表估算赤字。
        </p>
      </section>
      <section>
        <h2>蛋白質與飲水</h2>
        <p>
          一般減脂或維持目標以參考體重每公斤 1.6g、增肌以每公斤 1.8g
          估算蛋白質。飲水目標以每公斤 30ml 估算，並限制在每日 1,800～3,500ml
          的一般提示範圍；高溫、大量流汗、疾病或特殊需求不適用此簡化結果。
        </p>
      </section>
      <section>
        <h2>運動消耗</h2>
        <p>
          使用 MET 估算式：MET×3.5×體重(kg)÷200×分鐘。實際結果會受動作效率、心率、地形、強度與裝置測量差異影響。
        </p>
      </section>
      <section>
        <h2>食物資料層級</h2>
        <ol>
          <li>「官方資料」來自衛福部食藥署食品營養成分資料集。</li>
          <li>「包裝標示」由使用者拍攝或輸入，加入前必須自行核對每份基準。</li>
          <li>「條碼資料」來自 Open Food Facts 社群資料，可能不完整或過期。</li>
          <li>「外食估算」與自行輸入資料會因品牌、份量和烹調方式而有較大誤差。</li>
        </ol>
      </section>
      <section>
        <h2>不確定性</h2>
        <p>
          真藍瘦刻意顯示資料來源，並允許修改份量與回報問題。建議觀察兩至四週的體重與紀錄趨勢，再做小幅調整，不要因單日數字進行極端限制。
        </p>
      </section>
    </LegalPage>
  );
}
