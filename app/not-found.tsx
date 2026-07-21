import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fallback-page">
      <span>404</span>
      <h1>找不到這個頁面</h1>
      <p>網址可能已變更，或這個功能尚未開放。</p>
      <div>
        <Link href="/">回到真藍瘦</Link>
      </div>
    </main>
  );
}
