import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";
import { TouchControls, isTouchDevice } from "../ui/TouchControls";
import {
  BIKE_COLORS,
  type GameState,
  type GamePlayerState,
  type GameProjectile,
  type GameMapHazard,
  type GameDog,
  type PlayerInput,
} from "@shared/types";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const OBSTACLE_COLOR = 0x556677;

// Represents a rendered bike on screen
interface RenderedBike {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  crashBody: Phaser.GameObjects.Graphics;
  deadBody: Phaser.GameObjects.Graphics;
  mopGraphic: Phaser.GameObjects.Graphics;
  shieldGraphic: Phaser.GameObjects.Graphics;
  healthBarBg: Phaser.GameObjects.Graphics;
  healthBarFill: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  boostTrail: Phaser.GameObjects.Graphics;
  // Interpolation targets
  targetX: number;
  targetY: number;
  targetHeading: number;
  isBoosting: boolean;
  isCrashed: boolean;
  isDead: boolean;
  mopExtended: boolean;
  shieldActive: boolean;
  health: number;
  maxHealth: number;
  speed: number;
}

export class GameScene extends Phaser.Scene {
  private bikes: Map<string, RenderedBike> = new Map();
  private projectileGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private hazardGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private dogGraphics: Map<string, Phaser.GameObjects.Container> = new Map();
  private myId: string = "";
  private inputSeq: number = 0;
  private useTouch: boolean = false;
  private touchControls: TouchControls | null = null;

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;  // throw
  private keyQ!: Phaser.Input.Keyboard.Key;  // drop nails
  private keyR!: Phaser.Input.Keyboard.Key;  // dog
  private keyF!: Phaser.Input.Keyboard.Key;  // mop toggle
  private keyT!: Phaser.Input.Keyboard.Key;  // teleport
  private keyG!: Phaser.Input.Keyboard.Key;  // shield

  // HUD
  private boostBar!: Phaser.GameObjects.Graphics;
  private boostText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;
  private healthHudBg!: Phaser.GameObjects.Graphics;
  private healthHudFill!: Phaser.GameObjects.Graphics;
  private healthHudText!: Phaser.GameObjects.Text;

  // Track own state for HUD
  private myBoosting: boolean = false;
  private myCrashed: boolean = false;
  private myDead: boolean = false;
  private mySpeed: number = 0;
  private myHealth: number = 100;
  private myMaxHealth: number = 100;

