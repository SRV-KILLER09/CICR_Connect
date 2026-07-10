const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', inquiryController.submitInquiry);
router.get('/', protect, authorize('Admin', 'Head'), inquiryController.getInquiries);

module.exports = router;
