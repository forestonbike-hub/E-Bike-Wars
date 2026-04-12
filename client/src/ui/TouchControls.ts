import Phaser from "phaser";

/**
 * Touch controls for tablet and phone players.
 *
 * Layout (landscape orientation):
 *   Left side: Virtual joystick for steering + throttle
 *   Right side: BOOST button
 *
 * The joystick works like a virtual WASD:
 *   Push up = accelerate (W)
 *   Push down = brake/reverse (S)
 *   Push left = steer left (A)
 *   Push right = steer right (D)
 *   Diagonal = combined (e.g., up-right = accelerate while turning right)
 */

export interface TouchInput {
  turnInput: number;    // -1 (left) to 1 (right)
  throttleInput: number; // -1 (brake) to 1 (accelerate)
  boostInput: boolean;
}

export class TouchControls {
  private scene: Phaser.Scene;

  // Joystick
  private joyBase: Phaser.GameObjects.Graphics;
  private joyStick: Phaser.GameObjects.Graphics;
  private joyBaseX: number;
  private joyBaseY: number;
  private joyRadius: number;
  private joyActive: boolean = false;
  private joyPointerId: number = -1;

  // Boost button
  private boostBg: Phaser.GameObjects.Graphics;
  private boostLabel: Phaser.GameObjects.Text;
  private boostActive: boolean = false;

  // Current input state
  private input: TouchInput = {
    turnInput: 0,
    throttleInput: 0,
    boostInput: false,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const w = scene.scale.width;
    const h = scene.scale.height;

    // Scale controls based on screen size (bigger on tablets)
    const scaleFactor = Math.min(w, h) / 600;
    this.joyRadius = Math.max(50, Math.min(80, 60 * scaleFactor));

    // Position joystick in bottom-left with padding
    const pad = this.joyRadius + 30;
    this.joyBaseX = pad;
    this.joyBaseY = h - pad;

    // Draw joystick base
    this.joyBase = scene.add.graphics();
    this.joyBase.setScrollFactor(0);
    this.joyBase.setDepth(100);
    this.drawJoyBase();

    // Draw joystick stick
    this.joyStick = scene.add.graphics();
    this.joyStick.setScrollFactor(0);
    this.joyStick.setDepth(101);
    this.drawJoyStick(this.joyBaseX, this.joyBaseY);

    // Draw directional hints on the base
    this.drawDirectionHints();

    // Boost button in bottom-right
    const boostRadius = Math.max(35, Math.min(50, 40 * scaleFactor));
    const boostX = w - boostRadius - 30;
    const boostY = h - boostRadius - 30;

    this.boostBg = scene.add.graphics();
    this.boostBg.setScrollFactor(0);
    this.boostBg.setDepth(100);
    this.drawBoostButton(boostX, boostY, boostRadius, false);

    this.boostLabel = scene.add.text(boostX, boostY, "BOOST", {
      fontSize: `${Math.round(12 * scaleFactor)}px`,
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Set up touch input zones
    // Left half of screen = joystick zone
    const joyZone = scene.add.zone(w * 0.4, h, w * 0.8, h * 2)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(99)
      .setInteractive();

    joyZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.joyActive) {
        this.joyActive = true;
        this.joyPointerId = pointer.id;
        this.updateJoystick(pointer);
      }
    });

    // Boost zone (right side)
    const boostZone = scene.add.zone(boostX, boostY, boostRadius * 2.5, boostRadius * 2.5)
      .setScrollFactor(0)
      .setDepth(99)
      .setInteractive();

    boostZone.on("pointerdown", () => {
      this.boostActive = true;
      this.input.boostInput = true;
      this.drawBoostButton(boostX, boostY, boostRadius, true);
    });
    boostZone.on("pointerup", () => {
      this.boostActive = false;
      this.input.boostInput = false;
      this.drawBoostButton(boostX, boostY, boostRadius, false);
    });
    boostZone.on("pointerout", () => {
      this.boostActive = false;
      this.input.boostInput = false;
      this.drawBoostButton(boostX, boostY, boostRadius, false);
    });

