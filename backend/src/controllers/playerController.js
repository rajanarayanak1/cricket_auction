const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { savePlayerPhotoAsWebp, fetchImageBuffer } = require('../utils/imagePipeline');

const CATEGORIES = ['Batsman', 'Bowler', 'All Rounder'];
const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'];
const SLEEVE_TYPES = ['Full', 'Half'];

const toBool = (value) => value === true || value === 'true' || value === '1' || value === 1;

// Shared by createPlayer/updatePlayer: a direct file upload (req.file, from
// multer's memory storage) always wins over a photo_url text field, since a
// caller sending both would only do so by accident. Returns null when
// neither is present — "no new photo" — vs. throwing when one was given but
// couldn't be turned into a usable image.
async function resolveIncomingPhoto(req) {
  if (req.file) {
    return savePlayerPhotoAsWebp(req.file.buffer);
  }
  const photoUrl = (req.body.photo_url || '').trim();
  if (photoUrl) {
    const buffer = await fetchImageBuffer(photoUrl);
    return savePlayerPhotoAsWebp(buffer);
  }
  return null;
}

exports.getPlayersByRoom = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM players WHERE auction_room_id = ? ORDER BY created_at DESC',
      [req.params.roomId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch players', error: err.message });
  }
};

exports.createPlayer = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, category, base_value, is_captain, is_icon } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: 'name and category are required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of ${CATEGORIES.join(', ')}` });
    }

    const captain = toBool(is_captain);
    const icon = toBool(is_icon);

    let photoPath = null;
    try {
      photoPath = await resolveIncomingPhoto(req);
    } catch (photoErr) {
      return res.status(400).json({ message: `Could not process the player photo — ${photoErr.message}` });
    }

    const [result] = await pool.query(
      `INSERT INTO players (auction_room_id, name, category, base_value, is_captain, is_icon, original_is_captain, original_is_icon, photo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, name, category, base_value ?? 1000, captain, icon, captain, icon, photoPath]
    );

    const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create player', error: err.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const { name, category, base_value, is_captain, is_icon } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: 'name and category are required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of ${CATEGORIES.join(', ')}` });
    }

    const [[existing]] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
    if (!existing) return res.status(404).json({ message: 'Player not found' });

    let photoPath = existing.photo_path;
    try {
      const newPhotoPath = await resolveIncomingPhoto(req);
      if (newPhotoPath) {
        if (photoPath) {
          fs.unlink(path.join(__dirname, '..', '..', photoPath), () => {});
        }
        photoPath = newPhotoPath;
      }
    } catch (photoErr) {
      return res.status(400).json({ message: `Could not process the player photo — ${photoErr.message}` });
    }

    const captain = toBool(is_captain);
    const icon = toBool(is_icon);

    await pool.query(
      `UPDATE players SET name = ?, category = ?, base_value = ?, is_captain = ?, is_icon = ?,
       original_is_captain = ?, original_is_icon = ?, photo_path = ?
       WHERE id = ?`,
      [name, category, base_value ?? 1000, captain, icon, captain, icon, photoPath, req.params.playerId]
    );

    const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update player', error: err.message });
  }
};

exports.updatePlayerKit = async (req, res) => {
  try {
    const { jersey_number, jersey_size, sleeve_type } = req.body;

    if (jersey_size && !JERSEY_SIZES.includes(jersey_size)) {
      return res.status(400).json({ message: `jersey_size must be one of ${JERSEY_SIZES.join(', ')}` });
    }
    if (sleeve_type && !SLEEVE_TYPES.includes(sleeve_type)) {
      return res.status(400).json({ message: `sleeve_type must be one of ${SLEEVE_TYPES.join(', ')}` });
    }

    const [result] = await pool.query(
      `UPDATE players SET jersey_number = ?, jersey_size = ?, sleeve_type = ? WHERE id = ?`,
      [jersey_number || null, jersey_size || null, sleeve_type || null, req.params.playerId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Player not found' });

    const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update player kit', error: err.message });
  }
};

// Bulk-clears every player in a room — deliberately restricted to the setup
// window (before the auction starts) rather than reusing the broader
// "not yet completed" idea elsewhere in this file: once bidding is live,
// deleting sold players would leave a team's purse deduction orphaned with
// no player to show for it, and once a tournament has started, deleting the
// players behind it would corrupt fixtures/results already recorded.
exports.deleteAllPlayers = async (req, res) => {
  try {
    const { roomId } = req.params;

    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });

    if (room.status !== 'created') {
      return res.status(400).json({ message: 'Players can only be bulk-deleted before the auction starts' });
    }

    const [[{ startedCount }]] = await pool.query(
      `SELECT COUNT(*) AS startedCount
       FROM fixtures f
       JOIN tournaments t ON t.id = f.tournament_id
       WHERE t.auction_room_id = ? AND f.match_status != 'not_started'`,
      [roomId]
    );
    if (startedCount > 0) {
      return res.status(400).json({ message: 'A tournament has already started for this room — bulk delete is disabled' });
    }

    const [players] = await pool.query('SELECT id, photo_path FROM players WHERE auction_room_id = ?', [roomId]);
    players.forEach((player) => {
      if (player.photo_path) {
        fs.unlink(path.join(__dirname, '..', '..', player.photo_path), () => {});
      }
    });

    await pool.query('DELETE FROM players WHERE auction_room_id = ?', [roomId]);
    res.json({ deletedCount: players.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete all players', error: err.message });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    const [[player]] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.playerId]);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    if (player.photo_path) {
      fs.unlink(path.join(__dirname, '..', '..', player.photo_path), () => {});
    }

    await pool.query('DELETE FROM players WHERE id = ?', [req.params.playerId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete player', error: err.message });
  }
};
