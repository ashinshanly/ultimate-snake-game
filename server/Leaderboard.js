// Real-time ranking system
class Leaderboard {
  constructor() {
    this.rankings = [];
    this.lastBroadcast = null;
  }

  update(players) {
    const activePlayers = [];
    for (const [id, player] of players) {
      if (player.alive) {
        activePlayers.push({
          id,
          name: player.name,
          score: player.segments.length,
          survivalTime: Date.now() - player.spawnTime,
        });
      }
    }

    // Sort by score (desc), then survival time (desc) as tiebreaker
    activePlayers.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.survivalTime - a.survivalTime;
    });

    // Assign ranks
    for (let i = 0; i < activePlayers.length; i++) {
      activePlayers[i].rank = i + 1;
    }

    this.rankings = activePlayers;
    return this.rankings;
  }

  getTop(n = 10) {
    return this.rankings.slice(0, n).map(p => ({
      rank: p.rank,
      name: p.name,
      score: p.score,
    }));
  }

  getPlayerRank(playerId) {
    const entry = this.rankings.find(p => p.id === playerId);
    return entry ? {
      rank: entry.rank,
      total: this.rankings.length,
      score: entry.score,
    } : null;
  }

  getLeaderboardData(playerId) {
    return {
      top: this.getTop(10),
      playerRank: this.getPlayerRank(playerId),
      totalPlayers: this.rankings.length,
    };
  }
}

module.exports = Leaderboard;
