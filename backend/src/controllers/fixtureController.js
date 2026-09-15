const pool = require('../config/db');
const { buildFixtureRows, insertFixtureRows } = require('../services/fixtureGenerator');
const { getTournamentDetail } = require('../services/tournamentEngine');

// Single-fixture lookup, joined the same way the old room-wide list used
// to be — needed by MatchDetail.jsx (and any other page that only knows a
// fixtureId) now that fixtures aren't listed flat per room anymore.
// Also surfaces the owning tournament's fixtures_finalized/id, since the
// "can this match start yet" gate now lives on the tournament, not the room.
exports.getFixtureById = async (req, res) => {
  try {
    const { roomId, fixtureId } = req.params;
    const [[row]] = await pool.query(
      `SELECT f.*, t1.team_name AS team1_name, t1.logo_path AS team1_logo,
              t2.team_name AS team2_name, t2.logo_path AS team2_logo,
              wt.team_name AS winner_team_name,
              t.fixtures_finalized
       FROM fixtures f
       LEFT JOIN teams t1 ON t1.id = f.team1_id
       LEFT JOIN teams t2 ON t2.id = f.team2_id
       LEFT JOIN teams wt ON wt.id = f.winner_team_id
       JOIN tournaments t ON t.id = f.tournament_id
       WHERE f.id = ? AND f.auction_room_id = ?`,
      [fixtureId, roomId]
    );
    if (!row) return res.status(404).json({ message: 'Fixture not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch fixture', error: err.message });
  }
};

// Regenerates the fixture schedule for an EXISTING, not-yet-finalized
// tournament (today's "Regenerate Fixture" capability, just re-scoped) —
// creating a brand new tournament is a separate flow (tournamentController).
exports.regenerateFixtures = async (req, res) => {
  try {
    const { roomId, tournamentId } = req.params;
    const { type, max_teams_per_pool } = req.body;

    const [[tournament]] = await pool.query(
      'SELECT fixtures_finalized FROM tournaments WHERE id = ? AND auction_room_id = ?',
      [tournamentId, roomId]
    );
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.fixtures_finalized) {
      return res.status(400).json({ message: 'Fixtures are finalized and can no longer be regenerated' });
    }

    const [teams] = await pool.query('SELECT id FROM teams WHERE auction_room_id = ?', [roomId]);
    const teamIds = teams.map((t) => t.id);
    const rows = buildFixtureRows(teamIds, type, max_teams_per_pool);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM fixtures WHERE tournament_id = ?', [tournamentId]);
      await insertFixtureRows(conn, { tournamentId, auctionRoomId: roomId, type, rows });
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json(await getTournamentDetail(tournamentId));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Failed to regenerate fixtures' });
  }
};

exports.deleteFixtures = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const [[tournament]] = await pool.query('SELECT fixtures_finalized FROM tournaments WHERE id = ?', [tournamentId]);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.fixtures_finalized) {
      return res.status(400).json({ message: 'Fixtures are finalized and cannot be deleted' });
    }

    await pool.query('DELETE FROM fixtures WHERE tournament_id = ?', [tournamentId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete fixtures', error: err.message });
  }
};

exports.finalizeFixtures = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const [[tournament]] = await pool.query('SELECT fixtures_finalized FROM tournaments WHERE id = ?', [tournamentId]);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    if (tournament.fixtures_finalized) {
      return res.status(400).json({ message: 'Fixtures are already finalized' });
    }

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM fixtures WHERE tournament_id = ?', [tournamentId]);
    if (count === 0) {
      return res.status(400).json({ message: 'Create a fixture before finalizing' });
    }

    await pool.query('UPDATE tournaments SET fixtures_finalized = TRUE WHERE id = ?', [tournamentId]);
    res.json(await getTournamentDetail(tournamentId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to finalize fixtures', error: err.message });
  }
};
