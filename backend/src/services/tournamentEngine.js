const pool = require('../config/db');
const { generateRoundRobinPairs, scheduleAvoidingBackToBack } = require('./fixtureScheduler');

const KNOCKOUT_THRESHOLD = 6;

// Appends Semi Final (1v4, 2v3) + Final placeholders when there are more than
// KNOCKOUT_THRESHOLD teams/pool-winners, or just a Final placeholder otherwise.
function buildKnockoutRows(contenderCount) {
  const rows = [];
  if (contenderCount <= KNOCKOUT_THRESHOLD) {
    rows.push({
      pool_name: 'Final', match_order: 1, stage: 'final',
      team1_id: null, team2_id: null, team1_placeholder: 'Rank 1', team2_placeholder: 'Rank 2'
    });
  } else {
    rows.push({
      pool_name: 'Semi Final', match_order: 1, stage: 'semifinal',
      team1_id: null, team2_id: null, team1_placeholder: 'Rank 1', team2_placeholder: 'Rank 4'
    });
    rows.push({
      pool_name: 'Semi Final', match_order: 2, stage: 'semifinal',
      team1_id: null, team2_id: null, team1_placeholder: 'Rank 2', team2_placeholder: 'Rank 3'
    });
    rows.push({
      pool_name: 'Final', match_order: 1, stage: 'final',
      team1_id: null, team2_id: null, team1_placeholder: 'Winner SF1', team2_placeholder: 'Winner SF2'
    });
  }
  return rows;
}

// Round-robin among each pool's eventual winner (identified only by pool name
// until the pool stage finishes), plus the same knockout stage on top.
function buildPoolPlayoffRows(poolNames) {
  const rows = [];
  const pairs = scheduleAvoidingBackToBack(generateRoundRobinPairs(poolNames.map((_, i) => i)));
  pairs.forEach((pair, i) => {
    rows.push({
      pool_name: 'Play-offs', match_order: i + 1, stage: 'pool_playoff',
      team1_id: null, team2_id: null,
      team1_placeholder: `${poolNames[pair.team1_id]} Winner`,
      team2_placeholder: `${poolNames[pair.team2_id]} Winner`
    });
  });
  rows.push(...buildKnockoutRows(poolNames.length));
  return rows;
}

// Computes points/NRR standings from an explicit list of fixture rows (each
// already carrying match_status/winner_team_id/result_type), scoped to
// whichever stage or pool the caller wants ranked.
async function standingsForFixtures(fixtureRows) {
  const completed = fixtureRows.filter((f) => f.match_status === 'completed');
  if (completed.length === 0) return [];

  const fixtureIds = completed.map((f) => f.id);
  const [innings] = await pool.query('SELECT * FROM match_innings WHERE fixture_id IN (?)', [fixtureIds]);

  const table = {};
  const ensure = (teamId) => {
    if (!table[teamId]) {
      table[teamId] = {
        team_id: teamId, played: 0, won: 0, lost: 0, tied: 0, points: 0,
        runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0
      };
    }
    return table[teamId];
  };

  for (const fx of completed) {
    const row1 = ensure(fx.team1_id);
    const row2 = ensure(fx.team2_id);
    row1.played += 1;
    row2.played += 1;
    if (fx.result_type === 'tie') {
      row1.tied += 1;
      row2.tied += 1;
      row1.points += 1;
      row2.points += 1;
    } else if (fx.winner_team_id === fx.team1_id) {
      row1.won += 1;
      row2.lost += 1;
      row1.points += 2;
    } else if (fx.winner_team_id === fx.team2_id) {
      row2.won += 1;
      row1.lost += 1;
      row2.points += 2;
    }

    innings
      .filter((inn) => inn.fixture_id === fx.id)
      .forEach((inn) => {
        const battingRow = ensure(inn.batting_team_id);
        const bowlingRow = ensure(inn.bowling_team_id);
        const oversValue = inn.all_out ? inn.overs_limit : inn.total_balls / 6;
        battingRow.runsFor += inn.total_runs;
        battingRow.oversFor += oversValue;
        bowlingRow.runsAgainst += inn.total_runs;
        bowlingRow.oversAgainst += oversValue;
      });
  }

  const rows = Object.values(table).map((row) => {
    const rateFor = row.oversFor > 0 ? row.runsFor / row.oversFor : 0;
    const rateAgainst = row.oversAgainst > 0 ? row.runsAgainst / row.oversAgainst : 0;
    return { ...row, nrr: rateFor - rateAgainst };
  });

  rows.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  return rows;
}

