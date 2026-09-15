function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateRoundRobinPairs(teamIds) {
  const pairs = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push({ team1_id: teamIds[i], team2_id: teamIds[j] });
    }
  }
  return pairs;
}

// Orders matches so consecutive ones share no team, falling back to a repeat
// only when every remaining match involves a team that just played.
function scheduleAvoidingBackToBack(pairs) {
  const remaining = shuffle(pairs);
  const schedule = [];
  let lastTeams = new Set();

  while (remaining.length > 0) {
    let index = remaining.findIndex(
      (match) => !lastTeams.has(match.team1_id) && !lastTeams.has(match.team2_id)
    );
    if (index === -1) index = 0;

    const [chosen] = remaining.splice(index, 1);
    schedule.push(chosen);
    lastTeams = new Set([chosen.team1_id, chosen.team2_id]);
  }

  return schedule;
}

// Deals teams round-robin-style into `Math.ceil(teamIds.length / maxPerPool)`
// pools so sizes never differ by more than one and none exceeds maxPerPool.
function splitIntoPools(teamIds, maxPerPool) {
  const numPools = Math.ceil(teamIds.length / maxPerPool);
  const shuffled = shuffle(teamIds);
  const pools = Array.from({ length: numPools }, () => []);
  shuffled.forEach((teamId, i) => pools[i % numPools].push(teamId));
  return pools;
}

module.exports = { generateRoundRobinPairs, scheduleAvoidingBackToBack, splitIntoPools };
