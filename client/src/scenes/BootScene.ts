import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    // Background panel
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

    // Subtitle
    this.add
      .text(400, 290, "Arena Combat", {
        fontSize: "18px",
        color: "#aaaacc",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5);

    // Play button (always visible, no server connection needed for now)
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x16c79a, 1);
    btnBg.fillRoundedRect(320, 340, 160, 50, 12);

    const btnText = this.add.text(400, 365, "PLAY", {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Clickable zone over the button
    const hitZone = this.add.zone(400, 365, 160, 50).setInteractive({ useHandCursor: true });

    hitZone.on("pointerover", () => {
      btnBg.clear();
      btnBg.fillStyle(0x1dd9a8, 1);
      btnBg.fillRoundedRect(320, 340, 160, 50, 12);
    });
    hitZone.on("pointerout", () => {
      btnBg.clear();
      btnBg.fillStyle(0x16c79a, 1);
      btnBg.fillRoundedRect(320, 340, 160, 50, 12);
    });
    hitZone.on("pointerdown", () => {
      this.scene.start("GameScene");
    });

    // Tap hint for mobile
    this.add
      .text(400, 420, "Tap or click PLAY to start", {
        fontSize: "12px",
        color: "#666688",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5);
  }
}
