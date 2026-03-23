// Energy orb spawning and management
class OrbManager {
  constructor(arenaSize = 6000) {
    this.orbs = new Map();
    this.nextId = 0;
    this.arenaSize = arenaSize;
    this.maxOrbs = 800;
    this.newOrbs = [];
    this.removedOrbs = [];
  }

  init() {
    // Spawn initial orbs
    for (let i = 0; i < this.maxOrbs; i++) {
      this._spawnOrb();
    }
  }

  _spawnOrb(x, y, value) {
    const id = this.nextId++;
    const half = this.arenaSize / 2;
    const orb = {
      id,
      x: x !== undefined ? x : (Math.random() - 0.5) * this.arenaSize,
      y: y !== undefined ? y : (Math.random() - 0.5) * this.arenaSize,
      value: value || (Math.random() < 0.1 ? 3 : 1),
      type: Math.random() < 0.05 ? 'special' : 'normal',
      pulse: Math.random() * Math.PI * 2,
    };
    this.orbs.set(id, orb);
    this.newOrbs.push(orb);
    return orb;
  }

  update() {
    this.newOrbs = [];
    this.removedOrbs = [];

    // Maintain orb density
    while (this.orbs.size < this.maxOrbs) {
      this._spawnOrb();
    }
  }

  checkCollection(snake) {
    const collected = [];
    const headX = snake.segments[0].x;
    const headY = snake.segments[0].y;
    const collectRadius = snake.headRadius + 15;

    for (const [id, orb] of this.orbs) {
      const dx = headX - orb.x;
      const dy = headY - orb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet power-up increases collection radius
      const magnetRadius = snake.powerUps.magnet ? collectRadius * 3 : collectRadius;

      if (dist < magnetRadius) {
        collected.push(orb);
        this.orbs.delete(id);
        this.removedOrbs.push(id);
      }
    }
    return collected;
  }

  spawnDeathOrbs(segments) {
    // When a snake dies, drop orbs along its body
    const dropCount = Math.min(segments.length, 30);
    const step = Math.max(1, Math.floor(segments.length / dropCount));

    for (let i = 0; i < segments.length; i += step) {
      const seg = segments[i];
      this._spawnOrb(
        seg.x + (Math.random() - 0.5) * 20,
        seg.y + (Math.random() - 0.5) * 20,
        2
      );
    }
  }

  getAll() {
    return Array.from(this.orbs.values());
  }

  getDelta() {
    return {
      added: this.newOrbs,
      removed: this.removedOrbs,
    };
  }

  getInArea(x, y, radius) {
    const result = [];
    for (const orb of this.orbs.values()) {
      const dx = x - orb.x;
      const dy = y - orb.y;
      if (dx * dx + dy * dy < radius * radius) {
        result.push(orb);
      }
    }
    return result;
  }
}

module.exports = OrbManager;
