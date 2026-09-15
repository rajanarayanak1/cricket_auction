const pool = require('../config/db');

const CATEGORY_ORDER = ['Batsman', 'Bowler', 'All Rounder'];

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

async function setCurrentPlayer(roomId, phase, playerId) {
  await pool.query(
    `UPDATE auction_rooms SET phase = ?, current_player_id = ?, current_bid_amount = NULL, current_bid_team_id = NULL
     WHERE id = ?`,
    [phase, playerId, roomId]
  );
}

async function markAuctionComplete(roomId) {
  await pool.query(
    `UPDATE auction_rooms SET phase = 'completed', current_player_id = NULL, current_bid_amount = NULL, current_bid_team_id = NULL
     WHERE id = ?`,
    [roomId]
  );
}

/**
 * Advances the auction to the next player, cascading through phases
 * (captains -> icons -> normal, category round-robin) as each phase's
 * exit condition is met. Mutates auction_rooms.phase/current_player_id.
 */
async function pickNextPlayer(roomId) {
  const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
  if (!room) return;

  const [[{ teamCount }]] = await pool.query(
    'SELECT COUNT(*) AS teamCount FROM teams WHERE auction_room_id = ?',
    [roomId]
  );

  let phase = room.phase === 'not_started' ? 'captains' : room.phase;

  if (phase === 'captains') {
    const [[{ teamsWithCaptain }]] = await pool.query(
      `SELECT COUNT(DISTINCT team_id) AS teamsWithCaptain FROM players
       WHERE auction_room_id = ? AND is_captain = 1 AND team_id IS NOT NULL`,
      [roomId]
    );
    const [unsoldCaptains] = await pool.query(
      `SELECT * FROM players WHERE auction_room_id = ? AND is_captain = 1 AND team_id IS NULL AND auction_status = 'pending'`,
      [roomId]
    );

    const captainPhaseDone = (teamCount > 0 && teamsWithCaptain >= teamCount) || unsoldCaptains.length === 0;

    if (captainPhaseDone) {
      await pool.query(
        `UPDATE players SET is_captain = 0 WHERE auction_room_id = ? AND is_captain = 1 AND team_id IS NULL`,
        [roomId]
      );
      phase = 'icons';
    } else {
      await setCurrentPlayer(roomId, 'captains', pickRandom(unsoldCaptains).id);
      return;
    }
  }

  if (phase === 'icons') {
    const [[{ teamsWithIcon }]] = await pool.query(
      `SELECT COUNT(DISTINCT team_id) AS teamsWithIcon FROM players
       WHERE auction_room_id = ? AND is_icon = 1 AND team_id IS NOT NULL`,
      [roomId]
    );
    const [unsoldIcons] = await pool.query(
      `SELECT * FROM players WHERE auction_room_id = ? AND is_icon = 1 AND team_id IS NULL AND auction_status = 'pending'`,
      [roomId]
    );

    const iconPhaseDone = (teamCount > 0 && teamsWithIcon >= teamCount) || unsoldIcons.length === 0;

    if (iconPhaseDone) {
      await pool.query(
        `UPDATE players SET is_icon = 0 WHERE auction_room_id = ? AND is_icon = 1 AND team_id IS NULL`,
        [roomId]
      );
      phase = 'normal';
    } else {
      await setCurrentPlayer(roomId, 'icons', pickRandom(unsoldIcons).id);
      return;
    }
  }

  if (phase === 'normal') {
    const [remaining] = await pool.query(
      `SELECT * FROM players WHERE auction_room_id = ? AND team_id IS NULL AND auction_status = 'pending'`,
      [roomId]
    );

    if (remaining.length > 0) {
      const startIndex = room.last_category ? (CATEGORY_ORDER.indexOf(room.last_category) + 1) % 3 : 0;
      let chosenCategory = null;
      let candidates = [];
      for (let i = 0; i < CATEGORY_ORDER.length; i++) {
        const category = CATEGORY_ORDER[(startIndex + i) % CATEGORY_ORDER.length];
        const list = remaining.filter((p) => p.category === category);
        if (list.length > 0) {
          chosenCategory = category;
          candidates = list;
          break;
        }
      }

      const chosen = pickRandom(candidates);
      await pool.query(
        `UPDATE auction_rooms SET phase = 'normal', last_category = ?, current_player_id = ?, current_bid_amount = NULL, current_bid_team_id = NULL
         WHERE id = ?`,
        [chosenCategory, chosen.id, roomId]
      );
      return;
    }

    phase = 'unsold_round';
  }

  if (phase === 'unsold_round') {
    const [unsoldPool] = await pool.query(
      `SELECT * FROM players WHERE auction_room_id = ? AND team_id IS NULL AND auction_status = 'unsold' AND unsold_revisited = 0`,
      [roomId]
    );

    if (unsoldPool.length === 0) {
      await markAuctionComplete(roomId);
      return;
    }

    await setCurrentPlayer(roomId, 'unsold_round', pickRandom(unsoldPool).id);
  }
}

async function buildLiveState(roomId) {
  const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
  const [teams] = await pool.query('SELECT * FROM teams WHERE auction_room_id = ? ORDER BY id', [roomId]);
  const [players] = await pool.query('SELECT * FROM players WHERE auction_room_id = ?', [roomId]);

  const teamsWithCounts = teams.map((team) => ({
    ...team,
    bought_count: players.filter((p) => p.team_id === team.id).length
  }));

  const currentPlayer = room.current_player_id
    ? players.find((p) => p.id === room.current_player_id) || null
    : null;

  const remainingCount = players.filter((p) => !p.team_id).length;

  return { room, teams: teamsWithCounts, players, currentPlayer, remainingCount };
}

module.exports = { pickNextPlayer, buildLiveState, CATEGORY_ORDER };
