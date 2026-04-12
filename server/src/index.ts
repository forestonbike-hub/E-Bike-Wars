import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
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

  // Host starts the game
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

    roomManager.startGame(roomCode);

    // Create and start the game loop for this room
    const gameLoop = new GameLoop((state) => {
      io.to(roomCode).emit("gameState", state);
    });

    // Add all players to the game
    for (const player of roomInfo.players) {
      gameLoop.addPlayer(player);
    }

    activeGames.set(roomCode, gameLoop);
    gameLoop.start();

    io.to(roomCode).emit("gameStarting", { players: roomInfo.players });
    broadcastRoomUpdate(roomCode);
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
  }

  const result = roomManager.removePlayer(socket.id);
  if (result) {
    socket.leave(result.roomCode);

    // If room was deleted (empty), stop the game loop
    if (!roomManager.getRoomInfo(result.roomCode)) {
      const gameLoop = activeGames.get(result.roomCode);
      if (gameLoop) {
        gameLoop.stop();
        activeGames.delete(result.roomCode);
        console.log(`Game loop stopped for room ${result.roomCode}`);
      }
    }

    broadcastRoomUpdate(result.roomCode);
    io.to(result.roomCode).emit("playerLeft", socket.id);
  }
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`E-Bike Wars server running on http://localhost:${PORT}`);
});
