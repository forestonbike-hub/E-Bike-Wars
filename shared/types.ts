// Shared type definitions used by both client and server

// Available bike colors for the color picker
export const BIKE_COLORS = [
  { name: "Blue", hex: "#4488ff", value: 0x4488ff },
  { name: "Red", hex: "#ff4455", value: 0xff4455 },
  { name: "Green", hex: "#44cc66", value: 0x44cc66 },
  { name: "Orange", hex: "#ff8833", value: 0xff8833 },
  { name: "Purple", hex: "#aa55ff", value: 0xaa55ff },
  { name: "Yellow", hex: "#ffcc22", value: 0xffcc22 },
  { name: "Cyan", hex: "#33ddee", value: 0x33ddee },
  { name: "Pink", hex: "#ff66aa", value: 0xff66aa },
] as const;

export interface Player {
  id: string;
  name: string;
  colorIndex: number;
  isHost: boolean;
  isReady: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: Player[];
  state: "lobby" | "equipping" | "playing" | "results";
  maxPlayers: number;
}

// ── Equip Phase: items players can buy before battle ──

export type EquipCategory = "bike" | "armor" | "weapons";

// ── Item parameters (the tunable knobs for game balance) ──
// Not every item uses every parameter. Only set the ones that apply.
// To change game balance, edit these numbers. Both client and server read from here.
export interface ItemParams {
  // Movement
  speed?: number;           // Top speed bonus (px/sec added to base)
  turnBoost?: number;       // Turn speed multiplier (1.0 = normal, 1.4 = 40% sharper)
  turnPenalty?: number;     // Turn speed multiplier penalty (0.8 = 20% slower turning)
  speedPenalty?: number;    // Speed multiplier penalty (0.9 = 10% slower)
  travel?: number;          // Teleport blink distance (px)

  // Battery / energy
  batteryDuration?: number; // How long motor-assist lasts (ms)
  batteryDrain?: number;    // Multiplier on battery drain rate (1.5 = 50% faster drain)
  pedalSpeed?: number;      // Speed when battery is dead (px/sec, replaces base motor speed)

  // Nitro
  nitroCooldown?: number;   // Nitro regen time (ms). Lower = faster regen
  nitroSpeed?: number;      // Speed during nitro burst (px/sec)
  nitroDuration?: number;   // How long nitro burst lasts (ms)

  // Combat
  damage?: number;          // Damage dealt on successful hit (base HP = 100)
  accuracy?: number;        // Hit chance 0-100 (100 = always hits)
  velocity?: number;        // Projectile speed (px/sec)
  range?: number;           // Reach distance (px)
  cooldown?: number;        // Time between uses (ms)
  uses?: number;            // Charges per round (undefined = unlimited or regens)
  regenTime?: number;       // Time to regenerate one charge (ms)

  // Effects
  duration?: number;        // How long an effect lasts (ms) - stun, slow, handling penalty
  handlingPenalty?: number;  // Reduces target's turn ability (multiplier, 0.3 = 70% worse)
  speedDebuff?: number;     // Reduces target's speed (multiplier, 0.5 = half speed)
  mapEffect?: {             // Leaves a zone on the ground
    radius: number;         //   Zone size (px)
    duration: number;       //   How long zone persists (ms)
    type: "slick" | "nails";//   What the zone does
  };

  // Defense
  stunReduction?: number;   // Reduces crash stun time (ms subtracted)
  damageReduction?: number; // Flat damage absorbed from each hit
  shieldDuration?: number;  // Active shield window (ms) when button pressed
  shieldUses?: number;      // How many times shield can be activated

  // Tire interaction
  nailVulnerability?: "instant" | "resistant" | "normal"; // How tires react to nails

  // Dog-specific
  dogSpeed?: number;        // How fast the dog moves (px/sec)
  dogDuration?: number;     // How long the dog stays on the field (ms)
  dogDelay?: number;        // Delay before dog starts chasing (ms)

  // Mop-specific
  jousting?: boolean;       // Stays extended, causes crash on front impact without self-crash
}

