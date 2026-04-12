import Phaser from "phaser";

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Circle;
  private stick: Phaser.GameObjects.Circle;
  private maxDistance: number;
  private inputX: number = 0;
  private inputY: number = 0;
  private isActive: boolean = false;
  private pointerId: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
    this.scene = scene;
    this.maxDistance = radius;

    // Base circle (the outer ring)
    this.base = scene.add.circle(x, y, radius, 0x444466, 0.4);
    this.base.setStrokeStyle(2, 0x6666aa, 0.5);
    this.base.setScrollFactor(0);
    this.base.setDepth(100);

    // Stick (the inner movable circle)
    this.stick = scene.add.circle(x, y, radius * 0.4, 0x6688bb, 0.7);
    this.stick.setScrollFactor(0);
    this.stick.setDepth(101);

    // Make the base interactive with a larger hit area
    this.base.setInteractive(
      new Phaser.Geom.Circle(0, 0, radius * 1.5),
      Phaser.Geom.Circle.Contains
    );

    this.base.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.isActive = true;
      this.pointerId = pointer.id;
      this.updateStick(pointer);
    });

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isActive && pointer.id === this.pointerId) {
        this.updateStick(pointer);
      }
    });

    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.pointerId) {
        this.isActive = false;
        this.pointerId = -1;
        this.inputX = 0;
        this.inputY = 0;
        this.stick.setPosition(this.base.x, this.base.y);
      }
    });
  }

  private updateStick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const clampedDist = Math.min(distance, this.maxDistance);
      const nx = dx / distance;
      const ny = dy / distance;

      this.stick.setPosition(
        this.base.x + nx * clampedDist,
        this.base.y + ny * clampedDist
      );

      this.inputX = (nx * clampedDist) / this.maxDistance;
      // Invert Y: pushing up on screen = forward = negative screen Y but positive game throttle
      this.inputY = -(ny * clampedDist) / this.maxDistance;
    }
  }

  getInput(): { x: number; y: number } {
    return { x: this.inputX, y: this.inputY };
  }
}
