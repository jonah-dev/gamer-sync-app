# Game Selector - Deployment Guide

This is a collaborative game selector app with live voting and real-time sync via WebSocket.

## Files

- `game-selector.html` - The frontend (upload to Cloudflare Pages)
- `wrangler.toml` - Cloudflare Worker configuration
- `src/index.js` - Worker entry point
- `src/games-durable-object.js` - Durable Object for state management
- `package.json` - Project metadata

## Features

- ✅ One shared game list everyone sees in real-time
- ✅ Upvote/downvote games with live updates
- ✅ Weighted random selection (games you like more are more likely to be picked)
- ✅ Persistent storage across sessions
- ✅ WebSocket-based real-time sync (changes appear instantly)

## Deployment Steps

### Step 1: Install Wrangler
```bash
npm install -g wrangler
```

### Step 2: Deploy the Worker + Durable Object
```bash
wrangler deploy
```

This deploys the API backend. You'll get a Workers URL in the output (something like `game-selector-api.yourdomain.workers.dev`).

### Step 3: Update the HTML file's API endpoint (if not on Pages)

The HTML file currently expects the API to be at the same origin (e.g., `game-selector.html` on `yoursite.pages.dev` with Worker routes configured).

If deploying the Worker separately, update this line in `game-selector.html`:
```javascript
let apiUrl = new URL(location.href).origin;
```

To something like:
```javascript
let apiUrl = 'https://game-selector-api.yourdomain.workers.dev';
```

### Step 4: Upload HTML to Cloudflare Pages

Upload `game-selector.html` to your Cloudflare Pages site (or just commit it if auto-deploying from GitHub).

### Step 5: Optional SSO hardening with Cloudflare Access

The Worker now supports Access-based SSO checks for API and WebSocket traffic.

1. In Cloudflare Zero Trust, create an Access application that protects your Worker/API hostname.
2. Add policies for approved users/groups.
3. Set `SSO_MODE = "access"` in Worker environment variables (Wrangler env or dashboard).
4. Optional restrictions:
    - `ALLOWED_EMAIL_DOMAIN` (for example `yourcompany.com`)
    - `ALLOWED_EMAILS` (comma-separated allowlist)

When SSO mode is enabled, requests without an Access identity are rejected.

## Local Development

```bash
wrangler dev
```

Then open `http://localhost:8787/game-selector.html`

## How It Works

1. **Durable Object Storage**: Games and votes are stored in a Cloudflare Durable Object, which persists data and ensures consistency
2. **WebSocket Connection**: The HTML connects via WebSocket for real-time updates
3. **Voting**: Each person gets a user ID (stored in localStorage). Vote changes are instantly broadcast to all connected clients
4. **Weighted Selection**: When you spin the wheel, games with more votes are more likely to be selected

## Architecture

```
game-selector.html ←→ WebSocket ←→ Worker ←→ Durable Object
    (Frontend)                    (API)      (State Storage)
```