export interface EquipItem {
  id: string;
  category: EquipCategory;
  name: string;
  description: string;
  price: number;
  icon: string;
  params: ItemParams;
  // Item relationships
  exclusiveGroup?: string;  // Items in the same group are mutually exclusive (pick one)
  requires?: string;        // Must own this item ID first (for upgrade chains)
  upgradeLabel?: string;    // Shown as "UPGRADE" or "LV2" badge in the shop
}

export const STARTING_BUDGET = 1000;

// ──────────────────────────────────────────────────────────────
// BASE BIKE STATS - Every player starts with these for free.
// Upgrades modify these values. Edit here to tune baseline feel.
// ──────────────────────────────────────────────────────────────
export const BASE_BIKE = {
  maxSpeed: 250,            // Top speed with motor assist (px/sec)
  pedalSpeed: 120,          // Speed when battery is dead (px/sec)
  turnSpeed: 3.5,           // Base turn rate (rad/sec)
  acceleration: 300,        // How fast bike reaches top speed
  brakeForce: 400,          // How fast bike stops
  friction: 100,            // Passive slowdown when not pedaling
  batteryDuration: 45000,   // Motor-assist lasts 45 seconds
  nitroCooldown: 8000,      // Nitro regens every 8 seconds
  nitroSpeed: 450,          // Speed during nitro burst
  nitroDuration: 300,       // Nitro burst lasts 0.3 seconds
  crashStun: 1000,          // Crash stun duration (ms)
  health: 100,              // Starting HP
};

// ──────────────────────────────────────────────────────────────
// ITEM DATABASE
// Edit values here to tune game balance.
// All parameters are first-draft values, expect to tweak.
// ──────────────────────────────────────────────────────────────

