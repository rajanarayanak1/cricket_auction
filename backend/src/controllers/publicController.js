const pool = require('../config/db');
const matchEngine = require('../services/matchEngine');
const { listTournamentsWithCounts, getTournamentDetail } = require('../services/tournamentEngine');

// Everything here is intentionally unauthenticated — a public, read-only
// mirror of the live scoring/tournament data so anyone with the link can
// follow along without an admin account. No purse/bid/credential data is
// ever touched by any of these.

exports.getLiveMatches = async (req, res) => {
  try {
    res.json(await matchEngine.getLiveMatchesSummary());
  } catch (err) {
    res.status(500).json({ message: 'Failed to load live matches', error: err.message });
  }
};

exports.getMatch = async (req, res) => {
  try {
    const state = await matchEngine.getMatchState(req.params.fixtureId);
    if (!state) return res.status(404).json({ message: 'Match not found' });
    res.json(state);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load match', error: err.message });
  }
};

exports.listTournaments = async (req, res) => {
  try {
    res.json(await listTournamentsWithCounts());
  } catch (err) {
    res.status(500).json({ message: 'Failed to load tournaments', error: err.message });
  }
};

exports.getTournament = async (req, res) => {
  try {
    const tournament = await getTournamentDetail(req.params.tournamentId);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load tournament', error: err.message });
  }
};

exports.listCompletedAuctions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.name, r.auction_date, r.num_teams, COUNT(p.id) AS player_count
       FROM auction_rooms r
       LEFT JOIN players p ON p.auction_room_id = r.id
       WHERE r.status = 'completed'
       GROUP BY r.id
       ORDER BY r.auction_date DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load completed auctions', error: err.message });
  }
};

// Player list for a completed auction — name/photo/category only, never
// sold_price or team purse info, since this is shown to unauthenticated
// visitors before the price is meant to be public.
exports.getCompletedAuction = async (req, res) => {
  try {
    const [[room]] = await pool.query(
      `SELECT id, name, auction_date, num_teams FROM auction_rooms WHERE id = ? AND status = 'completed'`,
      [req.params.roomId]
    );
    if (!room) return res.status(404).json({ message: 'Auction not found' });

    const [players] = await pool.query(
      `SELECT id, name, category, photo_path FROM players WHERE auction_room_id = ? ORDER BY name`,
      [room.id]
    );

    res.json({ ...room, players });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load auction', error: err.message });
  }
};
