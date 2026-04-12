import Phaser from "phaser";
import { Bike } from "../objects/Bike";
import { VirtualJoystick } from "../ui/VirtualJoystick";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const OBSTACLE_COLOR = 0x556677;

export class GameScene extends Phaser.Scene {
  private bike!: Bike;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private joystick: VirtualJoystick | null = null;
  private boostButton: Phaser.GameObjects.Container | null = null;
  private isMobile: boolean = false;

  // HUD elements
  private boostBar!: Phaser.GameObjects.Graphics;
  private speedText!: Phaser.GameObjects.Text;
  private boostReadyText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.isMobile = !this.sys.game.device.os.desktop;

    // Set world bounds to arena size
    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Draw arena
    this.createArena();
    this.createObstacles();

    // Create player bike at center
    this.bike = new Bike(this, {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      color: 0x4488ff,
      name: "Player",
    });

    // Set up keyboard input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Set up mobile controls
    if (this.isMobile) {
      this.createMobileControls();
    }

    // Camera follows player
    this.cameras.main.startFollow(this.bike, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.2);
    this.cameras.main.setBounds(
      -WALL_THICKNESS * 2,
      -WALL_THICKNESS * 2,
      ARENA_WIDTH + WALL_THICKNESS * 4,
      ARENA_HEIGHT + WALL_THICKNESS * 4
    );

    // Create HUD (fixed to camera)
    this.createHUD();

