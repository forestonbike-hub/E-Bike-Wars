# E-Bike Wars: Product Requirements Document

**Version:** 1.0
**Created:** April 12, 2026
**Status:** Active

---

## 1. Overview

E-Bike Wars is a free, multiplayer browser game where players control
e-bikes in a top-down arena and fight to be the last one standing. No
downloads, no accounts. Players join by clicking a shared link.

---

## 2. Core Concept

**Genre:** Arena combat
**Perspective:** Top-down bird's eye view
**Art style:** Cartoon / clean (bright, friendly, simple shapes, Among Us energy)
**Session size:** 2-8 players per game
**Round length:** 60-120 seconds per round
**Win condition:** Last e-bike standing wins the round

Players enter an arena on e-bikes. They ram, dodge, and outmaneuver
each other to knock opponents out. Short rounds keep the energy high.
Eliminated players watch the rest of the round, then everyone plays
again.

---

## 3. Target Audience

Friends who want a quick, fun game to play together. No gaming
experience required. The kind of game you text a link to your group
chat and everyone is playing within 30 seconds.

---

## 4. Platform Requirements

- Runs in any modern browser (Chrome, Safari, Firefox, Edge)
- Works on desktop (keyboard controls) and mobile (touch controls)
- No app install, no plugin, no account creation
- Responsive layout that adapts to any screen size
- Target performance: 60fps on mid-range phones

---

## 5. How Players Join

1. One player visits the game URL
2. They click "Create Game" and get a room code (e.g., BIKE-7X3Q)
3. The game URL updates to include the room code (e.g., ebikewars.glitch.me/game/BIKE-7X3Q)
4. Player shares that link with friends via text, Discord, etc.
5. Friends click the link, enter a display name, and join the lobby
6. No passwords, no sign-up, no email

---

## 6. Game Flow

### 6.1 Home Screen
- Game title and branding
- "Create Game" button
- Field to enter a room code manually (for joining without a link)

### 6.2 Lobby
- List of all connected players with their chosen name and bike color
- Host (room creator) has a "Start Game" button
- Minimum 2 players required to start
- Players can pick their bike color (6-8 color options)
- Room code displayed prominently for easy sharing
- "Copy Link" button for quick sharing

### 6.3 Countdown
- 3... 2... 1... GO! animation
- Players placed at random starting positions in the arena

### 6.4 Gameplay (the round)
- Top-down arena with walls and obstacles
- Each player controls an e-bike
- Objective: knock other bikes out of the arena or deplete their health
- Round timer counts down (60-120 seconds)
- If timer expires, the player with the most health wins
- Eliminated players switch to spectator view (can watch the remaining
  players)

### 6.5 Results Screen
- Winner announced with animation
- Round stats (eliminations, survival time)
- Session scoreboard (wins across multiple rounds)
- "Play Again" returns everyone to the lobby for the next round

### 6.6 Round Loop
Lobby > Countdown > Gameplay > Results > Lobby (repeat)

---

## 7. Gameplay Mechanics

### 7.1 Movement
- E-bikes move forward continuously at a base speed
- Player controls the steering (left/right rotation)
- Acceleration and braking (speed up / slow down)
- Desktop: WASD or arrow keys
- Mobile: on-screen virtual joystick or tilt controls

### 7.2 Combat
- **Ramming:** Hitting another bike at high speed deals damage based on
  your speed. Head-on collisions damage both players. Hitting someone
  from behind deals more damage to them.
- **Boost:** A short speed burst on a cooldown timer. Great for
  ramming attacks or escaping danger. Activated with spacebar (desktop)
  or a button (mobile).
- **Arena hazards:** The arena shrinks over time (like a battle royale
  storm) to force players together and prevent camping.

### 7.3 Health System
- Each bike starts with 100 health
- Damage from collisions reduces health
- At 0 health, the bike is eliminated (explosion effect)
- No health regeneration (keeps rounds short and aggressive)

### 7.4 Arena
- Rectangular arena with solid walls around the edges
- Scattered obstacles (barriers, ramps, columns) for tactical play
- Arena shrinks every 20-30 seconds, pushing remaining players closer
- Clean, readable layout so players always know where they are

### 7.5 Power-ups (future, not required for MVP)
- Speed boost pickup
- Shield (temporary invulnerability)
- Health pack (small heal)
- Appear randomly on the arena floor

---

## 8. Visual Design

