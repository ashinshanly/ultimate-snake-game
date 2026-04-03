// Express + WebSocket server entry point
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const Game = require('./Game');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve client files
app.use(express.static(path.join(__dirname, '../client')));

const game = new Game();
const clients = new Map(); // ws -> playerId
let nextPlayerId = 1;

function getAlivePlayerCount() {
  let count = 0;
  for (const player of game.players.values()) {
    if (player.alive) count++;
  }
  return count;
}

wss.on('connection', (ws) => {
  const playerId = `p${nextPlayerId++}`;
  clients.set(ws, { id: playerId, joined: false });

  // Send initial stats on connect
  ws.send(JSON.stringify({ type: 'stats', players: getAlivePlayerCount() }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const client = clients.get(ws);

      switch (msg.type) {
        case 'join': {
          client.joined = true;
          const initData = game.addPlayer(playerId, msg.name);
          ws.send(JSON.stringify(initData));
          console.log(`[JOIN] ${msg.name} (${playerId}) — ${game.players.size} players`);
          
          // Broadcast to non-joined clients
          const pCount = getAlivePlayerCount();
          const statsMsg = JSON.stringify({ type: 'stats', players: pCount });
          for (const [otherWs, otherClient] of clients) {
            if (!otherClient.joined && otherWs.readyState === 1) {
              otherWs.send(statsMsg);
            }
          }
          break;
        }

        case 'input': {
          game.handleInput(playerId, msg);
          break;
        }

        case 'boost': {
          game.handleInput(playerId, { boost: msg.active });
          break;
        }

        case 'respawn': {
          const respawnData = game.respawnPlayer(playerId);
          if (respawnData) {
            ws.send(JSON.stringify(respawnData));
          }
          break;
        }
      }
    } catch (e) {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.joined) {
      game.removePlayer(playerId);
      console.log(`[LEAVE] ${playerId} — ${game.players.size} players`);
      
      // Broadcast to non-joined clients
      const pCount = getAlivePlayerCount();
      const statsMsg = JSON.stringify({ type: 'stats', players: pCount });
      for (const [otherWs, otherClient] of clients) {
        if (!otherClient.joined && otherWs.readyState === 1) {
          otherWs.send(statsMsg);
        }
      }
    }
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

// Game loop — fixed timestep with accumulator
const TICK_MS = 1000 / 30;     // 30Hz physics (was 60Hz — halved server load)
const SEND_RATE = 1000 / 15;   // 15Hz network sends (was 30Hz — halved bandwidth)
let lastTick = Date.now();
let lastSend = Date.now();
let accumulator = 0;
let leaderboardPending = false;

// Pre-allocate reusable JSON string buffer per player
const sendBuffers = new Map();

function gameLoop() {
  const now = Date.now();
  const frameTime = Math.min(now - lastTick, 100); // cap to avoid spiral
  lastTick = now;
  accumulator += frameTime;

  // Fixed timestep update
  while (accumulator >= TICK_MS) {
    const result = game.update();
    accumulator -= TICK_MS;

    if (result.leaderboardData) {
      leaderboardPending = true;
    }

    // Send death notifications immediately (low frequency, critical)
    for (const death of result.deaths) {
      for (const [ws, client] of clients) {
        if (ws.readyState !== 1) continue;
        if (client.id === death.id) {
          ws.send(JSON.stringify({
            type: 'death',
            data: {
              score: death.data.score,
              killCount: death.data.killCount,
              survivalTime: death.data.survivalTime,
              killedBy: death.killer ? game.players.get(death.killer)?.name || 'Unknown' : 'Self',
            },
          }));
        } else if (client.joined) {
          ws.send(JSON.stringify({
            type: 'playerDeath',
            id: death.id,
            x: death.data.segments[0]?.x || 0,
            y: death.data.segments[0]?.y || 0,
          }));
        }
      }
    }
  }

  // Send state updates at lower rate
  if (now - lastSend >= SEND_RATE) {
    lastSend = now;

    for (const [ws, client] of clients) {
      if (!client.joined || ws.readyState !== 1) continue;

      // Check bufferedAmount to avoid overwhelming slow connections
      if (ws.bufferedAmount > 16384) continue;

      const state = game.getStateForPlayer(client.id);
      if (state) {
        ws.send(JSON.stringify(state));
      }

      // Send leaderboard
      if (leaderboardPending) {
        const lb = game.getLeaderboardForPlayer(client.id);
        ws.send(JSON.stringify({ type: 'leaderboard', ...lb }));
      }
    }
    
    leaderboardPending = false;
  }

  // Use setTimeout instead of setImmediate to prevent CPU starvation
  const elapsed = Date.now() - now;
  const sleepMs = Math.max(1, Math.floor(TICK_MS / 2) - elapsed);
  setTimeout(gameLoop, sleepMs);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🐍 Neon Serpent server running on http://localhost:${PORT}`);
  gameLoop();
});
