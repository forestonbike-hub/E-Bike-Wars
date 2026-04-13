import Phaser from "phaser";

/**
 * Touch controls for tablet and phone players.
 *
 * Layout (landscape orientation):
 *   Left side:  Virtual joystick for steering + throttle
 *               Big NITRO button below the joystick
 *   Right side: Item slots (icons of purchased active items)
 *               USE button below the item slots
 *
 * All controls use generous safe margins (SAFE_PAD) to stay visible
 * even when browser chrome eats into the viewport on Kindle/tablet.
 */

const SAFE_PAD = 180; // px from edge on a 1920x1200 canvas

export interface TouchInput {
  turnInput: number;
  throttleInput: number;
  boostInput: boolean;
  useItem: boolean;        // USE button pressed this frame
  selectedSlot: number;    // which item slot is selected (-1 = none)
}

export interface ActiveItem {
  id: string;
  icon: string;
  name: string;
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

  // Nitro button
  private nitroBg: Phaser.GameObjects.Graphics;
  private nitroLabel: Phaser.GameObjects.Text;
  private nitroActive: boolean = false;

  // Item slots (right side)
  private items: ActiveItem[] = [];
  private selectedSlot: number = -1;
  private slotGraphics: Phaser.GameObjects.Graphics[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];

  // USE button
  private useBg: Phaser.GameObjects.Graphics;
  private useLabel: Phaser.GameObjects.Text;
  private usePressed: boolean = false;

  // Current input state
  private input: TouchInput = {
    turnInput: 0,
    throttleInput: 0,
    boostInput: false,
    useItem: false,
    selectedSlot: -1,
  };

