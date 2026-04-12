import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";
import { TouchControls, isTouchDevice } from "../ui/TouchControls";
import { BIKE_COLORS, type GameState, type GamePlayerState, type Player } from "@shared/types";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const OBSTACLE_COLOR = 0x556677;

// Represents a rendered bike on screen
interface RenderedBike {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  crashBody: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  boostTrail: Phaser.GameObjects.Graphics;
  // Interpolation targets
  targetX: number;
  targetY: number;
  targetHeading: number;
  isBoosting: boolean;
  isCrashed: boolean;
  speed: number;
}

export class GameScene extends Phaser.Scene {
  private bikes: Map<string, RenderedBike> = new Map();
  private myId: string = "";
  private inputSeq: number = 0;
  private useTouch: boolean = false;
  private touchControls: TouchControls | null = null;

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;

  // HUD
  private boostBar!: Phaser.GameObjects.Graphics;
  private boostText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;

  // Track boost/crash state for HUD
  private myBoosting: boolean = false;
  private myCrashed: boolean = false;
  private mySpeed: number = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.useTouch = isTouchDevice();
    const socket = getSocket();
    this.myId = socket.id || "";

    // Set world bounds
    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Draw arena
    this.createArena();
    this.createObstacles();

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

    // Touch controls
    if (this.useTouch) {
      this.touchControls = new TouchControls(this);
    }

    // Camera setup
    this.cameras.main.setZoom(1.2);
    this.cameras.main.setBounds(
      -WALL_THICKNESS * 2,
      -WALL_THICKNESS * 2,
      ARENA_WIDTH + WALL_THICKNESS * 4,
      ARENA_HEIGHT + WALL_THICKNESS * 4
    );

    // HUD
    this.createHUD();

    // Listen for game state from server
    socket.on("gameState", (state: GameState) => {
      this.applyServerState(state);
    });

    socket.on("playerLeft", (playerId: string) => {
      this.removeBike(playerId);
    });

