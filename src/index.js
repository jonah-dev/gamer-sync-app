import { GamesDurableObject } from "./games-durable-object.js";

export { GamesDurableObject };

function unauthorized(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getRequestIdentity(request, env) {
  const ssoMode = (env.SSO_MODE || "off").toLowerCase();
  const requireSso = ssoMode === "access" || env.REQUIRE_SSO === "true";

  if (!requireSso) {
    return { identity: null, error: null };
  }

  const email = request.headers.get("cf-access-authenticated-user-email")?.toLowerCase();
  if (!email) {
    return { identity: null, error: unauthorized("SSO required. Authenticate via Cloudflare Access first.") };
  }

  const allowedEmails = parseCsv(env.ALLOWED_EMAILS);
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    return { identity: null, error: unauthorized("Your account is not allowed for this app.") };
  }

  const allowedDomain = (env.ALLOWED_EMAIL_DOMAIN || "").trim().toLowerCase();
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    return { identity: null, error: unauthorized("Your email domain is not allowed.") };
  }

  return { identity: email, error: null };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApiOrWebSocket = url.pathname.startsWith("/api/") || request.headers.get("upgrade") === "websocket";

    if (isApiOrWebSocket) {
      const { identity, error } = getRequestIdentity(request, env);
      if (error) {
        return error;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        return new Response(JSON.stringify({
          authenticated: Boolean(identity),
          user: identity,
        }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      const id = env.GAMES.idFromName("main");
      const stub = env.GAMES.get(id);

      const headers = new Headers(request.headers);
      if (identity) {
        headers.set("x-user-email", identity);
      }

      const proxiedRequest = new Request(request, { headers });
      return stub.fetch(proxiedRequest);
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