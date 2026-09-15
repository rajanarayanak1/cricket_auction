const express = require('express');
const router = express.Router({ mergeParams: true });
const tournamentController = require('../controllers/tournamentController');
const fixtureController = require('../controllers/fixtureController');
const matchController = require('../controllers/matchController');

router.get('/', tournamentController.listTournaments);
router.post('/', tournamentController.createTournament);
router.get('/:tournamentId', tournamentController.getTournament);

router.put('/:tournamentId/fixtures', fixtureController.regenerateFixtures);
router.delete('/:tournamentId/fixtures', fixtureController.deleteFixtures);
router.post('/:tournamentId/fixtures/finalize', fixtureController.finalizeFixtures);

router.get('/:tournamentId/points-table', matchController.getPointsTable);
router.get('/:tournamentId/stats', matchController.getLeaderboard);

module.exports = router;