    // Clean up on scene shutdown
    this.events.on("shutdown", () => {
      socket.off("gameState");
      socket.off("playerLeft");
      this.bikes.clear();
    });
  }

  private createArena() {
    // Floor
    const floor = this.add.graphics();
    floor.fillStyle(0x2a2a3e, 1);
    floor.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Grid lines
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
    this.add.rectangle(ARENA_WIDTH / 2, WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS, 0x445566);
    this.add.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT - WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS, 0x445566);
    this.add.rectangle(WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT, 0x445566);
    this.add.rectangle(ARENA_WIDTH - WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT, 0x445566);
  }

  private createObstacles() {
    const obstacleLayouts = [
      { x: 800, y: 600, w: 80, h: 80 },
      { x: 300, y: 250, w: 60, h: 120 },
      { x: 1300, y: 250, w: 60, h: 120 },
      { x: 300, y: 900, w: 60, h: 120 },
      { x: 1300, y: 900, w: 60, h: 120 },
      { x: 600, y: 400, w: 120, h: 30 },
      { x: 1000, y: 400, w: 120, h: 30 },
      { x: 600, y: 800, w: 120, h: 30 },
      { x: 1000, y: 800, w: 120, h: 30 },
      { x: 500, y: 600, w: 30, h: 80 },
      { x: 1100, y: 600, w: 30, h: 80 },
    ];

    for (const obs of obstacleLayouts) {
      const rect = this.add.rectangle(obs.x, obs.y, obs.w, obs.h, OBSTACLE_COLOR);
      rect.setStrokeStyle(2, 0x667788);
    }
  }

  private createHUD() {
    this.boostBar = this.add.graphics().setScrollFactor(0).setDepth(100);

    this.boostText = this.add.text(20, 42, "", {
      fontSize: "14px",
      color: "#ff8800",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(100);

    this.playerCountText = this.add.text(this.scale.width - 20, 20, "", {
      fontSize: "14px",
      color: "#aabbcc",
      fontFamily: "Arial, sans-serif",
      align: "right",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Controls hint
    const hint = this.add.text(
      this.scale.width / 2,
      this.scale.height - 30,
      this.useTouch ? "Joystick to drive  |  BOOST button" : "WASD to drive  |  SPACE to boost",
      { fontSize: "13px", color: "#888899", fontFamily: "Arial, sans-serif" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 1000 });
  }

  private getOrCreateBike(playerState: GamePlayerState): RenderedBike {
    let bike = this.bikes.get(playerState.id);
    if (bike) return bike;

    // Create new bike visual
    const container = this.add.container(playerState.x, playerState.y);

    const boostTrail = this.add.graphics();
    container.add(boostTrail);

    const body = this.add.graphics();
    const color = BIKE_COLORS[playerState.colorIndex]?.value || 0x4488ff;
    body.fillStyle(color, 1);
    body.fillRoundedRect(-10, -18, 20, 36, 6);
    body.fillStyle(0xffffff, 0.9);
    body.fillTriangle(-5, -14, 5, -14, 0, -22);
    body.lineStyle(2, 0x222222, 1);
    body.strokeRoundedRect(-10, -18, 20, 36, 6);
    container.add(body);

    // Crashed visual: bike tipped over with rider sprawled out
    const crashBody = this.add.graphics();
    // Tipped-over bike (wider, flatter shape)
    crashBody.fillStyle(color, 0.7);
    crashBody.fillRoundedRect(-18, -8, 36, 16, 4);
    // Wheel marks
    crashBody.fillStyle(0x333333, 0.8);
    crashBody.fillCircle(-12, 0, 5);
    crashBody.fillCircle(12, 0, 5);
    // Rider fallen to the side
    crashBody.fillStyle(0xffccaa, 0.9);
    crashBody.fillCircle(0, -14, 6); // head
    crashBody.fillStyle(color, 0.5);
    crashBody.fillRoundedRect(-8, -8, 6, 14, 2); // body/arm
    // Daze sparkles (small diamonds)
    crashBody.fillStyle(0xffff00, 0.8);
    crashBody.fillTriangle(8, -22, 5, -18, 11, -18);
    crashBody.fillTriangle(8, -14, 5, -18, 11, -18);
    crashBody.fillStyle(0xffff00, 0.6);
    crashBody.fillTriangle(-6, -24, -9, -20, -3, -20);
    crashBody.fillTriangle(-6, -16, -9, -20, -3, -20);
    // Outline
    crashBody.lineStyle(2, 0x222222, 0.6);
    crashBody.strokeRoundedRect(-18, -8, 36, 16, 4);
    crashBody.setVisible(false);
    container.add(crashBody);

    const nameLabel = this.add.text(0, -30, playerState.name, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameLabel);

    // If this is our own bike, camera follows it
    if (playerState.id === this.myId) {
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }

    bike = {
      container,
      body,
      crashBody,
      nameLabel,
      boostTrail,
      targetX: playerState.x,
      targetY: playerState.y,
      targetHeading: playerState.heading,
      isBoosting: playerState.isBoosting,
      isCrashed: playerState.isCrashed,
      speed: playerState.speed,
    };

    this.bikes.set(playerState.id, bike);
    return bike;
  }

  private removeBike(playerId: string) {
    const bike = this.bikes.get(playerId);
    if (bike) {
      bike.container.destroy();
      this.bikes.delete(playerId);
    }
  }

  private applyServerState(state: GameState) {
    const activeIds = new Set<string>();

    for (const playerState of state.players) {
      activeIds.add(playerState.id);
      const bike = this.getOrCreateBike(playerState);

      // Set interpolation targets
      bike.targetX = playerState.x;
      bike.targetY = playerState.y;
      bike.targetHeading = playerState.heading;
      bike.isBoosting = playerState.isBoosting;
      bike.isCrashed = playerState.isCrashed;
      bike.speed = playerState.speed;

      // Track own state for HUD
      if (playerState.id === this.myId) {
        this.myBoosting = playerState.isBoosting;
        this.myCrashed = playerState.isCrashed;
        this.mySpeed = playerState.speed;
      }
    }

    // Remove bikes that are no longer in the state
    for (const [id] of this.bikes) {
      if (!activeIds.has(id)) {
        this.removeBike(id);
      }
    }

    // Update player count
    this.playerCountText.setText(`Players: ${state.players.length}`);
  }

  update(_time: number, _delta: number) {
    // Read and send input
    let turnInput = 0;
    let throttleInput = 0;
    let boostInput = false;

    if (this.useTouch && this.touchControls) {
      const touch = this.touchControls.getInput();
      turnInput = touch.turnInput;
      throttleInput = touch.throttleInput;
      boostInput = touch.boostInput;
    } else if (this.cursors) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      turnInput = (left ? -1 : 0) + (right ? 1 : 0);
      throttleInput = (up ? 1 : 0) + (down ? -1 : 0);
      boostInput = this.spaceKey.isDown;
    }

    // Send input to server
    const socket = getSocket();
    socket.emit("playerInput", {
      turnInput,
      throttleInput,
      boostInput,
      seq: this.inputSeq++,
    });

    // Interpolate all bikes toward their target positions
    for (const bike of this.bikes.values()) {
      const lerpSpeed = 0.25;
      bike.container.x += (bike.targetX - bike.container.x) * lerpSpeed;
      bike.container.y += (bike.targetY - bike.container.y) * lerpSpeed;

      // Interpolate heading (handle wrapping)
      let headingDiff = bike.targetHeading - bike.container.rotation;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      bike.container.rotation += headingDiff * lerpSpeed;

      // Keep name label upright
      bike.nameLabel.rotation = -bike.container.rotation;

      // Toggle normal vs crashed visual
      bike.body.setVisible(!bike.isCrashed);
      bike.crashBody.setVisible(bike.isCrashed);

      // Boost trail effect
      bike.boostTrail.clear();
      if (bike.isBoosting) {
        bike.boostTrail.fillStyle(0xff8800, 0.6);
        bike.boostTrail.fillCircle(-4, 22, 4 + Math.random() * 3);
        bike.boostTrail.fillCircle(4, 22, 4 + Math.random() * 3);
        bike.boostTrail.fillStyle(0xffcc00, 0.4);
        bike.boostTrail.fillCircle(0, 26, 3 + Math.random() * 2);
      } else if (bike.speed > 175) {
        bike.boostTrail.fillStyle(0xcccccc, 0.3);
        bike.boostTrail.fillCircle(0, 22, 2);
      }
    }

    // Update HUD
    this.updateHUD();
  }

  private updateHUD() {
    this.boostBar.clear();
    this.boostBar.fillStyle(0x333344, 0.8);
    this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);

    if (this.myCrashed) {
      this.boostBar.fillStyle(0xff2222, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText("CRASHED!");
      this.boostText.setColor("#ff2222");
    } else if (this.myBoosting) {
      this.boostBar.fillStyle(0xffcc00, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText("BOOSTING!");
      this.boostText.setColor("#ffcc00");
    } else {
      this.boostBar.fillStyle(0xff8800, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText(this.useTouch ? "Boost ready!" : "Boost ready! [SPACE]");
      this.boostText.setColor("#ff8800");
    }
  }
}
