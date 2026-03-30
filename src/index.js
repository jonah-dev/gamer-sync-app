import { GamesDurableObject } from "./games-durable-object.js";

export { GamesDurableObject };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route API requests and WebSocket upgrades to the Durable Object
    if (url.pathname.startsWith("/api/") || request.headers.get("upgrade") === "websocket") {
      const id = env.GAMES.idFromName("main");
      const stub = env.GAMES.get(id);
      return stub.fetch(request);
    }

    // If static assets are bound to this Worker, serve them.
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    // Standalone API Worker fallback.
    return new Response("Game Selector API is running. Open your Cloudflare Pages URL for the frontend.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};