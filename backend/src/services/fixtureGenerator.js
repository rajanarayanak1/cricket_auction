const { generateRoundRobinPairs, scheduleAvoidingBackToBack, splitIntoPools } = require('./fixtureScheduler');
const { buildKnockoutRows, buildPoolPlayoffRows } = require('./tournamentEngine');

const POOL_MIN_TEAMS = 6;
const POOL_PLAYOFF_THRESHOLD = 4;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Validates the fixture format/pool config and builds the row shapes to
// insert — shared by "create a new tournament" (tournamentController) and
// "regenerate this tournament's fixtures" (fixtureController), so the two
// flows can never drift apart on validation rules.
//
// `twoTeamOptions` only ever applies to the round_robin/2-team case (it's
// simply ignored otherwise): a plain round-robin schedule between exactly 2
// teams is just the same single match every time, which is a poor default
// for a 2-team tournament, so callers may instead ask to either skip the
// league stage entirely (a direct Final) or repeat the pairing N times
// before the Final.
function buildFixtureRows(teamIds, type, maxTeamsPerPool, twoTeamOptions = {}) {
  if (!['round_robin', 'pool'].includes(type)) {
    throw httpError(400, 'type must be "round_robin" or "pool"');
  }
  if (teamIds.length < 2) {
    throw httpError(400, 'Add at least 2 teams before creating a fixture');
  }

  const rows = [];

  if (type === 'round_robin' && teamIds.length === 2 && twoTeamOptions.skipLeague) {
    // No league stage at all — the two teams are already known, so the Final
    // gets real team ids up front instead of the usual 'Rank 1'/'Rank 2'
    // placeholders (there's no standings table to resolve those against).
    rows.push({
      pool_name: null, match_order: 1, stage: 'final',
      team1_id: teamIds[0], team2_id: teamIds[1], team1_placeholder: null, team2_placeholder: null
    });
  } else if (type === 'round_robin' && teamIds.length === 2 && twoTeamOptions.leagueMatchCount > 1) {
    const count = twoTeamOptions.leagueMatchCount;
    if (!Number.isInteger(count)) {
      throw httpError(400, 'Number of league matches must be a whole number');
    }
    for (let i = 0; i < count; i++) {
      rows.push({ pool_name: null, match_order: i + 1, stage: 'league', team1_id: teamIds[0], team2_id: teamIds[1] });
    }
    rows.push(...buildKnockoutRows(teamIds.length));
  } else if (type === 'round_robin') {
    const matches = scheduleAvoidingBackToBack(generateRoundRobinPairs(teamIds));
    matches.forEach((match, i) => rows.push({ pool_name: null, match_order: i + 1, stage: 'league', ...match }));
    rows.push(...buildKnockoutRows(teamIds.length));
  } else {
    if (teamIds.length <= POOL_MIN_TEAMS) {
      throw httpError(400, `Pool play needs more than ${POOL_MIN_TEAMS} teams (currently ${teamIds.length})`);
    }
    const maxPerPool = Number(maxTeamsPerPool);
    if (!Number.isInteger(maxPerPool) || maxPerPool < 2) {
      throw httpError(400, 'Max teams per pool must be a whole number of at least 2');
    }
    const pools = splitIntoPools(teamIds, maxPerPool);
    if (pools.length < 2) {
      throw httpError(400, 'That max teams per pool only produces a single pool — lower it, or use Round Robin instead');
    }
    if (pools.some((p) => p.length < 2)) {
      throw httpError(400, 'That max teams per pool leaves a pool with only 1 team — choose a max that divides more evenly');
    }
    const poolNames = pools.map((_, poolIndex) => `Pool ${String.fromCharCode(65 + poolIndex)}`);
    pools.forEach((poolTeamIds, poolIndex) => {
      const matches = scheduleAvoidingBackToBack(generateRoundRobinPairs(poolTeamIds));
      matches.forEach((match, i) => rows.push({ pool_name: poolNames[poolIndex], match_order: i + 1, stage: 'league', ...match }));
    });
    if (pools.length > POOL_PLAYOFF_THRESHOLD) {
      rows.push(...buildPoolPlayoffRows(poolNames));
    }
  }

  return rows;
}

async function insertFixtureRows(conn, { tournamentId, auctionRoomId, type, rows }) {
  for (const row of rows) {
    await conn.query(
      `INSERT INTO fixtures (auction_room_id, tournament_id, fixture_type, pool_name, match_order, stage, team1_id, team2_id, team1_placeholder, team2_placeholder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auctionRoomId, tournamentId, type, row.pool_name, row.match_order, row.stage || 'league',
        row.team1_id ?? null, row.team2_id ?? null,
        row.team1_placeholder ?? null, row.team2_placeholder ?? null
      ]
    );
  }
}

module.exports = { POOL_MIN_TEAMS, POOL_PLAYOFF_THRESHOLD, buildFixtureRows, insertFixtureRows };
