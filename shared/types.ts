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
export interface ItemParams {
  speed?: number;       // Top speed increase (added to base bike speed)
  travel?: number;      // Teleport/blink distance in pixels
  damage?: number;      // Damage dealt on successful hit (base HP is 100)
  mapEffect?: {         // Does this item leave something on the ground?
    radius: number;     //   Size of the zone in pixels
    duration: number;   //   How long it stays on the map (ms)
  };
  accuracy?: number;    // Hit chance, 0-100 (100 = always hits)
  velocity?: number;    // Projectile speed (pixels per second)
  duration?: number;    // How long the effect lasts (ms) - stun, blind, slow, etc.
  range?: number;       // How far the item can reach (px) - swing range, throw distance
  cooldown?: number;    // Time between uses (ms)
  uses?: number;        // Limited charges per round (undefined = unlimited)
  turnBoost?: number;   // Turning speed multiplier (1.0 = normal, 1.5 = 50% better)
  stunReduction?: number; // Reduces crash stun time by this many ms
  damageReduction?: number; // Damage absorbed (flat number subtracted from incoming hits)
  rearBlock?: number;   // Chance to block attacks from behind, 0-100
  boostDuration?: number; // Extra boost time added (ms)
}

export interface EquipItem {
  id: string;
  category: EquipCategory;
  name: string;
  description: string;
  price: number;
  icon: string; // emoji for now, sprites later
  params: ItemParams;
}

export const STARTING_BUDGET = 1000;

// ──────────────────────────────────────────────────────────
// ITEM DATABASE - Edit values here to tune game balance
// All parameters are placeholder values until playtested
// ──────────────────────────────────────────────────────────

export const EQUIP_ITEMS: EquipItem[] = [
  // ── Bike upgrades ──
  {
    id: "motor-1", category: "bike", name: "Motor",
    description: "Increases top speed",
    price: 150, icon: "⚡",
    params: { speed: 50 },
  },
  {
    id: "battery-1", category: "bike", name: "Battery",
    description: "Longer boost duration",
    price: 120, icon: "🔋",
    params: { boostDuration: 200 },
  },
  {
    id: "tires-1", category: "bike", name: "Tires",
    description: "Better grip and turning",
    price: 100, icon: "🛞",
    params: { turnBoost: 1.4 },
  },
  {
    id: "nitro-1", category: "bike", name: "Nitro",
    description: "Massive speed burst on demand",
    price: 250, icon: "🔥",
    params: { speed: 200, duration: 1500, cooldown: 12000, uses: 3 },
  },
  {
    id: "teleporter-1", category: "bike", name: "Teleporter",
    description: "Short-range blink to dodge attacks",
    price: 300, icon: "✨",
    params: { travel: 150, cooldown: 8000, uses: 5 },
  },

  // ── Armor ──
  {
    id: "helmet-1", category: "armor", name: "Helmet",
    description: "Reduces crash stun time",
    price: 80, icon: "⛑️",
    params: { stunReduction: 400 },
  },
  {
    id: "bodyarmor-1", category: "armor", name: "Body Armor",
    description: "Absorbs damage from hits",
    price: 200, icon: "🦺",
    params: { damageReduction: 15 },
  },
  {
    id: "trashlid-1", category: "armor", name: "Trash Can Lid",
    description: "Blocks attacks from behind",
    price: 120, icon: "🛡️",
    params: { rearBlock: 70 },
  },

  // ── Weapons ──
  {
    id: "mop-1", category: "weapons", name: "Mop",
    description: "Swing to knock nearby riders",
    price: 100, icon: "🧹",
    params: { damage: 15, range: 60, accuracy: 85, cooldown: 2000 },
  },
  {
    id: "newspapers-1", category: "weapons", name: "Newspapers",
    description: "Throw to temporarily blind opponents",
    price: 80, icon: "📰",
    params: { damage: 5, range: 200, velocity: 300, accuracy: 70, duration: 1500, cooldown: 3000 },
  },
  {
    id: "waterballoon-1", category: "weapons", name: "Water Balloon",
    description: "Lob to make area slippery",
    price: 120, icon: "🎈",
    params: {
      damage: 0, range: 250, velocity: 200, accuracy: 65, cooldown: 4000, uses: 3,
      mapEffect: { radius: 60, duration: 8000 },
    },
  },
  {
    id: "nails-1", category: "weapons", name: "Nails",
    description: "Drop behind you to pop tires",
    price: 150, icon: "📌",
    params: {
      damage: 10, accuracy: 100, cooldown: 5000, uses: 4,
      mapEffect: { radius: 30, duration: 15000 },
    },
  },
  {
    id: "dog-1", category: "weapons", name: "Dog",
    description: "Chases nearest opponent and trips them",
    price: 250, icon: "🐕",
    params: { damage: 20, speed: 180, range: 400, accuracy: 75, cooldown: 10000, uses: 2 },
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
  isBoosting: boolean;
  isCrashed: boolean;
}

export interface GameState {
  players: GamePlayerState[];
  timestamp: number;
}

// Input sent from client to server every frame
export interface PlayerInput {
  turnInput: number;    // -1 to 1
  throttleInput: number; // -1 to 1
  boostInput: boolean;
  seq: number; // sequence number for reconciliation
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
