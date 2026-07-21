import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://example.test${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the main app with production safety headers", async () => {
  const response = await render();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(
    response.headers.get("strict-transport-security") ?? "",
    /max-age=31536000/,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /真藍瘦/);
});

test("renders privacy, terms, methodology and not-found routes", async () => {
  for (const [path, expected] of [
    ["/privacy", "隱私權政策"],
    ["/terms", "使用條款"],
    ["/methodology", "計算方法與資料來源"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(expected));
  }
  const missing = await render("/this-page-does-not-exist");
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /找不到這個頁面/);
});
