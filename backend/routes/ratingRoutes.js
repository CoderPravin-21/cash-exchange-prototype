import express from 'express';
import Rating from '../models/Rating.js';
import Transaction from '../models/Transaction.js';
import protect from '../middleware/authMiddleware.js';
import { validateRating, validateObjectId } from '../middleware/validateRequest.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Create rating for a transaction
// @route   POST /api/ratings/:transactionId
// @access  Private
router.post('/:transactionId', validateObjectId('transactionId'), validateRating, asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { rating, review, categories, isAnonymous } = req.body;

  // Verify transaction exists and user is involved
  const transaction = await Transaction.findById(transactionId)
    .populate('exchangeRequest');

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  if (transaction.status !== 'COMPLETED') {
    throw new AppError('Can only rate completed transactions', 400);
  }

  // Determine who to rate
  const rated = transaction.payer.toString() === req.user._id.toString()
    ? transaction.payee
    : transaction.payer;

  const newRating = await Rating.createRating({
    transaction: transactionId,
    exchangeRequest: transaction.exchangeRequest,
    rater: req.user._id,
    rated,
    rating,
    review,
    categories,
    isAnonymous
  });

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: { rating: newRating }
  });
}));

// @desc    Get ratings for a user
// @route   GET /api/ratings/user/:userId
// @access  Private
router.get('/user/:userId', validateObjectId('userId'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page, limit, minRating, maxRating } = req.query;

  const result = await Rating.getUserRatings(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    minRating: minRating ? parseInt(minRating) : undefined,
    maxRating: maxRating ? parseInt(maxRating) : undefined
  });

  res.status(200).json({
    success: true,
    data: result
  });
}));

export default router;
