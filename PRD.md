# E-Bike Wars: Product Requirements Document

**Version:** 1.2
**Created:** April 12, 2026
**Last updated:** April 12, 2026
**Status:** Active

---

## 1. Overview

E-Bike Wars is a free, multiplayer browser game with two stages.
First, every player gets the same budget to build and equip their
e-bike (buying bike upgrades, weapons, and armor). Then
everyone enters a top-down arena and battles until one bike is left
standing. No downloads, no accounts. Players join by clicking a
shared link.

---

## 2. Core Concept

**Genre:** Arena combat with a build/loadout phase
**Perspective:** Top-down bird's eye view
**Art style:** Cartoon / clean (bright, friendly, simple shapes)
**Session size:** 2-8 players per game
**Round structure:** Equip Phase (strategy) > Battle Phase (action)
**Win condition:** Last e-bike standing wins the round

The equip phase is where the strategy happens. Everyone starts with
the same e-bike and the same $1,000 budget. You spend that budget
on bike upgrades, armor, and weapons. A faster motor with a dog
and no armor? Full armor and a mop? A balanced build with a little
of everything? You don't know what anyone else is buying until the
battle starts.

---

## 3. Target Audience

Friends who want a quick, fun game to play together. No gaming
experience required. The kind of game you text a link to your group
chat and everyone is playing within 30 seconds.

---

## 4. Platform Requirements

- Runs in any modern browser (Chrome, Safari, Firefox, Edge)
- Works on desktop (keyboard + mouse controls) and mobile (touch)
- No app install, no plugin, no account creation
- Responsive layout that adapts to any screen size
- Target performance: 60fps on mid-range phones

---

## 5. How Players Join

1. One player visits the game URL
2. They click "Create Game" and get a room code (e.g., BIKE-7X3Q)
3. The game URL updates to include the room code
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
- List of all connected players with their chosen name
- Host (room creator) has a "Start Round" button
- Minimum 2 players required to start
- Room code displayed prominently for easy sharing
- "Copy Link" button for quick sharing
- Session scoreboard visible (wins from previous rounds)

### 6.3 Equip Phase (Stage 1)
- Every player starts with the same $1,000 budget
- Shop interface with three category tabs: Bike, Armor, Weapons
- Click a tab to expand its item list; other tabs collapse
- Each item has a checkbox, icon, name, description, and price
- Click to buy (checkbox fills, budget decreases). Click again to
  remove (budget refunded in full)
- Items you can't afford are grayed out
- Budget counter updates live, color-coded: green (plenty), yellow
  (low), red (spent)
- Other players' purchases are hidden
- "Ready for Battle" button when done shopping. Locks your
  selections. When all players are ready, the battle begins