// Fills in real team_ids on the next stage's placeholder fixtures as soon as
// the stage feeding them finishes. Safe to call after every match — it's a
// no-op unless a stage just became fully complete. Scoped strictly by
// tournament_id (never auction_room_id) — a room can have many tournaments
// over time reusing the same pool_name/placeholder-label conventions (e.g.
// "Pool A", "Rank 1"), so room-wide scoping here would let an old, already
// finished tournament's fixtures leak into a new one's bracket resolution.
async function maybeAdvanceTournament(tournamentId) {
  const [allFixtures] = await pool.query('SELECT * FROM fixtures WHERE tournament_id = ?', [tournamentId]);
  if (allFixtures.length === 0) return;

  const leagueFixtures = allFixtures.filter((f) => f.stage === 'league');
  const playoffFixtures = allFixtures.filter((f) => f.stage === 'pool_playoff');
  const semiFixtures = allFixtures.filter((f) => f.stage === 'semifinal');
  const finalFixtures = allFixtures.filter((f) => f.stage === 'final');

  const leagueDone = leagueFixtures.length > 0 && leagueFixtures.every((f) => f.match_status === 'completed');
  if (!leagueDone) return;

  if (playoffFixtures.length > 0 && playoffFixtures.some((f) => !f.team1_id || !f.team2_id)) {
    const poolNames = [...new Set(leagueFixtures.map((f) => f.pool_name))];
    for (const poolName of poolNames) {
      const ranked = await standingsForFixtures(leagueFixtures.filter((f) => f.pool_name === poolName));
      const winnerId = ranked[0]?.team_id;
      if (!winnerId) continue;
      const label = `${poolName} Winner`;
      await pool.query(
        'UPDATE fixtures SET team1_id = ? WHERE tournament_id = ? AND stage = "pool_playoff" AND team1_placeholder = ?',
        [winnerId, tournamentId, label]
      );
      await pool.query(
        'UPDATE fixtures SET team2_id = ? WHERE tournament_id = ? AND stage = "pool_playoff" AND team2_placeholder = ?',
        [winnerId, tournamentId, label]
      );
    }
    return;
  }

  const sourceFixtures = playoffFixtures.length > 0 ? playoffFixtures : leagueFixtures;
  const sourceDone = sourceFixtures.every((f) => f.match_status === 'completed');
  if (!sourceDone) return;

  if (semiFixtures.length > 0 && semiFixtures.some((f) => !f.team1_id || !f.team2_id)) {
    const ranked = await standingsForFixtures(sourceFixtures);
    const byRank = { 'Rank 1': ranked[0]?.team_id, 'Rank 2': ranked[1]?.team_id, 'Rank 3': ranked[2]?.team_id, 'Rank 4': ranked[3]?.team_id };
    for (const fx of semiFixtures) {
      const t1 = byRank[fx.team1_placeholder];
      const t2 = byRank[fx.team2_placeholder];
      if (t1 && t2) {
        await pool.query('UPDATE fixtures SET team1_id = ?, team2_id = ? WHERE id = ?', [t1, t2, fx.id]);
      }
    }
    return;
  }

  if (finalFixtures.length > 0 && (!finalFixtures[0].team1_id || !finalFixtures[0].team2_id)) {
    const finalFixture = finalFixtures[0];
    if (semiFixtures.length > 0) {
      const semisDone = semiFixtures.every((f) => f.match_status === 'completed');
      if (!semisDone) return;
      const sf1 = semiFixtures.find((f) => f.match_order === 1);
      const sf2 = semiFixtures.find((f) => f.match_order === 2);
      const t1 = sf1?.winner_team_id;
      const t2 = sf2?.winner_team_id;
      if (t1 && t2) {
        await pool.query('UPDATE fixtures SET team1_id = ?, team2_id = ? WHERE id = ?', [t1, t2, finalFixture.id]);
      }
    } else {
      const ranked = await standingsForFixtures(sourceFixtures);
      const t1 = ranked[0]?.team_id;
      const t2 = ranked[1]?.team_id;
      if (t1 && t2) {
        await pool.query('UPDATE fixtures SET team1_id = ?, team2_id = ? WHERE id = ?', [t1, t2, finalFixture.id]);
      }
    }
  }
}

