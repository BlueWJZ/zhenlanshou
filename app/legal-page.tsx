import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link href="/" aria-label="回到真藍瘦首頁">
          <span aria-hidden="true">藍</span>
          <b>真藍瘦</b>
        </Link>
        <nav aria-label="說明頁導覽">
          <Link href="/privacy">隱私權</Link>
          <Link href="/terms">使用條款</Link>
          <Link href="/methodology">計算方法</Link>
        </nav>
      </header>
      <article className="legal-document">
        <p className="legal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-summary">{summary}</p>
        <p className="legal-updated">版本 0.9.0・最後更新：2026 年 7 月 21 日</p>
        <div className="legal-content">{children}</div>
      </article>
      <footer className="legal-footer">
        <span>真藍瘦</span>
        <Link href="/">返回 App</Link>
      </footer>
    </main>
  );
}
