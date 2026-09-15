const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicController');

router.get('/live-matches', controller.getLiveMatches);
router.get('/fixtures/:fixtureId/match', controller.getMatch);
router.get('/tournaments', controller.listTournaments);
router.get('/tournaments/:tournamentId', controller.getTournament);

module.exports = router;
