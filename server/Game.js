// Core game loop and state management
const Player = require('./Player');
const SpatialGrid = require('./SpatialGrid');
const Leaderboard = require('./Leaderboard');
const OrbManager = require('./OrbManager');
const PowerUpManager = require('./PowerUpManager');

class Game {
  constructor() {
    this.arenaSize = 6000;
    this.players = new Map();
    this.spatialGrid = new SpatialGrid(200);
    this.leaderboard = new Leaderboard();
    this.orbManager = new OrbManager(this.arenaSize);
    this.powerUpManager = new PowerUpManager(this.arenaSize);
    this.tickRate = 1000 / 30; // Match server tick rate
    this.leaderboardInterval = 500; // Update leaderboard every 500ms (was 100ms)
    this.lastLeaderboardUpdate = 0;
    this.viewRadius = 1500; // Reduced from 2000 — less data per update
    this.compactStateCache = new Map();
    this.minimapCache = [];

    // Delta tracking for orbs — only send changes, not full state
    this._lastOrbSnapshot = new Map(); // playerId -> Set of orb ids sent

    this.orbManager.init();
  }

  addPlayer(id, name) {
    const player = new Player(id, name, this.arenaSize);
    this.players.set(id, player);

    return {
      type: 'init',
      playerId: id,
      arenaSize: this.arenaSize,
      orbs: this.orbManager.getInArea(
        player.segments[0].x,
        player.segments[0].y,
        this.viewRadius
      ),
      powerUps: this.powerUpManager.getAll(),
      players: this._getPlayersInArea(
        player.segments[0].x,
        player.segments[0].y,
        this.viewRadius,
        id
      ),
      selfState: player.getCompactState(),
    };
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (player && player.alive) {
      this.orbManager.spawnDeathOrbs(player.segments);
    }
    this.players.delete(id);
    this._lastOrbSnapshot.delete(id);
  }

  handleInput(id, data) {
    const player = this.players.get(id);
    if (!player || !player.alive) return;

    if (data.dir !== undefined) {
      player.setDirection(data.dir);
    }
    if (data.boost !== undefined) {
      player.setBoost(data.boost);
    }
  }

  respawnPlayer(id) {
    const player = this.players.get(id);
    if (player) {
      player.respawn();
      this._lastOrbSnapshot.delete(id);
      return {
        type: 'respawn',
        selfState: player.getCompactState(),
        orbs: this.orbManager.getInArea(
          player.segments[0].x,
          player.segments[0].y,
          this.viewRadius
        ),
      };
    }
    return null;
  }

  update() {
    const now = Date.now();

    // Update all players
    for (const [id, player] of this.players) {
      player.update(this.tickRate);
    }

    // Build spatial grid for collision detection
    this.spatialGrid.clear();
    for (const [id, player] of this.players) {
      if (!player.alive) continue;
      // Only insert head + every 3rd segment for collision (huge perf win)
      for (let i = 0; i < player.segments.length; i++) {
        if (i > 0 && i % 3 !== 0) continue;
        this.spatialGrid.insertSegment({
          playerId: id,
          segIndex: i,
          x: player.segments[i].x,
          y: player.segments[i].y,
        });
      }
    }

    // Check collisions
    const deaths = [];
    for (const [id, player] of this.players) {
      if (!player.alive) continue;

      // Self collision
      if (player.checkSelfCollision()) {
        const deathData = player.die();
        this.orbManager.spawnDeathOrbs(deathData.segments);
        deaths.push({ id, data: deathData, killer: null });
        continue;
      }

      // Collision with other snakes
      const head = player.segments[0];
      const nearby = this.spatialGrid.query(head.x, head.y, player.headRadius + 20);

      for (const seg of nearby) {
        if (seg.playerId === id) continue;
        if (player.powerUps.phase > 0) continue;

        const otherPlayer = this.players.get(seg.playerId);
        if (!otherPlayer || !otherPlayer.alive) continue;

        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        const distSq = dx * dx + dy * dy;
        const collisionDist = player.headRadius + 6;

        if (distSq < collisionDist * collisionDist) {
          const deathData = player.die();
          this.orbManager.spawnDeathOrbs(deathData.segments);
          otherPlayer.killCount++;
          deaths.push({ id, data: deathData, killer: seg.playerId });
          break;
        }
      }
    }

    // Check orb collection
    for (const [id, player] of this.players) {
      if (!player.alive) continue;

      const collected = this.orbManager.checkCollection(player);
      for (const orb of collected) {
        const surge = this.powerUpManager.isInSurgeZone(orb.x, orb.y);
        const value = surge ? orb.value * surge.orbBoost : orb.value;
        player.grow(value);
      }

      // Check power-up collection
      const powerUps = this.powerUpManager.checkCollection(player);
      for (const pu of powerUps) {
        player.applyPowerUp(pu.type, pu.duration);
      }
    }

    // Update managers
    this.orbManager.update();
    this.powerUpManager.update(this.tickRate);
    this._rebuildStateCaches();

    // Update leaderboard
    let leaderboardData = null;
    if (now - this.lastLeaderboardUpdate > this.leaderboardInterval) {
      this.leaderboard.update(this.players);
      this.lastLeaderboardUpdate = now;
      leaderboardData = true;
    }

    return { deaths, leaderboardData };
  }

  getStateForPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    const head = player.alive ? player.segments[0] : { x: 0, y: 0 };

    // Get nearby players (area of interest filtering)
    const nearbyPlayers = this._getPlayersInArea(head.x, head.y, this.viewRadius, playerId);

    // Get nearby orbs — compact format
    const nearbyOrbs = this.orbManager.getInArea(head.x, head.y, this.viewRadius);
    const orbArray = [];
    for (let i = 0; i < nearbyOrbs.length; i++) {
      const o = nearbyOrbs[i];
      orbArray.push([o.id, o.x | 0, o.y | 0, o.value, o.type === 'special' ? 1 : 0]);
    }

    const puDelta = this.powerUpManager.getDelta();

    return {
      type: 'update',
      self: this.compactStateCache.get(playerId) || player.getCompactState(),
      players: nearbyPlayers,
      orbs: orbArray,
      pu: puDelta,
      mm: this.minimapCache
    };
  }

  getLeaderboardForPlayer(playerId) {
    return this.leaderboard.getLeaderboardData(playerId);
  }

  _getPlayersInArea(x, y, radius, excludeId) {
    const result = [];
    const r2 = radius * radius;
    for (const [id, player] of this.players) {
      if (id === excludeId || !player.alive) continue;
      const head = player.segments[0];
      const dx = x - head.x;
      const dy = y - head.y;
      if (dx * dx + dy * dy < r2) {
        result.push(this.compactStateCache.get(id) || player.getCompactState());
      }
    }
    return result;
  }

  _rebuildStateCaches() {
    this.compactStateCache.clear();
    this.minimapCache.length = 0;

    for (const [id, player] of this.players) {
      if (!player.alive || player.segments.length === 0) continue;
      const compact = player.getCompactState();
      this.compactStateCache.set(id, compact);
      this.minimapCache.push([
        id,
        player.segments[0].x | 0,
        player.segments[0].y | 0,
        player.hue | 0
      ]);
    }
  }
}

module.exports = Game;