export const EQUIP_ITEMS: EquipItem[] = [

  // ═══════════════════════════════════════
  //  BIKE UPGRADES (standard comes free)
  // ═══════════════════════════════════════

  {
    id: "motor-upgrade",
    category: "bike",
    name: "Motor Upgrade",
    description: "Faster pedaling when battery dies. Drains battery 30% faster.",
    price: 150, icon: "⚡",
    upgradeLabel: "UPGRADE",
    params: {
      pedalSpeed: 180,        // Up from base 120 when battery is dead
      batteryDrain: 1.3,      // Battery drains 30% faster with upgraded motor
    },
  },
  {
    id: "battery-upgrade",
    category: "bike",
    name: "Battery Upgrade",
    description: "Motor-assist lasts longer before you have to pedal.",
    price: 120, icon: "🔋",
    upgradeLabel: "UPGRADE",
    params: {
      batteryDuration: 70000, // Up from base 45 seconds
    },
  },
  {
    id: "tires-skinny",
    category: "bike",
    name: "Skinny Tires",
    description: "Faster speed and sharper turns. Pop instantly on nails.",
    price: 100, icon: "🏎️",
    exclusiveGroup: "tires",
    params: {
      speed: 30,              // +30 px/sec top speed
      turnBoost: 1.3,         // 30% sharper turning
      nailVulnerability: "instant",
    },
  },
  {
    id: "tires-tough",
    category: "bike",
    name: "Tough Tires",
    description: "Slower and wider turns, but survives nails for a while.",
    price: 100, icon: "🛞",
    exclusiveGroup: "tires",
    params: {
      speedPenalty: 0.9,      // 10% slower top speed
      turnPenalty: 0.85,      // 15% wider turns
      nailVulnerability: "resistant",
    },
  },
  {
    id: "nitro-upgrade",
    category: "bike",
    name: "Nitro Upgrade",
    description: "Nitro regenerates faster between uses.",
    price: 100, icon: "🔥",
    upgradeLabel: "UPGRADE",
    params: {
      nitroCooldown: 5000,    // Down from base 8 seconds
    },
  },
  {
    id: "teleporter",
    category: "bike",
    name: "Teleporter",
    description: "Blink forward through bikes and walls. 3 uses per round.",
    price: 300, icon: "✨",
    params: {
      travel: 150,            // Blink distance in px
      uses: 3,                // Does not regenerate
    },
  },

  // ═══════════════════════════════════════
  //  ARMOR (nobody starts with any)
  // ═══════════════════════════════════════

  {
    id: "helmet",
    category: "armor",
    name: "Helmet",
    description: "Reduces steering disruption from newspaper hits.",
    price: 80, icon: "⛑️",
    params: {
      handlingPenalty: 0.7,   // Newspapers only reduce handling by 30% instead of 70%
    },
  },
  {
    id: "bodyarmor-1",
    category: "armor",
    name: "Body Armor Lv1",
    description: "Reduces damage from items and crashes.",
    price: 150, icon: "🦺",
    params: {
      damageReduction: 10,    // Absorbs 10 damage from each hit
    },
  },
  {
    id: "bodyarmor-2",
    category: "armor",
    name: "Body Armor Lv2",
    description: "Even more protection. Requires Lv1.",
    price: 200, icon: "🦺",
    upgradeLabel: "LV2",
    requires: "bodyarmor-1",
    params: {
      damageReduction: 25,    // Replaces Lv1 value: absorbs 25 damage per hit
    },
  },
  {
    id: "trashlid",
    category: "armor",
    name: "Trash Can Lid",
    description: "Press to block damage for 2 sec. 3 uses. Won't stop nails or dog.",
    price: 120, icon: "🛡️",
    params: {
      shieldDuration: 2000,   // 2 seconds of protection per use
      shieldUses: 3,          // 3 activations per round
    },
  },

  // ═══════════════════════════════════════
  //  WEAPONS (nobody starts with any)
  // ═══════════════════════════════════════

  {
    id: "mop",
    category: "weapons",
    name: "Mop",
    description: "Jousting stick. Toggle to extend. Front hits crash them, not you.",
    price: 100, icon: "🧹",
    params: {
      jousting: true,         // Stays out when toggled on
      damage: 15,             // Damage dealt on hit
      range: 50,              // How far mop extends in front of bike
      // Only works on front collisions. Rear attacks still hurt you.
    },
  },
  {
    id: "newspapers",
    category: "weapons",
    name: "Newspapers",
    description: "Throw spinning papers. Disrupts steering on hit. Can cause crash.",
    price: 80, icon: "📰",
    params: {
      damage: 8,              // Small damage on hit
      accuracy: 70,           // 70% chance to actually land (can show "MISSED!")
      velocity: 350,          // Fast projectile
      range: 250,             // How far it can fly
      cooldown: 800,          // Time between throws
      uses: 5,                // 5 per reload
      regenTime: 10000,       // 10 sec to get 5 more newspapers
      duration: 2000,         // Handling disruption lasts 2 sec
      handlingPenalty: 0.3,   // Victim's turning drops to 30% effectiveness
    },
  },
  {
    id: "waterballoon",
    category: "weapons",
    name: "Water Balloon",
    description: "Slows bike and hurts handling on hit. Leaves slick zone on ground.",
    price: 120, icon: "🎈",
    params: {
      damage: 5,              // Minor splash damage
      accuracy: 80,           // Easier to land than newspapers (bigger splash)
      velocity: 200,          // Slower projectile (lob arc)
      range: 200,             // Shorter throw range
      cooldown: 3000,         // 3 sec between throws
      uses: 3,                // 3 per reload
      regenTime: 15000,       // 15 sec to get 3 more
      duration: 3000,         // Speed/handling debuff lasts 3 sec on direct hit
      speedDebuff: 0.5,       // Victim's speed drops to 50%
      handlingPenalty: 0.5,   // Victim's turning drops to 50%
      mapEffect: {
        radius: 50,           // Slick zone size
        duration: 10000,      // Slick zone lasts 10 sec
        type: "slick",
      },
    },
  },
  {
    id: "nails",
    category: "weapons",
    name: "Nails",
    description: "Drop behind you. Pops standard/skinny tires. Tough tires resist.",
    price: 150, icon: "📌",
    params: {
      cooldown: 6000,         // 6 sec between drops
      uses: 3,                // 3 drops per reload
      regenTime: 20000,       // 20 sec to get 3 more
      mapEffect: {
        radius: 40,           // Nail patch size
        duration: 30000,      // Nails stay on ground 30 sec
        type: "nails",
      },
    },
  },
  {
    id: "dog",
    category: "weapons",
    name: "Dog",
    description: "Release behind you. Chases nearest bike (even you!). Causes crash.",
    price: 250, icon: "🐕",
    params: {
      dogSpeed: 220,          // Faster than base bike, slower than nitro
      dogDuration: 12000,     // Dog stays on field for 12 sec
      dogDelay: 1000,         // Waits 1 sec before chasing
      cooldown: 20000,        // 20 sec to regen after dog disappears
      damage: 20,             // Damage when dog catches someone
      // Dog chases nearest bike, switches target by proximity
      // Disappears after catching someone OR after dogDuration expires
    },
  },
];

