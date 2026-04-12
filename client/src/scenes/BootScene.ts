import Phaser from "phaser";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@shared/types";

export class BootScene extends Phaser.Scene {
  private socket!: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    // Draw a colored rectangle as proof-of-life
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0f3460, 1);
    graphics.fillRoundedRect(200, 150, 400, 300, 16);

    // Title text
    this.add
      .text(400, 250, "E-BIKE WARS", {
        fontSize: "48px",
        color: "#e94560",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Status text (will update when connected)
    const statusText = this.add
      .text(400, 320, "Connecting to server...", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5);

    // Connect to Socket.io server
    this.socket = io();

    this.socket.on("connected", (data) => {
      console.log("Connected to server:", data.message);
      statusText.setText("Connected! Ready to play.");
      statusText.setColor("#16c79a");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      statusText.setText("Disconnected from server.");
      statusText.setColor("#e94560");
    });
  }
}
