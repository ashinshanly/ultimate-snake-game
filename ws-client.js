const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'join', name: 'Tester' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'leaderboard') {
    console.log('LEADERBOARD:', JSON.stringify(msg).substring(0, 100));
  } else if (msg.type === 'update') {
    console.log('UPDATE:', JSON.stringify(msg).substring(0, 100));
  }
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 2000);