### 8.1 Style Guidelines
- Cartoon / clean aesthetic
- Bright, saturated colors on a lighter background
- Simple geometric shapes with bold outlines
- Smooth animations (bike turning, boost trails, explosions)
- Readable at small sizes (important for mobile)

### 8.2 Player Bikes
- Simple top-down bike shape (oval/rectangle with a direction indicator)
- Each player gets a distinct color
- Name label floating above each bike
- Boost effect: speed lines or glow trail behind the bike
- Damage effect: bike flashes red, slight screen shake

### 8.3 Arena
- Clean tiled or solid-color floor
- Walls and obstacles in a contrasting color
- Shrinking zone has a clear visual boundary (colored border or fog)
- Minimal visual noise so gameplay is easy to read

### 8.4 UI Elements
- Health bar above each bike (small, clean)
- Boost cooldown indicator
- Round timer (top center)
- Player count / alive count
- Kill feed (top right, shows eliminations)

---

## 9. Audio (future, not required for MVP)

- Background music: upbeat, energetic, loopable
- Sound effects: boost activation, collision impact, elimination
  explosion, countdown beeps, round start horn, victory fanfare
- Volume controls in settings

---

## 10. Technical Architecture

### 10.1 Tech Stack
- **Game engine:** Phaser 3 (2D rendering, physics, input handling)
- **Networking:** Socket.io (real-time multiplayer communication)
- **Server:** Node.js + Express (room management, game state)
- **Language:** TypeScript (client and server)
- **Build tool:** Vite (fast development builds)
- **Hosting:** Glitch.com (free, no credit card)

### 10.2 Networking Model
- Server is authoritative: it owns the true game state
- Clients send input (steering, boost) to the server
- Server calculates physics, collisions, and damage
- Server broadcasts updated positions to all clients
- Clients use interpolation to smooth movement between updates
- Target: 20 state updates per second from server

### 10.3 Constraints
- Zero cost: no paid services or subscriptions
- Glitch.com limits: 512MB RAM, 200MB disk, apps sleep after 5 min idle
- Must work without WebGL (Canvas fallback for older devices)

---

## 11. Build Phases

### Phase 0: Project Skeleton [COMPLETE]
Tech stack wired up. Phaser loads in the browser. Socket.io connects
to the server.

### Phase 1: Game Canvas and E-Bike Movement
Single-player e-bike riding around an arena with walls and obstacles.
Keyboard and touch controls. No multiplayer yet, just the core feel
of driving the bike.

### Phase 2: Room System and Link-Join
Create/join rooms via shareable link. Lobby with player names and
bike color selection. Host can start the game.

### Phase 3: Multiplayer Arena
All players in a room see each other on the same arena. Networked
movement. Server-authoritative physics.

### Phase 4: Combat and Win Condition
Ramming damage, health bars, elimination, shrinking arena, round
timer, results screen, round loop.

### Phase 5: Visual Polish
Bike sprites, arena theming, particle effects, animations, UI styling.

### Phase 6: Game Feel
Screen shake, speed effects, sound, reconnection handling, spectator
mode, performance optimization.

### Phase 7: Progression
Session leaderboard, match history (browser storage), emoji reactions,
arena variations.

### Phase 8: Deployment
Deploy to Glitch.com. Shareable URL. Open Graph previews for link
sharing. Share button in-game.

---

## 12. MVP Definition

The minimum playable version (end of Phase 4) includes:
- Join a game via shared link with no account
- 2-8 players in a top-down arena
- Control an e-bike with keyboard or touch
- Ram other bikes to deal damage
- Boost mechanic on cooldown
- Shrinking arena forces action
- Last bike standing wins
- Round loop (play again without rejoining)
- Session scoreboard

Everything after Phase 4 is polish, progression, and deployment.

---

## 13. Open Questions (to decide as we build)

- Exact arena size and obstacle layout
- Boost cooldown duration and damage multiplier
- Arena shrink speed and timing
- Whether eliminated players can interact as spectators (chat, emoji)
- Specific power-up designs (Phase 7+)
- Sound and music sourcing
- Custom domain name for deployment

---

## 14. Success Criteria

The game is successful when:
1. Two friends can go from "here's a link" to playing in under 30 seconds
2. A round feels exciting and unpredictable
3. Players want to immediately play another round
4. It works on both a laptop and a phone without issues
5. It costs $0 to host and run
