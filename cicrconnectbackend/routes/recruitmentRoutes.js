const express = require('express');
const {
  createDrive,
  updateDrive,
  getDrives,
  getDrive
} = require('../controllers/recruitmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getDrives); // Protect will inject req.user, controller handles public vs admin
router.get('/public', getDrives); // True public route
router.get('/:id', protect, getDrive);
router.get('/public/:id', getDrive);

router.post('/', protect, authorize('Admin', 'Head'), createDrive);
router.put('/:id', protect, authorize('Admin', 'Head'), updateDrive);

module.exports = router;