  constructor(scene: Phaser.Scene, activeItems: ActiveItem[] = []) {
    this.scene = scene;
    this.items = activeItems;

    const w = scene.scale.width;
    const h = scene.scale.height;

    // ── LEFT SIDE: Joystick + Nitro ──

    this.joyRadius = 100; // fixed large radius for 1920x1200
    this.joyBaseX = SAFE_PAD + this.joyRadius;
    this.joyBaseY = h - SAFE_PAD - this.joyRadius - 60;

    // Joystick base
    this.joyBase = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.drawJoyBase();

    // Joystick stick
    this.joyStick = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.drawJoyStick(this.joyBaseX, this.joyBaseY);
    this.drawDirectionHints();

    // Nitro button below joystick
    const nitroW = this.joyRadius * 2.4;
    const nitroH = 60;
    const nitroX = this.joyBaseX;
    const nitroY = h - SAFE_PAD + 20;

    this.nitroBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.drawNitroButton(nitroX, nitroY, nitroW, nitroH, false);

    this.nitroLabel = scene.add.text(nitroX, nitroY, "NITRO", {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Joystick zone (left half of screen, above nitro)
    const joyZone = scene.add.zone(w * 0.25, h * 0.35, w * 0.5, h * 0.7)
      .setOrigin(0.5, 0.5)
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

    // Nitro zone
    const nitroZone = scene.add.zone(nitroX, nitroY, nitroW + 30, nitroH + 30)
      .setScrollFactor(0).setDepth(99).setInteractive();

    nitroZone.on("pointerdown", () => {
      this.nitroActive = true;
      this.input.boostInput = true;
      this.drawNitroButton(nitroX, nitroY, nitroW, nitroH, true);
    });
    nitroZone.on("pointerup", () => {
      this.nitroActive = false;
      this.input.boostInput = false;
      this.drawNitroButton(nitroX, nitroY, nitroW, nitroH, false);
    });
    nitroZone.on("pointerout", () => {
      this.nitroActive = false;
      this.input.boostInput = false;
      this.drawNitroButton(nitroX, nitroY, nitroW, nitroH, false);
    });

    // ── RIGHT SIDE: Item slots + USE button ──

    this.createItemSlots(w, h);

    // USE button at bottom-right
    const useW = 120;
    const useH = 60;
    const useX = w - SAFE_PAD;
    const useY = h - SAFE_PAD + 20;

    this.useBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.drawUseButton(useX, useY, useW, useH, false);

    this.useLabel = scene.add.text(useX, useY, "USE", {
      fontSize: "24px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const useZone = scene.add.zone(useX, useY, useW + 30, useH + 30)
      .setScrollFactor(0).setDepth(99).setInteractive();

    useZone.on("pointerdown", () => {
      this.usePressed = true;
      this.input.useItem = true;
      this.drawUseButton(useX, useY, useW, useH, true);
    });
    useZone.on("pointerup", () => {
      this.usePressed = false;
      this.input.useItem = false;
      this.drawUseButton(useX, useY, useW, useH, false);
    });
    useZone.on("pointerout", () => {
      this.usePressed = false;
      this.input.useItem = false;
      this.drawUseButton(useX, useY, useW, useH, false);
    });

    // Global pointer events for joystick
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

  private createItemSlots(w: number, h: number) {
    const slotSize = 64;
    const gap = 10;
    const startX = w - SAFE_PAD;
    const startY = 160; // below top HUD

    for (let i = 0; i < this.items.length; i++) {
      const y = startY + i * (slotSize + gap);

      const g = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
      this.drawSlot(g, startX, y, slotSize, false);
      this.slotGraphics.push(g);

      const label = this.scene.add.text(startX, y, this.items[i].icon, {
        fontSize: "32px",
        fontFamily: "Arial, sans-serif",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      this.slotTexts.push(label);

      const zone = this.scene.add.zone(startX, y, slotSize + 14, slotSize + 14)
        .setScrollFactor(0).setDepth(99).setInteractive();
      this.slotZones.push(zone);

      const idx = i;
      zone.on("pointerdown", () => {
        this.selectSlot(idx);
      });
    }
  }

  private selectSlot(index: number) {
    if (this.selectedSlot === index) {
      this.selectedSlot = -1;
      this.input.selectedSlot = -1;
    } else {
      this.selectedSlot = index;
      this.input.selectedSlot = index;
    }
    this.redrawSlots();
  }

  private redrawSlots() {
    const w = this.scene.scale.width;
    const slotSize = 64;
    const gap = 10;
    const startX = w - SAFE_PAD;
    const startY = 160;

    for (let i = 0; i < this.slotGraphics.length; i++) {
      const y = startY + i * (slotSize + gap);
      this.drawSlot(this.slotGraphics[i], startX, y, slotSize, i === this.selectedSlot);
    }
  }

  // ── Drawing helpers ──

  private drawJoyBase() {
    this.joyBase.clear();
    this.joyBase.lineStyle(4, 0x6666aa, 0.5);
    this.joyBase.strokeCircle(this.joyBaseX, this.joyBaseY, this.joyRadius);
    this.joyBase.fillStyle(0x333355, 0.35);
    this.joyBase.fillCircle(this.joyBaseX, this.joyBaseY, this.joyRadius);
  }

  private drawDirectionHints() {
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(100);
    const cx = this.joyBaseX;
    const cy = this.joyBaseY;
    const r = this.joyRadius;

    g.fillStyle(0x8888bb, 0.3);
    g.fillTriangle(cx - 8, cy - r + 22, cx + 8, cy - r + 22, cx, cy - r + 10);
    g.fillTriangle(cx - 8, cy + r - 22, cx + 8, cy + r - 22, cx, cy + r - 10);
    g.fillTriangle(cx - r + 22, cy - 8, cx - r + 22, cy + 8, cx - r + 10, cy);
    g.fillTriangle(cx + r - 22, cy - 8, cx + r - 22, cy + 8, cx + r - 10, cy);
  }

  private drawJoyStick(x: number, y: number) {
    this.joyStick.clear();
    const stickRadius = this.joyRadius * 0.35;
    this.joyStick.fillStyle(0x000000, 0.2);
    this.joyStick.fillCircle(x + 2, y + 2, stickRadius);
    this.joyStick.fillStyle(this.joyActive ? 0x8899cc : 0x6677aa, 0.8);
    this.joyStick.fillCircle(x, y, stickRadius);
    this.joyStick.fillStyle(0xaabbdd, 0.3);
    this.joyStick.fillCircle(x - stickRadius * 0.2, y - stickRadius * 0.2, stickRadius * 0.5);
  }

  private drawNitroButton(x: number, y: number, w: number, h: number, pressed: boolean) {
    this.nitroBg.clear();
    const hw = w / 2;
    const hh = h / 2;
    if (pressed) {
      this.nitroBg.fillStyle(0xffaa00, 0.9);
      this.nitroBg.fillRoundedRect(x - hw, y - hh, w, h, 10);
      this.nitroBg.lineStyle(3, 0xffdd44, 1);
    } else {
      this.nitroBg.fillStyle(0xff8800, 0.6);
      this.nitroBg.fillRoundedRect(x - hw, y - hh, w, h, 10);
      this.nitroBg.lineStyle(3, 0xffcc00, 0.7);
    }
    this.nitroBg.strokeRoundedRect(x - hw, y - hh, w, h, 10);
  }

  private drawUseButton(x: number, y: number, w: number, h: number, pressed: boolean) {
    this.useBg.clear();
    const hw = w / 2;
    const hh = h / 2;
    if (pressed) {
      this.useBg.fillStyle(0x22cc55, 0.9);
      this.useBg.fillRoundedRect(x - hw, y - hh, w, h, 12);
      this.useBg.lineStyle(3, 0x44ff77, 1);
    } else {
      this.useBg.fillStyle(0x229944, 0.6);
      this.useBg.fillRoundedRect(x - hw, y - hh, w, h, 12);
      this.useBg.lineStyle(3, 0x33cc55, 0.7);
    }
    this.useBg.strokeRoundedRect(x - hw, y - hh, w, h, 12);
  }

  private drawSlot(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, selected: boolean) {
    g.clear();
    const hs = size / 2;
    if (selected) {
      g.fillStyle(0x44aa66, 0.8);
      g.fillRoundedRect(x - hs, y - hs, size, size, 10);
      g.lineStyle(3, 0x66ff88, 1);
    } else {
      g.fillStyle(0x333355, 0.6);
      g.fillRoundedRect(x - hs, y - hs, size, size, 10);
      g.lineStyle(2, 0x6666aa, 0.6);
    }
    g.strokeRoundedRect(x - hs, y - hs, size, size, 10);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.joyBaseX;
    const dy = pointer.y - this.joyBaseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const clampedDist = Math.min(distance, this.joyRadius);
      const nx = dx / distance;
      const ny = dy / distance;

      this.drawJoyStick(this.joyBaseX + nx * clampedDist, this.joyBaseY + ny * clampedDist);

      const normalizedX = (nx * clampedDist) / this.joyRadius;
      const normalizedY = (ny * clampedDist) / this.joyRadius;

      const deadzone = 0.15;
      this.input.turnInput = Math.abs(normalizedX) > deadzone ? normalizedX : 0;
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

  /** Returns the item ID of the currently selected slot, or null */
  getSelectedItemId(): string | null {
    if (this.selectedSlot >= 0 && this.selectedSlot < this.items.length) {
      return this.items[this.selectedSlot].id;
    }
    return null;
  }

  /** Clear the use flag after it's been consumed */
  clearUse() {
    this.input.useItem = false;
  }
}

/**
 * Detect if the device should use touch controls.
 */
export function isTouchDevice(): boolean {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const ua = navigator.userAgent.toLowerCase();
  const mobileUA = /android|ipad|iphone|ipod|tablet|kindle|silk|playbook/.test(ua);
  const isiPad = hasTouch && /macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return hasTouch && (mobileUA || isiPad);
}
