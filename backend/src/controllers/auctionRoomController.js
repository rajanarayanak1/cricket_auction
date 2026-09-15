const pool = require('../config/db');
const { pickNextPlayer } = require('../services/auctionEngine');

exports.getAllRooms = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM auction_rooms WHERE admin_id = ? ORDER BY created_at DESC',
      [req.admin.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch auction rooms', error: err.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Auction room not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch auction room', error: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { name, auction_date, num_teams, purse_value, bid_step_up } = req.body;

    if (!name || !auction_date || !num_teams || !purse_value || !bid_step_up) {
      return res.status(400).json({ message: 'name, auction_date, num_teams, purse_value and bid_step_up are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO auction_rooms (admin_id, name, auction_date, num_teams, purse_value, bid_step_up, status)
       VALUES (?, ?, ?, ?, ?, ?, 'created')`,
      [req.admin.id, name, auction_date, num_teams, purse_value, bid_step_up]
    );

    const [rows] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create auction room', error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM auction_rooms WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Auction room not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete auction room', error: err.message });
  }
};

exports.startAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const [[room]] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [id]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });

    if (room.status === 'created') {
      const [[{ teamCount }]] = await pool.query('SELECT COUNT(*) AS teamCount FROM teams WHERE auction_room_id = ?', [id]);
      const [[{ playerCount }]] = await pool.query('SELECT COUNT(*) AS playerCount FROM players WHERE auction_room_id = ?', [id]);
      if (teamCount === 0) return res.status(400).json({ message: 'Add at least one team before starting the auction' });
      if (playerCount === 0) return res.status(400).json({ message: 'Add at least one player before starting the auction' });

      await pool.query(`UPDATE auction_rooms SET status = 'live' WHERE id = ?`, [id]);
      await pickNextPlayer(id);
    }

    const [rows] = await pool.query('SELECT * FROM auction_rooms WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to start auction', error: err.message });
  }
};
