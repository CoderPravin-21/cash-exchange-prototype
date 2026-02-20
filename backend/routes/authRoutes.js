import express from 'express';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  updateLocation,
  updateProfile,
  changePassword,
  getWalletBalance
} from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import {
  validateRegistration,
  validateLogin,
  validateLocationUpdate
} from '../middleware/validateRequest.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRegistration, registerUser);
router.post('/login', authLimiter, validateLogin, loginUser);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.put('/location', protect, validateLocationUpdate, updateLocation);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/wallet', protect, getWalletBalance);

export default router;
