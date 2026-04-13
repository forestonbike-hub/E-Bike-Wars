import type {
  PlayerInput, GameState, GamePlayerState, GameProjectile,
  GameMapHazard, GameDog, Player,
} from "../../../shared/types.js";
import { EQUIP_ITEMS, BASE_BIKE } from "../../../shared/types.js";

// ── Arena constants ──
const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const BIKE_RADIUS = 14;
const CRASH_DAMAGE = 15; // HP lost per crash
const WALL_CRASH_SPEED = 80; // speed threshold for wall/obstacle crash (was 150, too high)
const BATTERY_DEAD_PERIOD = 10000; // ms before battery starts regenerating after hitting 0
const BATTERY_REGEN_RATE = 0.167; // fraction per second (~3s from 0% to 50%)

// Obstacle definitions (must match client GameScene)
const OBSTACLES = [
  { x: 800, y: 600, w: 80, h: 80 },
  { x: 300, y: 250, w: 60, h: 120 },
  { x: 1300, y: 250, w: 60, h: 120 },
  { x: 300, y: 900, w: 60, h: 120 },
  { x: 1300, y: 900, w: 60, h: 120 },
  { x: 600, y: 400, w: 120, h: 30 },
  { x: 1000, y: 400, w: 120, h: 30 },
  { x: 600, y: 800, w: 120, h: 30 },
  { x: 1000, y: 800, w: 120, h: 30 },
  { x: 500, y: 600, w: 30, h: 80 },
  { x: 1100, y: 600, w: 30, h: 80 },
];

// ── Computed stats for a bike after applying loadout ──
interface BikeStats {
  maxSpeed: number;
  pedalSpeed: number;
  turnSpeed: number;
  acceleration: number;
  brakeForce: number;
  friction: number;
  batteryDuration: number;
  batteryDrain: number;       // multiplier on drain rate
  nitroCooldown: number;
  nitroSpeed: number;
  nitroDuration: number;
  crashStun: number;
  health: number;
  speedBonus: number;         // flat speed added to maxSpeed
  turnMultiplier: number;     // applied to turnSpeed
  damageReduction: number;    // flat damage absorbed per hit
  nailVulnerability: "normal" | "instant" | "resistant";
  // Item flags
  hasMop: boolean;
  mopDamage: number;
  mopRange: number;
  hasNewspapers: boolean;
  hasWaterBalloon: boolean;
  hasNails: boolean;
  hasDog: boolean;
  hasTeleporter: boolean;
  teleporterDistance: number;
  teleporterUses: number;
  hasHelmet: boolean;
  helmetHandlingOverride: number; // overrides newspaper handling penalty
  hasTrashLid: boolean;
  trashLidDuration: number;
  trashLidUses: number;
}

// ── Server-side bike state ──
interface ServerBike {
  id: string;
  isBot: boolean;
  name: string;
  colorIndex: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
  isDead: boolean;

  // Loadout
  stats: BikeStats;
  itemIds: string[];

  // Battery / motor
  batteryRemaining: number; // ms remaining
  batteryActive: boolean;
  batteryDeadTimer: number; // ms until regen starts after battery hits 0

  // Nitro
  isNitroing: boolean;
  nitroTimer: number;
  nitroCooldownTimer: number;

  // Crash
  isCrashed: boolean;
  crashTimer: number;

  // Mop
  mopExtended: boolean;

  // Shield (trash can lid)
  shieldActive: boolean;
  shieldTimer: number;
  shieldUsesLeft: number;

  // Teleporter
  teleportUsesLeft: number;

  // Weapon cooldowns and ammo
  newspaperCooldown: number;
  newspaperAmmo: number;
  newspaperMaxAmmo: number;
  newspaperRegenTimer: number;

  waterBalloonCooldown: number;
  waterBalloonAmmo: number;
  waterBalloonMaxAmmo: number;
  waterBalloonRegenTimer: number;

  nailCooldown: number;
  nailAmmo: number;
  nailMaxAmmo: number;
  nailRegenTimer: number;

  dogCooldown: number;
  dogActive: boolean; // whether this player's dog is on the field

  // Active debuffs
  handlingDebuff: number;     // multiplier (1.0 = normal, 0.3 = impaired)
  handlingDebuffTimer: number;
  speedDebuff: number;        // multiplier (1.0 = normal, 0.5 = slowed)
  speedDebuffTimer: number;

  // Last received input
  input: PlayerInput;
}

// ── Projectile in flight ──
interface ServerProjectile {
  id: string;
  type: "newspaper" | "waterballoon";
  x: number;
  y: number;
  heading: number;
  speed: number;
  ownerId: string;
  range: number;     // max distance
  traveled: number;  // distance traveled so far
  damage: number;
  accuracy: number;
  // Debuff applied on hit
  duration: number;
  handlingPenalty: number;
  speedDebuff: number;
  // Water balloon map effect
  mapEffect?: { radius: number; duration: number; type: "slick" | "nails" };
}

// ── Map hazard on the ground ──
interface ServerHazard {
  id: string;
  type: "slick" | "nails";
  x: number;
  y: number;
  radius: number;
  remainingMs: number;
  ownerId?: string;     // who dropped it (immune briefly)
  immuneUntilMs?: number; // owner is immune until this many ms remain
}

// ── Dog chasing players ──
interface ServerDog {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  heading: number;
  speed: number;
  damage: number;
  remainingMs: number;
  delayMs: number; // waits before chasing
}

let nextId = 0;
function uid(): string { return `e${nextId++}`; }

