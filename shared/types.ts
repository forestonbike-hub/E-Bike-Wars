// Shared type definitions used by both client and server

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  state: "lobby" | "playing" | "results";
  maxPlayers: number;
}

// Socket.io event types (client -> server)
export interface ClientToServerEvents {
  ping: () => void;
}

// Socket.io event types (server -> client)
export interface ServerToClientEvents {
  pong: () => void;
  connected: (data: { message: string }) => void;
}
