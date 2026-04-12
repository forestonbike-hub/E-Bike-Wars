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
      .text(400, 230, "E-BIKE WARS", {
        fontSize: "48px",
        color: "#e94560",
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Status text
    const statusText = this.add
      .text(400, 300, "Connecting to server...", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5);

    // Play button (starts hidden, shown after connection)
    const playBtn = this.add.container(400, 380);
    playBtn.setAlpha(0);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x16c79a, 1);
    btnBg.fillRoundedRect(-80, -22, 160, 44, 10);

    const btnText = this.add.text(0, 0, "PLAY", {
      fontSize: "24px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5);

    playBtn.add([btnBg, btnText]);

    // Make button interactive
    const hitZone = this.add.zone(0, 0, 160, 44).setInteractive();
    playBtn.add(hitZone);

    hitZone.on("pointerover", () => {
      playBtn.setScale(1.05);
    });
    hitZone.on("pointerout", () => {
      playBtn.setScale(1);
    });
    hitZone.on("pointerdown", () => {
      this.scene.start("GameScene");
    });

    // Connect to Socket.io server
    this.socket = io();

    this.socket.on("connected", (data) => {
      console.log("Connected to server:", data.message);
      statusText.setText("Connected!");
      statusText.setColor("#16c79a");

      // Show play button
      this.tweens.add({
        targets: playBtn,
        alpha: 1,
        y: 370,
        duration: 400,
        ease: "Back.easeOut",
      });
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      statusText.setText("Disconnected from server.");
      statusText.setColor("#e94560");
      playBtn.setAlpha(0);
    });
  }
}
