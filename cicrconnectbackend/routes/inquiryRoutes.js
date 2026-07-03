const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', inquiryController.submitInquiry);
router.get('/', protect, restrictTo('Admin', 'Head'), inquiryController.getInquiries);

module.exports = router;
