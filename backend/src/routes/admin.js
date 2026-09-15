const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');

router.get('/profile', controller.getProfile);
router.put('/profile', controller.updateProfile);
router.post('/change-password', controller.changePassword);

module.exports = router;
