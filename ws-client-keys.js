const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => { ws.send(JSON.stringify({ type: 'join', name: 'Tester' })); });
ws.on('message', (d) => {
  const msg = JSON.parse(d);
  if (msg.type === 'update') {
    console.log('UPDATE keys:', Object.keys(msg));
    if (msg.mm) console.log('MM array length:', msg.mm.length, 'first:', msg.mm[0]);
  } else if (msg.type === 'leaderboard') {
    console.log('LB keys:', Object.keys(msg));
  }
});
setTimeout(() => process.exit(0), 1000);