  // Track one-shot inputs (toggle once per press)
  private mopJustPressed: boolean = false;
  private teleportJustPressed: boolean = false;
  private shieldJustPressed: boolean = false;
  private dogJustPressed: boolean = false;
  private nailJustPressed: boolean = false;

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
      this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.keyT = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
      this.keyG = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
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
      this.projectileGraphics.forEach(g => g.destroy());
      this.projectileGraphics.clear();
      this.hazardGraphics.forEach(g => g.destroy());
      this.hazardGraphics.clear();
      this.dogGraphics.forEach(g => g.destroy());
      this.dogGraphics.clear();
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
    // Boost bar
    this.boostBar = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.boostText = this.add.text(20, 42, "", {
      fontSize: "14px",
      color: "#ff8800",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(100);

    // Health bar HUD (bottom left)
    this.healthHudBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.healthHudFill = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.healthHudText = this.add.text(20, 72, "HP: 100", {
      fontSize: "14px",
      color: "#44cc66",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(100);

    // Player count
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
      this.useTouch
        ? "Joystick to drive  |  BOOST button"
        : "WASD drive | SPACE nitro | E throw | Q nails | R dog | F mop | T teleport | G shield",
      { fontSize: "11px", color: "#888899", fontFamily: "Arial, sans-serif" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.tweens.add({ targets: hint, alpha: 0, delay: 8000, duration: 1000 });
  }

  private getOrCreateBike(playerState: GamePlayerState): RenderedBike {
    let bike = this.bikes.get(playerState.id);
    if (bike) return bike;

    const container = this.add.container(playerState.x, playerState.y);
    container.setDepth(10);

    const boostTrail = this.add.graphics();
    container.add(boostTrail);

    // Normal bike body
    const body = this.add.graphics();
    const color = BIKE_COLORS[playerState.colorIndex]?.value || 0x4488ff;
    body.fillStyle(color, 1);
    body.fillRoundedRect(-10, -18, 20, 36, 6);
    body.fillStyle(0xffffff, 0.9);
    body.fillTriangle(-5, -14, 5, -14, 0, -22);
    body.lineStyle(2, 0x222222, 1);
    body.strokeRoundedRect(-10, -18, 20, 36, 6);
    container.add(body);

    // Crashed visual
    const crashBody = this.add.graphics();
    crashBody.fillStyle(color, 0.7);
    crashBody.fillRoundedRect(-18, -8, 36, 16, 4);
    crashBody.fillStyle(0x333333, 0.8);
    crashBody.fillCircle(-12, 0, 5);
    crashBody.fillCircle(12, 0, 5);
    crashBody.fillStyle(0xffccaa, 0.9);
    crashBody.fillCircle(0, -14, 6);
    crashBody.fillStyle(color, 0.5);
    crashBody.fillRoundedRect(-8, -8, 6, 14, 2);
    crashBody.fillStyle(0xffff00, 0.8);
    crashBody.fillTriangle(8, -22, 5, -18, 11, -18);
    crashBody.fillTriangle(8, -14, 5, -18, 11, -18);
    crashBody.fillStyle(0xffff00, 0.6);
    crashBody.fillTriangle(-6, -24, -9, -20, -3, -20);
    crashBody.fillTriangle(-6, -16, -9, -20, -3, -20);
    crashBody.lineStyle(2, 0x222222, 0.6);
    crashBody.strokeRoundedRect(-18, -8, 36, 16, 4);
    crashBody.setVisible(false);
    container.add(crashBody);

    // Dead visual (X marks the spot)
    const deadBody = this.add.graphics();
    deadBody.fillStyle(0x333333, 0.5);
    deadBody.fillCircle(0, 0, 16);
    deadBody.lineStyle(3, 0xff2222, 0.8);
    deadBody.moveTo(-8, -8);
    deadBody.lineTo(8, 8);
    deadBody.moveTo(8, -8);
    deadBody.lineTo(-8, 8);
    deadBody.strokePath();
    deadBody.setVisible(false);
    container.add(deadBody);

    // Mop graphic (extends in front of bike)
    const mopGraphic = this.add.graphics();
    mopGraphic.fillStyle(0x8B4513, 1);
    mopGraphic.fillRect(-2, -68, 4, 50); // stick
    mopGraphic.fillStyle(0xcccccc, 1);
    mopGraphic.fillRect(-6, -72, 12, 8); // mop head
    mopGraphic.setVisible(false);
    container.add(mopGraphic);

    // Shield graphic (circle around bike)
    const shieldGraphic = this.add.graphics();
    shieldGraphic.lineStyle(3, 0x33bbff, 0.7);
    shieldGraphic.strokeCircle(0, 0, 22);
    shieldGraphic.fillStyle(0x33bbff, 0.15);
    shieldGraphic.fillCircle(0, 0, 22);
    shieldGraphic.setVisible(false);
    container.add(shieldGraphic);

    // Health bar background (above name)
    const healthBarBg = this.add.graphics();
    healthBarBg.fillStyle(0x000000, 0.6);
    healthBarBg.fillRoundedRect(-20, -42, 40, 5, 2);
    container.add(healthBarBg);

    // Health bar fill
    const healthBarFill = this.add.graphics();
    container.add(healthBarFill);

    // Name label
    const nameLabel = this.add.text(0, -50, playerState.name, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameLabel);

    // Camera follows own bike
    if (playerState.id === this.myId) {
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }

    bike = {
      container,
      body,
      crashBody,
      deadBody,
      mopGraphic,
      shieldGraphic,
      healthBarBg,
      healthBarFill,
      nameLabel,
      boostTrail,
      targetX: playerState.x,
      targetY: playerState.y,
      targetHeading: playerState.heading,
      isBoosting: playerState.isBoosting,
      isCrashed: playerState.isCrashed,
      isDead: playerState.isDead,
      mopExtended: playerState.mopExtended,
      shieldActive: playerState.shieldActive,
      health: playerState.health,
      maxHealth: playerState.maxHealth,
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

    // Update bikes
    for (const playerState of state.players) {
      activeIds.add(playerState.id);
      const bike = this.getOrCreateBike(playerState);

      bike.targetX = playerState.x;
      bike.targetY = playerState.y;
      bike.targetHeading = playerState.heading;
      bike.isBoosting = playerState.isBoosting;
      bike.isCrashed = playerState.isCrashed;
      bike.isDead = playerState.isDead;
      bike.mopExtended = playerState.mopExtended;
      bike.shieldActive = playerState.shieldActive;
      bike.health = playerState.health;
      bike.maxHealth = playerState.maxHealth;
      bike.speed = playerState.speed;

      if (playerState.id === this.myId) {
        this.myBoosting = playerState.isBoosting;
        this.myCrashed = playerState.isCrashed;
        this.myDead = playerState.isDead;
        this.mySpeed = playerState.speed;
        this.myHealth = playerState.health;
        this.myMaxHealth = playerState.maxHealth;
      }
    }

    // Remove bikes no longer in state
    for (const [id] of this.bikes) {
      if (!activeIds.has(id)) this.removeBike(id);
    }

    // Update projectiles
    const activeProjectileIds = new Set<string>();
    for (const proj of state.projectiles) {
      activeProjectileIds.add(proj.id);
      let g = this.projectileGraphics.get(proj.id);
      if (!g) {
        g = this.add.graphics().setDepth(8);
        this.projectileGraphics.set(proj.id, g);
      }
      g.clear();
      if (proj.type === "newspaper") {
        g.fillStyle(0xeeeecc, 1);
        g.fillRect(proj.x - 5, proj.y - 5, 10, 10);
        g.lineStyle(1, 0x888866, 1);
        g.strokeRect(proj.x - 5, proj.y - 5, 10, 10);
      } else {
        // Water balloon
        g.fillStyle(0x3399ff, 0.8);
        g.fillCircle(proj.x, proj.y, 6);
        g.lineStyle(1, 0x1166cc, 1);
        g.strokeCircle(proj.x, proj.y, 6);
      }
    }
    // Remove old projectiles
    for (const [id, g] of this.projectileGraphics) {
      if (!activeProjectileIds.has(id)) {
        g.destroy();
        this.projectileGraphics.delete(id);
      }
    }

    // Update hazards
    const activeHazardIds = new Set<string>();
    for (const hazard of state.hazards) {
      activeHazardIds.add(hazard.id);
      let g = this.hazardGraphics.get(hazard.id);
      if (!g) {
        g = this.add.graphics().setDepth(1);
        this.hazardGraphics.set(hazard.id, g);
      }
      g.clear();
      if (hazard.type === "slick") {
        g.fillStyle(0x3399ff, 0.25);
        g.fillCircle(hazard.x, hazard.y, hazard.radius);
        g.lineStyle(1, 0x3399ff, 0.4);
        g.strokeCircle(hazard.x, hazard.y, hazard.radius);
      } else {
        // Nails
        g.fillStyle(0x888888, 0.5);
        g.fillCircle(hazard.x, hazard.y, hazard.radius);
        // Small dots to represent nails
        g.fillStyle(0xcccccc, 0.8);
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2;
          const r = hazard.radius * 0.6;
          g.fillCircle(hazard.x + Math.cos(angle) * r, hazard.y + Math.sin(angle) * r, 2);
        }
      }
    }
    for (const [id, g] of this.hazardGraphics) {
      if (!activeHazardIds.has(id)) {
        g.destroy();
        this.hazardGraphics.delete(id);
      }
    }

    // Update dogs
    const activeDogIds = new Set<string>();
    for (const dog of state.dogs) {
      activeDogIds.add(dog.id);
      let c = this.dogGraphics.get(dog.id);
      if (!c) {
        c = this.add.container(dog.x, dog.y).setDepth(9);
        const dogBody = this.add.graphics();
        // Simple dog shape: oval body + head
        dogBody.fillStyle(0x8B4513, 1);
        dogBody.fillEllipse(0, 0, 16, 10); // body
        dogBody.fillCircle(0, -8, 5); // head
        dogBody.fillStyle(0x000000, 1);
        dogBody.fillCircle(-2, -10, 1.5); // eye
        dogBody.fillCircle(2, -10, 1.5); // eye
        c.add(dogBody);
        this.dogGraphics.set(dog.id, c);
      }
      c.x = dog.x;
      c.y = dog.y;
      c.rotation = dog.heading;
    }
    for (const [id, c] of this.dogGraphics) {
      if (!activeDogIds.has(id)) {
        c.destroy();
        this.dogGraphics.delete(id);
      }
    }

    // Update player count (alive only)
    const alive = state.players.filter(p => !p.isDead).length;
    this.playerCountText.setText(`Alive: ${alive}/${state.players.length}`);
  }

  update(_time: number, _delta: number) {
    // Read input
    let turnInput = 0;
    let throttleInput = 0;
    let boostInput = false;
    let throwInput = false;
    let mopToggle = false;
    let dropInput = false;
    let dogInput = false;
    let teleportInput = false;
    let shieldInput = false;

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
      throwInput = this.keyE.isDown;

      // One-shot inputs: only send true on the frame the key goes down
      if (this.keyF.isDown && !this.mopJustPressed) {
        mopToggle = true;
        this.mopJustPressed = true;
      } else if (!this.keyF.isDown) {
        this.mopJustPressed = false;
      }

      if (this.keyQ.isDown && !this.nailJustPressed) {
        dropInput = true;
        this.nailJustPressed = true;
      } else if (!this.keyQ.isDown) {
        this.nailJustPressed = false;
      }

      if (this.keyR.isDown && !this.dogJustPressed) {
        dogInput = true;
        this.dogJustPressed = true;
      } else if (!this.keyR.isDown) {
        this.dogJustPressed = false;
      }

      if (this.keyT.isDown && !this.teleportJustPressed) {
        teleportInput = true;
        this.teleportJustPressed = true;
      } else if (!this.keyT.isDown) {
        this.teleportJustPressed = false;
      }

      if (this.keyG.isDown && !this.shieldJustPressed) {
        shieldInput = true;
        this.shieldJustPressed = true;
      } else if (!this.keyG.isDown) {
        this.shieldJustPressed = false;
      }
    }

    // Send input to server
    const socket = getSocket();
    const input: PlayerInput = {
      turnInput,
      throttleInput,
      boostInput,
      nitroInput: boostInput,
      mopToggle,
      throwInput,
      dropInput,
      dogInput,
      teleportInput,
      shieldInput,
      seq: this.inputSeq++,
    };
    socket.emit("playerInput", input);

    // Interpolate all bikes
    for (const bike of this.bikes.values()) {
      const lerpSpeed = 0.25;
      bike.container.x += (bike.targetX - bike.container.x) * lerpSpeed;
      bike.container.y += (bike.targetY - bike.container.y) * lerpSpeed;

      let headingDiff = bike.targetHeading - bike.container.rotation;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      bike.container.rotation += headingDiff * lerpSpeed;

      // Keep name label and health bar upright
      bike.nameLabel.rotation = -bike.container.rotation;
      bike.healthBarBg.rotation = -bike.container.rotation;
      bike.healthBarFill.rotation = -bike.container.rotation;

      // Toggle visuals based on state
      if (bike.isDead) {
        bike.body.setVisible(false);
        bike.crashBody.setVisible(false);
        bike.deadBody.setVisible(true);
        bike.mopGraphic.setVisible(false);
        bike.shieldGraphic.setVisible(false);
        bike.healthBarBg.setVisible(false);
        bike.healthBarFill.setVisible(false);
        bike.boostTrail.clear();
      } else {
        bike.body.setVisible(!bike.isCrashed);
        bike.crashBody.setVisible(bike.isCrashed);
        bike.deadBody.setVisible(false);
        bike.mopGraphic.setVisible(bike.mopExtended && !bike.isCrashed);
        bike.shieldGraphic.setVisible(bike.shieldActive);
        bike.healthBarBg.setVisible(true);

        // Update health bar fill
        bike.healthBarFill.clear();
        const hpRatio = bike.health / bike.maxHealth;
        const barWidth = 38 * hpRatio;
        // Color: green > yellow > red
        let hpColor = 0x44cc66;
        if (hpRatio < 0.3) hpColor = 0xff2222;
        else if (hpRatio < 0.6) hpColor = 0xffcc22;
        bike.healthBarFill.fillStyle(hpColor, 1);
        bike.healthBarFill.fillRoundedRect(-19, -41, barWidth, 3, 1);
        bike.healthBarFill.setVisible(true);

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
    }

    // Update HUD
    this.updateHUD();
  }

  private updateHUD() {
    // Boost bar
    this.boostBar.clear();
    this.boostBar.fillStyle(0x333344, 0.8);
    this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);

    if (this.myDead) {
      this.boostBar.fillStyle(0x555555, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText("ELIMINATED");
      this.boostText.setColor("#888888");
    } else if (this.myCrashed) {
      this.boostBar.fillStyle(0xff2222, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText("CRASHED!");
      this.boostText.setColor("#ff2222");
    } else if (this.myBoosting) {
      this.boostBar.fillStyle(0xffcc00, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText("NITRO!");
      this.boostText.setColor("#ffcc00");
    } else {
      this.boostBar.fillStyle(0xff8800, 1);
      this.boostBar.fillRoundedRect(20, 20, 120, 8, 4);
      this.boostText.setText(this.useTouch ? "Nitro ready!" : "Nitro [SPACE]");
      this.boostText.setColor("#ff8800");
    }

    // Health HUD
    this.healthHudBg.clear();
    this.healthHudFill.clear();
    this.healthHudBg.fillStyle(0x333344, 0.8);
    this.healthHudBg.fillRoundedRect(20, 56, 120, 10, 4);

    const hpRatio = this.myHealth / this.myMaxHealth;
    let hpColor = 0x44cc66;
    if (hpRatio < 0.3) hpColor = 0xff2222;
    else if (hpRatio < 0.6) hpColor = 0xffcc22;

    this.healthHudFill.fillStyle(hpColor, 1);
    this.healthHudFill.fillRoundedRect(20, 56, 120 * hpRatio, 10, 4);

    this.healthHudText.setText(`HP: ${Math.ceil(this.myHealth)}`);
    if (hpRatio < 0.3) this.healthHudText.setColor("#ff2222");
    else if (hpRatio < 0.6) this.healthHudText.setColor("#ffcc22");
    else this.healthHudText.setColor("#44cc66");
  }
}
