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
