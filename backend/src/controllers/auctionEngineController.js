const pool = require('../config/db');
const { pickNextPlayer, buildLiveState } = require('../services/auctionEngine');

exports.getState = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load live auction state', error: err.message });
  }
};

exports.placeBid = async (req, res) => {
  try {
    const { roomId } = req.params;
    const teamId = Number(req.body.team_id);

    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    if (!room.current_player_id) return res.status(400).json({ message: 'There is no active player to bid on' });
    if (room.current_bid_team_id === teamId) {
      return res.status(400).json({ message: 'This team is already the highest bidder' });
    }

    const [[player]] = await pool.query('SELECT * FROM players WHERE id = ?', [room.current_player_id]);
    const [[team]] = await pool.query('SELECT * FROM teams WHERE id = ? AND auction_room_id = ?', [teamId, roomId]);
    if (!team) return res.status(404).json({ message: 'Team not found in this auction room' });

    const [[{ boughtCount }]] = await pool.query('SELECT COUNT(*) AS boughtCount FROM players WHERE team_id = ?', [teamId]);
    if (boughtCount >= team.num_players) {
      return res.status(400).json({ message: 'Team roster is already full' });
    }

    // The first bid on a player just claims them at their base price — the
    // step-up only kicks in once there's an existing bid to raise.
    const isFirstBid = room.current_bid_amount == null;
    const nextBid = isFirstBid
      ? Number(player.base_value)
      : Number(room.current_bid_amount) + Number(room.bid_step_up);

    const remainingAfterThis = Math.max(team.num_players - boughtCount - 1, 0);
    const reserve = remainingAfterThis * Number(player.base_value);
    const maxAllowedBid = Number(team.purse_remaining) - reserve;

    if (nextBid > maxAllowedBid) {
      return res.status(400).json({ message: `${team.team_name} does not have enough purse remaining for this bid` });
    }

    await pool.query(
      'INSERT INTO bid_history (auction_room_id, player_id, team_id, bid_amount) VALUES (?, ?, ?, ?)',
      [roomId, player.id, teamId, nextBid]
    );
    await pool.query(
      'UPDATE auction_rooms SET current_bid_amount = ?, current_bid_team_id = ? WHERE id = ?',
      [nextBid, teamId, roomId]
    );

    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to place bid', error: err.message });
  }
};

exports.undoBid = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room || !room.current_player_id) return res.status(400).json({ message: 'No active player' });

    const [history] = await pool.query(
      'SELECT * FROM bid_history WHERE auction_room_id = ? AND player_id = ? ORDER BY id DESC',
      [roomId, room.current_player_id]
    );
    if (history.length === 0) return res.status(400).json({ message: 'No bids to undo' });

    await pool.query('DELETE FROM bid_history WHERE id = ?', [history[0].id]);
    const previous = history[1] || null;

    await pool.query(
      'UPDATE auction_rooms SET current_bid_amount = ?, current_bid_team_id = ? WHERE id = ?',
      [previous ? previous.bid_amount : null, previous ? previous.team_id : null, roomId]
    );

    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to undo bid', error: err.message });
  }
};

exports.markSold = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room || !room.current_player_id) return res.status(400).json({ message: 'No active player' });
    if (!room.current_bid_team_id) return res.status(400).json({ message: 'No team has bid on this player yet' });

    const [[player]] = await pool.query('SELECT * FROM players WHERE id = ?', [room.current_player_id]);
    const soldPrice = room.current_bid_amount != null ? Number(room.current_bid_amount) : Number(player.base_value);

    await pool.query("UPDATE players SET team_id = ?, sold_price = ?, auction_status = 'sold' WHERE id = ?", [
      room.current_bid_team_id,
      soldPrice,
      room.current_player_id
    ]);
    await pool.query('UPDATE teams SET purse_remaining = purse_remaining - ? WHERE id = ?', [
      soldPrice,
      room.current_bid_team_id
    ]);
    await pool.query('DELETE FROM bid_history WHERE player_id = ?', [room.current_player_id]);

    await pickNextPlayer(roomId);
    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark player as sold', error: err.message });
  }
};