// ── Compute stats from item list ──
function computeStats(itemIds: string[]): BikeStats {
  const stats: BikeStats = {
    maxSpeed: BASE_BIKE.maxSpeed,
    pedalSpeed: BASE_BIKE.pedalSpeed,
    turnSpeed: BASE_BIKE.turnSpeed,
    acceleration: BASE_BIKE.acceleration,
    brakeForce: BASE_BIKE.brakeForce,
    friction: BASE_BIKE.friction,
    batteryDuration: BASE_BIKE.batteryDuration,
    batteryDrain: 1.0,
    nitroCooldown: BASE_BIKE.nitroCooldown,
    nitroSpeed: BASE_BIKE.nitroSpeed,
    nitroDuration: BASE_BIKE.nitroDuration,
    crashStun: BASE_BIKE.crashStun,
    health: BASE_BIKE.health,
    speedBonus: 0,
    turnMultiplier: 1.0,
    damageReduction: 0,
    nailVulnerability: "normal",
    hasMop: false,
    mopDamage: 0,
    mopRange: 0,
    hasNewspapers: false,
    hasWaterBalloon: false,
    hasNails: false,
    hasDog: false,
    hasTeleporter: false,
    teleporterDistance: 0,
    teleporterUses: 0,
    hasHelmet: false,
    helmetHandlingOverride: 0,
    hasTrashLid: false,
    trashLidDuration: 0,
    trashLidUses: 0,
  };

  for (const id of itemIds) {
    const item = EQUIP_ITEMS.find(i => i.id === id);
    if (!item) continue;
    const p = item.params;

    switch (id) {
      case "motor-upgrade":
        if (p.pedalSpeed) stats.pedalSpeed = p.pedalSpeed;
        if (p.batteryDrain) stats.batteryDrain = p.batteryDrain;
        break;
      case "battery-upgrade":
        if (p.batteryDuration) stats.batteryDuration = p.batteryDuration;
        break;
      case "tires-skinny":
        if (p.speed) stats.speedBonus += p.speed;
        if (p.turnBoost) stats.turnMultiplier *= p.turnBoost;
        if (p.nailVulnerability) stats.nailVulnerability = p.nailVulnerability;
        break;
      case "tires-tough":
        if (p.speedPenalty) stats.maxSpeed *= p.speedPenalty;
        if (p.turnPenalty) stats.turnMultiplier *= p.turnPenalty;
        if (p.nailVulnerability) stats.nailVulnerability = p.nailVulnerability;
        break;
      case "nitro-upgrade":
        if (p.nitroCooldown) stats.nitroCooldown = p.nitroCooldown;
        break;
      case "teleporter":
        stats.hasTeleporter = true;
        if (p.travel) stats.teleporterDistance = p.travel;
        if (p.uses) stats.teleporterUses = p.uses;
        break;
      case "helmet":
        stats.hasHelmet = true;
        if (p.handlingPenalty) stats.helmetHandlingOverride = p.handlingPenalty;
        break;
      case "bodyarmor-1":
        if (p.damageReduction) stats.damageReduction = p.damageReduction;
        break;
      case "bodyarmor-2":
        // Lv2 replaces lv1 value
        if (p.damageReduction) stats.damageReduction = p.damageReduction;
        break;
      case "trashlid":
        stats.hasTrashLid = true;
        if (p.shieldDuration) stats.trashLidDuration = p.shieldDuration;
        if (p.shieldUses) stats.trashLidUses = p.shieldUses;
        break;
      case "mop":
        stats.hasMop = true;
        if (p.damage) stats.mopDamage = p.damage;
        if (p.range) stats.mopRange = p.range;
        break;
      case "newspapers":
        stats.hasNewspapers = true;
        break;
      case "waterballoon":
        stats.hasWaterBalloon = true;
        break;
      case "nails":
        stats.hasNails = true;
        break;
      case "dog":
        stats.hasDog = true;
        break;
    }
  }

  // Apply speed bonus to max speed
  stats.maxSpeed += stats.speedBonus;

  return stats;
}

// ── Default input (no buttons pressed) ──
const DEFAULT_INPUT: PlayerInput = {
  turnInput: 0,
  throttleInput: 0,
  boostInput: false,
  nitroInput: false,
  mopToggle: false,
  throwInput: false,
  dropInput: false,
  dogInput: false,
  teleportInput: false,
  shieldInput: false,
  seq: 0,
};

// ══════════════════════════════════════════════════════════════
//  GAME LOOP
// ══════════════════════════════════════════════════════════════

