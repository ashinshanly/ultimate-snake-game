// Power-up spawning, collection, and event management
class PowerUpManager {
  constructor(arenaSize = 6000) {
    this.powerUps = new Map();
    this.surgeZones = [];
    this.nextId = 0;
    this.arenaSize = arenaSize;
    this.maxPowerUps = 15;
    this.spawnInterval = 5000;
    this.lastSpawn = Date.now();
    this.surgeInterval = 30000;
    this.lastSurge = Date.now();
    this.newPowerUps = [];
    this.removedPowerUps = [];
    this.newSurges = [];
    this.removedSurges = [];
  }

  update(dt) {
    this.newPowerUps = [];
    this.removedPowerUps = [];
    this.newSurges = [];
    this.removedSurges = [];

    const now = Date.now();

    // Spawn power-ups periodically
    if (now - this.lastSpawn > this.spawnInterval && this.powerUps.size < this.maxPowerUps) {
      this._spawnPowerUp();
      this.lastSpawn = now;
    }

    // Dynamic energy surge zones
    if (now - this.lastSurge > this.surgeInterval) {
      this._createSurgeZone();
      this.lastSurge = now;
    }

    // Remove expired surge zones
    this.surgeZones = this.surgeZones.filter(zone => {
      if (now > zone.endTime) {
        this.removedSurges.push(zone.id);
        return false;
      }
      return true;
    });
  }

  _spawnPowerUp() {
    const types = ['magnet', 'phase'];
    const type = types[Math.floor(Math.random() * types.length)];
    const id = this.nextId++;
    const powerUp = {
      id,
      type,
      x: (Math.random() - 0.5) * this.arenaSize,
      y: (Math.random() - 0.5) * this.arenaSize,
      duration: type === 'magnet' ? 10000 : 5000,
    };
    this.powerUps.set(id, powerUp);
    this.newPowerUps.push(powerUp);
  }

  _createSurgeZone() {
    const id = this.nextId++;
    const zone = {
      id,
      x: (Math.random() - 0.5) * this.arenaSize * 0.7,
      y: (Math.random() - 0.5) * this.arenaSize * 0.7,
      radius: 300 + Math.random() * 200,
      endTime: Date.now() + 15000,
      orbBoost: 3,
    };
    this.surgeZones.push(zone);
    this.newSurges.push(zone);
  }

  checkCollection(snake) {
    const headX = snake.segments[0].x;
    const headY = snake.segments[0].y;
    const collectRadius = snake.headRadius + 20;
    const collected = [];

    for (const [id, pu] of this.powerUps) {
      const dx = headX - pu.x;
      const dy = headY - pu.y;
      if (dx * dx + dy * dy < collectRadius * collectRadius) {
        collected.push(pu);
        this.powerUps.delete(id);
        this.removedPowerUps.push(id);
      }
    }
    return collected;
  }

  isInSurgeZone(x, y) {
    for (const zone of this.surgeZones) {
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy < zone.radius * zone.radius) {
        return zone;
      }
    }
    return null;
  }

  getAll() {
    return {
      powerUps: Array.from(this.powerUps.values()),
      surgeZones: this.surgeZones,
    };
  }

  getDelta() {
    return {
      addedPowerUps: this.newPowerUps,
      removedPowerUps: this.removedPowerUps,
      addedSurges: this.newSurges,
      removedSurges: this.removedSurges,
    };
  }
}

module.exports = PowerUpManager;
