import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerLoadout,
} from "../../shared/types.js";
import { EQUIP_ITEMS, STARTING_BUDGET } from "../../shared/types.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { GameLoop } from "./game/GameLoop.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
  },
});

const roomManager = new RoomManager();
const activeGames: Map<string, GameLoop> = new Map();

// Track equip phase state per room
interface EquipState {
  loadouts: Map<string, { itemIds: Set<string>; isReady: boolean }>;
}
const equipStates: Map<string, EquipState> = new Map();

// Helper: broadcast room state to all players in a room
function broadcastRoomUpdate(roomCode: string) {
  const roomInfo = roomManager.getRoomInfo(roomCode);
  if (roomInfo) {
    io.to(roomCode).emit("roomUpdated", roomInfo);
  }
}

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new room
  socket.on("createRoom", (data, callback) => {
    const result = roomManager.createRoom(socket.id, data.playerName);
    if (result.success && result.roomCode) {
      socket.join(result.roomCode);
      callback({ success: true, roomCode: result.roomCode });
      broadcastRoomUpdate(result.roomCode);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Join an existing room
  socket.on("joinRoom", (data, callback) => {
    const result = roomManager.joinRoom(socket.id, data.playerName, data.roomCode);
    if (result.success) {
      const roomCode = data.roomCode.toUpperCase();
      socket.join(roomCode);
      callback({ success: true });
      broadcastRoomUpdate(roomCode);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Get current room info (called when LobbyScene loads)
  socket.on("getRoomInfo", (callback) => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (roomCode) {
      callback(roomManager.getRoomInfo(roomCode));
    } else {
      callback(null);
    }
  });

  // Change bike color
  socket.on("changeColor", (colorIndex) => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (roomCode && roomManager.changeColor(socket.id, colorIndex)) {
      broadcastRoomUpdate(roomCode);
    }
  });

  // Toggle ready status
  socket.on("toggleReady", () => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (roomCode && roomManager.toggleReady(socket.id)) {
      broadcastRoomUpdate(roomCode);
    }
  });

  // Host starts the game -> enters equip phase
  socket.on("startGame", () => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (!roomCode) return;

    const roomInfo = roomManager.getRoomInfo(roomCode);
    if (!roomInfo || roomInfo.hostId !== socket.id) return;

    const check = roomManager.canStartGame(roomCode);
    if (!check.canStart) {
      socket.emit("error", check.reason || "Cannot start game");
      return;
    }

    roomManager.startEquipPhase(roomCode);

    // Initialize equip state for all players in the room
    const equipState: EquipState = {
      loadouts: new Map(),
    };
    for (const player of roomInfo.players) {
      equipState.loadouts.set(player.id, { itemIds: new Set(), isReady: false });
    }
    equipStates.set(roomCode, equipState);

    io.to(roomCode).emit("equipPhaseStarting");
    broadcastRoomUpdate(roomCode);
  });

  // Equip phase: toggle an item
  socket.on("toggleItem", (itemId) => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (!roomCode) return;

    const equipState = equipStates.get(roomCode);
    if (!equipState) return;

    const playerLoadout = equipState.loadouts.get(socket.id);
    if (!playerLoadout || playerLoadout.isReady) return;

    const item = EQUIP_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    if (playerLoadout.itemIds.has(itemId)) {
      // Deselect
      playerLoadout.itemIds.delete(itemId);
    } else {
      // Check budget
      let spent = 0;
      for (const id of playerLoadout.itemIds) {
        const it = EQUIP_ITEMS.find((i) => i.id === id);
        if (it) spent += it.price;
      }
      if (spent + item.price > STARTING_BUDGET) {
        socket.emit("error", "Not enough budget");
        return;
      }
      playerLoadout.itemIds.add(itemId);
    }

    // Broadcast this player's updated loadout to the room
    let spent = 0;
    for (const id of playerLoadout.itemIds) {
      const it = EQUIP_ITEMS.find((i) => i.id === id);
      if (it) spent += it.price;
    }

    io.to(roomCode).emit("equipUpdate", {
      playerId: socket.id,
      loadout: {
        itemIds: Array.from(playerLoadout.itemIds),
        budgetRemaining: STARTING_BUDGET - spent,
      },
      isReady: playerLoadout.isReady,
    });
  });

  // Equip phase: toggle ready
  socket.on("equipReady", () => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (!roomCode) return;

    const equipState = equipStates.get(roomCode);
    if (!equipState) return;

    const playerLoadout = equipState.loadouts.get(socket.id);
    if (!playerLoadout) return;

    playerLoadout.isReady = !playerLoadout.isReady;

    // Broadcast update
    let spent = 0;
    for (const id of playerLoadout.itemIds) {
      const it = EQUIP_ITEMS.find((i) => i.id === id);
      if (it) spent += it.price;
    }

    io.to(roomCode).emit("equipUpdate", {
      playerId: socket.id,
      loadout: {
        itemIds: Array.from(playerLoadout.itemIds),
        budgetRemaining: STARTING_BUDGET - spent,
      },
      isReady: playerLoadout.isReady,
    });

    // Check if all players are ready -> start battle
    let allReady = true;
    for (const loadout of equipState.loadouts.values()) {
      if (!loadout.isReady) {
        allReady = false;
        break;
      }
    }

    if (allReady) {
      const roomInfo = roomManager.getRoomInfo(roomCode);
      if (!roomInfo) return;

      roomManager.startBattle(roomCode);

      // Create and start the game loop with loadouts
      const gameLoop = new GameLoop((state) => {
        io.to(roomCode).emit("gameState", state);
      });

      for (const player of roomInfo.players) {
        const playerEquip = equipState.loadouts.get(player.id);
        const itemIds = playerEquip ? Array.from(playerEquip.itemIds) : [];
        gameLoop.addPlayer(player, itemIds);
      }

      activeGames.set(roomCode, gameLoop);
      gameLoop.start();

      // Clean up equip state
      equipStates.delete(roomCode);

      io.to(roomCode).emit("battleStarting");
      broadcastRoomUpdate(roomCode);
    }
  });

  // Player input during gameplay
  socket.on("playerInput", (input) => {
    const roomCode = roomManager.getPlayerRoom(socket.id);
    if (!roomCode) return;

    const gameLoop = activeGames.get(roomCode);
    if (gameLoop) {
      gameLoop.handleInput(socket.id, input);
    }
  });

  // Leave room
  socket.on("leaveRoom", () => {
    handlePlayerLeave(socket);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    handlePlayerLeave(socket);
  });
});

function handlePlayerLeave(socket: any) {
  const roomCode = roomManager.getPlayerRoom(socket.id);

  // Remove from active game if playing
  if (roomCode) {
    const gameLoop = activeGames.get(roomCode);
    if (gameLoop) {
      gameLoop.removePlayer(socket.id);
    }

    // Remove from equip state if in equip phase
    const equipState = equipStates.get(roomCode);
    if (equipState) {
      equipState.loadouts.delete(socket.id);
    }
  }

  const result = roomManager.removePlayer(socket.id);
  if (result) {
    socket.leave(result.roomCode);

    // If room was deleted (empty), clean up everything
    if (!roomManager.getRoomInfo(result.roomCode)) {
      const gameLoop = activeGames.get(result.roomCode);
      if (gameLoop) {
        gameLoop.stop();
        activeGames.delete(result.roomCode);
        console.log(`Game loop stopped for room ${result.roomCode}`);
      }
      equipStates.delete(result.roomCode);
    }

    broadcastRoomUpdate(result.roomCode);
    io.to(result.roomCode).emit("playerLeft", socket.id);
  }
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`E-Bike Wars server running on http://localhost:${PORT}`);
});
