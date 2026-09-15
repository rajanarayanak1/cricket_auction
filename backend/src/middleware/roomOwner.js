const pool = require('../config/db');

// Every route this guards operates on a single auction room (by :roomId or,
// for the top-level auctionRoomsRouter, :id). 404 rather than 403 on a
// mismatch so a non-owner can't even confirm the room exists.
module.exports = async function requireRoomOwner(req, res, next) {
  const roomId = req.params.roomId || req.params.id;
  try {
    const [[room]] = await pool.query('SELECT admin_id FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room || room.admin_id !== req.admin.id) {
      return res.status(404).json({ message: 'Auction room not found' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Failed to verify auction room access', error: err.message });
  }
};
