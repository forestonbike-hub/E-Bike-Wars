import type { PlayerInput, GameState, GamePlayerState, Player } from "../../../shared/types.js";

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 1200;
const WALL_THICKNESS = 20;

// Bike physics constants (must match client Bike.ts for local prediction)
const MAX_SPEED = 250;
const ACCELERATION = 300;
const BRAKE_FORCE = 400;
const FRICTION = 100;
const TURN_SPEED = 3.5;
const BOOST_MAX_SPEED = 450;
const BOOST_ACCELERATION = 800;
const BOOST_DURATION = 300;
const BOOST_COOLDOWN = 5000;
const CRASH_DURATION = 1000; // 1 second stun on collision
const BIKE_RADIUS = 14;

interface ServerBike {
  id: string;
  name: string;
  colorIndex: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  isBoosting: boolean;
  boostTimer: number;
  boostCooldownTimer: number;
  isCrashed: boolean;
  crashTimer: number;
  // Last received input
  turnInput: number;
  throttleInput: number;
  boostInput: boolean;
}

// Obstacle definitions (must match client GameScene)
const OBSTACLES = [
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

export class GameLoop {
  private bikes: Map<string, ServerBike> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastTick: number = 0;
  private onStateUpdate: (state: GameState) => void;

  constructor(onStateUpdate: (state: GameState) => void) {
    this.onStateUpdate = onStateUpdate;
  }

  addPlayer(player: Player) {
    // Spread players around the arena center
    const count = this.bikes.size;
    const angle = (count / 8) * Math.PI * 2;
    const spawnRadius = 200;
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    const bike: ServerBike = {
      id: player.id,
      name: player.name,
      colorIndex: player.colorIndex,
      x: cx + Math.cos(angle) * spawnRadius,
      y: cy + Math.sin(angle) * spawnRadius,
      heading: angle + Math.PI, // face toward center
      speed: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldownTimer: 0,
      isCrashed: false,
      crashTimer: 0,
      turnInput: 0,
      throttleInput: 0,
      boostInput: false,
    };

    this.bikes.set(player.id, bike);
  }

  removePlayer(playerId: string) {
    this.bikes.delete(playerId);
  }

  handleInput(playerId: string, input: PlayerInput) {
    const bike = this.bikes.get(playerId);
    if (!bike) return;
    bike.turnInput = input.turnInput;
    bike.throttleInput = input.throttleInput;
    bike.boostInput = input.boostInput;
  }

  start() {
    this.lastTick = Date.now();
    // Run physics at 60fps, broadcast state at 20fps
    let broadcastCounter = 0;
    this.interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      this.updatePhysics(dt);

      broadcastCounter++;
      if (broadcastCounter >= 3) { // every 3rd tick at 60fps = ~20 broadcasts/sec
        broadcastCounter = 0;
        this.broadcastState();
      }
    }, 1000 / 60);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private crashBike(bike: ServerBike) {
    bike.isCrashed = true;
    bike.crashTimer = CRASH_DURATION;
    bike.speed = 0;
    bike.isBoosting = false;
    bike.boostTimer = 0;
  }

  private updatePhysics(dt: number) {
    for (const bike of this.bikes.values()) {
      // Crash recovery timer
      if (bike.isCrashed) {
        bike.crashTimer -= dt * 1000;
        if (bike.crashTimer <= 0) {
          bike.isCrashed = false;
          bike.crashTimer = 0;
        }
        // Crashed bikes can't move or act, skip all input/physics
        continue;
      }

      // Boost timers
      if (bike.isBoosting) {
        bike.boostTimer -= dt * 1000;
        if (bike.boostTimer <= 0) {
          bike.isBoosting = false;
          bike.boostCooldownTimer = BOOST_COOLDOWN;
        }
      } else if (bike.boostCooldownTimer > 0) {
        bike.boostCooldownTimer -= dt * 1000;
      }

      // Trigger boost
      if (bike.boostInput && !bike.isBoosting && bike.boostCooldownTimer <= 0 && bike.speed > 0) {
        bike.isBoosting = true;
        bike.boostTimer = BOOST_DURATION;
      }

      const currentMaxSpeed = bike.isBoosting ? BOOST_MAX_SPEED : MAX_SPEED;
      const currentAccel = bike.isBoosting ? BOOST_ACCELERATION : ACCELERATION;

      // Throttle
      if (bike.throttleInput > 0) {
        bike.speed += currentAccel * dt;
      } else if (bike.throttleInput < 0) {
        bike.speed -= BRAKE_FORCE * dt;
      } else {
        if (bike.speed > 0) {
          bike.speed = Math.max(0, bike.speed - FRICTION * dt);
        } else if (bike.speed < 0) {
          bike.speed = Math.min(0, bike.speed + FRICTION * dt);
        }
      }

      // Clamp speed
      bike.speed = Math.max(-MAX_SPEED * 0.3, Math.min(currentMaxSpeed, bike.speed));

      // Turn
      if (Math.abs(bike.speed) > 10) {
        const turnMultiplier = Math.min(1, Math.abs(bike.speed) / (MAX_SPEED * 0.5));
        bike.heading += bike.turnInput * TURN_SPEED * turnMultiplier * dt;
      }

      // Move
      const vx = Math.sin(bike.heading) * bike.speed * dt;
      const vy = -Math.cos(bike.heading) * bike.speed * dt;
      bike.x += vx;
      bike.y += vy;

      // Wall collisions (keep inside arena)
      const minX = WALL_THICKNESS + BIKE_RADIUS;
      const maxX = ARENA_WIDTH - WALL_THICKNESS - BIKE_RADIUS;
      const minY = WALL_THICKNESS + BIKE_RADIUS;
      const maxY = ARENA_HEIGHT - WALL_THICKNESS - BIKE_RADIUS;

      if (bike.x < minX) { bike.x = minX; bike.speed *= -0.3; }
      if (bike.x > maxX) { bike.x = maxX; bike.speed *= -0.3; }
      if (bike.y < minY) { bike.y = minY; bike.speed *= -0.3; }
      if (bike.y > maxY) { bike.y = maxY; bike.speed *= -0.3; }

      // Obstacle collisions (simple AABB)
      for (const obs of OBSTACLES) {
        const halfW = obs.w / 2 + BIKE_RADIUS;
        const halfH = obs.h / 2 + BIKE_RADIUS;

        if (
          bike.x > obs.x - halfW &&
          bike.x < obs.x + halfW &&
          bike.y > obs.y - halfH &&
          bike.y < obs.y + halfH
        ) {
          const overlapLeft = bike.x - (obs.x - halfW);
          const overlapRight = (obs.x + halfW) - bike.x;
          const overlapTop = bike.y - (obs.y - halfH);
          const overlapBottom = (obs.y + halfH) - bike.y;

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapLeft) bike.x = obs.x - halfW;
          else if (minOverlap === overlapRight) bike.x = obs.x + halfW;
          else if (minOverlap === overlapTop) bike.y = obs.y - halfH;
          else bike.y = obs.y + halfH;

          bike.speed *= -0.3;
        }
      }
    }

    // Bike-to-bike collisions: both bikes crash on contact
    const collisionDist = BIKE_RADIUS * 2;
    const bikeArray = Array.from(this.bikes.values());

    for (let i = 0; i < bikeArray.length; i++) {
      for (let j = i + 1; j < bikeArray.length; j++) {
        const a = bikeArray[i];
        const b = bikeArray[j];

        // Skip if either is already crashed
        if (a.isCrashed || b.isCrashed) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < collisionDist && dist > 0.001) {
          // Push bikes apart so they don't overlap while crashed
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = collisionDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Both bikes crash
          this.crashBike(a);
          this.crashBike(b);
        }
      }
    }
  }

  private broadcastState() {
    const players: GamePlayerState[] = [];
    for (const bike of this.bikes.values()) {
      players.push({
        id: bike.id,
        name: bike.name,
        colorIndex: bike.colorIndex,
        x: bike.x,
        y: bike.y,
        heading: bike.heading,
        speed: bike.speed,
        isBoosting: bike.isBoosting,
        isCrashed: bike.isCrashed,
      });
    }

    this.onStateUpdate({
      players,
      timestamp: Date.now(),
    });
  }
}
