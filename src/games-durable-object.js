export class GamesDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.games = [];
    this.votes = {}; // gameId -> { userId -> vote value }
    this.clients = new Set();
  }

  async fetch(request) {
    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    const url = new URL(request.url);
    const method = request.method;

    // Load state
    await this.loadState();

    if (method === "GET" && url.pathname === "/api/games") {
      return this.getGames();
    }

    if (method === "POST" && url.pathname === "/api/games") {
      const body = await request.json();
      return this.addGame(body.name);
    }

    if (method === "DELETE" && url.pathname.match(/\/api\/games\/\d+/)) {
      const gameId = parseInt(url.pathname.split("/").pop());
      return this.removeGame(gameId);
    }

    if (method === "POST" && url.pathname === "/api/vote") {
      const body = await request.json();
      return this.vote(body.gameId, body.userId, body.value);
    }

    return new Response("Not found", { status: 404 });
  }

  handleWebSocket(request) {
    const { 0: client, 1: server } = new WebSocketPair();

    this.clients.add(server);

    server.accept();
    server.addEventListener("close", () => {
      this.clients.delete(server);
    });

    server.addEventListener("message", async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "vote") {
        await this.vote(data.gameId, data.userId, data.value);
        this.broadcast();
      } else if (data.type === "addGame") {
        await this.addGameDirect(data.name);
        this.broadcast();
      } else if (data.type === "removeGame") {
        await this.removeGameDirect(data.gameId);
        this.broadcast();
      }
    });

    // Send initial state
    this.loadState().then(() => {
      server.send(JSON.stringify({ type: "update", data: this.getStateData() }));
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async loadState() {
    const stored = await this.state.storage.get("games");
    if (stored) {
      this.games = stored.games;
      this.votes = stored.votes;
    }
  }

  async saveState() {
    await this.state.storage.put("games", {
      games: this.games,
      votes: this.votes,
    });
  }

  getStateData() {
    return {
      games: this.games.map((game) => ({
        id: game.id,
        name: game.name,
        votes: this.votes[game.id] || {},
      })),
    };
  }

  async addGame(name) {
    await this.loadState();
    const id = Math.max(...this.games.map((g) => g.id), 0) + 1;
    this.games.push({ id, name });
    this.votes[id] = {};
    await this.saveState();
    this.broadcast();
    return new Response(JSON.stringify({ id, name }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async addGameDirect(name) {
    const id = Math.max(...this.games.map((g) => g.id), 0) + 1;
    this.games.push({ id, name });
    this.votes[id] = {};
    await this.saveState();
  }

  async removeGame(gameId) {
    await this.loadState();
    this.games = this.games.filter((g) => g.id !== gameId);
    delete this.votes[gameId];
    await this.saveState();
    this.broadcast();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async removeGameDirect(gameId) {
    this.games = this.games.filter((g) => g.id !== gameId);
    delete this.votes[gameId];
    await this.saveState();
  }

  async vote(gameId, userId, value) {
    await this.loadState();
    if (!this.votes[gameId]) {
      this.votes[gameId] = {};
    }
    this.votes[gameId][userId] = value;
    await this.saveState();
    this.broadcast();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  broadcast() {
    const message = JSON.stringify({ type: "update", data: this.getStateData() });
    for (const client of this.clients) {
      client.send(message);
    }
  }

  getGames() {
    return new Response(JSON.stringify(this.getStateData()), {
      headers: { "Content-Type": "application/json" },
    });
  }
}