export class GameLoop {
  private bikes: Map<string, ServerBike> = new Map();
  private projectiles: ServerProjectile[] = [];
  private hazards: ServerHazard[] = [];
  private dogs: ServerDog[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastTick: number = 0;
  private onStateUpdate: (state: GameState) => void;
  private onGameOver: ((winnerId: string, winnerName: string) => void) | null = null;
  private gameEnded: boolean = false;

  constructor(onStateUpdate: (state: GameState) => void) {
    this.onStateUpdate = onStateUpdate;
  }

  setGameOverCallback(cb: (winnerId: string, winnerName: string) => void) {
    this.onGameOver = cb;
  }

  // ── Player management ──

  addPlayer(player: Player, itemIds: string[], isBot = false) {
    const count = this.bikes.size;
    // Spawn positions along the arena edges, evenly spaced and facing inward
    const SPAWN_MARGIN = 80; // distance from wall
    const spawnPoints = [
      { x: SPAWN_MARGIN, y: SPAWN_MARGIN, heading: Math.PI * 0.75 },                   // top-left, facing center
      { x: ARENA_WIDTH - SPAWN_MARGIN, y: SPAWN_MARGIN, heading: Math.PI * 1.25 },      // top-right
      { x: ARENA_WIDTH - SPAWN_MARGIN, y: ARENA_HEIGHT - SPAWN_MARGIN, heading: Math.PI * 1.75 }, // bottom-right
      { x: SPAWN_MARGIN, y: ARENA_HEIGHT - SPAWN_MARGIN, heading: Math.PI * 0.25 },     // bottom-left
      { x: ARENA_WIDTH / 2, y: SPAWN_MARGIN, heading: Math.PI },                         // top-center
      { x: ARENA_WIDTH - SPAWN_MARGIN, y: ARENA_HEIGHT / 2, heading: Math.PI * 1.5 },   // right-center
      { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - SPAWN_MARGIN, heading: 0 },                // bottom-center
      { x: SPAWN_MARGIN, y: ARENA_HEIGHT / 2, heading: Math.PI * 0.5 },                  // left-center
    ];
    const sp = spawnPoints[count % spawnPoints.length];

    const stats = computeStats(itemIds);

    // Get newspaper item params for ammo
    const newspaperItem = EQUIP_ITEMS.find(i => i.id === "newspapers");
    const waterBalloonItem = EQUIP_ITEMS.find(i => i.id === "waterballoon");
    const nailItem = EQUIP_ITEMS.find(i => i.id === "nails");

    const bike: ServerBike = {
      id: player.id,
      isBot,
      name: player.name,
      colorIndex: player.colorIndex,
      x: sp.x,
      y: sp.y,
      heading: sp.heading,
      speed: 0,
      health: stats.health,
      maxHealth: stats.health,
      isDead: false,
      stats,
      itemIds,

      // Battery
      batteryRemaining: stats.batteryDuration,
      batteryActive: true,
      batteryDeadTimer: 0,

      // Nitro
      isNitroing: false,
      nitroTimer: 0,
      nitroCooldownTimer: 0,

      // Crash
      isCrashed: false,
      crashTimer: 0,

      // Mop
      mopExtended: false,

      // Shield
      shieldActive: false,
      shieldTimer: 0,
      shieldUsesLeft: stats.trashLidUses,

      // Teleporter
      teleportUsesLeft: stats.teleporterUses,

      // Newspapers
      newspaperCooldown: 0,
      newspaperAmmo: newspaperItem?.params.uses ?? 5,
      newspaperMaxAmmo: newspaperItem?.params.uses ?? 5,
      newspaperRegenTimer: 0,

      // Water balloon
      waterBalloonCooldown: 0,
      waterBalloonAmmo: waterBalloonItem?.params.uses ?? 3,
      waterBalloonMaxAmmo: waterBalloonItem?.params.uses ?? 3,
      waterBalloonRegenTimer: 0,

      // Nails
      nailCooldown: 0,
      nailAmmo: nailItem?.params.uses ?? 3,
      nailMaxAmmo: nailItem?.params.uses ?? 3,
      nailRegenTimer: 0,

      // Dog
      dogCooldown: 0,
      dogActive: false,

      // Debuffs
      handlingDebuff: 1.0,
      handlingDebuffTimer: 0,
      speedDebuff: 1.0,
      speedDebuffTimer: 0,

      input: { ...DEFAULT_INPUT },
    };

    this.bikes.set(player.id, bike);
  }

  removePlayer(playerId: string) {
    this.bikes.delete(playerId);
    // Remove their projectiles and dogs
    this.projectiles = this.projectiles.filter(p => p.ownerId !== playerId);
    this.dogs = this.dogs.filter(d => d.ownerId !== playerId);
  }

  handleInput(playerId: string, input: PlayerInput) {
    const bike = this.bikes.get(playerId);
    if (!bike) return;
    // Accumulate one-shot flags so rapid input packets don't overwrite
    // a true flag before the physics tick reads it
    const mopToggle = bike.input.mopToggle || input.mopToggle;
    const shieldInput = bike.input.shieldInput || input.shieldInput;
    const dropInput = bike.input.dropInput || input.dropInput;
    const dogInput = bike.input.dogInput || input.dogInput;
    const teleportInput = bike.input.teleportInput || input.teleportInput;
    const throwInput = bike.input.throwInput || input.throwInput;
    const throwItemId = input.throwItemId || bike.input.throwItemId;
    bike.input = input;
    bike.input.mopToggle = mopToggle;
    bike.input.shieldInput = shieldInput;
    bike.input.dropInput = dropInput;
    bike.input.dogInput = dogInput;
    bike.input.teleportInput = teleportInput;
    bike.input.throwInput = throwInput;
    bike.input.throwItemId = throwItemId;
  }

  // Send state once (for countdown phase, before game loop starts)
  broadcastOnce() {
    this.broadcastState();
  }

  // ── Start / stop ──

  start() {
    this.lastTick = Date.now();
    let broadcastCounter = 0;
    this.interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      this.updateBotAI(dt);
      this.updatePhysics(dt);
      this.checkWinCondition();

      broadcastCounter++;
      if (broadcastCounter >= 3) {
        broadcastCounter = 0;
        this.broadcastState();
      }
    }, 1000 / 60);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PHYSICS TICK
  // ══════════════════════════════════════════════════════════════

