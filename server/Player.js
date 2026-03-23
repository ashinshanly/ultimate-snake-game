// Player/Snake entity - server-side authoritative state
class Player {
  constructor(id, name, arenaSize = 6000) {
    this.id = id;
    this.name = name || 'Anonymous';
    this.alive = true;
    this.arenaSize = arenaSize;

    // Snake properties
    this.segments = [];
    this.direction = Math.random() * Math.PI * 2;
    this.targetDirection = this.direction;
    this.speed = 6;
    this.baseSpeed = 6;
    this.boostSpeed = 12;
    this.headRadius = 12;
    this.segmentSpacing = 8;
    this.turnRate = 0.12;
    this.initialLength = 10;

    // State
    this.boosting = false;
    this.score = 0;
    this.killCount = 0;
    this.maxLength = 0;
    this.spawnTime = Date.now();

    // Power-ups
    this.powerUps = {
      magnet: 0,
      phase: 0,
    };

    // Color (hue for neon theme)
    this.hue = Math.random() * 360;

    this._spawn();
  }

  _spawn() {
    this.segments = [];
    const half = this.arenaSize / 2;
    const x = (Math.random() - 0.5) * this.arenaSize * 0.6;
    const y = (Math.random() - 0.5) * this.arenaSize * 0.6;
    this.direction = Math.random() * Math.PI * 2;
    this.targetDirection = this.direction;
    this.alive = true;
    this.spawnTime = Date.now();
    this.boosting = false;

    // Create initial segments
    for (let i = 0; i < this.initialLength; i++) {
      this.segments.push({
        x: x - Math.cos(this.direction) * i * this.segmentSpacing,
        y: y - Math.sin(this.direction) * i * this.segmentSpacing,
      });
    }

    this.score = this.initialLength;
    this.powerUps = { magnet: 0, phase: 0 };
  }

  respawn() {
    this.killCount = 0;
    this.maxLength = 0;
    this._spawn();
  }

  setDirection(angle) {
    this.targetDirection = angle;
  }

  setBoost(val) {
    this.boosting = val && this.score > 20;
  }

  update(dt) {
    if (!this.alive) return;

    const now = Date.now();

    // Update power-up timers
    for (const key of Object.keys(this.powerUps)) {
      if (this.powerUps[key] > 0 && now > this.powerUps[key]) {
        this.powerUps[key] = 0;
      }
    }

    // Smooth turning
    let angleDiff = this.targetDirection - this.direction;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.direction += angleDiff * this.turnRate;

    // Speed
    if (this.boosting) {
      if (this.score > 20) {
        this.score -= 15 / 60; // Lose 15 mass per second
      } else {
        this.boosting = false;
      }
    }

    this.speed = this.boosting ? this.boostSpeed : this.baseSpeed;

    // Move head
    const head = this.segments[0];
    const newHead = {
      x: head.x + Math.cos(this.direction) * this.speed,
      y: head.y + Math.sin(this.direction) * this.speed,
    };

    // Arena boundary wrapping
    const half = this.arenaSize / 2;
    if (newHead.x > half) newHead.x = -half;
    if (newHead.x < -half) newHead.x = half;
    if (newHead.y > half) newHead.y = -half;
    if (newHead.y < -half) newHead.y = half;

    // Insert new head
    this.segments.unshift(newHead);



    // Maintain length
    while (this.segments.length > this.score) {
      this.segments.pop();
    }

    // Track max length
    if (this.segments.length > this.maxLength) {
      this.maxLength = this.segments.length;
    }
  }

  grow(amount = 1) {
    this.score += amount;
    // Dynamic head radius based on size
    this.headRadius = 12 + Math.min(this.score * 0.05, 8);
  }

  applyPowerUp(type, duration) {
    this.powerUps[type] = Date.now() + duration;
  }

  checkSelfCollision() {
    if (this.segments.length < 15 || this.powerUps.phase) return false;
    const head = this.segments[0];
    // Start checking from segment 10 onwards to avoid false positives
    for (let i = 10; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = head.x - seg.x;
      const dy = head.y - seg.y;
      if (dx * dx + dy * dy < this.headRadius * this.headRadius * 0.5) {
        return true;
      }
    }
    return false;
  }

  die() {
    this.alive = false;
    return {
      name: this.name,
      score: this.maxLength,
      killCount: this.killCount,
      survivalTime: Date.now() - this.spawnTime,
      segments: [...this.segments],
    };
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      segments: this.segments,
      direction: this.direction,
      boosting: this.boosting,
      score: this.score,
      hue: this.hue,
      headRadius: this.headRadius,
      alive: this.alive,
      powerUps: {
        magnet: this.powerUps.magnet > 0,
        phase: this.powerUps.phase > 0,
      },
    };
  }

  getCompactState() {
    // Send fewer segments for distant players
    return {
      id: this.id,
      name: this.name,
      segs: this.segments.map(s => [Math.round(s.x), Math.round(s.y)]),
      dir: Math.round(this.direction * 100) / 100,
      bst: this.boosting,
      sc: this.score,
      hue: this.hue,
      hr: Math.round(this.headRadius * 10) / 10,
      pu: this.powerUps.phase > 0 ? 2 : 0,
    };
  }
}

module.exports = Player;
