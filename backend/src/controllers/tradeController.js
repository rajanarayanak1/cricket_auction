const pool = require('../config/db');

exports.executeTrade = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { player_out_id, team_in_id, players_in_ids } = req.body;

    if (!player_out_id || !team_in_id || !Array.isArray(players_in_ids) || players_in_ids.length === 0) {
      return res.status(400).json({ message: 'player_out_id, team_in_id and at least one player to trade for are required' });
    }

    const [[playerOut]] = await pool.query(
      'SELECT * FROM players WHERE id = ? AND auction_room_id = ?',
      [player_out_id, roomId]
    );
    if (!playerOut) return res.status(404).json({ message: 'Player to trade away was not found' });
    if (!playerOut.team_id) return res.status(400).json({ message: 'That player is not currently on a team' });
    if (playerOut.is_captain) return res.status(400).json({ message: 'Captains cannot be traded' });

    const teamOutId = playerOut.team_id;
    if (Number(team_in_id) === Number(teamOutId)) {
      return res.status(400).json({ message: 'Cannot trade with the same team' });
    }
    if (players_in_ids.includes(player_out_id)) {
      return res.status(400).json({ message: 'The traded-away player cannot also be part of the return package' });
    }

    const [[teamOut]] = await pool.query('SELECT * FROM teams WHERE id = ? AND auction_room_id = ?', [teamOutId, roomId]);
    const [[teamIn]] = await pool.query('SELECT * FROM teams WHERE id = ? AND auction_room_id = ?', [team_in_id, roomId]);
    if (!teamOut || !teamIn) return res.status(404).json({ message: 'One of the teams was not found' });

    const [playersIn] = await pool.query(
      'SELECT * FROM players WHERE auction_room_id = ? AND id IN (?)',
      [roomId, players_in_ids]
    );
    if (playersIn.length !== players_in_ids.length) {
      return res.status(400).json({ message: 'One or more selected players could not be found' });
    }
    const invalidPlayer = playersIn.find((p) => Number(p.team_id) !== Number(team_in_id));
    if (invalidPlayer) {
      return res.status(400).json({ message: `${invalidPlayer.name} is not on the selected team` });
    }
    const captainIn = playersIn.find((p) => p.is_captain);
    if (captainIn) {
      return res.status(400).json({ message: `${captainIn.name} is a captain and cannot be traded` });
    }

    const [[{ countOut }]] = await pool.query('SELECT COUNT(*) AS countOut FROM players WHERE team_id = ?', [teamOutId]);
    const [[{ countIn }]] = await pool.query('SELECT COUNT(*) AS countIn FROM players WHERE team_id = ?', [team_in_id]);

    const newCountOut = countOut - 1 + playersIn.length;
    const newCountIn = countIn - playersIn.length + 1;

    if (newCountOut > teamOut.num_players) {
      return res.status(400).json({ message: `${teamOut.team_name}'s roster only has room for ${teamOut.num_players} players` });
    }
    if (newCountIn > teamIn.num_players) {
      return res.status(400).json({ message: `${teamIn.team_name}'s roster only has room for ${teamIn.num_players} players` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE players SET team_id = ? WHERE id = ?', [team_in_id, player_out_id]);
      await conn.query('UPDATE players SET team_id = ? WHERE id IN (?)', [teamOutId, players_in_ids]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query('SELECT * FROM players WHERE auction_room_id = ? ORDER BY created_at DESC', [roomId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to complete trade', error: err.message });
  }
};