    // Add obstacle collisions
    const obstacles = this.physics.world.staticBodies;
    this.physics.add.collider(this.bike, Array.from(obstacles.entries).map(e => e.gameObject));
  }

  private createArena() {
    // Floor
    const floor = this.add.graphics();
    floor.fillStyle(0x2a2a3e, 1);
    floor.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Grid lines for visual reference
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x3a3a4e, 0.3);
    for (let x = 0; x <= ARENA_WIDTH; x += 80) {
      grid.moveTo(x, 0);
      grid.lineTo(x, ARENA_HEIGHT);
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += 80) {
      grid.moveTo(0, y);
      grid.lineTo(ARENA_WIDTH, y);
    }
    grid.strokePath();

    // Walls
    this.createWall(0, 0, ARENA_WIDTH, WALL_THICKNESS); // top
    this.createWall(0, ARENA_HEIGHT - WALL_THICKNESS, ARENA_WIDTH, WALL_THICKNESS); // bottom
    this.createWall(0, 0, WALL_THICKNESS, ARENA_HEIGHT); // left
    this.createWall(ARENA_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, ARENA_HEIGHT); // right
  }

  private createWall(x: number, y: number, w: number, h: number) {
    const wall = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x445566);
    this.physics.add.existing(wall, true); // static body
  }

  private createObstacles() {
    // Scattered obstacles for tactical play
    const obstacleLayouts = [
      // Center cluster
      { x: 800, y: 600, w: 80, h: 80 },
      // Corners
      { x: 300, y: 250, w: 60, h: 120 },
      { x: 1300, y: 250, w: 60, h: 120 },
      { x: 300, y: 900, w: 60, h: 120 },
      { x: 1300, y: 900, w: 60, h: 120 },
      // Side barriers
      { x: 600, y: 400, w: 120, h: 30 },
      { x: 1000, y: 400, w: 120, h: 30 },
      { x: 600, y: 800, w: 120, h: 30 },
      { x: 1000, y: 800, w: 120, h: 30 },
      // Extra cover
      { x: 500, y: 600, w: 30, h: 80 },
      { x: 1100, y: 600, w: 30, h: 80 },
    ];

    for (const obs of obstacleLayouts) {
      const rect = this.add.rectangle(obs.x, obs.y, obs.w, obs.h, OBSTACLE_COLOR);
      rect.setStrokeStyle(2, 0x667788);
      this.physics.add.existing(rect, true);
    }
  }

  private createMobileControls() {
    this.joystick = new VirtualJoystick(this, 120, this.scale.height - 120, 50);

    // Boost button (right side)
    const btnX = this.scale.width - 80;
    const btnY = this.scale.height - 100;

    const boostBtnContainer = this.add.container(btnX, btnY);
    boostBtnContainer.setScrollFactor(0);
    boostBtnContainer.setDepth(100);

    const btnBg = this.add.circle(0, 0, 35, 0xff8800, 0.7);
    btnBg.setStrokeStyle(3, 0xffcc00);
    const btnText = this.add.text(0, 0, "BOOST", {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5);

    boostBtnContainer.add([btnBg, btnText]);

    btnBg.setInteractive();
    btnBg.on("pointerdown", () => {
      this.bike.boostInput = true;
    });
    btnBg.on("pointerup", () => {
      this.bike.boostInput = false;
    });
    btnBg.on("pointerout", () => {
      this.bike.boostInput = false;
    });

    this.boostButton = boostBtnContainer;
  }

  private createHUD() {
    const hudX = 20;
    const hudY = 20;

    // Boost bar background
    this.boostBar = this.add.graphics();
    this.boostBar.setScrollFactor(0);
    this.boostBar.setDepth(100);

    // Speed text
    this.speedText = this.add.text(hudX, hudY, "", {
      fontSize: "14px",
      color: "#aabbcc",
      fontFamily: "Arial, sans-serif",
    }).setScrollFactor(0).setDepth(100);

    // Boost ready text
    this.boostReadyText = this.add.text(hudX, hudY + 40, "", {
      fontSize: "14px",
      color: "#ff8800",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(100);

    // Controls hint (bottom center, fades after a few seconds)
    const controlsHint = this.isMobile
      ? "Joystick to steer  |  BOOST button for speed burst"
      : "WASD / Arrows to drive  |  SPACE to boost";

    const hint = this.add.text(
      this.scale.width / 2,
      this.scale.height - 30,
      controlsHint,
      {
        fontSize: "13px",
        color: "#888899",
        fontFamily: "Arial, sans-serif",
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 5000,
      duration: 1000,
    });
  }

  private updateHUD() {
    const boostPercent = this.bike.getBoostCooldownPercent();
    const speedPercent = this.bike.getSpeedPercent();

    // Speed text
    const speedLabel = speedPercent < 0.1 ? "Stopped" : speedPercent < 0.4 ? "Cruising" : speedPercent < 0.7 ? "Fast" : "Full Speed";
    this.speedText.setText(`Speed: ${speedLabel}`);

    // Boost bar
    this.boostBar.clear();
    const barX = 20;
    const barY = 38;
    const barW = 120;
    const barH = 8;

    // Background
    this.boostBar.fillStyle(0x333344, 0.8);
    this.boostBar.fillRoundedRect(barX, barY, barW, barH, 4);

    // Fill
    if (boostPercent >= 1) {
      this.boostBar.fillStyle(0xff8800, 1);
    } else {
      this.boostBar.fillStyle(0x886644, 0.6);
    }
    this.boostBar.fillRoundedRect(barX, barY, barW * boostPercent, barH, 4);

    // Boost ready text
    if (this.bike.getIsBoosting()) {
      this.boostReadyText.setText("BOOSTING!");
      this.boostReadyText.setColor("#ffcc00");
    } else if (boostPercent >= 1) {
      this.boostReadyText.setText(this.isMobile ? "Boost ready!" : "Boost ready! [SPACE]");
      this.boostReadyText.setColor("#ff8800");
    } else {
      this.boostReadyText.setText("Boost recharging...");
      this.boostReadyText.setColor("#666677");
    }
  }

  update(time: number, delta: number) {
    // Read keyboard input
    if (!this.isMobile && this.cursors) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      this.bike.turnInput = (left ? -1 : 0) + (right ? 1 : 0);
      this.bike.throttleInput = (up ? 1 : 0) + (down ? -1 : 0);
      this.bike.boostInput = this.spaceKey.isDown;
    }

    // Read joystick input
    if (this.isMobile && this.joystick) {
      const joy = this.joystick.getInput();
      this.bike.turnInput = joy.x;
      this.bike.throttleInput = joy.y > 0.2 ? 1 : joy.y < -0.2 ? -1 : 0;
      // Boost handled by button pointerdown
    }

    this.bike.update(time, delta);
    this.updateHUD();
  }
}
