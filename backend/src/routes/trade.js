const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/tradeController');

router.post('/', controller.executeTrade);

module.exports = router;