    // Global pointer events for joystick tracking
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.joyActive && pointer.id === this.joyPointerId) {
        this.updateJoystick(pointer);
      }
    });

    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joyPointerId) {
        this.joyActive = false;
        this.joyPointerId = -1;
        this.input.turnInput = 0;
        this.input.throttleInput = 0;
        this.drawJoyStick(this.joyBaseX, this.joyBaseY);
      }
    });
  }

  private drawJoyBase() {
    this.joyBase.clear();

    // Outer ring
    this.joyBase.lineStyle(3, 0x6666aa, 0.4);
    this.joyBase.strokeCircle(this.joyBaseX, this.joyBaseY, this.joyRadius);

    // Inner fill
    this.joyBase.fillStyle(0x333355, 0.3);
    this.joyBase.fillCircle(this.joyBaseX, this.joyBaseY, this.joyRadius);
  }

  private drawDirectionHints() {
    const g = this.scene.add.graphics();
    g.setScrollFactor(0);
    g.setDepth(100);

    const cx = this.joyBaseX;
    const cy = this.joyBaseY;
    const r = this.joyRadius;

    // Small arrow hints at N/S/E/W
    g.fillStyle(0x8888bb, 0.3);

    // Up arrow (forward/accelerate)
    g.fillTriangle(cx - 6, cy - r + 18, cx + 6, cy - r + 18, cx, cy - r + 8);
    // Down arrow (brake)
    g.fillTriangle(cx - 6, cy + r - 18, cx + 6, cy + r - 18, cx, cy + r - 8);
    // Left arrow
    g.fillTriangle(cx - r + 18, cy - 6, cx - r + 18, cy + 6, cx - r + 8, cy);
    // Right arrow
    g.fillTriangle(cx + r - 18, cy - 6, cx + r - 18, cy + 6, cx + r - 8, cy);
  }

  private drawJoyStick(x: number, y: number) {
    this.joyStick.clear();

    const stickRadius = this.joyRadius * 0.35;

    // Stick shadow
    this.joyStick.fillStyle(0x000000, 0.2);
    this.joyStick.fillCircle(x + 2, y + 2, stickRadius);

    // Stick
    this.joyStick.fillStyle(this.joyActive ? 0x8899cc : 0x6677aa, 0.8);
    this.joyStick.fillCircle(x, y, stickRadius);

    // Highlight
    this.joyStick.fillStyle(0xaabbdd, 0.3);
    this.joyStick.fillCircle(x - stickRadius * 0.2, y - stickRadius * 0.2, stickRadius * 0.5);
  }

  private drawBoostButton(x: number, y: number, r: number, pressed: boolean) {
    this.boostBg.clear();

    if (pressed) {
      this.boostBg.fillStyle(0xffaa00, 0.9);
      this.boostBg.fillCircle(x, y, r * 1.05);
      this.boostBg.lineStyle(3, 0xffdd44, 1);
    } else {
      this.boostBg.fillStyle(0xff8800, 0.6);
      this.boostBg.fillCircle(x, y, r);
      this.boostBg.lineStyle(3, 0xffcc00, 0.7);
    }
    this.boostBg.strokeCircle(x, y, r);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.joyBaseX;
    const dy = pointer.y - this.joyBaseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const clampedDist = Math.min(distance, this.joyRadius);
      const nx = dx / distance;
      const ny = dy / distance;

      const stickX = this.joyBaseX + nx * clampedDist;
      const stickY = this.joyBaseY + ny * clampedDist;
      this.drawJoyStick(stickX, stickY);

      // Normalize input to -1..1 range
      const normalizedX = (nx * clampedDist) / this.joyRadius;
      const normalizedY = (ny * clampedDist) / this.joyRadius;

      // Apply deadzone (ignore very small movements)
      const deadzone = 0.15;
      this.input.turnInput = Math.abs(normalizedX) > deadzone ? normalizedX : 0;
      // Invert Y: pushing up on screen = forward = positive throttle
      this.input.throttleInput = Math.abs(normalizedY) > deadzone ? -normalizedY : 0;
    } else {
      this.drawJoyStick(this.joyBaseX, this.joyBaseY);
      this.input.turnInput = 0;
      this.input.throttleInput = 0;
    }
  }

  getInput(): TouchInput {
    return this.input;
  }
}

/**
 * Detect if the device should use touch controls.
 * Returns true for tablets, phones, and touch-enabled devices.
 */
export function isTouchDevice(): boolean {
  // Check for touch support
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Check for mobile/tablet user agent patterns
  const ua = navigator.userAgent.toLowerCase();
  const mobileUA = /android|ipad|iphone|ipod|tablet|kindle|silk|playbook/.test(ua);

  // iPadOS 13+ reports as desktop Safari, but has touch
  const isiPad = hasTouch && /macintosh/.test(ua) && navigator.maxTouchPoints > 1;

  return hasTouch && (mobileUA || isiPad);
}