- All items are optional. You can enter battle with unspent budget
  (though there's no advantage to saving money)

### 6.4 Battle Phase (Stage 2)
- 3... 2... 1... GO! countdown
- Players placed at random starting positions in the arena
- Top-down arena with walls and obstacles
- Each player's bike has the stats and equipment from their build
- Objective: be the last bike standing
- Round timer counts down (60-120 seconds)
- If timer expires, the player with the most health wins
- Eliminated players switch to spectator view

### 6.5 Results Screen
- Winner announced with animation
- Round stats (eliminations, damage dealt, survival time)
- Reveal of each player's build (what they bought, total spent)
- Session scoreboard (wins across multiple rounds)
- "Play Again" returns everyone to the lobby for the next round

### 6.6 Round Loop
Lobby > Equip Phase > Battle Phase > Results > Lobby (repeat)

---

## 7. Equip Phase: Shop System

All items are defined in `shared/types.ts` (the single source of
truth for the codebase). This section mirrors that file in a
readable format. If prices or descriptions change, update both
this document and `shared/types.ts`.

### 7.1 Budget
- Every player starts each round with **$1,000**
- Budget resets each round (no carrying money between rounds)
- All items have fixed prices. Buy/unbuy freely before readying up
- No limit on how many items you can buy (budget is the only constraint)
- Unspent budget has no benefit

### 7.2 Bike Upgrades
Every player starts with the same base e-bike. These upgrades
improve your ride's performance. All are optional.

| Item | Price | Icon | Effect |
|------|-------|------|--------|
| Motor | $150 | ⚡ | Increases top speed |
| Battery | $120 | 🔋 | Longer boost duration |
| Tires | $100 | 🛞 | Better grip and turning |
| Nitro | $250 | 🔥 | Massive speed burst on demand |
| Teleporter | $300 | ✨ | Short-range blink to dodge attacks |

### 7.3 Armor
Protective gear that helps you survive crashes and attacks.

| Item | Price | Icon | Effect |
|------|-------|------|--------|
| Helmet | $80 | ⛑️ | Reduces crash stun time |
| Body Armor | $200 | 🦺 | Absorbs damage from hits |
| Trash Can Lid | $120 | 🛡️ | Blocks attacks from behind |

### 7.4 Weapons
Offensive items you can use during battle to crash or damage
other riders. The fun stuff.

| Item | Price | Icon | Effect |
|------|-------|------|--------|
| Mop | $100 | 🧹 | Swing to knock nearby riders |
| Newspapers | $80 | 📰 | Throw to temporarily blind opponents |
| Water Balloon | $120 | 🎈 | Lob to make area slippery |
| Nails | $150 | 📌 | Drop behind you to pop tires |
| Dog | $250 | 🐕 | Chases nearest opponent and trips them |

### 7.5 Example Builds (to illustrate trade-offs)

**Speed Demon ($920):**
Motor ($150) + Battery ($120) + Nitro ($250) + Tires ($100) +
Dog ($250) + Helmet ($80). Maxed-out speed with a dog to harass
opponents. Helmet reduces crash penalty. No body armor though,
so vulnerable to direct attacks. $80 unspent.

**The Survivor ($880):**
Helmet ($80) + Body Armor ($200) + Trash Can Lid ($120) +
Tires ($100) + Motor ($150) + Newspapers ($80) + Water Balloon
($120) + Nails ($150). Full armor stack with cheap weapons.
Slow to kill but hard to take down. $120 unspent.

**Chaos Agent ($780):**
Dog ($250) + Nails ($150) + Water Balloon ($120) + Mop ($100) +
Newspapers ($80) + Helmet ($80). Every weapon in the shop plus
a helmet. No bike upgrades, so you're slow. But the arena will
be total chaos around you. $220 unspent.

**Budget Build ($380):**
Motor ($150) + Tires ($100) + Mop ($100) + Helmet ($80).
Basic speed, basic weapon, basic protection. Saves $620. Not
optimal but gets the job done.

**All-In Speed ($820):**
Motor ($150) + Battery ($120) + Nitro ($250) + Teleporter ($300).
Every bike upgrade. No armor, no weapons. Pure evasion strategy
with the ability to blink away from danger. $180 unspent.

> **Note:** Prices are placeholder values for initial testing.
> We will tune through playtesting. Each item may also get
> upgrade tiers in the future (e.g., Motor Level 1/2/3).

---

## 8. Battle Phase: Gameplay Mechanics

### 8.1 Movement
- All e-bikes start with the same base speed
- Motor upgrade increases top speed; Tires upgrade improves turning
- Player controls steering (left/right rotation) and throttle (accelerate/brake)
- Desktop: WASD or arrow keys. Mobile: virtual joystick

### 8.2 Boost
- Every bike has a boost ability (short speed burst)
- Base cooldown: 5 seconds. Battery upgrade extends boost duration
- Nitro upgrade gives a separate massive speed burst on demand
- Boosting into another bike causes a crash
- Desktop: spacebar. Mobile: on-screen button

### 8.3 Crashing
- Bike-to-bike collisions cause both riders to crash
- Crashed bikes stop for 1 second (stunned, no input)
- Crashed visual: bike tips over, rider falls, daze sparkles
- Helmet reduces crash stun time
- Weapons like the Mop can cause crashes without the attacker crashing

### 8.4 Weapons
Each weapon has unique behavior during battle:
- **Mop:** Swing to knock nearby riders (causes them to crash, you don't)
- **Newspapers:** Throw to temporarily obscure an opponent's screen
- **Water Balloon:** Lob to create a slippery zone on the ground
- **Nails:** Drop behind you; bikes that ride over them lose speed
- **Dog:** Releases a dog that chases the nearest opponent and trips them

### 8.5 Armor Effects
- **Helmet:** Reduces crash stun time (recover faster)
- **Body Armor:** Absorbs damage from weapon hits
- **Trash Can Lid:** Blocks attacks that hit you from behind

### 8.6 Teleporter
- Short-range blink in the direction you're facing
- Useful for dodging attacks or repositioning quickly
- Cooldown TBD through playtesting

### 8.7 Arena
- Rectangular arena (1600x1200) with solid walls around the edges
- 11 scattered obstacles (barriers, columns) for cover and tactical play
- Arena may shrink over time to force players closer (TBD)
- Clean, readable layout so players always know where they are

---

## 9. Visual Design

### 9.1 Style Guidelines
- Cartoon / clean aesthetic
- Bright, saturated colors on a lighter background
- Simple geometric shapes with bold outlines
- Smooth animations (bike turning, boost trails, explosions)
- Readable at small sizes (important for mobile)

### 9.2 Player Bikes
- Simple top-down bike shape (same base for all players)
- Each player gets a distinct color
- Equipped weapons visible on the bike sprite
- Armor visually changes the bike appearance (thicker outline, plating)
- Name label floating above each bike
- Boost effect: speed lines or glow trail behind the bike
- Damage effect: bike flashes red, slight screen shake

### 9.3 Equip Phase UI
- Header: player name (left), budget counter (right)
- Three category tabs: Bike, Armor, Weapons
- Click a tab to see its items; accordion-style (one open at a time)
- Each item: checkbox + emoji icon + name + description + price
- Checkbox fills blue with white checkmark when selected
- Budget counter color-coded: green > yellow > red as money depletes
- Items you can't afford are grayed out
- "Ready for Battle" button at the bottom locks selections
- Clean enough to be usable on a phone screen

### 9.4 Arena
- Clean tiled or solid-color floor
- Walls and obstacles in a contrasting color
- Shrinking zone has a clear visual boundary (colored border or fog)
- Minimal visual noise so gameplay is easy to read

### 9.5 Battle UI Elements
- Health bar above each bike (small, clean)
- Boost cooldown indicator
- Crash stun indicator
- Round timer (top center)
- Player count / alive count
- Kill feed (top right, shows eliminations)

---

## 10. Audio (future, not required for MVP)

- Background music: different tracks for equip phase (chill/strategic)
  vs. battle phase (intense/energetic)
- Sound effects: item purchase click, boost activation, weapon fire,
  collision impact, elimination explosion, countdown beeps, round
  start horn, victory fanfare
- Volume controls in settings

---

## 11. Technical Architecture

### 11.1 Tech Stack
- **Game engine:** Phaser 3 (2D rendering, physics, input handling)
- **Networking:** Socket.io (real-time multiplayer communication)
- **Server:** Node.js + Express (room management, game state)
- **Language:** TypeScript (client and server)
- **Build tool:** Vite (fast development builds)
- **Hosting:** Glitch.com (free, no credit card)

### 11.2 Networking Model
- Server is authoritative: it owns the true game state
- During equip phase: clients send purchase/equip actions, server
  validates budget and updates loadout
- During battle phase: clients send input (steering, boost, fire),
  server calculates physics, collisions, projectiles, and damage
- Server broadcasts updated state to all clients
- Clients use interpolation to smooth movement between updates
- Target: 20 state updates per second from server during battle
- Build phase: event-driven updates only (on purchase/ready)

### 11.3 Anti-Cheat Considerations
- Server validates all purchases against budget
- Server validates all combat damage calculations
- Client never decides its own health or damage
- Build choices are hidden from other clients until battle starts

### 11.4 Constraints
- Zero cost: no paid services or subscriptions
- Glitch.com limits: 512MB RAM, 200MB disk, apps sleep after 5 min idle
- Must work without WebGL (Canvas fallback for older devices)

---

## 12. Equip Phases

### Phase 0: Project Skeleton [COMPLETE]
Tech stack wired up. Phaser loads in the browser. Socket.io connects
to the server.

### Phase 1: Game Canvas and E-Bike Movement
Single-player e-bike riding around an arena. Keyboard and touch
controls. Bike steering, acceleration, boost. The core feel of
driving.

### Phase 2: Room System and Link-Join
Create/join rooms via shareable link. Lobby with player names.
Host can start the game.

### Phase 3: Equip Phase (Shop System)
Shop UI with three category tabs (Bike / Armor / Weapons). $1,000
budget system. Checkbox-based item selection. Server validates all
purchases. Ready system. All players see equip screen simultaneously.

### Phase 4: Multiplayer Arena
All players enter the arena with their builds. Networked movement.
Server-authoritative physics. Each bike reflects its loadout stats.

### Phase 5: Combat and Win Condition
Weapon firing, ramming damage, health/armor system, elimination,
shrinking arena, round timer, results screen (with build reveal),
session scoreboard, round loop.

### Phase 6: Visual Polish
Bike sprites that reflect equipment, arena theming, particle effects,
shop UI styling, animations.

### Phase 7: Game Feel
Screen shake, speed effects, sound, reconnection handling, spectator
mode, performance optimization.

### Phase 8: Progression
Session leaderboard, match history (browser storage), emoji reactions,
arena variations, new items.

### Phase 9: Deployment
Deploy to Glitch.com. Shareable URL. Open Graph previews. Share
button in-game.

---

## 13. MVP Definition

The minimum playable version (end of Phase 5) includes:
- Join a game via shared link with no account
- 2-8 players
- Equip phase: $1,000 budget, buy bike upgrades + armor + weapons
- Battle phase: top-down arena combat with equipment effects active
- Crashing, weapons (mop, newspapers, water balloon, nails, dog),
  armor (helmet, body armor, trash can lid), bike upgrades
- Last bike standing wins
- Build reveal on results screen
- Round loop (play again without rejoining)
- Session scoreboard

Everything after Phase 5 is polish, progression, and deployment.

---

## 14. Open Questions (to decide as we build)

- Item prices need playtesting to balance (current values are placeholders)
- Exact stats for each item (speed boost amount, stun reduction, etc.)
- Whether items should have upgrade tiers (e.g., Motor Level 1/2/3)
- Equip phase timer (currently no timer, just ready-up; add a countdown?)
- Arena shrink speed and timing
- Whether eliminated players can interact as spectators (chat, emoji)
- Sound and music sourcing
- Custom domain name for deployment

---

## 15. Success Criteria

The game is successful when:
1. Two friends can go from "here's a link" to playing in under 60
   seconds (slightly longer than before due to equip phase)
2. The equip phase creates genuine "what should I pick?" tension
3. Seeing enemy builds revealed after a round creates surprise and
   conversation ("you had a DOG?!")
4. Players want to immediately try a different build next round
5. It works on both a laptop and a phone without issues
6. It costs $0 to host and run
