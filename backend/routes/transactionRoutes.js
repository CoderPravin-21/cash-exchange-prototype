import express from 'express';
import Transaction from '../models/Transaction.js';
import protect from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get user transaction history
// @route   GET /api/transactions
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, status, type } = req.query;

  const result = await Transaction.getUserHistory(req.user._id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    type
  });

  res.status(200).json({
    success: true,
    data: result
  });
}));

// @desc    Get transaction statistics
// @route   GET /api/transactions/stats
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await Transaction.getUserStats(req.user._id);

  res.status(200).json({
    success: true,
    data: { stats }
  });
}));

export default router;
