const pool = require('../config/db');
const { buildFixtureRows, insertFixtureRows } = require('../services/fixtureGenerator');
const { getOngoingTournament, listTournamentsWithCounts, getTournamentDetail } = require('../services/tournamentEngine');

exports.listTournaments = async (req, res) => {
  try {
    res.json(await listTournamentsWithCounts({ auctionRoomId: req.params.roomId }));
  } catch (err) {
    res.status(500).json({ message: 'Failed to list tournaments', error: err.message });
  }
};

// Admin dashboard's "Tournaments" tab — scoped to the requesting admin's own
// rooms. The public equivalent (publicController) calls
// listTournamentsWithCounts() with no adminId, and stays global on purpose.
exports.listAllTournaments = async (req, res) => {
  try {
    res.json(await listTournamentsWithCounts({ adminId: req.admin.id }));
  } catch (err) {
    res.status(500).json({ message: 'Failed to list tournaments', error: err.message });
  }
};

exports.getTournament = async (req, res) => {
  try {
    const tournament = await getTournamentDetail(req.params.tournamentId);
    if (!tournament || tournament.auction_room_id !== Number(req.params.roomId)) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load tournament', error: err.message });
  }
};

// Creating a tournament and generating its initial fixtures is ONE atomic
// step (not "create an empty tournament, then separately add fixtures") —
// splitting it would risk a tournament permanently stuck with zero fixtures,
// which counts as "ongoing" forever and would block ever starting a new one.
exports.createTournament = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, type, max_teams_per_pool, skip_league, league_match_count } = req.body;

    const trimmedName = (name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Tournament name is required' });

    const [[room]] = await pool.query('SELECT id FROM auction_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ message: 'Auction room not found' });

    const ongoing = await getOngoingTournament(roomId);
    if (ongoing) {
      return res.status(400).json({
        message: `Finish "${ongoing.name}" (complete all its fixtures) before creating a new tournament`
      });
    }

    const [[existing]] = await pool.query(
      'SELECT id FROM tournaments WHERE auction_room_id = ? AND name = ?',
      [roomId, trimmedName]
    );
    if (existing) {
      return res.status(400).json({ message: `A tournament named "${trimmedName}" already exists for this auction` });
    }

    const [teams] = await pool.query('SELECT id FROM teams WHERE auction_room_id = ?', [roomId]);
    const teamIds = teams.map((t) => t.id);
    const rows = buildFixtureRows(teamIds, type, max_teams_per_pool, {
      skipLeague: !!skip_league,
      leagueMatchCount: Number(league_match_count) || 1
    });

    const conn = await pool.getConnection();
    let tournamentId;
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'INSERT INTO tournaments (auction_room_id, name) VALUES (?, ?)',
        [roomId, trimmedName]
      );
      tournamentId = result.insertId;
      await insertFixtureRows(conn, { tournamentId, auctionRoomId: roomId, type, rows });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.status(201).json(await getTournamentDetail(tournamentId));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to create tournament' });
  }
};
