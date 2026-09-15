const pool = require('../config/db');
const { maybeAdvanceTournament } = require('./tournamentEngine');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function ensureStatsRow(conn, inningsId, playerId, teamId) {
  await conn.query(
    'INSERT IGNORE INTO match_player_stats (innings_id, player_id, team_id) VALUES (?, ?, ?)',
    [inningsId, playerId, teamId]
  );
}

async function getMatchState(fixtureId) {
  const [[fixture]] = await pool.query(
    `SELECT f.*, t1.team_name AS team1_name, t1.logo_path AS team1_logo,
            t2.team_name AS team2_name, t2.logo_path AS team2_logo,
            tw.team_name AS toss_winner_name, wt.team_name AS winner_team_name,
            pom.name AS player_of_match_name
     FROM fixtures f
     LEFT JOIN teams t1 ON t1.id = f.team1_id
     LEFT JOIN teams t2 ON t2.id = f.team2_id
     LEFT JOIN teams tw ON tw.id = f.toss_winner_team_id
     LEFT JOIN teams wt ON wt.id = f.winner_team_id
     LEFT JOIN players pom ON pom.id = f.player_of_match_id
     WHERE f.id = ?`,
    [fixtureId]
  );
  if (!fixture) return null;

  const [inningsRows] = await pool.query(
    'SELECT * FROM match_innings WHERE fixture_id = ? ORDER BY innings_number',
    [fixtureId]
  );

  const innings = [];
  for (const inn of inningsRows) {
    const [stats] = await pool.query(
      `SELECT s.*, p.name AS player_name FROM match_player_stats s
       JOIN players p ON p.id = s.player_id WHERE s.innings_id = ?`,
      [inn.id]
    );
    const [currentOverBalls] = await pool.query(
      `SELECT b.*, p.name AS batsman_name FROM match_balls b
       JOIN players p ON p.id = b.batsman_id
       WHERE b.innings_id = ? AND b.over_number = ? ORDER BY b.id`,
      [inn.id, Math.floor(inn.total_balls / 6)]
    );

    // The trailing "last 12 balls" ticker spans over boundaries (unlike
    // currentOverBalls, which resets every over) — fetched most-recent-first
    // so LIMIT 12 grabs the right window, then reversed back to chronological
    // order for display.
    const [recentBallsDesc] = await pool.query(
      `SELECT b.*, p.name AS batsman_name FROM match_balls b
       JOIN players p ON p.id = b.batsman_id
       WHERE b.innings_id = ? ORDER BY b.id DESC LIMIT 12`,
      [inn.id]
    );
    const last12Balls = recentBallsDesc.reverse();

    // A hat-trick ball is the bowler's next LEGAL delivery after their last
    // two legal deliveries (wherever they fell — extras don't count as a
    // ball and don't break the streak, same as the real laws of cricket)
    // were both wickets that weren't run outs. Scoped to this innings only.
    let bowlerOnHatTrick = false;
    if (inn.current_bowler_id && !inn.is_completed) {
      const [lastLegalBalls] = await pool.query(
        `SELECT is_wicket, is_run_out FROM match_balls
         WHERE innings_id = ? AND bowler_id = ? AND extra_type = 'none'
         ORDER BY id DESC LIMIT 2`,
        [inn.id, inn.current_bowler_id]
      );
      bowlerOnHatTrick = lastLegalBalls.length === 2 && lastLegalBalls.every((b) => b.is_wicket && !b.is_run_out);
    }

    innings.push({ ...inn, stats, currentOverBalls, last12Balls, bowlerOnHatTrick });
  }

  const [team1Players] = await pool.query(
    'SELECT id, name, category, is_captain FROM players WHERE team_id = ?',
    [fixture.team1_id]
  );
  const [team2Players] = await pool.query(
    'SELECT id, name, category, is_captain FROM players WHERE team_id = ?',
    [fixture.team2_id]
  );

  return { ...fixture, innings, team1Players, team2Players };
}

// A lightweight summary for the public "live matches" home page — one row
// per currently-live fixture, with just enough of its latest innings to
// render a score tile (current run rate, and the chase target/required
// rate once the second innings is under way). Deliberately doesn't reuse
// getMatchState here: that pulls full ball-by-ball history and every
// player's stats per innings, which is unnecessary for a summary tile and
// would multiply cost across every live fixture on every poll.
async function getLiveMatchesSummary() {
  const [fixtures] = await pool.query(
    `SELECT f.id AS fixture_id, f.auction_room_id AS room_id, f.stage, f.overs_limit,
            r.name AS room_name, tn.name AS tournament_name,
            t1.id AS team1_id, t1.team_name AS team1_name, t1.logo_path AS team1_logo,
            t2.id AS team2_id, t2.team_name AS team2_name, t2.logo_path AS team2_logo
     FROM fixtures f
     JOIN auction_rooms r ON r.id = f.auction_room_id
     JOIN tournaments tn ON tn.id = f.tournament_id
     JOIN teams t1 ON t1.id = f.team1_id
     JOIN teams t2 ON t2.id = f.team2_id
     WHERE f.match_status = 'live'
     ORDER BY f.id`
  );
  if (fixtures.length === 0) return [];

  const [innings] = await pool.query(
    `SELECT * FROM match_innings WHERE fixture_id IN (?) ORDER BY innings_number`,
    [fixtures.map((f) => f.fixture_id)]
  );

  const summaries = [];
  for (const fx of fixtures) {
    const fixtureInnings = innings.filter((inn) => inn.fixture_id === fx.fixture_id);
    const inn = fixtureInnings[fixtureInnings.length - 1];
    if (!inn) continue; // toss done, first innings not started yet — nothing to show yet

    const battingTeamName = inn.batting_team_id === fx.team1_id ? fx.team1_name : fx.team2_name;
    const bowlingTeamName = inn.bowling_team_id === fx.team1_id ? fx.team1_name : fx.team2_name;
    const oversFaced = inn.total_balls / 6;
    const currentRunRate = oversFaced > 0 ? inn.total_runs / oversFaced : 0;

    let target = null;
    let requiredRuns = null;
    let ballsLeft = null;
    let requiredRunRate = null;
    const isChasing = inn.innings_number % 2 === 0;
    if (isChasing && inn.target != null) {
      target = inn.target;
      requiredRuns = Math.max(inn.target - inn.total_runs, 0);
      ballsLeft = Math.max(inn.overs_limit * 6 - inn.total_balls, 0);
      requiredRunRate = ballsLeft > 0 ? requiredRuns / (ballsLeft / 6) : null;
    }

    // The deciding innings has ended but the admin hasn't hit "Finish
    // Match" yet (winner_team_id isn't persisted until then) — work out
    // the winner from the score right here so the home page tile doesn't
    // sit blank in that window. Same win/tie comparison as finishMatch().
    let winnerTeamName = null;
    let isTied = false;
    if (isChasing && inn.is_completed) {
      const decidingFirst = fixtureInnings.find((i) => i.innings_number === inn.innings_number - 1);
      if (decidingFirst) {
        if (inn.total_runs > decidingFirst.total_runs) {
          winnerTeamName = inn.batting_team_id === fx.team1_id ? fx.team1_name : fx.team2_name;
        } else if (inn.total_runs < decidingFirst.total_runs) {
          winnerTeamName = decidingFirst.batting_team_id === fx.team1_id ? fx.team1_name : fx.team2_name;
        } else {
          isTied = true;
        }
      }
    }

    summaries.push({
      fixture_id: fx.fixture_id,
      room_id: fx.room_id,
      room_name: fx.room_name,
      tournament_name: fx.tournament_name,
      stage: fx.stage,
      team1_name: fx.team1_name,
      team1_logo: fx.team1_logo,
      team2_name: fx.team2_name,
      team2_logo: fx.team2_logo,
      batting_team_name: battingTeamName,
      bowling_team_name: bowlingTeamName,
      innings_number: inn.innings_number,
      total_runs: inn.total_runs,
      total_wickets: inn.total_wickets,
      total_balls: inn.total_balls,
      overs_limit: inn.overs_limit,
      current_run_rate: Math.round(currentRunRate * 100) / 100,
      target,
      required_runs: requiredRuns,
      balls_left: ballsLeft,
      required_run_rate: requiredRunRate != null ? Math.round(requiredRunRate * 100) / 100 : null,
      winner_team_name: winnerTeamName,
      is_tied: isTied
    });
  }
  return summaries;
}