exports.markUnsold = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room || !room.current_player_id) return res.status(400).json({ message: 'No active player' });
    if (room.current_bid_team_id) {
      return res.status(400).json({ message: 'This player already has a bid — undo the bid first if you want to mark it unsold' });
    }

    const [[player]] = await pool.query('SELECT * FROM players WHERE id = ?', [room.current_player_id]);

    if (player.auction_status === 'unsold') {
      // Second time round with no takers — retire it from further picking so the auction can finish.
      await pool.query('UPDATE players SET unsold_revisited = 1 WHERE id = ?', [player.id]);
    } else {
      await pool.query("UPDATE players SET auction_status = 'unsold', unsold_revisited = 0 WHERE id = ?", [player.id]);
    }

    await pickNextPlayer(roomId);
    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark player as unsold', error: err.message });
  }
};

exports.resumeUnsold = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    if (room.phase !== 'completed') {
      return res.status(400).json({ message: 'The main auction is still in progress' });
    }

    const [unsoldPlayers] = await pool.query(
      `SELECT * FROM players WHERE auction_room_id = ? AND team_id IS NULL AND auction_status = 'unsold'`,
      [roomId]
    );
    if (unsoldPlayers.length === 0) {
      return res.status(400).json({ message: 'There are no unsold players to resume' });
    }

    await pool.query(
      `UPDATE players SET unsold_revisited = 0 WHERE auction_room_id = ? AND team_id IS NULL AND auction_status = 'unsold'`,
      [roomId]
    );
    await pool.query("UPDATE auction_rooms SET status = 'live', phase = 'unsold_round' WHERE id = ?", [roomId]);

    await pickNextPlayer(roomId);
    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to resume auction for unsold players', error: err.message });
  }
};

exports.finishAuction = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [result] = await pool.query("UPDATE auction_rooms SET status = 'completed' WHERE id = ?", [roomId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Auction room not found' });
    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to finish auction', error: err.message });
  }
};

exports.resetAuction = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    if (room.status === 'created') {
      return res.status(400).json({ message: 'This auction has not started yet — there is nothing to reset' });
    }

    await pool.query(
      `UPDATE players
       SET team_id = NULL, sold_price = NULL,
           is_captain = original_is_captain, is_icon = original_is_icon,
           auction_status = 'pending', unsold_revisited = 0,
           jersey_number = NULL, jersey_size = NULL, sleeve_type = NULL
       WHERE auction_room_id = ?`,
      [roomId]
    );
    await pool.query(
      `UPDATE teams t JOIN auction_rooms r ON r.id = t.auction_room_id
       SET t.purse_remaining = r.purse_value
       WHERE t.auction_room_id = ?`,
      [roomId]
    );
    await pool.query('DELETE FROM bid_history WHERE auction_room_id = ?', [roomId]);
    // Deleting the tournament rows cascades (via FK ON DELETE CASCADE) through
    // fixtures -> match_innings -> match_balls/match_player_stats, so no
    // explicit cleanup of those tables is needed. Teams/players themselves
    // are never touched here — only the schedule/match data tied to the
    // auction that just got un-sold. This wipes EVERY tournament the room
    // has ever run, not just an in-progress one — resetting the auction
    // already meant redoing the one schedule that existed before tournaments
    // existed, so this is the same blast radius, just now covering however
    // many tournaments have accumulated over the room's lifetime.
    await pool.query('DELETE FROM tournaments WHERE auction_room_id = ?', [roomId]);
    await pool.query(
      `UPDATE auction_rooms
       SET status = 'created', phase = 'not_started',
           current_player_id = NULL, current_bid_amount = NULL, current_bid_team_id = NULL, last_category = NULL
       WHERE id = ?`,
      [roomId]
    );

    res.json(await buildLiveState(roomId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset auction', error: err.message });
  }
};
