import Phaser from "phaser";
import { HomeScene } from "./scenes/HomeScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { EquipScene } from "./scenes/EquipScene";
import { GameScene } from "./scenes/GameScene";

// Hide loading text
const loading = document.getElementById("loading");
if (loading) loading.style.display = "none";

// Check URL for room code (e.g., /game/BIKE-7X3Q)
const pathMatch = window.location.pathname.match(/^\/game\/([A-Z0-9-]+)$/i);
const roomCodeFromURL = pathMatch ? pathMatch[1].toUpperCase() : null;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: "100%",
    height: "100%",
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [HomeScene, LobbyScene, EquipScene, GameScene],
};

const game = new Phaser.Game(config);

// If URL has a room code, pass it to the HomeScene so it pre-fills the join field
if (roomCodeFromURL) {
  game.scene.start("HomeScene", { roomCode: roomCodeFromURL });
}
