# E-Bike Wars: Product Requirements Document

**Version:** 1.1
**Created:** April 12, 2026
**Last updated:** April 12, 2026
**Status:** Active

---

## 1. Overview

E-Bike Wars is a free, multiplayer browser game with two stages.
First, every player gets the same budget to build and equip their
e-bike (choosing frames, weapons, armor, and accessories). Then
everyone enters a top-down arena and battles until one bike is left
standing. No downloads, no accounts. Players join by clicking a
shared link.

---

## 2. Core Concept

**Genre:** Arena combat with a build/loadout phase
**Perspective:** Top-down bird's eye view
**Art style:** Cartoon / clean (bright, friendly, simple shapes)
**Session size:** 2-8 players per game
**Round structure:** Build Phase (strategy) > Battle Phase (action)
**Win condition:** Last e-bike standing wins the round

The build phase is where the strategy happens. Everyone has the same
budget but must make trade-offs: a fast bike with a big gun but no
armor? A tank that's slow but hard to kill? A balanced build with
a little of everything? You don't know what anyone else is building
until the battle starts.

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

### 6.3 Build Phase (Stage 1)
- Timer counts down (60-90 seconds to build)
- Every player starts with the same budget (e.g., $1,000)
- Shop interface showing available items organized by category
- Players buy a bike frame, then add weapons, armor, and accessories
- Each purchase deducts from the budget. No refunds (or allow
  sell-back at reduced price, TBD)
- Players can see their bike preview updating as they add items
- Remaining budget displayed prominently
- Other players' builds are hidden (you can't see what they're buying)
- "Ready" button when done building. Once all players are ready (or
  the timer expires), the battle begins
- Players who don't finish building in time go with whatever they
  have equipped

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
Lobby > Build Phase > Battle Phase > Results > Lobby (repeat)

---

## 7. Build Phase: Shop System

### 7.1 Budget
- Every player starts each round with the same amount (e.g., $1,000)
- Budget resets each round (no carrying money between rounds)
- All items have fixed prices visible in the shop

### 7.2 Bike Frames
The frame is the base of your bike. It determines base stats before
equipment is added. Players must pick exactly one frame.

| Frame | Cost | Speed | Health | Size | Description |
|-------|------|-------|--------|------|-------------|
| Scout | $150 | Fast | Low (70 HP) | Small | Quick and agile, hard to hit, but fragile |
| Standard | $200 | Medium | Medium (100 HP) | Medium | Balanced all-rounder |
| Bruiser | $300 | Slow | High (150 HP) | Large | Tanky and heavy, deals more ram damage |
| Racer | $250 | Very fast | Low (60 HP) | Small | Fastest frame, glass cannon for boost-ram builds |

**Assumption:** These are starter values. We'll tune through playtesting.

### 7.3 Weapons
Weapons add offensive capability beyond ramming. Players can equip
one weapon at a time (or none, to save budget for other items).

| Weapon | Cost | Effect |
|--------|------|--------|
| Machine Gun | $200 | Rapid fire, low damage per shot. Good for chip damage at range. |
| Shotgun | $250 | Fires a spread of pellets. High damage up close, weak at distance. |
| Missile Launcher | $350 | Slow-firing homing missile. High damage but limited ammo (3 shots per round). |
| EMP Blast | $300 | Short-range burst that disables nearby bikes for 2 seconds (no damage). |
| None | $0 | Save your budget. Ram-only build. |

### 7.4 Armor
Armor reduces incoming damage but adds weight (reduces speed).

| Armor | Cost | Damage Reduction | Speed Penalty |
|-------|------|-----------------|---------------|
| None | $0 | 0% | None |
| Light Plating | $150 | 15% reduction | Slight slowdown |
| Heavy Plating | $300 | 30% reduction | Noticeable slowdown |
| Reactive Armor | $400 | 20% reduction + reflects 10% damage back to attacker | Moderate slowdown |

### 7.5 Accessories
Optional items that add special abilities or passive bonuses.
Players can equip up to 2 accessories.

| Accessory | Cost | Effect |
|-----------|------|--------|
| Turbo Boost | $150 | Upgrades your boost (longer duration, shorter cooldown) |
| Oil Slick | $200 | Drop an oil patch behind you (3 uses). Bikes that ride over it spin out. |
| Shield Generator | $250 | One-time shield that absorbs the next 50 damage, then breaks |
| Radar | $100 | Shows all enemy positions on your minimap even through obstacles |
| Spikes | $200 | Passive: bikes that ram you take 25% of the damage back |
| Nitro Tank | $150 | One massive speed boost (single use). Great for a surprise attack. |

### 7.6 Example Builds (to illustrate trade-offs)

**Glass Cannon ($1,000):**
Racer frame ($250) + Missile Launcher ($350) + Turbo Boost ($150) +
Nitro Tank ($150). Extremely fast with big damage, but 60 HP and
no armor. One good hit and you're done.

**The Tank ($1,000):**
Bruiser frame ($300) + Heavy Plating ($300) + Spikes ($200) +
Radar ($100). Slow but nearly unkillable. Rams everything in sight
and punishes anyone who rams back.