// A tournament is "ongoing" while it has zero fixtures (created but not yet
// scheduled) or at least one fixture that isn't completed — this is the
// gate that blocks starting a new tournament in the same room.
async function getOngoingTournament(auctionRoomId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.name FROM tournaments t
     LEFT JOIN fixtures f ON f.tournament_id = t.id
     WHERE t.auction_room_id = ?
     GROUP BY t.id
     HAVING COUNT(f.id) = 0 OR SUM(f.match_status != 'completed') > 0
     LIMIT 1`,
    [auctionRoomId]
  );
  return rows[0] || null;
}

// Backs three call sites: the room-scoped admin Tournament tab, the global
// admin dashboard Tournaments tab, and the public Ongoing/Past Tournaments
// tabs — pass { auctionRoomId } to scope to one room, omit for a global list.
async function listTournamentsWithCounts({ auctionRoomId, adminId } = {}) {
  const params = [];
  const clauses = [];
  if (auctionRoomId) {
    clauses.push('t.auction_room_id = ?');
    params.push(auctionRoomId);
  }
  if (adminId) {
    clauses.push('r.admin_id = ?');
    params.push(adminId);
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT t.*, r.name AS room_name,
            COUNT(f.id) AS fixture_count,
            SUM(f.match_status = 'completed') AS completed_count
     FROM tournaments t
     JOIN auction_rooms r ON r.id = t.auction_room_id
     LEFT JOIN fixtures f ON f.tournament_id = t.id
     ${whereClause}
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    params
  );

  const tournaments = rows.map((row) => {
    const fixtureCount = Number(row.fixture_count);
    const completedCount = Number(row.completed_count) || 0;
    return {
      ...row,
      fixture_count: fixtureCount,
      completed_count: completedCount,
      is_completed: fixtureCount > 0 && completedCount === fixtureCount
    };
  });

  const completedIds = tournaments.filter((t) => t.is_completed).map((t) => t.id);
  if (completedIds.length > 0) {
    const [winners] = await pool.query(
      `SELECT f.tournament_id, wt.team_name AS winner_team_name,
              t.player_of_tournament_id, p.name AS player_of_tournament_name
       FROM fixtures f
       JOIN tournaments t ON t.id = f.tournament_id
       LEFT JOIN teams wt ON wt.id = f.winner_team_id
       LEFT JOIN players p ON p.id = t.player_of_tournament_id
       WHERE f.tournament_id IN (?) AND f.stage = 'final' AND f.match_status = 'completed'`,
      [completedIds]
    );
    const byTournamentId = {};
    winners.forEach((w) => { byTournamentId[w.tournament_id] = w; });
    tournaments.forEach((t) => {
      const w = byTournamentId[t.id];
      if (w) {
        t.winner_team_name = w.winner_team_name;
        t.player_of_tournament_name = w.player_of_tournament_name;
      }
    });
  }

  return tournaments;
}

// One tournament's full detail: its own row, computed is_completed, its
// fixture list (same join shape the old room-wide getFixtures used to
// return), and the tournament winner's name if it has one. Shared by both
// the authed single-tournament endpoint and the public one.
async function getTournamentDetail(tournamentId) {
  const [[tournament]] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
  if (!tournament) return null;

  const [fixtures] = await pool.query(
    `SELECT f.*, t1.team_name AS team1_name, t1.logo_path AS team1_logo,
            t2.team_name AS team2_name, t2.logo_path AS team2_logo,
            wt.team_name AS winner_team_name
     FROM fixtures f
     LEFT JOIN teams t1 ON t1.id = f.team1_id
     LEFT JOIN teams t2 ON t2.id = f.team2_id
     LEFT JOIN teams wt ON wt.id = f.winner_team_id
     WHERE f.tournament_id = ?
     ORDER BY f.stage, f.pool_name IS NOT NULL, f.pool_name, f.match_order`,
    [tournamentId]
  );

  const isCompleted = fixtures.length > 0 && fixtures.every((f) => f.match_status === 'completed');

  let playerOfTournamentName = null;
  if (tournament.player_of_tournament_id) {
    const [[player]] = await pool.query('SELECT name FROM players WHERE id = ?', [tournament.player_of_tournament_id]);
    playerOfTournamentName = player?.name || null;
  }

  return { ...tournament, is_completed: isCompleted, fixtures, player_of_tournament_name: playerOfTournamentName };
}

module.exports = {
  KNOCKOUT_THRESHOLD, buildKnockoutRows, buildPoolPlayoffRows, standingsForFixtures, maybeAdvanceTournament,
  getOngoingTournament, listTournamentsWithCounts, getTournamentDetail
};
