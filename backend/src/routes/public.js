const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicController');

router.get('/live-matches', controller.getLiveMatches);
router.get('/fixtures/:fixtureId/match', controller.getMatch);
router.get('/tournaments', controller.listTournaments);
router.get('/tournaments/:tournamentId', controller.getTournament);
router.get('/completed-auctions', controller.listCompletedAuctions);
router.get('/completed-auctions/:roomId', controller.getCompletedAuction);

module.exports = router;