  private updatePhysics(dt: number) {
    const dtMs = dt * 1000;

    // ── Per-bike updates ──
    for (const bike of this.bikes.values()) {
      if (bike.isDead) continue;

      // Debuff timers
      if (bike.handlingDebuffTimer > 0) {
        bike.handlingDebuffTimer -= dtMs;
        if (bike.handlingDebuffTimer <= 0) {
          bike.handlingDebuff = 1.0;
          bike.handlingDebuffTimer = 0;
        }
      }
      if (bike.speedDebuffTimer > 0) {
        bike.speedDebuffTimer -= dtMs;
        if (bike.speedDebuffTimer <= 0) {
          bike.speedDebuff = 1.0;
          bike.speedDebuffTimer = 0;
        }
      }

      // Crash recovery
      if (bike.isCrashed) {
        bike.crashTimer -= dtMs;
        if (bike.crashTimer <= 0) {
          bike.isCrashed = false;
          bike.crashTimer = 0;
        }
        continue; // crashed bikes can't act
      }

      // Shield timer
      if (bike.shieldActive) {
        bike.shieldTimer -= dtMs;
        if (bike.shieldTimer <= 0) {
          bike.shieldActive = false;
          bike.shieldTimer = 0;
        }
      }

      // Battery drain (drains while motor is active and moving)
      if (bike.batteryActive && bike.speed > 0) {
        bike.batteryRemaining -= dtMs * bike.stats.batteryDrain;
        if (bike.batteryRemaining <= 0) {
          bike.batteryRemaining = 0;
          bike.batteryActive = false;
          bike.batteryDeadTimer = BATTERY_DEAD_PERIOD; // 10 seconds before regen starts
        }
      }
      // Battery regeneration: after dead period, auto-regen (even while moving)
      if (!bike.batteryActive) {
        if (bike.batteryDeadTimer > 0) {
          // Waiting for dead period to expire
          bike.batteryDeadTimer -= dtMs;
        } else {
          // Regen automatically (BATTERY_REGEN_RATE = 0.167/s, so ~3s to reach 50%)
          bike.batteryRemaining += bike.stats.batteryDuration * BATTERY_REGEN_RATE * dt;
          if (bike.batteryRemaining >= bike.stats.batteryDuration) {
            bike.batteryRemaining = bike.stats.batteryDuration;
          }
          // Motor kicks back in at 50% battery
          const pct = bike.batteryRemaining / bike.stats.batteryDuration;
          if (pct >= 0.5) {
            bike.batteryActive = true;
          }
        }
      }

      // ── Process inputs ──
      const inp = bike.input;

      // Nitro (boost)
      if ((inp.nitroInput || inp.boostInput) && !bike.isNitroing && bike.nitroCooldownTimer <= 0 && bike.speed > 0) {
        bike.isNitroing = true;
        bike.nitroTimer = bike.stats.nitroDuration;
      }

      // Nitro timer
      if (bike.isNitroing) {
        bike.nitroTimer -= dtMs;
        if (bike.nitroTimer <= 0) {
          bike.isNitroing = false;
          bike.nitroCooldownTimer = bike.stats.nitroCooldown;
        }
      } else if (bike.nitroCooldownTimer > 0) {
        bike.nitroCooldownTimer -= dtMs;
      }

      // Mop toggle
      if (inp.mopToggle && bike.stats.hasMop) {
        bike.mopExtended = !bike.mopExtended;
        // Only toggle once per press - clear the flag
        bike.input = { ...bike.input, mopToggle: false };
      }

      // Shield toggle
      if (inp.shieldInput && bike.stats.hasTrashLid && !bike.shieldActive && bike.shieldUsesLeft > 0) {
        bike.shieldActive = true;
        bike.shieldTimer = bike.stats.trashLidDuration;
        bike.shieldUsesLeft--;
        bike.input = { ...bike.input, shieldInput: false };
      }

      // Teleporter
      if (inp.teleportInput && bike.stats.hasTeleporter && bike.teleportUsesLeft > 0) {
        bike.x += Math.sin(bike.heading) * bike.stats.teleporterDistance;
        bike.y -= Math.cos(bike.heading) * bike.stats.teleporterDistance;
        bike.teleportUsesLeft--;
        bike.input = { ...bike.input, teleportInput: false };
      }

      // ── Throw projectile (client specifies which via throwItemId) ──
      if (inp.throwInput) {
        const wantNewspaper = inp.throwItemId === "newspapers" || !inp.throwItemId;
        const wantBalloon = inp.throwItemId === "waterballoon";

        if (wantNewspaper && bike.stats.hasNewspapers && bike.newspaperCooldown <= 0 && bike.newspaperAmmo > 0) {
          this.fireProjectile(bike, "newspaper");
          bike.newspaperAmmo--;
          const np = EQUIP_ITEMS.find(i => i.id === "newspapers")!;
          bike.newspaperCooldown = np.params.cooldown ?? 800;
          if (bike.newspaperAmmo <= 0) {
            bike.newspaperRegenTimer = np.params.regenTime ?? 10000;
          }
        } else if (wantBalloon && bike.stats.hasWaterBalloon && bike.waterBalloonCooldown <= 0 && bike.waterBalloonAmmo > 0) {
          this.fireProjectile(bike, "waterballoon");
          bike.waterBalloonAmmo--;
          const wb = EQUIP_ITEMS.find(i => i.id === "waterballoon")!;
          bike.waterBalloonCooldown = wb.params.cooldown ?? 3000;
          if (bike.waterBalloonAmmo <= 0) {
            bike.waterBalloonRegenTimer = wb.params.regenTime ?? 15000;
          }
        }
      }

      // Drop nails
      if (inp.dropInput && bike.stats.hasNails && bike.nailCooldown <= 0 && bike.nailAmmo > 0) {
        this.dropNails(bike);
        bike.nailAmmo--;
        const nl = EQUIP_ITEMS.find(i => i.id === "nails")!;
        bike.nailCooldown = nl.params.cooldown ?? 6000;
        if (bike.nailAmmo <= 0) {
          bike.nailRegenTimer = nl.params.regenTime ?? 20000;
        }
        bike.input = { ...bike.input, dropInput: false };
      }

      // Release dog
      if (inp.dogInput && bike.stats.hasDog && !bike.dogActive && bike.dogCooldown <= 0) {
        this.releaseDog(bike);
        bike.dogActive = true;
        bike.input = { ...bike.input, dogInput: false };
      }

      // ── Weapon cooldown timers ──
      if (bike.newspaperCooldown > 0) bike.newspaperCooldown -= dtMs;
      if (bike.waterBalloonCooldown > 0) bike.waterBalloonCooldown -= dtMs;
      if (bike.nailCooldown > 0) bike.nailCooldown -= dtMs;
      if (bike.dogCooldown > 0) bike.dogCooldown -= dtMs;

      // Ammo regen
      if (bike.newspaperAmmo <= 0 && bike.newspaperRegenTimer > 0) {
        bike.newspaperRegenTimer -= dtMs;
        if (bike.newspaperRegenTimer <= 0) {
          bike.newspaperAmmo = bike.newspaperMaxAmmo;
          bike.newspaperRegenTimer = 0;
        }
      }
      if (bike.waterBalloonAmmo <= 0 && bike.waterBalloonRegenTimer > 0) {
        bike.waterBalloonRegenTimer -= dtMs;
        if (bike.waterBalloonRegenTimer <= 0) {
          bike.waterBalloonAmmo = bike.waterBalloonMaxAmmo;
          bike.waterBalloonRegenTimer = 0;
        }
      }
      if (bike.nailAmmo <= 0 && bike.nailRegenTimer > 0) {
        bike.nailRegenTimer -= dtMs;
        if (bike.nailRegenTimer <= 0) {
          bike.nailAmmo = bike.nailMaxAmmo;
          bike.nailRegenTimer = 0;
        }
      }

      // ── Movement physics ──
      const effectiveMaxSpeed = bike.isNitroing
        ? bike.stats.nitroSpeed
        : (bike.batteryActive ? bike.stats.maxSpeed : bike.stats.pedalSpeed) * bike.speedDebuff;

      const accel = bike.isNitroing ? 800 : bike.stats.acceleration;

      if (inp.throttleInput > 0) {
        bike.speed += accel * dt;
      } else if (inp.throttleInput < 0) {
        bike.speed -= bike.stats.brakeForce * dt;
      } else {
        if (bike.speed > 0) bike.speed = Math.max(0, bike.speed - bike.stats.friction * dt);
        else if (bike.speed < 0) bike.speed = Math.min(0, bike.speed + bike.stats.friction * dt);
      }

      bike.speed = Math.max(-bike.stats.maxSpeed * 0.3, Math.min(effectiveMaxSpeed, bike.speed));

      // Turn
      if (Math.abs(bike.speed) > 10) {
        const turnMultiplier = Math.min(1, Math.abs(bike.speed) / (bike.stats.maxSpeed * 0.5));
        const effectiveTurn = bike.stats.turnSpeed * bike.stats.turnMultiplier * bike.handlingDebuff;
        bike.heading += inp.turnInput * effectiveTurn * turnMultiplier * dt;
      }

      // Move
      bike.x += Math.sin(bike.heading) * bike.speed * dt;
      bike.y -= Math.cos(bike.heading) * bike.speed * dt;

      // Wall collisions (crash + damage above speed threshold, minor damage below)
      const minX = WALL_THICKNESS + BIKE_RADIUS;
      const maxX = ARENA_WIDTH - WALL_THICKNESS - BIKE_RADIUS;
      const minY = WALL_THICKNESS + BIKE_RADIUS;
      const maxY = ARENA_HEIGHT - WALL_THICKNESS - BIKE_RADIUS;

      let hitWall = false;
      if (bike.x < minX) { bike.x = minX; hitWall = true; }
      if (bike.x > maxX) { bike.x = maxX; hitWall = true; }
      if (bike.y < minY) { bike.y = minY; hitWall = true; }
      if (bike.y > maxY) { bike.y = maxY; hitWall = true; }
      if (hitWall) {
        const impactSpeed = Math.abs(bike.speed);
        if (impactSpeed > WALL_CRASH_SPEED) {
          this.crashBike(bike, CRASH_DAMAGE);
        } else if (impactSpeed > 30) {
          // Minor wall bump: take some damage but don't crash
          this.damageBike(bike, Math.round(impactSpeed / 20));
          bike.speed *= -0.3;
        } else {
          bike.speed *= -0.3;
        }
      }

      // Obstacle collisions (crash + damage above speed threshold, minor damage below)
      for (const obs of OBSTACLES) {
        const halfW = obs.w / 2 + BIKE_RADIUS;
        const halfH = obs.h / 2 + BIKE_RADIUS;
        if (bike.x > obs.x - halfW && bike.x < obs.x + halfW &&
            bike.y > obs.y - halfH && bike.y < obs.y + halfH) {
          const oL = bike.x - (obs.x - halfW);
          const oR = (obs.x + halfW) - bike.x;
          const oT = bike.y - (obs.y - halfH);
          const oB = (obs.y + halfH) - bike.y;
          const min = Math.min(oL, oR, oT, oB);
          if (min === oL) bike.x = obs.x - halfW;
          else if (min === oR) bike.x = obs.x + halfW;
          else if (min === oT) bike.y = obs.y - halfH;
          else bike.y = obs.y + halfH;

          const impactSpeed = Math.abs(bike.speed);
          if (impactSpeed > WALL_CRASH_SPEED) {
            this.crashBike(bike, CRASH_DAMAGE);
          } else if (impactSpeed > 30) {
            this.damageBike(bike, Math.round(impactSpeed / 20));
            bike.speed *= -0.3;
          } else {
            bike.speed *= -0.3;
          }
        }
      }

      // Check hazards underfoot
      for (let hi = this.hazards.length - 1; hi >= 0; hi--) {
        const hazard = this.hazards[hi];
        const dx = bike.x - hazard.x;
        const dy = bike.y - hazard.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hazard.radius + BIKE_RADIUS) {
          // Owner is immune for a brief period after dropping
          if (hazard.ownerId === bike.id && hazard.immuneUntilMs && hazard.remainingMs > hazard.immuneUntilMs) {
            continue;
          }

          if (hazard.type === "slick") {
            if (bike.handlingDebuffTimer <= 0) {
              bike.handlingDebuff = 0.4;
              bike.handlingDebuffTimer = 500;
              bike.speedDebuff = 0.7;
              bike.speedDebuffTimer = 500;
            }
          } else if (hazard.type === "nails") {
            if (bike.stats.nailVulnerability === "instant") {
              this.crashBike(bike, 25);
            } else if (bike.stats.nailVulnerability === "resistant") {
              bike.speedDebuff = 0.8;
              bike.speedDebuffTimer = 1000;
            } else {
              this.crashBike(bike, 15);
            }
            // Push bike out of nail zone so they don't re-crash on recovery
            if (dist > 0.001) {
              const pushDist = hazard.radius + BIKE_RADIUS - dist + 5;
              bike.x += (dx / dist) * pushDist;
              bike.y += (dy / dist) * pushDist;
            }
            // Nails are consumed after one hit
            this.hazards.splice(hi, 1);
            break; // don't check more hazards this frame for this bike
          }
        }
      }
    }

