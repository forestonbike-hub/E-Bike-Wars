import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import { RoomManager } from "./rooms/RoomManager.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
  },
});

const roomManager = new RoomManager();

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
    io.to(roomCode).emit("gameStarting");
    broadcastRoomUpdate(roomCode);
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
  const result = roomManager.removePlayer(socket.id);
  if (result) {
    socket.leave(result.roomCode);
    broadcastRoomUpdate(result.roomCode);
  }
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`E-Bike Wars server running on http://localhost:${PORT}`);
});
