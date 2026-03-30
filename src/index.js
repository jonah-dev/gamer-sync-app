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

    // Let Pages handle everything else
    return fetch(request);
  },
};