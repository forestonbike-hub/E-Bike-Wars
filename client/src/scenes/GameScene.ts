import Phaser from "phaser";
import { getSocket } from "../network/SocketManager";
import { TouchControls, isTouchDevice } from "../ui/TouchControls";
import type { ActiveItem } from "../ui/TouchControls";
import {
  BIKE_COLORS,
  EQUIP_ITEMS,
  type GameState,
  type GamePlayerState,
  type PlayerInput,
  type PlayerLoadout,
} from "@shared/types";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;
const OBSTACLE_COLOR = 0x556677;

// Active items: items that need a USE action (not passive upgrades)
const USABLE_ITEM_IDS = new Set([
  "mop", "newspapers", "waterballoon", "nails", "dog", "teleporter", "trashlid",
]);

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

  // Loadout: which usable items does this player have?
  private usableItems: ActiveItem[] = [];
  private selectedItemIndex: number = -1; // which slot is selected
  private controlDiagram!: Phaser.GameObjects.Container;

  // Desktop item slot visuals (bottom bar)
  private slotGraphics: Phaser.GameObjects.Graphics[] = [];
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private slotKeyLabels: Phaser.GameObjects.Text[] = [];

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;   // USE
  private numKeys: Phaser.Input.Keyboard.Key[] = [];

  // HUD
  private boostBar!: Phaser.GameObjects.Graphics;
  private boostText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;
  private healthHudBg!: Phaser.GameObjects.Graphics;
  private healthHudFill!: Phaser.GameObjects.Graphics;
  private healthHudText!: Phaser.GameObjects.Text;

  // Battery HUD
  private batteryHudBg!: Phaser.GameObjects.Graphics;
  private batteryHudFill!: Phaser.GameObjects.Graphics;
  private batteryHudText!: Phaser.GameObjects.Text;

  // Win overlay
  private winOverlay: Phaser.GameObjects.Container | null = null;
  private countdownText: Phaser.GameObjects.Text | null = null;
  private gameStarted: boolean = false;
  private roomCode: string = "";
  private playerName: string = "";

  // Own state for HUD
  private myBoosting = false;
  private myCrashed = false;
  private myDead = false;
  private mySpeed = 0;
  private myHealth = 100;
  private myMaxHealth = 100;
  private myBatteryPercent = 100;

  // One-shot tracking for USE key
  private useJustPressed = false;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data: { roomCode?: string; playerName?: string; loadout?: PlayerLoadout }) {
    this.roomCode = data?.roomCode || "";
    this.playerName = data?.playerName || "";
    // Build the list of usable items from the loadout
    this.usableItems = [];
    this.selectedItemIndex = -1;
    if (data?.loadout?.itemIds) {
      for (const id of data.loadout.itemIds) {
        if (USABLE_ITEM_IDS.has(id)) {
          const item = EQUIP_ITEMS.find(i => i.id === id);
          if (item) {
            this.usableItems.push({ id: item.id, icon: item.icon, name: item.name });
          }
        }
      }
    }
  }

  create() {
    this.useTouch = isTouchDevice();
    const socket = getSocket();
    this.myId = socket.id || "";

    this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.createArena();
    this.createObstacles();

    // Keyboard setup
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

      // Number keys 1-7 for item selection
      const codes = [
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
        Phaser.Input.Keyboard.KeyCodes.FIVE,
        Phaser.Input.Keyboard.KeyCodes.SIX,
        Phaser.Input.Keyboard.KeyCodes.SEVEN,
      ];
      this.numKeys = codes.map(c => this.input.keyboard!.addKey(c));
    }

    // Touch controls
    if (this.useTouch) {
      this.touchControls = new TouchControls(this, this.usableItems);
    }

    // Camera
    this.cameras.main.setZoom(1.2);
    this.cameras.main.setBounds(
      -WALL_THICKNESS * 2, -WALL_THICKNESS * 2,
      ARENA_WIDTH + WALL_THICKNESS * 4, ARENA_HEIGHT + WALL_THICKNESS * 4
    );

    // HUD
    this.createHUD();

    // Desktop: item slots bar + control diagram at bottom
    if (!this.useTouch) {
      this.createDesktopItemBar();
      this.createDesktopControlDiagram();
    }

    // Network listeners
    socket.on("gameState", (state: GameState) => this.applyServerState(state));
    socket.on("playerLeft", (playerId: string) => this.removeBike(playerId));

    socket.on("countdown", (count: number) => {
      this.showCountdown(count);
    });

    socket.on("gameOver", (data: { winnerId: string; winnerName: string }) => {
      this.showWinOverlay(data.winnerName, data.winnerId === this.myId);
    });

    socket.on("returnToLobby", () => {
      this.scene.start("LobbyScene", {
        roomCode: this.roomCode,
        playerName: this.playerName,
      });
    });

    this.events.on("shutdown", () => {
      socket.off("gameState");
      socket.off("playerLeft");
      socket.off("countdown");
      socket.off("gameOver");
      socket.off("returnToLobby");
      if (this.winOverlay) { this.winOverlay.destroy(); this.winOverlay = null; }
      this.bikes.clear();
      this.projectileGraphics.forEach(g => g.destroy());
      this.projectileGraphics.clear();
      this.hazardGraphics.forEach(g => g.destroy());
      this.hazardGraphics.clear();
      this.dogGraphics.forEach(g => g.destroy());
      this.dogGraphics.clear();
    });
  }

  // ── Arena drawing ──

  private createArena() {
    const floor = this.add.graphics();
    floor.fillStyle(0x2a2a3e, 1);
    floor.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x3a3a4e, 0.3);
    for (let x = 0; x <= ARENA_WIDTH; x += 80) { grid.moveTo(x, 0); grid.lineTo(x, ARENA_HEIGHT); }
    for (let y = 0; y <= ARENA_HEIGHT; y += 80) { grid.moveTo(0, y); grid.lineTo(ARENA_WIDTH, y); }
    grid.strokePath();

    this.add.rectangle(ARENA_WIDTH / 2, WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS, 0x445566);
    this.add.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT - WALL_THICKNESS / 2, ARENA_WIDTH, WALL_THICKNESS, 0x445566);
    this.add.rectangle(WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT, 0x445566);
    this.add.rectangle(ARENA_WIDTH - WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT, 0x445566);
  }

  private createObstacles() {
    const layouts = [
      { x: 800, y: 600, w: 80, h: 80 }, { x: 300, y: 250, w: 60, h: 120 },
      { x: 1300, y: 250, w: 60, h: 120 }, { x: 300, y: 900, w: 60, h: 120 },
      { x: 1300, y: 900, w: 60, h: 120 }, { x: 600, y: 400, w: 120, h: 30 },
      { x: 1000, y: 400, w: 120, h: 30 }, { x: 600, y: 800, w: 120, h: 30 },
      { x: 1000, y: 800, w: 120, h: 30 }, { x: 500, y: 600, w: 30, h: 80 },
      { x: 1100, y: 600, w: 30, h: 80 },
    ];
    for (const obs of layouts) {
      this.add.rectangle(obs.x, obs.y, obs.w, obs.h, OBSTACLE_COLOR).setStrokeStyle(2, 0x667788);
    }
  }

  // ── HUD ──

  private createHUD() {
    const sw = this.scale.width;
    const cx = sw / 2;
    const hy = 12;

    this.boostBar = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.boostText = this.add.text(cx, hy + 22, "", {
      fontSize: "15px", color: "#ff8800", fontFamily: "Arial, sans-serif", fontStyle: "bold",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.healthHudBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.healthHudFill = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.healthHudText = this.add.text(cx, hy + 48, "HP: 100", {
      fontSize: "15px", color: "#44cc66", fontFamily: "Arial, sans-serif", fontStyle: "bold",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.batteryHudBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.batteryHudFill = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.batteryHudText = this.add.text(cx, hy + 74, "Battery: 100%", {
      fontSize: "15px", color: "#ff8833", fontFamily: "Arial, sans-serif", fontStyle: "bold",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.playerCountText = this.add.text(sw - 16, hy, "", {
      fontSize: "15px", color: "#aabbcc", fontFamily: "Arial, sans-serif", align: "right",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  // ── Desktop: Item bar at bottom center ──

  private createDesktopItemBar() {
    if (this.usableItems.length === 0) return;

    const sw = this.scale.width;
    const sh = this.scale.height;
    const slotSize = 48;
    const gap = 6;
    const totalW = this.usableItems.length * (slotSize + gap) - gap;
    const startX = (sw - totalW) / 2;
    const y = sh - 70;

    for (let i = 0; i < this.usableItems.length; i++) {
      const x = startX + i * (slotSize + gap) + slotSize / 2;

      // Slot background
      const g = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.drawDesktopSlot(g, x, y, slotSize, false);
      this.slotGraphics.push(g);

      // Item icon
      const label = this.add.text(x, y, this.usableItems[i].icon, {
        fontSize: "24px", fontFamily: "Arial, sans-serif",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      this.slotLabels.push(label);

      // Key number label
      const keyLabel = this.add.text(x - slotSize / 2 + 6, y - slotSize / 2 + 2, `${i + 1}`, {
        fontSize: "10px", color: "#aabbcc", fontFamily: "Arial, sans-serif", fontStyle: "bold",
      }).setScrollFactor(0).setDepth(101);
      this.slotKeyLabels.push(keyLabel);
    }
  }

  private drawDesktopSlot(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, selected: boolean) {
    g.clear();
    const hs = size / 2;
    if (selected) {
      g.fillStyle(0x44aa66, 0.85);
      g.fillRoundedRect(x - hs, y - hs, size, size, 8);
      g.lineStyle(3, 0x66ff88, 1);
    } else {
      g.fillStyle(0x222244, 0.8);
      g.fillRoundedRect(x - hs, y - hs, size, size, 8);
      g.lineStyle(2, 0x555577, 0.8);
    }
    g.strokeRoundedRect(x - hs, y - hs, size, size, 8);
  }

  private updateDesktopSlotHighlights() {
    const slotSize = 48;
    const gap = 6;
    const totalW = this.usableItems.length * (slotSize + gap) - gap;
    const startX = (this.scale.width - totalW) / 2;
    const y = this.scale.height - 70;

    for (let i = 0; i < this.slotGraphics.length; i++) {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      this.drawDesktopSlot(this.slotGraphics[i], x, y, slotSize, i === this.selectedItemIndex);
    }
  }

  // ── Desktop: Control diagram ──

  private createDesktopControlDiagram() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 0.7);
    bg.fillRoundedRect(10, sh - 28, sw - 20, 24, 6);
    container.add(bg);

    let parts = ["WASD: Move", "SPACE: Nitro"];
    if (this.usableItems.length > 0) {
      parts.push("1-" + this.usableItems.length + ": Select Item");
      parts.push("E: Use Item");
    }
    const helpStr = parts.join("    ");

    const text = this.add.text(sw / 2, sh - 16, helpStr, {
      fontSize: "11px", color: "#8899aa", fontFamily: "Arial, sans-serif",
    }).setOrigin(0.5);
    container.add(text);

    this.controlDiagram = container;

    // Fade after 12 seconds
    this.tweens.add({ targets: container, alpha: 0.3, delay: 12000, duration: 2000 });
  }

  // ── Bike rendering ──

  private getOrCreateBike(ps: GamePlayerState): RenderedBike {
    let bike = this.bikes.get(ps.id);
    if (bike) return bike;

    const container = this.add.container(ps.x, ps.y).setDepth(10);
    const color = BIKE_COLORS[ps.colorIndex]?.value || 0x4488ff;

    const boostTrail = this.add.graphics();
    container.add(boostTrail);

    // Normal body - bird's eye view of person on e-bike
    const body = this.add.graphics();

    // Back wheel
    body.fillStyle(0x222222, 1);
    body.fillRoundedRect(-4, 10, 8, 14, 3);
    // Front wheel
    body.fillRoundedRect(-4, -24, 8, 14, 3);

    // Bike frame (center bar)
    body.fillStyle(0x555555, 1);
    body.fillRect(-2, -16, 4, 28);

    // Handlebars
    body.fillStyle(0x444444, 1);
    body.fillRoundedRect(-10, -18, 20, 4, 2);

    // Rider torso (oval, colored jersey)
    body.fillStyle(color, 1);
    body.fillEllipse(0, 0, 16, 20);
    // Torso outline
    body.lineStyle(1.5, 0x222222, 0.6);
    body.strokeEllipse(0, 0, 16, 20);

    // Rider head (circle, skin tone)
    body.fillStyle(0xffccaa, 1);
    body.fillCircle(0, -12, 5);
    body.lineStyle(1, 0x222222, 0.5);
    body.strokeCircle(0, -12, 5);

    // Helmet (arc over top of head, colored)
    body.fillStyle(color, 0.9);
    body.fillEllipse(0, -14, 10, 6);

    // Arms reaching to handlebars
    body.lineStyle(3, 0xffccaa, 1);
    body.beginPath();
    body.moveTo(-5, -4); body.lineTo(-9, -16);
    body.moveTo(5, -4); body.lineTo(9, -16);
    body.strokePath();

    // Legs (bent knees, feet on pedals)
    body.lineStyle(3, 0x334466, 1);
    body.beginPath();
    body.moveTo(-4, 6); body.lineTo(-8, 14); body.lineTo(-4, 18);
    body.moveTo(4, 6); body.lineTo(8, 14); body.lineTo(4, 18);
    body.strokePath();

    // Direction indicator (small white chevron at front)
    body.fillStyle(0xffffff, 0.7);
    body.fillTriangle(-4, -22, 4, -22, 0, -27);

    container.add(body);

    // Crashed body - bike tipped over, rider sprawled
    const crashBody = this.add.graphics();

    // Tipped bike frame (angled)
    crashBody.fillStyle(0x555555, 0.6);
    crashBody.fillRect(-14, -4, 28, 3);
    // Wheels (sideways)
    crashBody.fillStyle(0x222222, 0.7);
    crashBody.fillCircle(-12, 0, 5);
    crashBody.fillCircle(12, 0, 5);
    // Handlebars (askew)
    crashBody.fillStyle(0x444444, 0.6);
    crashBody.fillRect(8, -8, 3, 12);

    // Rider body (sprawled, slightly offset)
    crashBody.fillStyle(color, 0.6);
    crashBody.fillEllipse(-2, -6, 14, 18);
    // Head (off to side)
    crashBody.fillStyle(0xffccaa, 0.7);
    crashBody.fillCircle(-4, -16, 5);

    // Star burst impact effect
    crashBody.fillStyle(0xffff00, 0.8);
    crashBody.fillTriangle(8, -22, 5, -18, 11, -18);
    crashBody.fillTriangle(8, -14, 5, -18, 11, -18);
    crashBody.fillStyle(0xffff00, 0.6);
    crashBody.fillTriangle(-6, -24, -9, -20, -3, -20);
    crashBody.fillTriangle(-6, -16, -9, -20, -3, -20);

    crashBody.lineStyle(1.5, 0x222222, 0.4);
    crashBody.strokeEllipse(-2, -6, 14, 18);
    crashBody.setVisible(false);
    container.add(crashBody);

    // Dead body - wreckage smoke cloud with X
    const deadBody = this.add.graphics();
    // Smoke/wreckage cloud
    deadBody.fillStyle(0x444444, 0.4);
    deadBody.fillCircle(-4, -3, 12);
    deadBody.fillCircle(5, 2, 10);
    deadBody.fillCircle(-2, 6, 8);
    // Scattered bike parts
    deadBody.fillStyle(0x222222, 0.5);
    deadBody.fillCircle(-10, 8, 4);
    deadBody.fillCircle(10, -6, 4);
    // Red X
    deadBody.lineStyle(3, 0xff2222, 0.8);
    deadBody.beginPath();
    deadBody.moveTo(-8, -8); deadBody.lineTo(8, 8);
    deadBody.moveTo(8, -8); deadBody.lineTo(-8, 8);
    deadBody.strokePath();
    deadBody.setVisible(false);
    container.add(deadBody);

    // Mop graphic
    const mopGraphic = this.add.graphics();
    mopGraphic.fillStyle(0x8B4513, 1);
    mopGraphic.fillRect(-2, -68, 4, 50);
    mopGraphic.fillStyle(0xcccccc, 1);
    mopGraphic.fillRect(-6, -72, 12, 8);
    mopGraphic.setVisible(false);
    container.add(mopGraphic);

    // Shield graphic
    const shieldGraphic = this.add.graphics();
    shieldGraphic.lineStyle(3, 0x33bbff, 0.7);
    shieldGraphic.strokeCircle(0, 0, 22);
    shieldGraphic.fillStyle(0x33bbff, 0.15);
    shieldGraphic.fillCircle(0, 0, 22);
    shieldGraphic.setVisible(false);
    container.add(shieldGraphic);

    // Health bar bg
    const healthBarBg = this.add.graphics();
    healthBarBg.fillStyle(0x000000, 0.6);
    healthBarBg.fillRoundedRect(-20, -42, 40, 5, 2);
    container.add(healthBarBg);

    // Health bar fill
    const healthBarFill = this.add.graphics();
    container.add(healthBarFill);

    // Name label
    const nameLabel = this.add.text(0, -50, ps.name, {
      fontSize: "12px", color: "#ffffff", fontFamily: "Arial, sans-serif",
      fontStyle: "bold", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameLabel);

    if (ps.id === this.myId) {
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }

    bike = {
      container, body, crashBody, deadBody, mopGraphic, shieldGraphic,
      healthBarBg, healthBarFill, nameLabel, boostTrail,
      targetX: ps.x, targetY: ps.y, targetHeading: ps.heading,
      isBoosting: ps.isBoosting, isCrashed: ps.isCrashed, isDead: ps.isDead,
      mopExtended: ps.mopExtended, shieldActive: ps.shieldActive,
      health: ps.health, maxHealth: ps.maxHealth, speed: ps.speed,
    };
    this.bikes.set(ps.id, bike);
    return bike;
  }

  private removeBike(playerId: string) {
    const bike = this.bikes.get(playerId);
    if (bike) { bike.container.destroy(); this.bikes.delete(playerId); }
  }

  // ── Apply server state ──

  private applyServerState(state: GameState) {
    const activeIds = new Set<string>();

    for (const ps of state.players) {
      activeIds.add(ps.id);
      const bike = this.getOrCreateBike(ps);
      bike.targetX = ps.x;
      bike.targetY = ps.y;
      bike.targetHeading = ps.heading;
      bike.isBoosting = ps.isBoosting;
      bike.isCrashed = ps.isCrashed;
      bike.isDead = ps.isDead;
      bike.mopExtended = ps.mopExtended;
      bike.shieldActive = ps.shieldActive;
      bike.health = ps.health;
      bike.maxHealth = ps.maxHealth;
      bike.speed = ps.speed;

      if (ps.id === this.myId) {
        this.myBoosting = ps.isBoosting;
        this.myCrashed = ps.isCrashed;
        this.myDead = ps.isDead;
        this.mySpeed = ps.speed;
        this.myHealth = ps.health;
        this.myMaxHealth = ps.maxHealth;
        this.myBatteryPercent = ps.batteryPercent ?? 100;
      }
    }

    for (const [id] of this.bikes) {
      if (!activeIds.has(id)) this.removeBike(id);
    }

    // Projectiles
    const activeProjIds = new Set<string>();
    for (const proj of state.projectiles) {
      activeProjIds.add(proj.id);
      let g = this.projectileGraphics.get(proj.id);
      if (!g) { g = this.add.graphics().setDepth(8); this.projectileGraphics.set(proj.id, g); }
      g.clear();
      if (proj.type === "newspaper") {
        g.fillStyle(0xeeeecc, 1); g.fillRect(proj.x - 5, proj.y - 5, 10, 10);
        g.lineStyle(1, 0x888866, 1); g.strokeRect(proj.x - 5, proj.y - 5, 10, 10);
      } else {
        g.fillStyle(0x3399ff, 0.8); g.fillCircle(proj.x, proj.y, 6);
        g.lineStyle(1, 0x1166cc, 1); g.strokeCircle(proj.x, proj.y, 6);
      }
    }
    for (const [id, g] of this.projectileGraphics) {
      if (!activeProjIds.has(id)) { g.destroy(); this.projectileGraphics.delete(id); }
    }

    // Hazards
    const activeHazIds = new Set<string>();
    for (const h of state.hazards) {
      activeHazIds.add(h.id);
      let g = this.hazardGraphics.get(h.id);
      if (!g) { g = this.add.graphics().setDepth(1); this.hazardGraphics.set(h.id, g); }
      g.clear();
      if (h.type === "slick") {
        g.fillStyle(0x3399ff, 0.25); g.fillCircle(h.x, h.y, h.radius);
        g.lineStyle(1, 0x3399ff, 0.4); g.strokeCircle(h.x, h.y, h.radius);
      } else {
        g.fillStyle(0x888888, 0.5); g.fillCircle(h.x, h.y, h.radius);
        g.fillStyle(0xcccccc, 0.8);
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2;
          g.fillCircle(h.x + Math.cos(angle) * h.radius * 0.6, h.y + Math.sin(angle) * h.radius * 0.6, 2);
        }
      }
    }
    for (const [id, g] of this.hazardGraphics) {
      if (!activeHazIds.has(id)) { g.destroy(); this.hazardGraphics.delete(id); }
    }

    // Dogs
    const activeDogIds = new Set<string>();
    for (const dog of state.dogs) {
      activeDogIds.add(dog.id);
      let c = this.dogGraphics.get(dog.id);
      if (!c) {
        c = this.add.container(dog.x, dog.y).setDepth(9);
        const db = this.add.graphics();
        db.fillStyle(0x8B4513, 1); db.fillEllipse(0, 0, 16, 10);
        db.fillCircle(0, -8, 5);
        db.fillStyle(0x000000, 1); db.fillCircle(-2, -10, 1.5); db.fillCircle(2, -10, 1.5);
        c.add(db);
        this.dogGraphics.set(dog.id, c);
      }
      c.x = dog.x; c.y = dog.y; c.rotation = dog.heading;
    }
    for (const [id, c] of this.dogGraphics) {
      if (!activeDogIds.has(id)) { c.destroy(); this.dogGraphics.delete(id); }
    }

    const alive = state.players.filter(p => !p.isDead).length;
    this.playerCountText.setText(`Alive: ${alive}/${state.players.length}`);
  }

  // ── Main update loop ──

  update(_time: number, _delta: number) {
    // During countdown, only interpolate bikes and update HUD (no input)
    if (!this.gameStarted) {
      this.interpolateBikes();
      this.updateHUD();
      return;
    }

    let turnInput = 0;
    let throttleInput = 0;
    let boostInput = false;
    let useItem = false;

    // ── Touch input ──
    if (this.useTouch && this.touchControls) {
      const ti = this.touchControls.getInput();
      turnInput = ti.turnInput;
      throttleInput = ti.throttleInput;
      boostInput = ti.boostInput;
      this.selectedItemIndex = ti.selectedSlot;
      if (ti.useItem) {
        useItem = true;
        this.touchControls.clearUse();
      }
    }
    // ── Desktop input ──
    else if (this.cursors) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      turnInput = (left ? -1 : 0) + (right ? 1 : 0);
      throttleInput = (up ? 1 : 0) + (down ? -1 : 0);
      boostInput = this.spaceKey.isDown;

      // Number keys to select item slot
      for (let i = 0; i < this.numKeys.length && i < this.usableItems.length; i++) {
        if (Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
          this.selectedItemIndex = (this.selectedItemIndex === i) ? -1 : i;
          this.updateDesktopSlotHighlights();
        }
      }

      // E = USE (one-shot)
      if (this.keyE.isDown && !this.useJustPressed) {
        useItem = true;
        this.useJustPressed = true;
      } else if (!this.keyE.isDown) {
        this.useJustPressed = false;
      }
    }

    // ── Map selected item + USE to server input flags ──
    const input: PlayerInput = {
      turnInput,
      throttleInput,
      boostInput,
      nitroInput: boostInput,
      mopToggle: false,
      throwInput: false,
      dropInput: false,
      dogInput: false,
      teleportInput: false,
      shieldInput: false,
      seq: this.inputSeq++,
    };

    if (useItem && this.selectedItemIndex >= 0 && this.selectedItemIndex < this.usableItems.length) {
      const itemId = this.usableItems[this.selectedItemIndex].id;
      switch (itemId) {
        case "mop": input.mopToggle = true; break;
        case "newspapers": input.throwInput = true; input.throwItemId = "newspapers"; break;
        case "waterballoon": input.throwInput = true; input.throwItemId = "waterballoon"; break;
        case "nails": input.dropInput = true; break;
        case "dog": input.dogInput = true; break;
        case "teleporter": input.teleportInput = true; break;
        case "trashlid": input.shieldInput = true; break;
      }
    }

    getSocket().emit("playerInput", input);

    this.interpolateBikes();
    this.updateHUD();
  }

  private interpolateBikes() {
    for (const bike of this.bikes.values()) {
      const lerp = 0.3;
      bike.container.x += (bike.targetX - bike.container.x) * lerp;
      bike.container.y += (bike.targetY - bike.container.y) * lerp;

      let hd = bike.targetHeading - bike.container.rotation;
      while (hd > Math.PI) hd -= Math.PI * 2;
      while (hd < -Math.PI) hd += Math.PI * 2;
      bike.container.rotation += hd * lerp;

      bike.nameLabel.rotation = -bike.container.rotation;
      bike.healthBarBg.rotation = -bike.container.rotation;
      bike.healthBarFill.rotation = -bike.container.rotation;

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

        // Health bar fill
        bike.healthBarFill.clear();
        const hpRatio = bike.health / bike.maxHealth;
        const barW = 38 * hpRatio;
        let hpColor = 0x44cc66;
        if (hpRatio < 0.3) hpColor = 0xff2222;
        else if (hpRatio < 0.6) hpColor = 0xffcc22;
        bike.healthBarFill.fillStyle(hpColor, 1);
        bike.healthBarFill.fillRoundedRect(-19, -41, barW, 3, 1);
        bike.healthBarFill.setVisible(true);

        // Boost trail
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
  }

  private updateHUD() {
    const sw = this.scale.width;
    const barW = Math.min(200, sw * 0.2);
    const barX = (sw - barW) / 2;
    const hy = 12;

    // Boost/status bar
    this.boostBar.clear();
    this.boostBar.fillStyle(0x333344, 0.8);
    this.boostBar.fillRoundedRect(barX, hy, barW, 10, 4);

    if (this.myDead) {
      this.boostBar.fillStyle(0x555555, 1);
      this.boostBar.fillRoundedRect(barX, hy, barW, 10, 4);
      this.boostText.setText("ELIMINATED");
      this.boostText.setColor("#888888");
    } else if (this.myCrashed) {
      this.boostBar.fillStyle(0xff2222, 1);
      this.boostBar.fillRoundedRect(barX, hy, barW, 10, 4);
      this.boostText.setText("CRASHED!");
      this.boostText.setColor("#ff2222");
    } else if (this.myBoosting) {
      this.boostBar.fillStyle(0xffcc00, 1);
      this.boostBar.fillRoundedRect(barX, hy, barW, 10, 4);
      this.boostText.setText("NITRO!");
      this.boostText.setColor("#ffcc00");
    } else {
      this.boostBar.fillStyle(0xff8800, 1);
      this.boostBar.fillRoundedRect(barX, hy, barW, 10, 4);
      this.boostText.setText(this.useTouch ? "Nitro ready!" : "Nitro [SPACE]");
      this.boostText.setColor("#ff8800");
    }

    // Reposition text to current center (handles resize)
    const cx = sw / 2;
    this.boostText.setX(cx);
    this.healthHudText.setX(cx);
    this.batteryHudText.setX(cx);
    this.playerCountText.setX(sw - 16);

    // Health bar
    this.healthHudBg.clear();
    this.healthHudFill.clear();
    this.healthHudBg.fillStyle(0x333344, 0.8);
    this.healthHudBg.fillRoundedRect(barX, hy + 36, barW, 12, 4);

    const hpRatio = this.myHealth / this.myMaxHealth;
    let hpColor = 0x44cc66;
    if (hpRatio < 0.3) hpColor = 0xff2222;
    else if (hpRatio < 0.6) hpColor = 0xffcc22;

    this.healthHudFill.fillStyle(hpColor, 1);
    this.healthHudFill.fillRoundedRect(barX, hy + 36, barW * hpRatio, 12, 4);

    this.healthHudText.setText(`HP: ${Math.ceil(this.myHealth)}`);
    if (hpRatio < 0.3) this.healthHudText.setColor("#ff2222");
    else if (hpRatio < 0.6) this.healthHudText.setColor("#ffcc22");
    else this.healthHudText.setColor("#44cc66");

    // Battery bar
    this.batteryHudBg.clear();
    this.batteryHudFill.clear();
    this.batteryHudBg.fillStyle(0x333344, 0.8);
    this.batteryHudBg.fillRoundedRect(barX, hy + 62, barW, 12, 4);

    const batRatio = this.myBatteryPercent / 100;
    let batColor = 0xff8833;
    if (batRatio < 0.2) batColor = 0xff2222;

    this.batteryHudFill.fillStyle(batColor, 1);
    this.batteryHudFill.fillRoundedRect(barX, hy + 62, barW * batRatio, 12, 4);

    this.batteryHudText.setText(`Battery: ${Math.ceil(this.myBatteryPercent)}%`);
    if (batRatio < 0.2) this.batteryHudText.setColor("#ff2222");
    else this.batteryHudText.setColor("#ff8833");
  }

  private showCountdown(count: number) {
    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = null;
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    if (count === 0) {
      this.gameStarted = true;
      const goText = this.add.text(cx, cy, "GO!", {
        fontSize: "72px", color: "#44cc66", fontFamily: "Arial, sans-serif",
        fontStyle: "bold", stroke: "#000000", strokeThickness: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      this.tweens.add({
        targets: goText, alpha: 0, scaleX: 2, scaleY: 2,
        duration: 800, ease: "Power2",
        onComplete: () => goText.destroy(),
      });
      return;
    }

    this.countdownText = this.add.text(cx, cy,
      `${count}`,
      {
        fontSize: "96px", color: "#ffcc22", fontFamily: "Arial, sans-serif",
        fontStyle: "bold", stroke: "#000000", strokeThickness: 6,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    // Pulse animation
    this.tweens.add({
      targets: this.countdownText,
      scaleX: 0.6, scaleY: 0.6, alpha: 0.5,
      duration: 800, ease: "Power2",
    });
  }

  private showWinOverlay(winnerName: string, isMe: boolean) {
    if (this.winOverlay) return;

    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    const sw = this.scale.width;
    const sh = this.scale.height;

    // Semi-transparent backdrop
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, sw, sh);
    container.add(bg);

    // Winner announcement
    const title = isMe ? "YOU WIN!" : `${winnerName} WINS!`;
    const titleColor = isMe ? "#ffcc22" : "#ff4455";
    const titleText = this.add.text(sw / 2, sh * 0.47, title, {
      fontSize: "72px", color: titleColor, fontFamily: "Arial, sans-serif",
      fontStyle: "bold", stroke: "#000000", strokeThickness: 6,
    }).setOrigin(0.5);
    container.add(titleText);

    const subText = this.add.text(sw / 2, sh * 0.47 + 90, "Returning to lobby...", {
      fontSize: "28px", color: "#aabbcc", fontFamily: "Arial, sans-serif",
    }).setOrigin(0.5);
    container.add(subText);

    this.winOverlay = container;

    // Pulse animation on the title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.1,
      scaleY: 1.1,
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: "Sine.easeInOut",
    });
  }
}
