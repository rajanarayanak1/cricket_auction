const express = require('express');
const router = express.Router();
const controller = require('../controllers/auctionRoomController');
const requireRoomOwner = require('../middleware/roomOwner');

router.get('/', controller.getAllRooms);
router.post('/', controller.createRoom);
router.get('/:id', requireRoomOwner, controller.getRoomById);
router.delete('/:id', requireRoomOwner, controller.deleteRoom);
router.post('/:id/start', requireRoomOwner, controller.startAuction);

module.exports = router;
