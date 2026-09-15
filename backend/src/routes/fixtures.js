const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/fixtureController');
const matchController = require('../controllers/matchController');

// Fixtures are created/finalized/listed under their owning tournament now
// (see routes/tournaments.js) — a fixture is still addressed directly by its
// own id everywhere else (match play, MatchDetail.jsx, Scorecard.jsx).
router.get('/:fixtureId', controller.getFixtureById);

router.get('/:fixtureId/match', matchController.getMatch);
router.post('/:fixtureId/match/start', matchController.startMatch);
router.post('/:fixtureId/match/super-over', matchController.startSuperOver);
router.post('/:fixtureId/match/finish', matchController.finishMatch);
router.post('/:fixtureId/match/innings/:inningsId/openers', matchController.selectOpeners);
router.post('/:fixtureId/match/innings/:inningsId/batsman', matchController.selectBatsman);
router.post('/:fixtureId/match/innings/:inningsId/bowler', matchController.selectBowler);
router.post('/:fixtureId/match/innings/:inningsId/ball', matchController.recordBall);
router.post('/:fixtureId/match/undo-ball', matchController.undoLastBall);

module.exports = router;