    // ── Bike-to-bike collisions ──
    const bikeArray = Array.from(this.bikes.values()).filter(b => !b.isDead);
    const collisionDist = BIKE_RADIUS * 2;

    for (let i = 0; i < bikeArray.length; i++) {
      for (let j = i + 1; j < bikeArray.length; j++) {
        const a = bikeArray[i];
        const b = bikeArray[j];
        if (a.isCrashed || b.isCrashed) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < collisionDist && dist > 0.001) {
          // Push apart
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = collisionDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Mop jousting: if one has mop extended and collision is roughly in front of them
          const aMopHit = a.mopExtended && this.isFrontCollision(a, b);
          const bMopHit = b.mopExtended && this.isFrontCollision(b, a);

          if (aMopHit && !bMopHit) {
            // A jousts B: only B crashes
            this.crashBike(b, a.stats.mopDamage + CRASH_DAMAGE);
          } else if (bMopHit && !aMopHit) {
            // B jousts A: only A crashes
            this.crashBike(a, b.stats.mopDamage + CRASH_DAMAGE);
          } else {
            // Normal mutual crash
            this.crashBike(a, CRASH_DAMAGE);
            this.crashBike(b, CRASH_DAMAGE);
          }
        }
      }
    }

    // ── Update projectiles ──
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const moveDist = proj.speed * dt;
      proj.x += Math.sin(proj.heading) * moveDist;
      proj.y -= Math.cos(proj.heading) * moveDist;
      proj.traveled += moveDist;

      // Remove if out of range or off-screen
      if (proj.traveled >= proj.range ||
          proj.x < 0 || proj.x > ARENA_WIDTH ||
          proj.y < 0 || proj.y > ARENA_HEIGHT) {
        // Water balloon: create slick zone where it lands even if it misses
        if (proj.type === "waterballoon" && proj.mapEffect) {
          this.hazards.push({
            id: uid(),
            type: proj.mapEffect.type,
            x: proj.x,
            y: proj.y,
            radius: proj.mapEffect.radius,
            remainingMs: proj.mapEffect.duration,
          });
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check hit on bikes
      let hit = false;
      for (const bike of this.bikes.values()) {
        if (bike.isDead || bike.isCrashed || bike.id === proj.ownerId) continue;
        const pdx = bike.x - proj.x;
        const pdy = bike.y - proj.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < BIKE_RADIUS + 8) {
          // Accuracy check
          if (Math.random() * 100 < proj.accuracy) {
            // Shield blocks projectiles
            if (bike.shieldActive) {
              // Blocked by shield, no damage
            } else {
              this.damageBike(bike, proj.damage);
              // Apply debuffs
              if (proj.handlingPenalty < 1.0) {
                // Helmet overrides handling penalty for newspapers
                const penalty = (bike.stats.hasHelmet && proj.type === "newspaper")
                  ? bike.stats.helmetHandlingOverride
                  : proj.handlingPenalty;
                bike.handlingDebuff = penalty;
                bike.handlingDebuffTimer = proj.duration;
              }
              if (proj.speedDebuff < 1.0) {
                bike.speedDebuff = proj.speedDebuff;
                bike.speedDebuffTimer = proj.duration;
              }
            }
          }
          // Water balloon: always leaves a zone on hit
          if (proj.type === "waterballoon" && proj.mapEffect) {
            this.hazards.push({
              id: uid(),
              type: proj.mapEffect.type,
              x: proj.x,
              y: proj.y,
              radius: proj.mapEffect.radius,
              remainingMs: proj.mapEffect.duration,
            });
          }
          hit = true;
          break;
        }
      }
      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }

    // ── Update hazards ──
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      this.hazards[i].remainingMs -= dtMs;
      if (this.hazards[i].remainingMs <= 0) {
        this.hazards.splice(i, 1);
      }
    }

    // ── Update dogs ──
    for (let i = this.dogs.length - 1; i >= 0; i--) {
      const dog = this.dogs[i];
      dog.remainingMs -= dtMs;

      if (dog.remainingMs <= 0) {
        // Dog disappears
        const owner = this.bikes.get(dog.ownerId);
        if (owner) {
          owner.dogActive = false;
          const dogItem = EQUIP_ITEMS.find(it => it.id === "dog");
          owner.dogCooldown = dogItem?.params.cooldown ?? 20000;
        }
        this.dogs.splice(i, 1);
        continue;
      }

      // Delay before chasing
      if (dog.delayMs > 0) {
        dog.delayMs -= dtMs;
        continue;
      }

      // Find nearest alive bike (including owner!)
      let nearest: ServerBike | null = null;
      let nearestDist = Infinity;
      for (const bike of this.bikes.values()) {
        if (bike.isDead || bike.isCrashed) continue;
        const ddx = bike.x - dog.x;
        const ddy = bike.y - dog.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = bike;
        }
      }

      if (nearest) {
        // Chase
        const ddx = nearest.x - dog.x;
        const ddy = nearest.y - dog.y;
        const dAngle = Math.atan2(ddx, -ddy);
        dog.heading = dAngle;

        const newX = dog.x + Math.sin(dog.heading) * dog.speed * dt;
        const newY = dog.y - Math.cos(dog.heading) * dog.speed * dt;

        // Wall collisions for dog
        const dogR = 8;
        const dMinX = WALL_THICKNESS + dogR;
        const dMaxX = ARENA_WIDTH - WALL_THICKNESS - dogR;
        const dMinY = WALL_THICKNESS + dogR;
        const dMaxY = ARENA_HEIGHT - WALL_THICKNESS - dogR;
        dog.x = Math.max(dMinX, Math.min(dMaxX, newX));
        dog.y = Math.max(dMinY, Math.min(dMaxY, newY));

        // Obstacle collisions for dog
        for (const obs of OBSTACLES) {
          const halfW = obs.w / 2 + dogR;
          const halfH = obs.h / 2 + dogR;
          if (dog.x > obs.x - halfW && dog.x < obs.x + halfW &&
              dog.y > obs.y - halfH && dog.y < obs.y + halfH) {
            const oL = dog.x - (obs.x - halfW);
            const oR = (obs.x + halfW) - dog.x;
            const oT = dog.y - (obs.y - halfH);
            const oB = (obs.y + halfH) - dog.y;
            const min = Math.min(oL, oR, oT, oB);
            if (min === oL) dog.x = obs.x - halfW;
            else if (min === oR) dog.x = obs.x + halfW;
            else if (min === oT) dog.y = obs.y - halfH;
            else dog.y = obs.y + halfH;
          }
        }

        // Catch check
        if (nearestDist < BIKE_RADIUS + 10) {
          // Dog catches someone - crash + damage
          if (!nearest.shieldActive) {
            this.crashBike(nearest, dog.damage);
          }
          // Dog disappears after catching
          const owner = this.bikes.get(dog.ownerId);
          if (owner) {
            owner.dogActive = false;
            const dogItem = EQUIP_ITEMS.find(it => it.id === "dog");
            owner.dogCooldown = dogItem?.params.cooldown ?? 20000;
          }
          this.dogs.splice(i, 1);
        }
      }
    }
  }

  // ── Helpers ──

  private isFrontCollision(attacker: ServerBike, victim: ServerBike): boolean {
    // Check if the victim is roughly in front of the attacker (within 60 degrees)
    const dx = victim.x - attacker.x;
    const dy = victim.y - attacker.y;
    const angleToVictim = Math.atan2(dx, -dy);
    let angleDiff = angleToVictim - attacker.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    return Math.abs(angleDiff) < Math.PI / 3; // 60 degree cone
  }

  private crashBike(bike: ServerBike, damage: number) {
    bike.isCrashed = true;
    bike.crashTimer = bike.stats.crashStun;
    bike.speed = 0;
    bike.isNitroing = false;
    bike.nitroTimer = 0;
    this.damageBike(bike, damage);
  }

  private damageBike(bike: ServerBike, rawDamage: number) {
    const actual = Math.max(0, rawDamage - bike.stats.damageReduction);
    bike.health -= actual;
    if (bike.health <= 0) {
      bike.health = 0;
      bike.isDead = true;
      bike.speed = 0;
    }
  }

  private fireProjectile(bike: ServerBike, type: "newspaper" | "waterballoon") {
    const item = EQUIP_ITEMS.find(i => i.id === (type === "newspaper" ? "newspapers" : "waterballoon"));
    if (!item) return;
    const p = item.params;

    const proj: ServerProjectile = {
      id: uid(),
      type,
      x: bike.x + Math.sin(bike.heading) * 20,
      y: bike.y - Math.cos(bike.heading) * 20,
      heading: bike.heading,
      speed: p.velocity ?? 300,
      ownerId: bike.id,
      range: p.range ?? 200,
      traveled: 0,
      damage: p.damage ?? 5,
      accuracy: p.accuracy ?? 70,
      duration: p.duration ?? 2000,
      handlingPenalty: p.handlingPenalty ?? 1.0,
      speedDebuff: p.speedDebuff ?? 1.0,
      mapEffect: p.mapEffect ? { ...p.mapEffect } : undefined,
    };

    this.projectiles.push(proj);
  }

  private dropNails(bike: ServerBike) {
    const item = EQUIP_ITEMS.find(i => i.id === "nails");
    if (!item || !item.params.mapEffect) return;
    const me = item.params.mapEffect;

    // Drop well behind the bike (60px) so dropper doesn't hit their own nails
    this.hazards.push({
      id: uid(),
      type: me.type,
      x: bike.x - Math.sin(bike.heading) * 60,
      y: bike.y + Math.cos(bike.heading) * 60,
      radius: me.radius,
      remainingMs: me.duration,
      ownerId: bike.id,
      immuneUntilMs: me.duration - 1500, // owner immune for 1.5 seconds
    });
  }

  private releaseDog(bike: ServerBike) {
    const item = EQUIP_ITEMS.find(i => i.id === "dog");
    if (!item) return;
    const p = item.params;

    this.dogs.push({
      id: uid(),
      ownerId: bike.id,
      x: bike.x - Math.sin(bike.heading) * 30,
      y: bike.y + Math.cos(bike.heading) * 30,
      heading: bike.heading,
      speed: p.dogSpeed ?? 220,
      damage: p.damage ?? 20,
      remainingMs: p.dogDuration ?? 12000,
      delayMs: p.dogDelay ?? 1000,
    });
  }

  // ── Broadcast state to clients ──

  private broadcastState() {
    const players: GamePlayerState[] = [];
    for (const bike of this.bikes.values()) {
      players.push({
        id: bike.id,
        name: bike.name,
        colorIndex: bike.colorIndex,
        x: bike.x,
        y: bike.y,
        heading: bike.heading,
        speed: bike.speed,
        health: bike.health,
        maxHealth: bike.maxHealth,
        isBoosting: bike.isNitroing,
        isCrashed: bike.isCrashed,
        isDead: bike.isDead,
        mopExtended: bike.mopExtended,
        batteryActive: bike.batteryActive,
        batteryPercent: Math.round((bike.batteryRemaining / bike.stats.batteryDuration) * 100),
        shieldActive: bike.shieldActive,
      });
    }

    const projectiles: GameProjectile[] = this.projectiles.map(p => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: p.y,
      heading: p.heading,
      ownerId: p.ownerId,
    }));

    const hazards: GameMapHazard[] = this.hazards.map(h => ({
      id: h.id,
      type: h.type,
      x: h.x,
      y: h.y,
      radius: h.radius,
    }));

    const dogs: GameDog[] = this.dogs.map(d => ({
      id: d.id,
      x: d.x,
      y: d.y,
      heading: d.heading,
      ownerId: d.ownerId,
    }));

    this.onStateUpdate({
      players,
      projectiles,
      hazards,
      dogs,
      timestamp: Date.now(),
    });
  }

  // ── Win condition ──

  private checkWinCondition() {
    if (this.gameEnded) return;
    const allBikes = Array.from(this.bikes.values());
    if (allBikes.length < 2) return; // need at least 2 players for a game

    const alive = allBikes.filter(b => !b.isDead);
    if (alive.length <= 1) {
      this.gameEnded = true;
      const winner = alive[0];
      if (this.onGameOver) {
        this.onGameOver(
          winner ? winner.id : "",
          winner ? winner.name : "Nobody",
        );
      }
    }
  }

  // ── Bot AI ──

  private updateBotAI(_dt: number) {
    for (const bike of this.bikes.values()) {
      if (!bike.isBot || bike.isDead || bike.isCrashed) continue;

      // Find nearest alive enemy
      let nearestEnemy: ServerBike | null = null;
      let nearestDist = Infinity;
      for (const other of this.bikes.values()) {
        if (other.id === bike.id || other.isDead) continue;
        const dx = other.x - bike.x;
        const dy = other.y - bike.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = other;
        }
      }

      // Default inputs
      bike.input.throttleInput = 1;
      bike.input.turnInput = 0;
      bike.input.boostInput = false;
      bike.input.nitroInput = false;
      bike.input.mopToggle = false;
      bike.input.throwInput = false;
      bike.input.dropInput = false;
      bike.input.dogInput = false;
      bike.input.teleportInput = false;
      bike.input.shieldInput = false;

      // ── Wall and obstacle avoidance (highest priority) ──
      // Cast a ray ahead to detect upcoming collisions
      const lookAhead = 100; // pixels ahead to check
      const futureX = bike.x + Math.sin(bike.heading) * lookAhead;
      const futureY = bike.y - Math.cos(bike.heading) * lookAhead;
      let wallDanger = false;
      let wallTurnDir = 0; // which way to turn to avoid

      // Check walls ahead
      const wallMargin = 60;
      const nearLeft = bike.x < WALL_THICKNESS + wallMargin;
      const nearRight = bike.x > ARENA_WIDTH - WALL_THICKNESS - wallMargin;
      const nearTop = bike.y < WALL_THICKNESS + wallMargin;
      const nearBottom = bike.y > ARENA_HEIGHT - WALL_THICKNESS - wallMargin;

      // If heading toward a wall we're near, strong avoidance
      const headingSin = Math.sin(bike.heading); // positive = moving right
      const headingCos = Math.cos(bike.heading); // positive = moving up (y decreases)

      if (nearLeft && headingSin < -0.2) { wallDanger = true; wallTurnDir = 1; }
      else if (nearRight && headingSin > 0.2) { wallDanger = true; wallTurnDir = -1; }
      if (nearTop && headingCos > 0.2) { wallDanger = true; wallTurnDir += 1; }
      else if (nearBottom && headingCos < -0.2) { wallDanger = true; wallTurnDir -= 1; }

      // Check if future position is out of bounds
      if (futureX < WALL_THICKNESS + 30 || futureX > ARENA_WIDTH - WALL_THICKNESS - 30 ||
          futureY < WALL_THICKNESS + 30 || futureY > ARENA_HEIGHT - WALL_THICKNESS - 30) {
        wallDanger = true;
        if (wallTurnDir === 0) wallTurnDir = (Math.random() > 0.5) ? 1 : -1;
      }

      // Check obstacles ahead
      let obstacleDanger = false;
      for (const obs of OBSTACLES) {
        const halfW = obs.w / 2 + BIKE_RADIUS + 20;
        const halfH = obs.h / 2 + BIKE_RADIUS + 20;
        // Check if future position hits obstacle
        if (futureX > obs.x - halfW && futureX < obs.x + halfW &&
            futureY > obs.y - halfH && futureY < obs.y + halfH) {
          obstacleDanger = true;
          // Turn away from obstacle center
          const obsDx = bike.x - obs.x;
          const obsDy = bike.y - obs.y;
          const obsAngle = Math.atan2(obsDx, -obsDy);
          let obsDiff = obsAngle - bike.heading;
          while (obsDiff > Math.PI) obsDiff -= Math.PI * 2;
          while (obsDiff < -Math.PI) obsDiff += Math.PI * 2;
          wallTurnDir = obsDiff > 0 ? 1 : -1;
          break;
        }
        // Also check current close proximity (stuck against obstacle)
        const closeW = obs.w / 2 + BIKE_RADIUS + 5;
        const closeH = obs.h / 2 + BIKE_RADIUS + 5;
        if (bike.x > obs.x - closeW && bike.x < obs.x + closeW &&
            bike.y > obs.y - closeH && bike.y < obs.y + closeH) {
          obstacleDanger = true;
          const obsDx = bike.x - obs.x;
          const obsDy = bike.y - obs.y;
          const obsAngle = Math.atan2(obsDx, -obsDy);
          let obsDiff = obsAngle - bike.heading;
          while (obsDiff > Math.PI) obsDiff -= Math.PI * 2;
          while (obsDiff < -Math.PI) obsDiff += Math.PI * 2;
          wallTurnDir = obsDiff > 0 ? 1 : -1;
          break;
        }
      }

      // If stuck (speed very low but throttle is on), back up and turn
      const isStuck = Math.abs(bike.speed) < 15 && bike.input.throttleInput > 0;
      if (isStuck) {
        bike.input.throttleInput = -1; // reverse
        bike.input.turnInput = (Math.random() > 0.5) ? 1 : -1; // turn while backing up
        // Skip enemy pursuit when stuck
        continue;
      }

      // Apply wall/obstacle avoidance
      if (wallDanger || obstacleDanger) {
        bike.input.turnInput = Math.max(-1, Math.min(1, wallTurnDir));
        // Slow down when near obstacles
        if (obstacleDanger) {
          bike.input.throttleInput = 0.5;
        }
      } else if (nearestEnemy) {
        // ��─ Chase enemy (only if not avoiding walls) ──
        const dx = nearestEnemy.x - bike.x;
        const dy = nearestEnemy.y - bike.y;
        const angleToEnemy = Math.atan2(dx, -dy);
        let angleDiff = angleToEnemy - bike.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (angleDiff > 0.1) bike.input.turnInput = 1;
        else if (angleDiff < -0.1) bike.input.turnInput = -1;
        else bike.input.turnInput = 0;

        // Use nitro when facing enemy and somewhat close
        if (nearestDist < 400 && Math.abs(angleDiff) < 0.5) {
          bike.input.nitroInput = true;
        }

        // ── Weapon usage ──
        if (nearestDist < 250) {
          if (bike.stats.hasMop && !bike.mopExtended && Math.abs(angleDiff) < 0.4) {
            bike.input.mopToggle = true;
          }
          if (bike.stats.hasNewspapers && bike.newspaperAmmo > 0 && Math.abs(angleDiff) < 0.3) {
            bike.input.throwInput = true;
            bike.input.throwItemId = "newspapers";
          } else if (bike.stats.hasWaterBalloon && bike.waterBalloonAmmo > 0 && Math.abs(angleDiff) < 0.4) {
            bike.input.throwInput = true;
            bike.input.throwItemId = "waterballoon";
          }
        } else if (nearestDist > 300) {
          if (bike.mopExtended) bike.input.mopToggle = true;
        }

        // Drop nails when enemy is chasing us (behind)
        if (bike.stats.hasNails && bike.nailAmmo > 0) {
          if (Math.abs(angleDiff) > 2.5 && nearestDist < 200) {
            bike.input.dropInput = true;
          }
        }

        // Release dog when enemy is in range
        if (bike.stats.hasDog && !bike.dogActive && bike.dogCooldown <= 0 && nearestDist < 350) {
          bike.input.dogInput = true;
        }

        // Teleport when low health and enemy is very close
        if (bike.stats.hasTeleporter && bike.teleportUsesLeft > 0 && bike.health < 30 && nearestDist < 100) {
          bike.input.teleportInput = true;
        }

        // Shield when threatened and low HP
        if (bike.stats.hasTrashLid && bike.shieldUsesLeft > 0 && !bike.shieldActive && bike.health < 40 && nearestDist < 150) {
          bike.input.shieldInput = true;
        }
      }

      // Small randomness for unpredictability
      if (Math.random() < 0.03) {
        bike.input.turnInput += (Math.random() - 0.5) * 0.3;
        bike.input.turnInput = Math.max(-1, Math.min(1, bike.input.turnInput));
      }
    }
  }
}
