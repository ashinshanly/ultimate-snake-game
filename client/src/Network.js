// WebSocket networking — connection, state sync, prediction
export class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.onInit = null;
    this.onUpdate = null;
    this.onDeath = null;
    this.onPlayerDeath = null;
    this.onLeaderboard = null;
    this.onRespawn = null;
    this.onStats = null;
    this.lastInputTime = 0;
    this.inputThrottle = 33; // ~30Hz input send
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use environment variable for production URL, fallback to location.host for local dev
    const wsHost = import.meta.env.VITE_WS_URL || location.host;
    const url = `${protocol}//${wsHost}`;
    
    console.log(`Connecting to server: ${url}`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'init':
            this.playerId = msg.playerId;
            if (this.onInit) this.onInit(msg);
            break;
          case 'update':
            if (this.onUpdate) this.onUpdate(msg);
            break;
          case 'death':
            if (this.onDeath) this.onDeath(msg.data);
            break;
          case 'playerDeath':
            if (this.onPlayerDeath) this.onPlayerDeath(msg);
            break;
          case 'leaderboard':
            if (this.onLeaderboard) this.onLeaderboard(msg);
            break;
          case 'respawn':
            if (this.onRespawn) this.onRespawn(msg);
            break;
          case 'stats':
            if (this.onStats) this.onStats(msg);
            break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      // Auto-reconnect after 2s
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {};
  }

  join(name) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'join', name }));
  }

  sendInput(direction, boost) {
    if (!this.connected) return;
    const now = Date.now();
    if (now - this.lastInputTime < this.inputThrottle) return;
    this.lastInputTime = now;

    this.ws.send(JSON.stringify({
      type: 'input',
      dir: Math.round(direction * 100) / 100,
      boost,
    }));
  }

  sendBoost(active) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'boost', active }));
  }

  sendRespawn() {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({ type: 'respawn' }));
  }
}
