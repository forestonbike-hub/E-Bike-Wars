import Phaser from "phaser";

export interface BikeConfig {
  x: number;
  y: number;
  color: number;
  name: string;
}

export class Bike extends Phaser.GameObjects.Container {
  // Physics
  private speed: number = 0;
  private maxSpeed: number = 250;
  private acceleration: number = 300;
  private brakeForce: number = 400;
  private friction: number = 100;
  private turnSpeed: number = 3.5;
  private heading: number = 0; // radians

  // Boost
  private boostMaxSpeed: number = 450;
  private boostAcceleration: number = 800;
  private boostDuration: number = 300; // ms
  private boostCooldown: number = 5000; // ms
  private boostTimer: number = 0;
  private boostCooldownTimer: number = 0;
  private isBoosting: boolean = false;

  // Visual components
  private bikeBody: Phaser.GameObjects.Graphics;
  private nameLabel: Phaser.GameObjects.Text;
  private boostTrail: Phaser.GameObjects.Graphics;

  // Input state (set externally)
  public turnInput: number = 0; // -1 left, 0 straight, 1 right
  public throttleInput: number = 0; // -1 brake, 0 coast, 1 accelerate
  public boostInput: boolean = false;

  constructor(scene: Phaser.Scene, config: BikeConfig) {
    super(scene, config.x, config.y);

    // Boost trail (drawn behind the bike)
    this.boostTrail = new Phaser.GameObjects.Graphics(scene);
    this.add(this.boostTrail);

    // Bike body
    this.bikeBody = new Phaser.GameObjects.Graphics(scene);
    this.drawBike(config.color);
    this.add(this.bikeBody);

    // Name label
    this.nameLabel = new Phaser.GameObjects.Text(scene, 0, -30, config.name, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Set container size for physics
    this.setSize(20, 36);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0.3);
    body.setDrag(0);
  }

  private drawBike(color: number) {
    this.bikeBody.clear();

    // Main body (elongated shape pointing up)
    this.bikeBody.fillStyle(color, 1);
    this.bikeBody.fillRoundedRect(-10, -18, 20, 36, 6);

    // Direction indicator (front triangle)
    this.bikeBody.fillStyle(0xffffff, 0.9);
    this.bikeBody.fillTriangle(-5, -14, 5, -14, 0, -22);

    // Dark outline
    this.bikeBody.lineStyle(2, 0x222222, 1);
    this.bikeBody.strokeRoundedRect(-10, -18, 20, 36, 6);
  }

  public getBoostCooldownPercent(): number {
    if (this.boostCooldownTimer <= 0) return 1;
    return 1 - this.boostCooldownTimer / this.boostCooldown;
  }

  public getSpeedPercent(): number {
    return Math.abs(this.speed) / this.boostMaxSpeed;
  }

  public getIsBoosting(): boolean {
    return this.isBoosting;
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    // Update boost timers
    if (this.isBoosting) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.isBoosting = false;
        this.boostCooldownTimer = this.boostCooldown;
      }
    } else if (this.boostCooldownTimer > 0) {
      this.boostCooldownTimer -= delta;
    }

    // Trigger boost
    if (this.boostInput && !this.isBoosting && this.boostCooldownTimer <= 0 && this.speed > 0) {
      this.isBoosting = true;
      this.boostTimer = this.boostDuration;
    }

    // Calculate current max speed and acceleration
    const currentMaxSpeed = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
    const currentAccel = this.isBoosting ? this.boostAcceleration : this.acceleration;

    // Apply throttle
    if (this.throttleInput > 0) {
      this.speed += currentAccel * dt;
    } else if (this.throttleInput < 0) {
      this.speed -= this.brakeForce * dt;
    } else {
      // Coast: apply friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction * dt);
      }
    }

    // Clamp speed
    this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed * 0.3, currentMaxSpeed);

    // Turn (only when moving)
    if (Math.abs(this.speed) > 10) {
      const turnMultiplier = Math.min(1, Math.abs(this.speed) / (this.maxSpeed * 0.5));
      this.heading += this.turnInput * this.turnSpeed * turnMultiplier * dt;
    }

    // Apply velocity based on heading
    const vx = Math.sin(this.heading) * this.speed;
    const vy = -Math.cos(this.heading) * this.speed;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(vx, vy);

    // Rotate visual to match heading
    this.rotation = this.heading;

    // Draw boost trail
    this.boostTrail.clear();
    if (this.isBoosting) {
      this.boostTrail.fillStyle(0xff8800, 0.6);
      this.boostTrail.fillCircle(-4, 22, 4 + Math.random() * 3);
      this.boostTrail.fillCircle(4, 22, 4 + Math.random() * 3);
      this.boostTrail.fillStyle(0xffcc00, 0.4);
      this.boostTrail.fillCircle(0, 26, 3 + Math.random() * 2);
    } else if (this.speed > this.maxSpeed * 0.7) {
      this.boostTrail.fillStyle(0xcccccc, 0.3);
      this.boostTrail.fillCircle(0, 22, 2);
    }

    // Keep name label upright (counteract container rotation)
    this.nameLabel.rotation = -this.heading;
  }
}
