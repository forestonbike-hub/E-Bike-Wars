import Phaser from "phaser";
import { Bike } from "../objects/Bike";
import { TouchControls, isTouchDevice } from "../ui/TouchControls";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const OBSTACLE_COLOR = 0x556677;

export class GameScene extends Phaser.Scene {
  private bike!: Bike;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private touchControls: TouchControls | null = null;
  private useTouch: boolean = false;
  private walls!: Phaser.Physics.Arcade.StaticGroup;

  // HUD elements
  private boostBar!: Phaser.GameObjects.Graphics;
  private speedText!: Phaser.GameObjects.Text;
  private boostReadyText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.useTouch = isTouchDevice();

    // Create static group for all walls and obstacles
    this.walls = this.physics.add.staticGroup();

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

    // Add collision between bike and walls/obstacles
    this.physics.add.collider(this.bike, this.walls);

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

    // Set up touch controls for tablet/phone
    if (this.useTouch) {
      this.touchControls = new TouchControls(this);
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
    this.addWall(ARENA_WIDTH / 2, WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS); // top
    this.addWall(ARENA_WIDTH / 2, ARENA_HEIGHT - WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS); // bottom
    this.addWall(WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT); // left
    this.addWall(ARENA_WIDTH - WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT); // right
  }

  private addWall(x: number, y: number, w: number, h: number) {
    const wall = this.add.rectangle(x, y, w, h, 0x445566);
    this.walls.add(wall);
  }

  private createObstacles() {
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
      this.walls.add(rect);
    }
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
    const controlsHint = this.useTouch
      ? "Joystick to steer and drive  |  BOOST button for speed burst"
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
      this.boostReadyText.setText(this.useTouch ? "Boost ready!" : "Boost ready! [SPACE]");
      this.boostReadyText.setColor("#ff8800");
    } else {
      this.boostReadyText.setText("Boost recharging...");
      this.boostReadyText.setColor("#666677");
    }
  }

  update(time: number, delta: number) {
    if (this.useTouch && this.touchControls) {
      // Read touch controls (tablet/phone)
      const touch = this.touchControls.getInput();
      this.bike.turnInput = touch.turnInput;
      this.bike.throttleInput = touch.throttleInput;
      this.bike.boostInput = touch.boostInput;
    } else if (this.cursors) {
      // Read keyboard input (desktop)
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      this.bike.turnInput = (left ? -1 : 0) + (right ? 1 : 0);
      this.bike.throttleInput = (up ? 1 : 0) + (down ? -1 : 0);
      this.bike.boostInput = this.spaceKey.isDown;
    }

    this.bike.update(time, delta);
    this.updateHUD();
  }
}
