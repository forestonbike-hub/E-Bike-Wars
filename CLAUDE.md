# E-Bike Wars

## What This Repo Is
This is a standalone game project. It has no connection to KwantumLabs,
marketing work, or any other repo in the workspace.

## Game Concept
**E-Bike Wars** is a multiplayer browser game. Core design principles:

- **No accounts required.** Players join via a shareable link/URL.
- **Multiplayer-first.** Multiple players connect to the same session
  from different devices/browsers.
- **Browser-based.** No downloads, no installs. Works on desktop and
  mobile.
- **Zero cost.** No paid services, no credit cards. Everything must be
  completely free.

## Tech Stack
- Phaser 3 (game engine)
- Socket.io (real-time multiplayer)
- Node.js + Express (server)
- TypeScript (language)
- Vite (build tool)
- Render.com (hosting, free instance type)

## Constraints
- Never introduce a paid dependency or service
- Render.com is the hosting platform, on the Free instance type
  (0.1 CPU, 512MB RAM, spins down after ~15 min idle; first visitor
  after a sleep waits ~30-60 seconds). Do not upgrade to a paid
  instance. (Glitch.com, the original host, shut down in 2025.)
- Live URL: https://e-bike-wars.onrender.com (auto-deploys from
  master via render.yaml)

## Status
Project started April 12, 2026. Phase 0 (project skeleton) complete.
