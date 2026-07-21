# Cloudflare Pages deployment

This repository is prepared for Git-integrated Cloudflare Pages deployment.
The Pages Function delegates requests to the production Vinext Worker build,
while `dist/client` contains the browser assets.

Use these settings when importing the GitHub repository in Cloudflare Pages:

- Project name: `zhenlanshou`
- Production branch: `main`
- Build command: `npm run build:pages`
- Build output directory: `dist/client`
- Root directory: `/`
- Node.js version: `22`
- Compatibility date: `2026-05-15`
- Compatibility flag: `nodejs_compat`

Cloudflare assigns `https://zhenlanshou.pages.dev` if the project name remains
available. Preview branches receive separate preview URLs and do not replace the
production deployment.
