# E-Bike Wars

Multiplayer browser game. Join via link, no account required.

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## How It Works

- **Client** (port 5173): Phaser 3 game running in the browser, built with Vite
- **Server** (port 3000): Express + Socket.io handling multiplayer connections
- Vite proxies WebSocket traffic from the client to the server automatically

## Tech Stack

- Phaser 3 (game engine)
- Socket.io (real-time multiplayer)
- Node.js + Express (server)
- TypeScript (language)
- Vite (build tool)