// A player's purchases during equip phase
export interface PlayerLoadout {
  itemIds: string[];
  budgetRemaining: number;
}

// Game state sent from server to all clients every tick
export interface GamePlayerState {
  id: string;
  name: string;
  colorIndex: number;
  x: number;
  y: number;
  heading: number; // radians
  speed: number;
  health: number;
  maxHealth: number;
  isBoosting: boolean;
  isCrashed: boolean;
  isDead: boolean;
  mopExtended: boolean;
  batteryActive: boolean; // true = motor assist, false = pedaling
  shieldActive: boolean;  // trash can lid currently blocking
}

// Projectiles and map hazards visible to clients
export interface GameProjectile {
  id: string;
  type: "newspaper" | "waterballoon";
  x: number;
  y: number;
  heading: number;
  ownerId: string;
}

export interface GameMapHazard {
  id: string;
  type: "slick" | "nails";
  x: number;
  y: number;
  radius: number;
}

export interface GameDog {
  id: string;
  x: number;
  y: number;
  heading: number;
  ownerId: string;
}

export interface GameState {
  players: GamePlayerState[];
  projectiles: GameProjectile[];
  hazards: GameMapHazard[];
  dogs: GameDog[];
  timestamp: number;
}

// Input sent from client to server every frame
export interface PlayerInput {
  turnInput: number;    // -1 to 1
  throttleInput: number; // -1 to 1
  boostInput: boolean;
  nitroInput: boolean;    // nitro burst
  mopToggle: boolean;     // toggle mop on/off
  throwInput: boolean;    // fire newspapers / water balloon
  throwItemId?: string;   // "newspapers" or "waterballoon" (which to throw)
  dropInput: boolean;     // drop nails
  dogInput: boolean;      // release dog
  teleportInput: boolean; // use teleporter
  shieldInput: boolean;   // activate trash can lid
  seq: number;
}

// Socket.io event types (client -> server)
export interface ClientToServerEvents {
  createRoom: (data: { playerName: string }, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  joinRoom: (data: { roomCode: string; playerName: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  getRoomInfo: (callback: (room: RoomInfo | null) => void) => void;
  changeColor: (colorIndex: number) => void;
  toggleReady: () => void;
  startGame: () => void;
  leaveRoom: () => void;
  playerInput: (input: PlayerInput) => void;
  // Equip phase
  toggleItem: (itemId: string) => void;
  equipReady: () => void;
}

// Socket.io event types (server -> client)
export interface ServerToClientEvents {
  roomUpdated: (room: RoomInfo) => void;
  gameStarting: (data: { players: Player[] }) => void;
  gameState: (state: GameState) => void;
  playerLeft: (playerId: string) => void;
  error: (message: string) => void;
  // Equip phase
  equipPhaseStarting: () => void;
  equipUpdate: (data: { playerId: string; loadout: PlayerLoadout; isReady: boolean }) => void;
  battleStarting: () => void;
}
