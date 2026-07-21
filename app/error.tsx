"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="fallback-page">
      <span>真藍瘦</span>
      <h1>畫面暫時無法載入</h1>
      <p>你的本機紀錄不會因此被刪除。請先重新載入；若仍失敗，可回到首頁。</p>
      <div>
        <button onClick={reset}>重新載入</button>
        <Link href="/">回到首頁</Link>
      </div>
    </main>
  );
}
