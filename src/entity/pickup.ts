import { approach, chebyshev, distanceSquared } from '../core/math';
import type { ItemId } from '../data/items';
import { ENTITY } from '../data/tuning';
import type { Body } from '../systems/physics';
import { moveBody } from '../systems/physics';
import type { Inventory } from '../systems/inventory';
import { SpatialHash } from '../systems/spatialHash';
import type { World } from '../world/world';

/** A dropped item stack lying in the world. */
export class Pickup {
  public readonly body: Body;
  public age = 0;
  public alive = true;

  public constructor(
    public readonly item: ItemId,
    public count: number,
    x: number,
    y: number,
    vx = 0,
    vy = 0,
  ) {
    const size = ENTITY.pickupHalfSize * 2;
    this.body = { x, y, vx, vy, w: size, h: size, onGround: false };
  }

  public get centreX(): number {
    return this.body.x + this.body.w / 2;
  }

  public get centreY(): number {
    return this.body.y + this.body.h / 2;
  }
}

/** Owns dropped items, their physics, despawning and pickup queries. */
export class PickupManager {
  private readonly items: Pickup[] = [];
  private readonly hash = new SpatialHash<Pickup>(8);

  public spawn(item: ItemId, count: number, x: number, y: number, vx = 0, vy = 0): Pickup {
    const pickup = new Pickup(item, count, x, y, vx, vy);
    this.items.push(pickup);
    return pickup;
  }

  public get count(): number {
    return this.items.length;
  }

  public get all(): readonly Pickup[] {
    return this.items;
  }

  public update(world: World, playerX: number, playerY: number, dt: number): void {
    this.hash.clear();
    let write = 0;
    for (const pickup of this.items) {
      pickup.age += dt;
      pickup.body.vy = Math.min(
        pickup.body.vy + ENTITY.pickupGravity * dt,
        ENTITY.pickupMaxFallSpeed,
      );
      if (pickup.body.onGround) {
        pickup.body.vx = approach(pickup.body.vx, 0, ENTITY.pickupFriction * dt);
      }
      moveBody(world, pickup.body, dt);

      if (pickup.age > ENTITY.pickupLifetimeSeconds) pickup.alive = false;
      if (chebyshev(pickup.centreX, pickup.centreY, playerX, playerY) > ENTITY.despawnRadius) {
        pickup.alive = false;
      }

      if (pickup.alive) {
        this.items[write++] = pickup;
        this.hash.insert(pickup, pickup.body.x, pickup.body.y);
      }
    }
    this.items.length = write;
  }

  /** Sweeps up pickups within range of the player. Returns the number collected. */
  public collect(playerX: number, playerY: number, inventory: Inventory): number {
    const radius = ENTITY.pickupRadius;
    const candidates = this.hash.queryRect(
      playerX - radius,
      playerY - radius,
      playerX + radius,
      playerY + radius,
    );
    const radiusSq = radius * radius;
    let collected = 0;

    for (const pickup of candidates) {
      if (!pickup.alive) continue;
      if (distanceSquared(pickup.centreX, pickup.centreY, playerX, playerY) > radiusSq) continue;
      const leftover = inventory.addItem(pickup.item, pickup.count);
      pickup.count = leftover;
      if (leftover <= 0) {
        pickup.alive = false;
        collected++;
      }
    }

    if (collected > 0) {
      let write = 0;
      for (const pickup of this.items) {
        if (pickup.alive) this.items[write++] = pickup;
      }
      this.items.length = write;
    }
    return collected;
  }

  public clear(): void {
    this.items.length = 0;
    this.hash.clear();
  }
}
