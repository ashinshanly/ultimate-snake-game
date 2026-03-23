// UI management — join screen, HUD, leaderboard, death screen, minimap
export class UI {
  constructor() {
    this.joinScreen = document.getElementById('join-screen');
    this.gameContainer = document.getElementById('game-container');
    this.deathScreen = document.getElementById('death-screen');
    this.nameInput = document.getElementById('player-name');
    this.playBtn = document.getElementById('play-btn');
    this.respawnBtn = document.getElementById('respawn-btn');
    this.scoreValue = document.getElementById('score-value');
    this.lbList = document.getElementById('lb-list');
    this.rankValue = document.getElementById('rank-value');
    this.boostBar = document.getElementById('boost-bar');
    this.powerupDisplay = document.getElementById('powerup-display');
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Death stats
    this.deathKiller = document.getElementById('death-killer');
    this.deathScore = document.getElementById('death-score');
    this.deathKills = document.getElementById('death-kills');
    this.deathTime = document.getElementById('death-time');

    this.currentScore = 0;
    this.displayScore = 0;

    // Join screen particles
    this._initBgParticles();
  }

  _initBgParticles() {
    const container = document.getElementById('bg-particles');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 4}px;
        height: ${2 + Math.random() * 4}px;
        background: ${Math.random() > 0.5 ? '#00f0ff' : '#ff00aa'};
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        opacity: ${0.1 + Math.random() * 0.3};
        animation: float ${5 + Math.random() * 10}s ease-in-out infinite ${Math.random() * 5}s;
        box-shadow: 0 0 ${4 + Math.random() * 8}px currentColor;
      `;
      container.appendChild(p);
    }

    // Add float animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translate(0, 0) scale(1); }
        25% { transform: translate(${Math.random() * 30 - 15}px, -30px) scale(1.2); }
        50% { transform: translate(${Math.random() * 30 - 15}px, 0) scale(0.8); }
        75% { transform: translate(${Math.random() * 30 - 15}px, 30px) scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }

  showJoin() {
    this.joinScreen.style.display = 'flex';
    this.gameContainer.style.display = 'none';
    this.deathScreen.style.display = 'none';
    this.nameInput.focus();
  }

  showGame() {
    this.joinScreen.style.display = 'none';
    this.gameContainer.style.display = 'block';
    this.deathScreen.style.display = 'none';
  }

  showDeath(data) {
    this.deathScreen.style.display = 'flex';
    this.deathKiller.textContent = data.killedBy || 'Self';
    this.deathScore.textContent = data.score || 0;
    this.deathKills.textContent = data.killCount || 0;

    const seconds = Math.floor((data.survivalTime || 0) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.deathTime.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  hideDeath() {
    this.deathScreen.style.display = 'none';
  }

  updateScore(score) {
    this.currentScore = score;
  }

  animateScore() {
    if (this.displayScore !== this.currentScore) {
      const diff = this.currentScore - this.displayScore;
      this.displayScore += Math.sign(diff) * Math.max(1, Math.abs(diff) * 0.2);
      if (Math.abs(this.displayScore - this.currentScore) < 1) {
        this.displayScore = this.currentScore;
      }
      this.scoreValue.textContent = Math.round(this.displayScore);
    }
  }

  updateLeaderboard(data) {
    if (!data) return;

    // Update top list
    let html = '';
    for (const entry of data.top) {
      const isSelf = data.playerRank && entry.rank === data.playerRank.rank;
      html += `
        <div class="lb-row ${isSelf ? 'self' : ''}">
          <span class="lb-rank">#${entry.rank}</span>
          <span class="lb-name">${this._escapeHtml(entry.name)}</span>
          <span class="lb-score">${entry.score}</span>
        </div>
      `;
    }
    
    if (data.playerRank && data.playerRank.rank > data.top.length) {
      html += `
        <div class="lb-row divider">
          <span>...</span>
        </div>
        <div class="lb-row self">
          <span class="lb-rank">#${data.playerRank.rank}</span>
          <span class="lb-name">You</span>
          <span class="lb-score">${data.playerRank.score}</span>
        </div>
      `;
    }
    
    this.lbList.innerHTML = html;

    // Update player rank
    if (data.playerRank) {
      this.rankValue.textContent = `#${data.playerRank.rank} / ${data.totalPlayers}`;
    }
  }

  updateBoost(length) {
    const boostReserve = Math.max(0, length - 20);
    const percent = Math.min(100, (boostReserve / Math.max(1, length)) * 100);
    this.boostBar.style.width = `${percent}%`;

    const boostButton = document.getElementById('mobile-boost-btn');
    if (boostButton) {
      boostButton.style.setProperty('--boost-charge', `${percent}%`);
      boostButton.classList.toggle('charged', percent > 0);
    }
  }

  updatePowerUps(powerUps) {
    if (!powerUps) return;
    let html = '';
    if (powerUps.magnet) html += '<div class="powerup-icon magnet">🧲</div>';
    if (powerUps.phase) html += '<div class="powerup-icon phase">👻</div>';
    this.powerupDisplay.innerHTML = html;
  }

  updateMinimap(selfPos, players, arenaSize) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const half = arenaSize / 2;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Map scale
    const scale = w / arenaSize;

    // Other players (dots)
    if (players) {
      for (const p of players) {
        let px, py;
        if (p.x !== undefined && p.y !== undefined) {
          px = p.x;
          py = p.y;
        } else {
          const segs = p.segs || p.segments;
          if (!segs || segs.length === 0) continue;
          px = Array.isArray(segs[0]) ? segs[0][0] : segs[0].x;
          py = Array.isArray(segs[0]) ? segs[0][1] : segs[0].y;
        }
        
        const mx = (px + half) * scale;
        const my = h - (py + half) * scale;
        
        ctx.fillStyle = `hsl(${p.hue || 0}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Self (larger, bright)
    if (selfPos) {
      const mx = (selfPos.x + half) * scale;
      const my = h - (selfPos.y + half) * scale;
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  updateStats(count) {
    const el = document.getElementById('online-count');
    if (el) {
      el.textContent = count;
    }
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