**Hit and Run ($950):**
Scout frame ($150) + Shotgun ($250) + Light Plating ($150) +
Oil Slick ($200) + Turbo Boost ($150). Fast, gets in close for
shotgun damage, drops oil to escape. $50 left unspent.

**Budget Brawler ($550):**
Standard frame ($200) + Machine Gun ($200) + Turbo Boost ($150).
Saves $450 in budget. Not optimized but functional. (Leftover
budget has no benefit, so this is a suboptimal strategy.)

---

## 8. Battle Phase: Gameplay Mechanics

### 8.1 Movement
- E-bikes move forward continuously at a base speed (modified by frame
  and armor choices)
- Player controls the steering (left/right rotation)
- Acceleration and braking (speed up / slow down)
- Desktop: WASD or arrow keys for movement, mouse to aim weapons
- Mobile: virtual joystick for movement, tap to fire

### 8.2 Boost
- Every bike has a boost ability (short speed burst)
- Base cooldown: 5 seconds (Turbo Boost accessory improves this)
- Boosting into another bike increases ram damage
- Desktop: spacebar. Mobile: on-screen button

### 8.3 Ramming
- Hitting another bike deals damage based on your speed and frame weight
- Head-on collisions damage both players
- Rear hits deal more damage to the target
- Heavier frames deal more ram damage
- Spikes accessory reflects damage back to the attacker

### 8.4 Weapons
- Weapons fire in the direction the bike is facing (or mouse aim on
  desktop)
- Each weapon has its own fire rate, range, and damage profile
- Ammo is unlimited except for Missile Launcher (3 shots per round)
- Weapons can be fired while moving

### 8.5 Health System
- Starting health is determined by bike frame choice
- Damage comes from ramming, weapons, and arena hazards
- Armor reduces incoming damage by a percentage
- At 0 health, the bike is eliminated (explosion effect)
- No health regeneration (keeps rounds aggressive)

### 8.6 Arena
- Rectangular arena with solid walls around the edges
- Scattered obstacles (barriers, columns) for cover and tactical play
- Arena shrinks every 20-30 seconds, pushing remaining players closer
- Shrinking zone deals damage to bikes caught outside the safe area
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
- Simple top-down bike shape that visually reflects the chosen frame
- Each player gets a distinct color
- Equipped weapons visible on the bike sprite
- Armor visually changes the bike appearance (thicker outline, plating)
- Name label floating above each bike
- Boost effect: speed lines or glow trail behind the bike
- Damage effect: bike flashes red, slight screen shake

### 9.3 Build Phase UI
- Shop laid out as a clean grid or list, organized by category tabs
  (Frames / Weapons / Armor / Accessories)
- Each item shows: icon, name, price, stat summary
- Bike preview in the center updates live as items are added
- Budget bar at the top shows remaining money
- "Ready" button at the bottom
- Timer visible at the top
- Clean enough to be usable on a phone screen

### 9.4 Arena
- Clean tiled or solid-color floor
- Walls and obstacles in a contrasting color
- Shrinking zone has a clear visual boundary (colored border or fog)
- Minimal visual noise so gameplay is easy to read

### 9.5 Battle UI Elements
- Health bar above each bike (small, clean)
- Boost cooldown indicator
- Weapon ammo count (if applicable)
- Round timer (top center)
- Player count / alive count
- Kill feed (top right, shows eliminations)
- Minimap (if Radar accessory is equipped)

---

## 10. Audio (future, not required for MVP)

- Background music: different tracks for build phase (chill/strategic)
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
- During build phase: clients send purchase/equip actions, server
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

## 12. Build Phases

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

### Phase 3: Build Phase (Shop System)
Shop UI with item categories. Budget system. Bike frame selection.
Weapons, armor, and accessories. Live bike preview. Ready system
with timer. Server validates all purchases.

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
- Build phase: same budget, buy frame + weapons + armor + accessories
- Battle phase: top-down arena combat with loadout-specific stats
- Ramming, weapons, boost, armor, shrinking arena
- Last bike standing wins
- Build reveal on results screen
- Round loop (play again without rejoining)
- Session scoreboard

Everything after Phase 5 is polish, progression, and deployment.

---

## 14. Open Questions (to decide as we build)

- Exact budget amount and item prices (needs playtesting to balance)
- Build phase timer duration (60s? 90s?)
- Whether to allow sell-back of purchased items during build phase
- Exact arena size and obstacle layout
- Weapon damage values and fire rates
- Arena shrink speed and timing
- Whether eliminated players can interact as spectators (chat, emoji)
- Sound and music sourcing
- Custom domain name for deployment

---

## 15. Success Criteria

The game is successful when:
1. Two friends can go from "here's a link" to playing in under 60
   seconds (slightly longer than before due to build phase)
2. The build phase creates genuine "what should I pick?" tension
3. Seeing enemy builds revealed after a round creates surprise and
   conversation ("you had MISSILES?!")
4. Players want to immediately try a different build next round
5. It works on both a laptop and a phone without issues
6. It costs $0 to host and run
