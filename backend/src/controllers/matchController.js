const matchEngine = require('../services/matchEngine');

function handle(err, res) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  res.status(500).json({ message: 'Something went wrong', error: err.message });
}

exports.getMatch = async (req, res) => {
  try {
    const state = await matchEngine.getMatchState(req.params.fixtureId);
    if (!state) return res.status(404).json({ message: 'Fixture not found' });
    res.json(state);
  } catch (err) {
    handle(err, res);
  }
};

exports.startMatch = async (req, res) => {
  try {
    res.json(await matchEngine.startMatch(req.params.fixtureId, req.body));
  } catch (err) {
    handle(err, res);
  }
};

exports.selectOpeners = async (req, res) => {
  try {
    res.json(await matchEngine.selectOpeners(req.params.inningsId, req.body));
  } catch (err) {
    handle(err, res);
  }
};

exports.selectBatsman = async (req, res) => {
  try {
    res.json(await matchEngine.selectBatsman(req.params.inningsId, req.body.player_id));
  } catch (err) {
    handle(err, res);
  }
};

exports.selectBowler = async (req, res) => {
  try {
    res.json(await matchEngine.selectBowler(req.params.inningsId, req.body.player_id));
  } catch (err) {
    handle(err, res);
  }
};

exports.recordBall = async (req, res) => {
  try {
    res.json(await matchEngine.recordBall(req.params.inningsId, req.body));
  } catch (err) {
    handle(err, res);
  }
};

exports.undoLastBall = async (req, res) => {
  try {
    res.json(await matchEngine.undoLastBall(req.params.fixtureId));
  } catch (err) {
    handle(err, res);
  }
};

exports.startSuperOver = async (req, res) => {
  try {
    res.json(await matchEngine.startSuperOver(req.params.fixtureId));
  } catch (err) {
    handle(err, res);
  }
};

exports.finishMatch = async (req, res) => {
  try {
    res.json(await matchEngine.finishMatch(req.params.fixtureId));
  } catch (err) {
    handle(err, res);
  }
};

exports.getPointsTable = async (req, res) => {
  try {
    res.json(await matchEngine.getPointsTable(req.params.tournamentId));
  } catch (err) {
    handle(err, res);
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    res.json(await matchEngine.getLeaderboard(req.params.tournamentId));
  } catch (err) {
    handle(err, res);
  }
};
