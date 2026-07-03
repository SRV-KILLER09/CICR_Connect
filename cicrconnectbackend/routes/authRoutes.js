const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const {
  registerUser,
  loginUser,
  requestMagicLink,
  verifyMagicLink,
  getMe,
  verifySignupOtp,
  resetPasswordWithCode,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  changePassword,
  updateProfile,
  logoutUser,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, passwordLimiter } = require('../middleware/securityMiddleware');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('inviteCode').trim().notEmpty().withMessage('Invite code is required'),
  ],
  validateRequest,
  registerUser
);

router.post(
  '/register/verify-otp',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  validateRequest,
  verifySignupOtp
);

router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isString()
      .withMessage('Email or College ID is required')
      .trim()
      .notEmpty()
      .withMessage('Email or College ID is required')
      .isLength({ max: 160 })
      .withMessage('Identifier is too long'),
    body('password')
      .isString()
      .withMessage('Password is required')
      .isLength({ min: 6, max: 160 })
      .withMessage('Password is invalid'),
  ],
  validateRequest,
  loginUser
);

router.post(
  '/login/magic-link',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  validateRequest,
  requestMagicLink
);

router.post(
  '/login/magic-link/verify',
  authLimiter,
  [
    body('token').trim().notEmpty().withMessage('Token is required'),
  ],
  validateRequest,
  verifyMagicLink
);
router.post(
  '/password/send-otp',
  passwordLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
  ],
  validateRequest,
  sendPasswordResetOtp
);
router.post(
  '/password/reset-with-otp',
  passwordLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validateRequest,
  resetPasswordWithOtp
);
router.post(
  '/password/reset-with-code',
  passwordLimiter,
  [
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('resetCode').trim().isLength({ min: 6, max: 10 }).withMessage('Reset code is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validateRequest,
  resetPasswordWithCode
);
router.put(
  '/password/change',
  protect,
  passwordLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validateRequest,
  changePassword
);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/logout', protect, logoutUser);

module.exports = router;
