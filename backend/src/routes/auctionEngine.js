const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/auctionEngineController');

router.get('/', controller.getState);
router.post('/bid', controller.placeBid);
router.post('/undo', controller.undoBid);
router.post('/sold', controller.markSold);
router.post('/unsold', controller.markUnsold);
router.post('/resume-unsold', controller.resumeUnsold);
router.post('/finish', controller.finishAuction);
router.post('/reset', controller.resetAuction);

module.exports = router;