async function startMatch(fixtureId, { toss_winner_team_id, toss_decision, overs_limit }) {
  const [[fixture]] = await pool.query('SELECT * FROM fixtures WHERE id = ?', [fixtureId]);
  if (!fixture) throw httpError(404, 'Fixture not found');
  const [[tournament]] = await pool.query('SELECT fixtures_finalized FROM tournaments WHERE id = ?', [fixture.tournament_id]);
  if (!tournament?.fixtures_finalized) {
    throw httpError(400, 'Fixtures must be finalized before starting a match');
  }
  if (fixture.match_status !== 'not_started') throw httpError(400, 'This match has already started');
  if (!fixture.team1_id || !fixture.team2_id) {
    throw httpError(400, 'Both teams for this fixture are not yet determined');
  }

  const [liveElsewhere] = await pool.query(
    `SELECT f.team1_id, f.team2_id FROM fixtures f
     WHERE f.match_status = 'live' AND f.id != ?
       AND (f.team1_id IN (?, ?) OR f.team2_id IN (?, ?))`,
    [fixtureId, fixture.team1_id, fixture.team2_id, fixture.team1_id, fixture.team2_id]
  );
  if (liveElsewhere.length > 0) {
    const busyTeamId = [liveElsewhere[0].team1_id, liveElsewhere[0].team2_id].includes(fixture.team1_id)
      ? fixture.team1_id
      : fixture.team2_id;
    const [[busyTeam]] = await pool.query('SELECT team_name FROM teams WHERE id = ?', [busyTeamId]);
    throw httpError(400, `${busyTeam?.team_name || 'One of these teams'} is already playing a live match elsewhere`);
  }

  if (!['bat', 'field'].includes(toss_decision)) {
    throw httpError(400, 'toss_decision must be "bat" or "field"');
  }
  const tossWinnerId = Number(toss_winner_team_id);
  if (![fixture.team1_id, fixture.team2_id].includes(tossWinnerId)) {
    throw httpError(400, 'toss_winner_team_id must be one of the two teams in this fixture');
  }
  const overs = Number(overs_limit);
  if (!Number.isInteger(overs) || overs < 1) {
    throw httpError(400, 'overs_limit must be a whole number of at least 1');
  }

  const otherTeamId = tossWinnerId === fixture.team1_id ? fixture.team2_id : fixture.team1_id;
  const battingTeamId = toss_decision === 'bat' ? tossWinnerId : otherTeamId;
  const bowlingTeamId = battingTeamId === fixture.team1_id ? fixture.team2_id : fixture.team1_id;

  const [[{ count: battingCount }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM players WHERE team_id = ?', [battingTeamId]
  );
  const [[{ count: bowlingCount }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM players WHERE team_id = ?', [bowlingTeamId]
  );
  if (battingCount < 2 || bowlingCount < 2) {
    throw httpError(400, 'Both teams need at least 2 players on their roster to start a match');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE fixtures SET match_status = 'live', toss_winner_team_id = ?, toss_decision = ?, overs_limit = ?, current_innings = 1
       WHERE id = ?`,
      [tossWinnerId, toss_decision, overs, fixtureId]
    );
    await conn.query(
      `INSERT INTO match_innings (fixture_id, innings_number, batting_team_id, bowling_team_id, overs_limit)
       VALUES (?, 1, ?, ?, ?)`,
      [fixtureId, battingTeamId, bowlingTeamId, overs]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getMatchState(fixtureId);
}

// Starting from the second Super Over (a rematch after a tied one), a team
// can't reuse whoever got out batting, or whoever bowled its over, in the
// immediately preceding Super Over — there's nothing to compare against
// before that, since the very first Super Over only follows the regular
// match, which has its own much larger squad and no such restriction. Since
// a fixture only ever has two teams, the previous pair's innings that
// batted for `innings.batting_team_id` is also the one that bowled for
// `innings.bowling_team_id` — so a single row lookup covers both checks.
async function getSuperOverIneligiblePlayers(innings) {
  if (innings.innings_number <= 2) return { outBatsmen: new Set(), bannedBowlerId: null };
  const pairStart = innings.innings_number % 2 === 1 ? innings.innings_number : innings.innings_number - 1;
  if (pairStart <= 3) return { outBatsmen: new Set(), bannedBowlerId: null };
  const prevPairStart = pairStart - 2;

  const [[prev]] = await pool.query(
    'SELECT * FROM match_innings WHERE fixture_id = ? AND innings_number IN (?, ?) AND batting_team_id = ?',
    [innings.fixture_id, prevPairStart, prevPairStart + 1, innings.batting_team_id]
  );
  if (!prev) return { outBatsmen: new Set(), bannedBowlerId: null };

  const [outRows] = await pool.query(
    'SELECT player_id FROM match_player_stats WHERE innings_id = ? AND team_id = ? AND is_out = TRUE',
    [prev.id, innings.batting_team_id]
  );
  const [[bowlerRow]] = await pool.query(
    'SELECT player_id FROM match_player_stats WHERE innings_id = ? AND team_id = ? AND balls_bowled > 0 LIMIT 1',
    [prev.id, innings.bowling_team_id]
  );
  return {
    outBatsmen: new Set(outRows.map((r) => Number(r.player_id))),
    bannedBowlerId: bowlerRow ? Number(bowlerRow.player_id) : null,
  };
}

async function selectOpeners(inningsId, { striker_id, non_striker_id, bowler_id }) {
  const [[innings]] = await pool.query('SELECT * FROM match_innings WHERE id = ?', [inningsId]);
  if (!innings) throw httpError(404, 'Innings not found');
  if (innings.striker_id) throw httpError(400, 'Openers have already been selected for this innings');
  if (!striker_id || !non_striker_id || !bowler_id) {
    throw httpError(400, 'striker_id, non_striker_id and bowler_id are all required');
  }
  if (Number(striker_id) === Number(non_striker_id)) {
    throw httpError(400, 'Choose two different opening batsmen');
  }

  const [[strikerOk]] = await pool.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [striker_id, innings.batting_team_id]);
  const [[nonStrikerOk]] = await pool.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [non_striker_id, innings.batting_team_id]);
  const [[bowlerOk]] = await pool.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [bowler_id, innings.bowling_team_id]);
  if (!strikerOk || !nonStrikerOk) throw httpError(400, 'Both openers must be players on the batting team');
  if (!bowlerOk) throw httpError(400, 'The bowler must be a player on the bowling team');

  const ineligible = await getSuperOverIneligiblePlayers(innings);
  if (ineligible.outBatsmen.has(Number(striker_id)) || ineligible.outBatsmen.has(Number(non_striker_id))) {
    throw httpError(400, 'A batter dismissed in the previous Super Over cannot bat in this one');
  }
  if (ineligible.bannedBowlerId && Number(bowler_id) === ineligible.bannedBowlerId) {
    throw httpError(400, 'The same bowler cannot bowl consecutive Super Overs');
  }

  await pool.query(
    `UPDATE match_innings SET striker_id = ?, non_striker_id = ?, current_bowler_id = ?,
      opening_striker_id = ?, opening_non_striker_id = ?, opening_bowler_id = ? WHERE id = ?`,
    [striker_id, non_striker_id, bowler_id, striker_id, non_striker_id, bowler_id, inningsId]
  );
  await ensureStatsRow(pool, inningsId, striker_id, innings.batting_team_id);
  await ensureStatsRow(pool, inningsId, non_striker_id, innings.batting_team_id);
  await ensureStatsRow(pool, inningsId, bowler_id, innings.bowling_team_id);

  return getMatchState(innings.fixture_id);
}

async function selectBatsman(inningsId, playerId) {
  const [[innings]] = await pool.query('SELECT * FROM match_innings WHERE id = ?', [inningsId]);
  if (!innings) throw httpError(404, 'Innings not found');
  if (innings.is_completed) throw httpError(400, 'This innings has already ended');
  if (innings.striker_id && innings.non_striker_id) throw httpError(400, 'A batsman is already at the crease');
  if (!playerId) throw httpError(400, 'player_id is required');
  // Usually the striker's slot is the one left vacant by a wicket, but a run
  // out can just as easily leave the non-striker's end open instead — so
  // whichever of the two is empty is who the incoming batsman replaces.
  const occupiedId = innings.striker_id || innings.non_striker_id;
  if (occupiedId && Number(playerId) === Number(occupiedId)) {
    throw httpError(400, 'That player is already batting');
  }

  const [[player]] = await pool.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [playerId, innings.batting_team_id]);
  if (!player) throw httpError(400, 'That player is not on the batting team');

  const [[stat]] = await pool.query('SELECT is_out FROM match_player_stats WHERE innings_id = ? AND player_id = ?', [inningsId, playerId]);
  if (stat && stat.is_out) throw httpError(400, 'That player is already out');

  const ineligible = await getSuperOverIneligiblePlayers(innings);
  if (ineligible.outBatsmen.has(Number(playerId))) {
    throw httpError(400, 'A batter dismissed in the previous Super Over cannot bat in this one');
  }

  const vacantField = innings.striker_id ? 'non_striker_id' : 'striker_id';
  await pool.query(`UPDATE match_innings SET ${vacantField} = ? WHERE id = ?`, [playerId, inningsId]);
  await ensureStatsRow(pool, inningsId, playerId, innings.batting_team_id);
  return getMatchState(innings.fixture_id);
}

async function selectBowler(inningsId, playerId) {
  const [[innings]] = await pool.query('SELECT * FROM match_innings WHERE id = ?', [inningsId]);
  if (!innings) throw httpError(404, 'Innings not found');
  if (innings.is_completed) throw httpError(400, 'This innings has already ended');
  if (innings.current_bowler_id) throw httpError(400, 'A bowler is already set for this over');
  if (!playerId) throw httpError(400, 'player_id is required');
  if (innings.last_over_bowler_id && Number(playerId) === Number(innings.last_over_bowler_id)) {
    throw httpError(400, 'The same bowler cannot bowl consecutive overs');
  }

  const ineligible = await getSuperOverIneligiblePlayers(innings);
  if (ineligible.bannedBowlerId && Number(playerId) === ineligible.bannedBowlerId) {
    throw httpError(400, 'The same bowler cannot bowl consecutive Super Overs');
  }

  const [[player]] = await pool.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [playerId, innings.bowling_team_id]);
  if (!player) throw httpError(400, 'That player is not on the bowling team');

  await pool.query('UPDATE match_innings SET current_bowler_id = ? WHERE id = ?', [playerId, inningsId]);
  await ensureStatsRow(pool, inningsId, playerId, innings.bowling_team_id);
  return getMatchState(innings.fixture_id);
}

// A ball's scoring detail is validated up front, outside the transaction,
// into one normalized shape — every downstream calculation (batting credit,
// extras, who's out, how many times the pair crossed) reads only from this,
// never from the raw request body. recomputeInnings() re-derives the exact
// same shape from a stored match_balls row, so the two can never drift apart.
function parseBallDetail({
  runs, extra_type, extra_runs, bye_type, bye_runs,
  wicket_type, run_out_player, run_out_runs,
  overthrow, overthrow_runs, overthrow_run_out, overthrow_player, overthrow_before_runs
}) {
  const extraType = extra_type || 'none';
  if (!['none', 'wide', 'no_ball'].includes(extraType)) {
    throw httpError(400, 'extra_type must be "none", "wide" or "no_ball"');
  }
  const isExtra = extraType !== 'none';

  const byeType = bye_type || 'none';
  if (!['none', 'bye', 'leg_bye'].includes(byeType)) {
    throw httpError(400, 'bye_type must be "none", "bye" or "leg_bye"');
  }
  const isBye = byeType !== 'none';
  if (isExtra && isBye) {
    throw httpError(400, 'Byes/Leg Byes cannot be recorded together with a Wide or No Ball');
  }

  const wicketType = wicket_type || 'none';
  if (!['none', 'out', 'run_out'].includes(wicketType)) {
    throw httpError(400, 'wicket_type must be "none", "out" or "run_out"');
  }
  if (wicketType === 'run_out' && (isExtra || isBye)) {
    throw httpError(400, 'A run out on a Wide/No Ball or Bye/Leg Bye delivery is not supported — record it as a standard wicket instead');
  }
  if (wicketType === 'run_out') {
    if (!['striker', 'non_striker'].includes(run_out_player)) {
      throw httpError(400, 'Select which batsman was run out');
    }
    const roRuns = Number(run_out_runs);
    if (!Number.isInteger(roRuns) || roRuns < 0 || roRuns > 5) {
      throw httpError(400, 'Runs completed on a run out must be between 0 and 5');
    }
  }

  const runsValue = Number(runs) || 0;
  if (runsValue < 0 || runsValue > 6) throw httpError(400, 'Run values must be between 0 and 6');
  const extraRunsValue = Number(extra_runs) || 0;
  if (extraRunsValue < 0 || extraRunsValue > 6) throw httpError(400, 'Run values must be between 0 and 6');
  const byeRunsValue = Number(bye_runs) || 0;
  if (isBye && (byeRunsValue < 1 || byeRunsValue > 6)) {
    throw httpError(400, 'Bye/Leg Bye runs must be between 1 and 6');
  }

  let overthrowRunsValue = 0;
  let overthrowIsRunOut = false;
  let overthrowPlayer = null;
  if (overthrow) {
    if (wicketType !== 'none') throw httpError(400, 'A ball can only have one wicket');
    if (isExtra || isBye) throw httpError(400, 'Over-throw only applies to a normal delivery off the bat');
    if ([4, 6].includes(runsValue)) throw httpError(400, 'Over-throw does not apply to a boundary');
    if (overthrow_run_out) {
      overthrowIsRunOut = true;
      if (!['striker', 'non_striker'].includes(overthrow_player)) {
        throw httpError(400, 'Select which batsman was run out on the over-throw');
      }
      overthrowPlayer = overthrow_player;
      overthrowRunsValue = Number(overthrow_before_runs);
      if (!Number.isInteger(overthrowRunsValue) || overthrowRunsValue < 0 || overthrowRunsValue > 5) {
        throw httpError(400, 'Runs completed before an over-throw run out must be between 0 and 5');
      }
    } else {
      overthrowRunsValue = Number(overthrow_runs);
      if (![1, 2, 3, 4, 5].includes(overthrowRunsValue)) {
        throw httpError(400, 'Over-throw runs must be between 1 and 5');
      }
    }
  }

  const isRunOut = wicketType === 'run_out' || overthrowIsRunOut;
  const isWicket = wicketType !== 'none' || overthrowIsRunOut;
  const runOutPlayer = wicketType === 'run_out' ? run_out_player : overthrowPlayer;

  // Runs credited to whoever is on strike — a primary run out still credits
  // the runs actually completed (they were off the bat), but over-throw runs
  // never are (they're purely a fielding error, same as a bye).
  const battingRuns = wicketType === 'run_out'
    ? Number(run_out_runs)
    : (isExtra || isBye ? 0 : runsValue);

  const wideNoBallExtra = isExtra ? 1 + extraRunsValue : 0;
  const byeExtra = isBye ? byeRunsValue : 0;
  const extraTotal = wideNoBallExtra + byeExtra + overthrowRunsValue;
  const ballRuns = battingRuns + extraTotal;

  // Every run physically run — off the bat, on a wide/no-ball, a bye/leg-bye,
  // or an over-throw scramble — flips which end the two batters are standing
  // at, regardless of who ends up credited for it.
  const runsRun = (isExtra ? extraRunsValue : battingRuns) + byeExtra + overthrowRunsValue;

  return {
    extraType, isExtra, byeType, isBye, wicketType, isWicket, isRunOut, runOutPlayer,
    battingRuns, extraRunsValue, byeRunsValue, overthrowRunsValue, ballRuns, runsRun
  };
}

async function recordBall(inningsId, payload) {
  const detail = parseBallDetail(payload);
  const { extraType, isExtra, byeType, byeRunsValue, overthrowRunsValue, isWicket, isRunOut, runOutPlayer,
    battingRuns, extraRunsValue, ballRuns, runsRun } = detail;

  const conn = await pool.getConnection();
  let fixtureId;
  try {
    await conn.beginTransaction();

    const [[innings]] = await conn.query('SELECT * FROM match_innings WHERE id = ? FOR UPDATE', [inningsId]);
    if (!innings) throw httpError(404, 'Innings not found');
    fixtureId = innings.fixture_id;
    if (innings.is_completed) throw httpError(400, 'This innings has already ended');
    if (!innings.striker_id || !innings.non_striker_id || !innings.current_bowler_id) {
      throw httpError(400, 'Select the openers and bowler before recording balls');
    }
    const isFreeHit = !!innings.free_hit;
    if (isFreeHit && isWicket && !isRunOut) {
      throw httpError(400, 'Only a run out is possible on a free hit');
    }

    const preStriker = innings.striker_id;
    const preNonStriker = innings.non_striker_id;
    const runOutPlayerId = isRunOut ? (runOutPlayer === 'striker' ? preStriker : preNonStriker) : null;

    const overNumber = Math.floor(innings.total_balls / 6);
    const ballInOver = innings.balls_in_current_over + 1;

    await conn.query(
      `INSERT INTO match_balls
        (innings_id, over_number, ball_in_over, bowler_id, batsman_id, runs, extra_type, extra_runs,
         bye_type, bye_runs, overthrow_runs, is_wicket, is_run_out, run_out_player_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inningsId, overNumber, ballInOver, innings.current_bowler_id, preStriker, battingRuns, extraType,
        isExtra ? extraRunsValue : 0, byeType, byeRunsValue, overthrowRunsValue, isWicket, isRunOut, runOutPlayerId]
    );

    await ensureStatsRow(conn, inningsId, preStriker, innings.batting_team_id);
    await ensureStatsRow(conn, inningsId, innings.current_bowler_id, innings.bowling_team_id);

    // A boundary specifically means the ball crossed the rope — a run out's
    // completed runs (capped at 5) are real runs covered by running, not a
    // struck boundary, so they must never count as a "four" even when the
    // count happens to be 4. Extras/byes already force battingRuns to 0.
    const isFour = battingRuns === 4 && !isWicket;
    const isSix = battingRuns === 6 && !isWicket;
    await conn.query(
      'UPDATE match_player_stats SET runs_scored = runs_scored + ?, balls_faced = balls_faced + ?, fours = fours + ?, sixes = sixes + ? WHERE innings_id = ? AND player_id = ?',
      [battingRuns, isExtra ? 0 : 1, isFour ? 1 : 0, isSix ? 1 : 0, inningsId, preStriker]
    );
    // A run out is never credited to the bowler's own wicket tally in real
    // cricket — only the team's wicket count goes up (newTotalWickets below).
    const bowlerCreditedWicket = isWicket && !isRunOut;
    await conn.query(
      'UPDATE match_player_stats SET runs_conceded = runs_conceded + ?, balls_bowled = balls_bowled + ?, wickets_taken = wickets_taken + ? WHERE innings_id = ? AND player_id = ?',
      [ballRuns, isExtra ? 0 : 1, bowlerCreditedWicket ? 1 : 0, inningsId, innings.current_bowler_id]
    );

    const newTotalRuns = innings.total_runs + ballRuns;
    const newExtras = innings.extras + (ballRuns - battingRuns);
    const newTotalWickets = innings.total_wickets + (isWicket ? 1 : 0);
    const newTotalBalls = innings.total_balls + (isExtra ? 0 : 1);
    let newBallsInOver = isExtra ? innings.balls_in_current_over : innings.balls_in_current_over + 1;

    // A no-ball always grants the next ball a free hit. A wide/no-ball bowled
    // ON a free hit doesn't use it up — it carries the free hit forward to
    // the ball after that too. Any legal delivery (including a bye/leg-bye,
    // which is still bowled off a legal ball) clears it.
    const newFreeHit = extraType === 'no_ball' || (extraType === 'wide' && isFreeHit);

    let newStriker = preStriker;
    let newNonStriker = preNonStriker;

    if (isRunOut) {
      const crossed = runsRun % 2 === 1;
      const strikerEndOccupant = crossed ? preNonStriker : preStriker;
      const nonStrikerEndOccupant = crossed ? preStriker : preNonStriker;
      await conn.query('UPDATE match_player_stats SET is_out = TRUE WHERE innings_id = ? AND player_id = ?', [inningsId, runOutPlayerId]);
      if (runOutPlayerId === strikerEndOccupant) {
        newStriker = null;
        newNonStriker = nonStrikerEndOccupant;
      } else {
        newStriker = strikerEndOccupant;
        newNonStriker = null;
      }
    } else if (isWicket) {
      await conn.query('UPDATE match_player_stats SET is_out = TRUE WHERE innings_id = ? AND player_id = ?', [inningsId, preStriker]);
      newStriker = null;
    } else if (runsRun % 2 === 1) {
      [newStriker, newNonStriker] = [newNonStriker, newStriker];
    }

    let newBowler = innings.current_bowler_id;
    let newLastOverBowler = innings.last_over_bowler_id;

    if (!isExtra && newBallsInOver >= 6) {
      newBallsInOver = 0;
      newLastOverBowler = innings.current_bowler_id;
      newBowler = null;
      if (newStriker && newNonStriker) {
        [newStriker, newNonStriker] = [newNonStriker, newStriker];
      }
    }

    // A super over (innings 3+) only ever has 3 nominated batsmen, so it's
    // "all out" after just 2 wickets — unlike the main match, where the real
    // squad size on the roster decides that threshold.
    const isSuperOver = innings.innings_number > 2;
    let squadSize = 3;
    if (!isSuperOver) {
      const [[row]] = await conn.query('SELECT COUNT(*) AS squadSize FROM players WHERE team_id = ?', [innings.batting_team_id]);
      squadSize = row.squadSize;
    }
    const allOut = newTotalWickets >= squadSize - 1;
    const oversUp = newTotalBalls >= innings.overs_limit * 6;
    const isChasingInnings = innings.innings_number % 2 === 0;
    const chaseComplete = isChasingInnings && innings.target != null && newTotalRuns >= innings.target;
    const inningsEnds = allOut || oversUp || chaseComplete;

    await conn.query(
      `UPDATE match_innings SET total_runs = ?, total_wickets = ?, total_balls = ?, extras = ?, balls_in_current_over = ?,
        striker_id = ?, non_striker_id = ?, current_bowler_id = ?, last_over_bowler_id = ?, is_completed = ?, all_out = ?,
        free_hit = ?
       WHERE id = ?`,
      [newTotalRuns, newTotalWickets, newTotalBalls, newExtras, newBallsInOver,
        newStriker, newNonStriker, newBowler, newLastOverBowler, inningsEnds, allOut, newFreeHit, inningsId]
    );

    // Innings 1, 3, 5… ("sets" first) automatically hand off to the chase
    // half of the same pair (innings 2, 4, 6…) the moment they end — this
    // covers both the main match and every super over uniformly.
    if (inningsEnds && innings.innings_number % 2 === 1) {
      await conn.query(
        `INSERT INTO match_innings (fixture_id, innings_number, batting_team_id, bowling_team_id, target, overs_limit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [innings.fixture_id, innings.innings_number + 1, innings.bowling_team_id, innings.batting_team_id, newTotalRuns + 1, innings.overs_limit]
      );
      await conn.query('UPDATE fixtures SET current_innings = ? WHERE id = ?', [innings.innings_number + 1, innings.fixture_id]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getMatchState(fixtureId);
}

// Rebuilds an innings's aggregate totals and every player's figures purely
// from its ball log (after the caller has already deleted whichever ball is
// being undone) rather than trying to invert the one ball's delta directly —
// a single ball can also rotate the strike, roll over the bowler at an over's
// end, or end the innings outright, so replaying from the top is far less
// error-prone than reversing each of those side effects individually.
// Whoever replaces an outgoing striker/bowler was chosen via a separate
// selectBatsman/selectBowler call that leaves no row of its own, but the very
// next ball's batsman_id/bowler_id always names them — so a one-ball lookahead
// recovers that choice without needing to store it anywhere.
async function recomputeInnings(conn, inningsId) {
  const [[innings]] = await conn.query('SELECT * FROM match_innings WHERE id = ? FOR UPDATE', [inningsId]);
  const [balls] = await conn.query('SELECT * FROM match_balls WHERE innings_id = ? ORDER BY id', [inningsId]);

  await conn.query(
    `UPDATE match_player_stats SET runs_scored = 0, balls_faced = 0, fours = 0, sixes = 0, is_out = FALSE,
      balls_bowled = 0, runs_conceded = 0, wickets_taken = 0 WHERE innings_id = ?`,
    [inningsId]
  );

  let totalRuns = 0;
  let totalWickets = 0;
  let totalBalls = 0;
  let extras = 0;
  let ballsInCurrentOver = 0;
  let striker = innings.opening_striker_id;
  let nonStriker = innings.opening_non_striker_id;
  let bowler = innings.opening_bowler_id;
  let lastOverBowler = null;
  let freeHit = false;

  for (let idx = 0; idx < balls.length; idx++) {
    const ball = balls[idx];
    const isExtra = ball.extra_type !== 'none';
    const isBye = ball.bye_type !== 'none';
    const battingRuns = ball.runs;
    const wideNoBallExtra = isExtra ? 1 + ball.extra_runs : 0;
    const byeExtra = isBye ? ball.bye_runs : 0;
    const overthrowExtra = ball.overthrow_runs || 0;
    const extraTotal = wideNoBallExtra + byeExtra + overthrowExtra;
    const ballRuns = battingRuns + extraTotal;

    totalRuns += ballRuns;
    extras += extraTotal;
    if (ball.is_wicket) totalWickets += 1;
    if (!isExtra) totalBalls += 1;

    // Same rule as recordBall(): a run out's completed runs are never a
    // struck boundary, even when the count happens to be 4.
    const isFour = battingRuns === 4 && !ball.is_wicket;
    const isSix = battingRuns === 6 && !ball.is_wicket;
    await conn.query(
      'UPDATE match_player_stats SET runs_scored = runs_scored + ?, balls_faced = balls_faced + ?, fours = fours + ?, sixes = sixes + ? WHERE innings_id = ? AND player_id = ?',
      [battingRuns, isExtra ? 0 : 1, isFour ? 1 : 0, isSix ? 1 : 0, inningsId, ball.batsman_id]
    );
    // Same rule as recordBall(): a run out never counts against the bowler's
    // own wicket tally, only the team's (totalWickets above).
    const bowlerCreditedWicket = ball.is_wicket && !ball.is_run_out;
    await conn.query(
      'UPDATE match_player_stats SET runs_conceded = runs_conceded + ?, balls_bowled = balls_bowled + ?, wickets_taken = wickets_taken + ? WHERE innings_id = ? AND player_id = ?',
      [ballRuns, isExtra ? 0 : 1, bowlerCreditedWicket ? 1 : 0, inningsId, ball.bowler_id]
    );

    ballsInCurrentOver = isExtra ? ballsInCurrentOver : ballsInCurrentOver + 1;

    // Same rule as recordBall(): a no-ball always grants the next ball a free
    // hit; a wide/no-ball bowled during an active free hit carries it
    // forward instead of using it up; any legal delivery clears it.
    freeHit = ball.extra_type === 'no_ball' || (ball.extra_type === 'wide' && freeHit);

    // Every run physically run — off the bat, on a wide/no-ball, a bye/leg-bye,
    // or an over-throw scramble — flips which end the pair is standing at.
    const runsRun = (isExtra ? ball.extra_runs : battingRuns) + byeExtra + overthrowExtra;

    if (ball.is_run_out) {
      const crossed = runsRun % 2 === 1;
      const strikerEndOccupant = crossed ? nonStriker : striker;
      const nonStrikerEndOccupant = crossed ? striker : nonStriker;
      await conn.query('UPDATE match_player_stats SET is_out = TRUE WHERE innings_id = ? AND player_id = ?', [inningsId, ball.run_out_player_id]);
      if (ball.run_out_player_id === strikerEndOccupant) {
        striker = null;
        nonStriker = nonStrikerEndOccupant;
      } else {
        striker = strikerEndOccupant;
        nonStriker = null;
      }
    } else if (ball.is_wicket) {
      await conn.query('UPDATE match_player_stats SET is_out = TRUE WHERE innings_id = ? AND player_id = ?', [inningsId, ball.batsman_id]);
      striker = null;
    } else if (runsRun % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }

    if (!isExtra && ballsInCurrentOver >= 6) {
      ballsInCurrentOver = 0;
      lastOverBowler = bowler;
      bowler = null;
      if (striker && nonStriker) [striker, nonStriker] = [nonStriker, striker];
    }

    const nextBall = balls[idx + 1];
    if (striker === null) striker = nextBall ? nextBall.batsman_id : null;
    if (bowler === null) bowler = nextBall ? nextBall.bowler_id : null;
  }

  const isSuperOver = innings.innings_number > 2;
  let squadSize = 3;
  if (!isSuperOver) {
    const [[row]] = await conn.query('SELECT COUNT(*) AS squadSize FROM players WHERE team_id = ?', [innings.batting_team_id]);
    squadSize = row.squadSize;
  }
  const allOut = totalWickets >= squadSize - 1;
  const oversUp = totalBalls >= innings.overs_limit * 6;
  const isChasingInnings = innings.innings_number % 2 === 0;
  const chaseComplete = isChasingInnings && innings.target != null && totalRuns >= innings.target;
  const isCompleted = allOut || oversUp || chaseComplete;

  await conn.query(
    `UPDATE match_innings SET total_runs = ?, total_wickets = ?, total_balls = ?, extras = ?, balls_in_current_over = ?,
      striker_id = ?, non_striker_id = ?, current_bowler_id = ?, last_over_bowler_id = ?, is_completed = ?, all_out = ?,
      free_hit = ?
     WHERE id = ?`,
    [totalRuns, totalWickets, totalBalls, extras, ballsInCurrentOver, striker, nonStriker, bowler, lastOverBowler, isCompleted, allOut, freeHit, inningsId]
  );
}

async function undoLastBall(fixtureId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[fixture]] = await conn.query('SELECT * FROM fixtures WHERE id = ? FOR UPDATE', [fixtureId]);
    if (!fixture) throw httpError(404, 'Fixture not found');
    if (fixture.match_status !== 'live') throw httpError(400, 'Can only undo a ball while the match is live');

    const [[lastBall]] = await conn.query(
      `SELECT b.* FROM match_balls b JOIN match_innings i ON i.id = b.innings_id
       WHERE i.fixture_id = ? ORDER BY b.id DESC LIMIT 1`,
      [fixtureId]
    );
    if (!lastBall) throw httpError(400, 'No ball has been recorded yet for this match');

    const [[innings]] = await conn.query('SELECT * FROM match_innings WHERE id = ? FOR UPDATE', [lastBall.innings_id]);

    // If that ball ended this innings and immediately opened the chase half of
    // the same pair (or a super over was started right after), that next
    // innings only exists because of this ball and can't have any balls of
    // its own yet — this ball was, by construction, the last one recorded
    // anywhere in the fixture.
    const [[nextInnings]] = await conn.query(
      'SELECT id FROM match_innings WHERE fixture_id = ? AND innings_number = ?',
      [fixtureId, innings.innings_number + 1]
    );
    if (nextInnings) {
      await conn.query('DELETE FROM match_innings WHERE id = ?', [nextInnings.id]);
      await conn.query('UPDATE fixtures SET current_innings = ? WHERE id = ?', [innings.innings_number, fixtureId]);
    }

    await conn.query('DELETE FROM match_balls WHERE id = ?', [lastBall.id]);
    await recomputeInnings(conn, innings.id);

    await conn.commit();
    return getMatchState(fixtureId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function startSuperOver(fixtureId) {
  const [[fixture]] = await pool.query('SELECT * FROM fixtures WHERE id = ?', [fixtureId]);
  if (!fixture) throw httpError(404, 'Fixture not found');
  if (!['semifinal', 'final'].includes(fixture.stage)) {
    throw httpError(400, 'Super overs only apply to semifinal and final matches');
  }
  if (fixture.match_status === 'completed') throw httpError(400, 'This match is already finished');

  // A Super Over always nominates 3 batsmen regardless of the real roster
  // size (unlike the main match, where all_out is based on the actual
  // count) — so unlike starting the match, both rosters need at least 3
  // players or a Super Over innings could never legally reach all-out.
  const [[{ count: team1Count }]] = await pool.query('SELECT COUNT(*) AS count FROM players WHERE team_id = ?', [fixture.team1_id]);
  const [[{ count: team2Count }]] = await pool.query('SELECT COUNT(*) AS count FROM players WHERE team_id = ?', [fixture.team2_id]);
  if (team1Count < 3 || team2Count < 3) {
    throw httpError(400, 'Both teams need at least 3 players on their roster for a Super Over');
  }

  const [innings] = await pool.query('SELECT * FROM match_innings WHERE fixture_id = ? ORDER BY innings_number', [fixtureId]);
  const lastNumber = innings.length ? Math.max(...innings.map((i) => i.innings_number)) : 0;
  if (lastNumber % 2 !== 0) throw httpError(400, 'The current super over has not finished yet');

  const first = innings.find((i) => i.innings_number === lastNumber - 1);
  const second = innings.find((i) => i.innings_number === lastNumber);
  if (!first || !second || !second.is_completed) {
    throw httpError(400, 'The current innings have not finished yet');
  }
  if (first.total_runs !== second.total_runs) {
    throw httpError(400, 'Scores are not level — no super over is needed');
  }

  // Whoever batted second in the most recently completed pair — the regular
  // match the first time around, or the previous Super Over on a rematch —
  // bats first here. `second` is always that pair's chasing team (the pair
  // handoff at the bottom of recordBall always swaps teams between the two
  // halves), so this alternates the order every time a Super Over ties.
  await pool.query(
    `INSERT INTO match_innings (fixture_id, innings_number, batting_team_id, bowling_team_id, overs_limit)
     VALUES (?, ?, ?, ?, 1)`,
    [fixtureId, lastNumber + 1, second.batting_team_id, second.bowling_team_id]
  );
  await pool.query('UPDATE fixtures SET current_innings = ? WHERE id = ?', [lastNumber + 1, fixtureId]);

  return getMatchState(fixtureId);
}

// No universal formula for "impact" — weigh a wicket roughly like 25 runs,
// which is a common rough equivalence in fantasy-cricket scoring, and let
// the highest combined score win. Admins can't override this; it's automatic.
function pickTopPerformer(rows) {
  if (rows.length === 0) return null;
  const ranked = rows
    .map((r) => ({ playerId: r.player_id, score: Number(r.runs) + Number(r.wickets) * 25 }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].playerId;
}

async function computePlayerOfMatch(fixtureId) {
  const [rows] = await pool.query(
    `SELECT s.player_id, SUM(s.runs_scored) AS runs, SUM(s.wickets_taken) AS wickets
     FROM match_player_stats s
     JOIN match_innings i ON i.id = s.innings_id
     WHERE i.fixture_id = ?
     GROUP BY s.player_id`,
    [fixtureId]
  );
  return pickTopPerformer(rows);
}

// Same scoring as Player of the Match, but aggregated across every completed
// match in the tournament (every stage — league, play-offs, semis, final).
async function computePlayerOfTournament(tournamentId) {
  const [rows] = await pool.query(
    `SELECT s.player_id, SUM(s.runs_scored) AS runs, SUM(s.wickets_taken) AS wickets
     FROM match_player_stats s
     JOIN match_innings i ON i.id = s.innings_id
     JOIN fixtures f ON f.id = i.fixture_id
     WHERE f.tournament_id = ? AND f.match_status = 'completed'
     GROUP BY s.player_id`,
    [tournamentId]
  );
  return pickTopPerformer(rows);
}

const DECISIVE_STAGES = ['semifinal', 'final'];

async function finishMatch(fixtureId) {
  const [[fixture]] = await pool.query('SELECT * FROM fixtures WHERE id = ?', [fixtureId]);
  if (!fixture) throw httpError(404, 'Fixture not found');
  if (fixture.match_status === 'completed') throw httpError(400, 'This match is already finished');

  const [innings] = await pool.query('SELECT * FROM match_innings WHERE fixture_id = ? ORDER BY innings_number', [fixtureId]);
  const lastNumber = innings.length ? Math.max(...innings.map((i) => i.innings_number)) : 0;
  const decidingSecond = innings.find((i) => i.innings_number === lastNumber);
  const decidingFirst = innings.find((i) => i.innings_number === lastNumber - 1);
  if (!decidingFirst || !decidingSecond || !decidingSecond.is_completed) {
    throw httpError(400, 'The second innings has not finished yet');
  }

  let winnerTeamId = null;
  let resultType;
  if (decidingSecond.total_runs > decidingFirst.total_runs) {
    winnerTeamId = decidingSecond.batting_team_id;
    resultType = 'win';
  } else if (decidingSecond.total_runs < decidingFirst.total_runs) {
    winnerTeamId = decidingFirst.batting_team_id;
    resultType = 'win';
  } else if (DECISIVE_STAGES.includes(fixture.stage)) {
    throw httpError(400, 'Scores are level — start a Super Over to decide the winner before finishing');
  } else {
    resultType = 'tie';
  }

  const pomId = await computePlayerOfMatch(fixtureId);

  await pool.query(
    "UPDATE fixtures SET match_status = 'completed', winner_team_id = ?, result_type = ?, player_of_match_id = ? WHERE id = ?",
    [winnerTeamId, resultType, pomId, fixtureId]
  );

  await maybeAdvanceTournament(fixture.tournament_id);

  if (fixture.stage === 'final') {
    const potId = await computePlayerOfTournament(fixture.tournament_id);
    await pool.query('UPDATE tournaments SET player_of_tournament_id = ? WHERE id = ?', [potId, fixture.tournament_id]);
  }

  return getMatchState(fixtureId);
}

async function getPointsTable(tournamentId) {
  // Derived from THIS tournament's own league fixtures, not every team in
  // the room — a room can run many tournaments over time, and a team added
  // to the room after/between them shouldn't show up in an older
  // tournament's table with a false 0-played row.
  const [teams] = await pool.query(
    `SELECT DISTINCT t.id, t.team_name, t.logo_path
     FROM teams t
     JOIN fixtures f ON f.team1_id = t.id OR f.team2_id = t.id
     WHERE f.tournament_id = ? AND f.stage = 'league'`,
    [tournamentId]
  );
  const [fixtures] = await pool.query(
    "SELECT * FROM fixtures WHERE tournament_id = ? AND match_status = 'completed' AND stage = 'league'",
    [tournamentId]
  );

  const table = {};
  teams.forEach((t) => {
    table[t.id] = {
      team_id: t.id,
      team_name: t.team_name,
      logo_path: t.logo_path,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0
    };
  });

  let innings = [];
  const fixtureIds = fixtures.map((f) => f.id);
  if (fixtureIds.length) {
    [innings] = await pool.query('SELECT * FROM match_innings WHERE fixture_id IN (?)', [fixtureIds]);
  }

  for (const fx of fixtures) {
    const row1 = table[fx.team1_id];
    const row2 = table[fx.team2_id];
    if (!row1 || !row2) continue;

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
        const battingRow = table[inn.batting_team_id];
        const bowlingRow = table[inn.bowling_team_id];
        if (!battingRow || !bowlingRow) return;
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
    return { ...row, nrr: Math.round((rateFor - rateAgainst) * 1000) / 1000 };
  });

  rows.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  return rows;
}

async function getLeaderboard(tournamentId) {
  const [rows] = await pool.query(
    `SELECT p.id AS player_id, p.name AS player_name, t.team_name,
            SUM(s.runs_scored) AS total_runs, SUM(s.wickets_taken) AS total_wickets
     FROM match_player_stats s
     JOIN match_innings i ON i.id = s.innings_id
     JOIN fixtures f ON f.id = i.fixture_id
     JOIN players p ON p.id = s.player_id
     JOIN teams t ON t.id = s.team_id
     WHERE f.tournament_id = ? AND f.match_status = 'completed'
     GROUP BY p.id, p.name, t.team_name`,
    [tournamentId]
  );

  const withNumbers = rows.map((r) => ({ ...r, total_runs: Number(r.total_runs), total_wickets: Number(r.total_wickets) }));
  const topBatsmen = [...withNumbers].sort((a, b) => b.total_runs - a.total_runs).slice(0, 5);
  const topBowlers = [...withNumbers].sort((a, b) => b.total_wickets - a.total_wickets).slice(0, 5);
  return { topBatsmen, topBowlers };
}

module.exports = {
  httpError,
  getMatchState,
  getLiveMatchesSummary,
  startMatch,
  selectOpeners,
  selectBatsman,
  selectBowler,
  recordBall,
  undoLastBall,
  startSuperOver,
  finishMatch,
  getPointsTable,
  getLeaderboard
};
