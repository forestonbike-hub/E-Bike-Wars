import type { Player, RoomInfo } from "../../../shared/types.js";

interface ServerRoom {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  state: "lobby" | "equipping" | "playing" | "results";
  maxPlayers: number;
  createdAt: number;
}

// Generate a room code like "BIKE-7X3Q"
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BIKE-${code}`;
}

export class RoomManager {
  private rooms: Map<string, ServerRoom> = new Map();
  // Track which room each socket is in
  private playerRooms: Map<string, string> = new Map();

  createRoom(hostId: string, hostName: string): { success: boolean; roomCode?: string; error?: string } {
    // Check if player is already in a room
    if (this.playerRooms.has(hostId)) {
      return { success: false, error: "You are already in a room" };
    }

    // Generate unique code
    let code = generateRoomCode();
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 10) {
      code = generateRoomCode();
      attempts++;
    }
    if (this.rooms.has(code)) {
      return { success: false, error: "Could not generate a unique room code" };
    }

    const host: Player = {
      id: hostId,
      name: hostName,
      colorIndex: 0,
      isHost: true,
      isReady: false,
    };

    const room: ServerRoom = {
      code,
      hostId,
      players: new Map([[hostId, host]]),
      state: "lobby",
      maxPlayers: 8,
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.playerRooms.set(hostId, code);

    console.log(`Room ${code} created by ${hostName} (${hostId})`);
    return { success: true, roomCode: code };
  }

  joinRoom(playerId: string, playerName: string, roomCode: string): { success: boolean; error?: string } {
    // Check if player is already in a room
    if (this.playerRooms.has(playerId)) {
      return { success: false, error: "You are already in a room" };
    }

    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.state !== "lobby") {
      return { success: false, error: "Game already in progress" };
    }

    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: "Room is full" };
    }

    // Check if name is already taken in this room
    for (const p of room.players.values()) {
      if (p.name.toLowerCase() === playerName.toLowerCase()) {
        return { success: false, error: "That name is already taken in this room" };
      }
    }

    // Assign a color not already in use
    const usedColors = new Set(Array.from(room.players.values()).map(p => p.colorIndex));
    let colorIndex = 0;
    for (let i = 0; i < 8; i++) {
      if (!usedColors.has(i)) {
        colorIndex = i;
        break;
      }
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      colorIndex,
      isHost: false,
      isReady: false,
    };

    room.players.set(playerId, player);
    this.playerRooms.set(playerId, roomCode.toUpperCase());

    console.log(`${playerName} (${playerId}) joined room ${roomCode}`);
    return { success: true };
  }

  changeColor(playerId: string, colorIndex: number): boolean {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return false;

    const room = this.rooms.get(roomCode);
    if (!room || room.state !== "lobby") return false;

    // Check if color is available
    for (const [id, p] of room.players) {
      if (id !== playerId && p.colorIndex === colorIndex) {
        return false; // color taken
      }
    }

    const player = room.players.get(playerId);
    if (player) {
      player.colorIndex = colorIndex;
      return true;
    }
    return false;
  }

  toggleReady(playerId: string): boolean {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return false;

    const room = this.rooms.get(roomCode);
    if (!room || room.state !== "lobby") return false;

    const player = room.players.get(playerId);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
      return true;
    }
    return false;
  }

  addBot(roomCode: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== "lobby") return null;
    if (room.players.size >= room.maxPlayers) return null;

    // Count existing bots
    let botCount = 0;
    for (const p of room.players.values()) {
      if (p.isBot) botCount++;
    }
    if (botCount >= 4) return null;

    const botNames = ["Sparky", "Turbo", "Blitz", "Zippy", "Flash", "Bolt"];
    const usedNames = new Set(Array.from(room.players.values()).map(p => p.name));
    let botName = botNames[botCount] || `Bot-${botCount + 1}`;
    if (usedNames.has(botName)) botName = `Bot-${Date.now() % 1000}`;

    const usedColors = new Set(Array.from(room.players.values()).map(p => p.colorIndex));
    let colorIndex = 0;
    for (let i = 0; i < 8; i++) {
      if (!usedColors.has(i)) { colorIndex = i; break; }
    }

    const botId = `bot-${Date.now()}-${botCount}`;
    const bot: Player = {
      id: botId,
      name: botName,
      colorIndex,
      isHost: false,
      isReady: true,
      isBot: true,
    };

    room.players.set(botId, bot);
    this.playerRooms.set(botId, roomCode);
    return bot;
  }

  removeBot(roomCode: string, botId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== "lobby") return false;
    const player = room.players.get(botId);
    if (!player || !player.isBot) return false;
    room.players.delete(botId);
    this.playerRooms.delete(botId);
    return true;
  }

  returnToLobby(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.state = "lobby";
    // Unready all players, bots stay ready
    for (const p of room.players.values()) {
      if (!p.isBot) p.isReady = false;
    }
    return true;
  }

  canStartGame(roomCode: string): { canStart: boolean; reason?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { canStart: false, reason: "Room not found" };
    if (room.state !== "lobby") return { canStart: false, reason: "Game already in progress" };
    if (room.players.size < 2) return { canStart: false, reason: "Need at least 2 players" };

    // Check all non-host, non-bot players are ready
    for (const p of room.players.values()) {
      if (!p.isHost && !p.isBot && !p.isReady) {
        return { canStart: false, reason: "Not all players are ready" };
      }
    }

    return { canStart: true };
  }

  startEquipPhase(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.state = "equipping";
    console.log(`Equip phase started in room ${roomCode}`);
    return true;
  }

  startBattle(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.state = "playing";
    console.log(`Battle started in room ${roomCode}`);
    return true;
  }

  removePlayer(playerId: string): { roomCode: string; room: ServerRoom; newHostId?: string } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const wasHost = room.hostId === playerId;
    room.players.delete(playerId);
    this.playerRooms.delete(playerId);

    console.log(`Player ${playerId} left room ${roomCode}`);

    // If room is empty, delete it
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
      return { roomCode, room };
    }

    // If host left, assign new host
    let newHostId: string | undefined;
    if (wasHost) {
      const firstPlayer = room.players.values().next().value;
      if (firstPlayer) {
        firstPlayer.isHost = true;
        firstPlayer.isReady = false;
        room.hostId = firstPlayer.id;
        newHostId = firstPlayer.id;
        console.log(`New host for room ${roomCode}: ${firstPlayer.name}`);
      }
    }

    return { roomCode, room, newHostId };
  }

  getRoomInfo(roomCode: string): RoomInfo | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.values()),
      state: room.state,
      maxPlayers: room.maxPlayers,
    };
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }
}
