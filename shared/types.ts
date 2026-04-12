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
  colorIndex: number; // index into BIKE_COLORS
  isHost: boolean;
  isReady: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: Player[];
  state: "lobby" | "playing" | "results";
  maxPlayers: number;
}

// Socket.io event types (client -> server)
export interface ClientToServerEvents {
  createRoom: (data: { playerName: string }, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  joinRoom: (data: { roomCode: string; playerName: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  changeColor: (colorIndex: number) => void;
  toggleReady: () => void;
  startGame: () => void;
  leaveRoom: () => void;
}

// Socket.io event types (server -> client)
export interface ServerToClientEvents {
  roomUpdated: (room: RoomInfo) => void;
  gameStarting: () => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  error: (message: string) => void;
}
