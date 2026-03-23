// Client game manager — orchestrates rendering, networking, and input
import { Renderer } from './Renderer.js';
import { SnakeRenderer } from './Snake.js';
import { Arena } from './Arena.js';
import { OrbRenderer } from './Orbs.js';
import { Effects } from './Effects.js';
import { Input } from './Input.js';
import { Network } from './Network.js';
import { UI } from './UI.js';

export class Game {
  constructor() {
    this.renderer = null;
    this.snakeRenderer = null;
    this.arena = null;
    this.orbRenderer = null;
    this.effects = null;
    this.input = new Input();
    this.network = new Network();
    this.ui = new UI();

    this.state = 'menu'; // menu | playing | dead
    this.playerId = null;
    this.arenaSize = 6000;
    this.selfState = null;
    this.otherPlayers = [];
    this.lastLeaderboard = null;
    this.lastBoost = false;

    this._setupCallbacks();
  }

  _setupCallbacks() {
    // Play button
    this.ui.playBtn.addEventListener('click', () => this._onPlay());
    this.ui.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onPlay();
    });

    // Respawn button
    this.ui.respawnBtn.addEventListener('click', () => this._onRespawn());

    // Network callbacks
    this.network.onInit = (data) => this._onInit(data);
    this.network.onUpdate = (data) => this._onUpdate(data);
    this.network.onDeath = (data) => this._onDeath(data);
    this.network.onPlayerDeath = (data) => this._onPlayerDeath(data);
    this.network.onLeaderboard = (data) => this._onLeaderboard(data);
    this.network.onRespawn = (data) => this._onRespawnResponse(data);
    this.network.onStats = (data) => {
      this.ui.updateStats(data.players);
    };
  }

  start() {
    // Connect to server
    this.network.connect();
    this.ui.showJoin();
  }

  _onPlay() {
    const name = this.ui.nameInput.value.trim() || 'Anonymous';
    if (!this.network.connected) return;

    // Initialize Three.js scene
    if (!this.renderer) {
      const canvas = document.getElementById('game-canvas');
      this.renderer = new Renderer(canvas);
      this.snakeRenderer = new SnakeRenderer(this.renderer.getScene());
      this.arena = new Arena(this.renderer.getScene(), this.arenaSize);
      this.orbRenderer = new OrbRenderer(this.renderer.getScene());
      this.effects = new Effects(this.renderer.getScene());
    }

    this.network.join(name);
    this.ui.showGame();
    this.input.show();
    this.state = 'playing';

    // Start game loop
    this._loop();
  }

  _onInit(data) {
    this.playerId = data.playerId;
    this.arenaSize = data.arenaSize || 6000;
    this.selfState = data.selfState;

    // Initial orbs
    if (data.orbs) {
      this.orbRenderer.updateOrbs(data.orbs.map(o => [o.id, o.x, o.y, o.value, o.type === 'special' ? 1 : 0]));
    }

    // Initial players
    if (data.players) {
      for (const p of data.players) {
        this.snakeRenderer.updateSnake(p, false);
      }
    }

    // Render self
    if (this.selfState) {
      this.snakeRenderer.updateSnake(this.selfState, true);
    }
  }

  _onUpdate(data) {
    if (this.state !== 'playing') return;

    // Update self
    if (data.self) {
      this.selfState = data.self;
      this.snakeRenderer.updateSnake(data.self, true);
      this.ui.updateScore(data.self.sc || data.self.score || 0);

      // Camera follow
      const segs = data.self.segs || data.self.segments;
      if (segs && segs.length > 0) {
        const hx = Array.isArray(segs[0]) ? segs[0][0] : segs[0].x;
        const hy = Array.isArray(segs[0]) ? segs[0][1] : segs[0].y;
        this.renderer.setCameraTarget(hx, hy, data.self.sc || data.self.score || 10);
      }

      // Update boost bar and power-ups
      this.ui.updateBoost(data.self.sc || data.self.score || 0);
      this.ui.updatePowerUps(data.self.pu ? {
        phase: data.self.pu === 2,
        magnet: false,
      } : null);
    }

    // Update other players
    const activeIds = new Set();
    if (data.players) {
      for (const p of data.players) {
        activeIds.add(p.id);
        this.snakeRenderer.updateSnake(p, false);
      }
    }
    if (this.selfState) activeIds.add(this.selfState.id);

    // Remove players no longer visible
    const existingIds = this.snakeRenderer.getActiveIds();
    for (const id of existingIds) {
      if (!activeIds.has(id)) {
        this.snakeRenderer.removeSnake(id);
      }
    }

    // Update orbs
    if (data.orbs) {
      this.orbRenderer.updateOrbs(data.orbs);
    }

    // Handle power-up deltas
    if (data.pu) {
      if (data.pu.addedSurges) {
        for (const surge of data.pu.addedSurges) {
          this.effects.addSurgeZone(surge);
        }
      }
      if (data.pu.removedSurges) {
        for (const id of data.pu.removedSurges) {
          this.effects.removeSurgeZone(id);
        }
      }
    }

    // Update real-time minimap (30Hz)
    if (this.selfState && data.mm) {
      const segs = this.selfState.segs || this.selfState.segments;
      const selfPos = segs && segs.length > 0 ? {
        x: Array.isArray(segs[0]) ? segs[0][0] : segs[0].x,
        y: Array.isArray(segs[0]) ? segs[0][1] : segs[0].y,
      } : null;
      
      const minimapPlayers = data.mm.map(p => ({
        id: p[0], x: p[1], y: p[2], hue: p[3]
      }));
      
      this.ui.updateMinimap(selfPos, minimapPlayers, this.arenaSize);
    }
  }

  _onDeath(data) {
    this.state = 'dead';
    this.ui.showDeath(data);
    this.input.hide();

    // Create explosion at death position
    if (this.selfState) {
      const segs = this.selfState.segs || this.selfState.segments;
      if (segs && segs.length > 0) {
        const x = Array.isArray(segs[0]) ? segs[0][0] : segs[0].x;
        const y = Array.isArray(segs[0]) ? segs[0][1] : segs[0].y;
        this.effects.createDeathExplosion(x, y, this.selfState.hue || 0);
      }
    }
  }

  _onPlayerDeath(data) {
    this.effects.createDeathExplosion(data.x, data.y, 0);
    this.snakeRenderer.removeSnake(data.id);
  }

  _onLeaderboard(data) {
    this.lastLeaderboard = data;
    this.ui.updateLeaderboard(data);
  }

  _onRespawn() {
    this.network.sendRespawn();
    this.ui.hideDeath();
    this.input.show();
    this.state = 'playing';
  }

  _onRespawnResponse(data) {
    if (data.selfState) {
      this.selfState = data.selfState;
      this.snakeRenderer.updateSnake(data.selfState, true);
    }
  }

  _loop() {
    if (this.state === 'menu') return;

    requestAnimationFrame(() => this._loop());

    const now = performance.now();

    // Send input to server
    if (this.state === 'playing') {
      const inputState = this.input.getState();
      this.network.sendInput(inputState.direction, inputState.boosting);

      // Send boost state change
      if (inputState.boosting !== this.lastBoost) {
        this.network.sendBoost(inputState.boosting);
        this.lastBoost = inputState.boosting;
      }
    }

    // Update visuals
    this.ui.animateScore();
    if (this.arena) this.arena.update(now);
    if (this.orbRenderer) this.orbRenderer.update(now);
    if (this.effects) this.effects.update(now);

    // Render
    if (this.renderer) this.renderer.render();
  }
}
