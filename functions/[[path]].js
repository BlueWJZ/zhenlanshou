import app from "../dist/server/index.js";

export function onRequest(context) {
  return app.fetch(context.request, context.env, context);
}
