import { access, rm } from "node:fs/promises";

await access("dist/client/_worker.js/index.js");

// Vinext writes a Workers-specific deployment redirect during its build. Pages
// must use the root wrangler.toml instead so the Pages compatibility flags are
// applied while Cloudflare uploads the generated _worker.js bundle.
await rm(".wrangler/deploy/config.json", { force: true });

console.log("Prepared Cloudflare Pages output with the root Pages configuration.");
