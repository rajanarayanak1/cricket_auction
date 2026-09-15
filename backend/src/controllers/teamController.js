const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'];

exports.getTeamsByRoom = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM teams WHERE auction_room_id = ? ORDER BY created_at DESC',
      [req.params.roomId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teams', error: err.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { team_name, num_players } = req.body;

    if (!team_name || !num_players) {
      return res.status(400).json({ message: 'team_name and num_players are required' });
    }

    const [[room]] = await pool.query('SELECT purse_value FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });

    const logoPath = req.file ? `/uploads/logos/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO teams (auction_room_id, team_name, logo_path, num_players, purse_remaining)
       VALUES (?, ?, ?, ?, ?)`,
      [roomId, team_name, logoPath, num_players, room.purse_value]
    );

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create team', error: err.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const { team_name, num_players } = req.body;

    const [existingRows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.teamId]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Team not found' });

    let logoPath = existingRows[0].logo_path;
    if (req.file) {
      if (logoPath) {
        const oldFile = path.join(__dirname, '..', '..', logoPath);
        fs.unlink(oldFile, () => {});
      }
      logoPath = `/uploads/logos/${req.file.filename}`;
    }

    await pool.query(
      `UPDATE teams SET team_name = ?, logo_path = ?, num_players = ? WHERE id = ?`,
      [team_name, logoPath, num_players, req.params.teamId]
    );

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.teamId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update team', error: err.message });
  }
};

exports.updateTeamOwner = async (req, res) => {
  try {
    const ownerName = (req.body.owner_name || '').trim() || null;
    const ownerJerseyNumber = (req.body.owner_jersey_number || '').trim() || null;
    const ownerJerseySize = req.body.owner_jersey_size || null;

    if (ownerJerseySize && !JERSEY_SIZES.includes(ownerJerseySize)) {
      return res.status(400).json({ message: `owner_jersey_size must be one of ${JERSEY_SIZES.join(', ')}` });
    }

    const [result] = await pool.query(
      'UPDATE teams SET owner_name = ?, owner_jersey_number = ?, owner_jersey_size = ? WHERE id = ?',
      [ownerName, ownerJerseyNumber, ownerJerseySize, req.params.teamId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Team not found' });

    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.teamId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update team owner', error: err.message });
  }
};

// Lets an admin lock in a team's captain before the auction starts, at a
// price they set directly (base_value) rather than through bidding — the
// player is sold to the team immediately, so the normal auction pool
// (which only ever looks at auction_status = 'pending') never sees them.
exports.assignCaptain = async (req, res) => {
  try {
    const { roomId, teamId } = req.params;
    const playerId = Number(req.body.player_id);
    const baseValue = Number(req.body.base_value);

    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    if (room.status !== 'created') {
      return res.status(400).json({ message: 'Captains can only be assigned before the auction starts' });
    }

    const [[team]] = await pool.query('SELECT * FROM teams WHERE id = ? AND auction_room_id = ?', [teamId, roomId]);
    if (!team) return res.status(404).json({ message: 'Team not found in this auction room' });

    if (!playerId) return res.status(400).json({ message: 'player_id is required' });
    if (!Number.isFinite(baseValue) || baseValue <= 0) {
      return res.status(400).json({ message: 'base_value must be a positive number' });
    }

    const [[player]] = await pool.query('SELECT * FROM players WHERE id = ? AND auction_room_id = ?', [playerId, roomId]);
    if (!player) return res.status(404).json({ message: 'Player not found in this auction room' });
    if (!player.is_captain) {
      return res.status(400).json({ message: 'Only a player flagged as Captain (in the Players tab) can be assigned this way' });
    }
    if (player.team_id) return res.status(400).json({ message: 'That player is already assigned to a team' });
    if (player.auction_status !== 'pending') {
      return res.status(400).json({ message: 'That player has already been through the auction' });
    }

    const [[{ boughtCount }]] = await pool.query('SELECT COUNT(*) AS boughtCount FROM players WHERE team_id = ?', [teamId]);
    if (boughtCount >= team.num_players) {
      return res.status(400).json({ message: 'Team roster is already full' });
    }
    if (baseValue > Number(team.purse_remaining)) {
      return res.status(400).json({ message: `${team.team_name} does not have enough purse remaining for this` });
    }

    const [[existingCaptain]] = await pool.query(
      'SELECT id FROM players WHERE team_id = ? AND is_captain = 1',
      [teamId]
    );
    if (existingCaptain) {
      return res.status(400).json({ message: 'This team already has a captain assigned — unassign them first' });
    }

    await pool.query(
      `UPDATE players SET team_id = ?, sold_price = ?, base_value = ?, auction_status = 'sold',
        is_captain = 1, original_is_captain = 1 WHERE id = ?`,
      [teamId, baseValue, baseValue, playerId]
    );
    await pool.query('UPDATE teams SET purse_remaining = purse_remaining - ? WHERE id = ?', [baseValue, teamId]);

    const [[updatedPlayer]] = await pool.query('SELECT * FROM players WHERE id = ?', [playerId]);
    const [[updatedTeam]] = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    res.json({ player: updatedPlayer, team: updatedTeam });
  } catch (err) {
    res.status(500).json({ message: 'Failed to assign captain', error: err.message });
  }
};

exports.unassignCaptain = async (req, res) => {
  try {
    const { roomId, teamId } = req.params;

    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });
    if (room.status !== 'created') {
      return res.status(400).json({ message: 'Captains can only be unassigned before the auction starts' });
    }

    const [[captain]] = await pool.query(
      'SELECT * FROM players WHERE team_id = ? AND auction_room_id = ? AND is_captain = 1',
      [teamId, roomId]
    );
    if (!captain) return res.status(404).json({ message: 'This team has no directly-assigned captain' });

    await pool.query('UPDATE teams SET purse_remaining = purse_remaining + ? WHERE id = ?', [captain.sold_price, teamId]);
    // is_captain (and the permanent original_is_captain) stay untouched here —
    // unassigning only frees the player from THIS team, it doesn't strip their
    // Captain designation. Clearing is_captain would make them fail
    // assignCaptain's own eligibility check and vanish from every other
    // team's captain dropdown.
    await pool.query(
      `UPDATE players SET team_id = NULL, sold_price = NULL, auction_status = 'pending' WHERE id = ?`,
      [captain.id]
    );

    const [[updatedPlayer]] = await pool.query('SELECT * FROM players WHERE id = ?', [captain.id]);
    const [[updatedTeam]] = await pool.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    res.json({ player: updatedPlayer, team: updatedTeam });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unassign captain', error: err.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.teamId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Team not found' });

    if (rows[0].logo_path) {
      const filePath = path.join(__dirname, '..', '..', rows[0].logo_path);
      fs.unlink(filePath, () => {});
    }

    await pool.query('DELETE FROM teams WHERE id = ?', [req.params.teamId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete team', error: err.message });
  }
};
