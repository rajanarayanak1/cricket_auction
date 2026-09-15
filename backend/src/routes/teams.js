const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/teamController');
const { logos: upload } = require('../middleware/upload');

router.get('/', controller.getTeamsByRoom);
router.post('/', upload.single('logo'), controller.createTeam);
router.put('/:teamId', upload.single('logo'), controller.updateTeam);
router.put('/:teamId/owner', controller.updateTeamOwner);
router.post('/:teamId/captain', controller.assignCaptain);
router.delete('/:teamId/captain', controller.unassignCaptain);
router.delete('/:teamId', controller.deleteTeam);

module.exports = router;
