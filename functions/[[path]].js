import app from "../dist/server/index.js";

export function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.svg" ||
    pathname === "/app-icon.svg" ||
    pathname === "/manifest.webmanifest"
  ) {
    return context.env.ASSETS.fetch(context.request);
  }

  return app.fetch(context.request, context.env, context);
}
