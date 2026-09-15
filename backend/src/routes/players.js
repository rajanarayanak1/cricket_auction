const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/playerController');
const { playerPhotos: upload } = require('../middleware/upload');

router.get('/', controller.getPlayersByRoom);
router.post('/', upload.single('photo'), controller.createPlayer);
router.put('/:playerId', upload.single('photo'), controller.updatePlayer);
router.put('/:playerId/kit', controller.updatePlayerKit);
router.delete('/:playerId', controller.deletePlayer);
router.delete('/', controller.deleteAllPlayers);

module.exports = router;
