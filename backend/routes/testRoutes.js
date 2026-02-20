import express from 'express';
import User from '../models/User.js';
import ExchangeRequest from '../models/ExchangeRequest.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Add balance to wallet (FOR TESTING ONLY)
// @route   POST /api/test/add-balance
// @access  Private
router.post('/add-balance', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    await req.user.creditWallet(amount);

    res.status(200).json({
      success: true,
      message: `Added ₹${amount} to wallet`,
      data: {
        wallet: req.user.wallet
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Clear all my exchange requests (FOR TESTING ONLY)
// @route   DELETE /api/test/clear-requests
// @access  Private
router.delete('/clear-requests', protect, async (req, res) => {
  try {
    const result = await ExchangeRequest.deleteMany({
      $or: [
        { requester: req.user._id },
        { helper: req.user._id }
      ]
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} requests`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Clear ALL data (FOR TESTING ONLY - DANGEROUS!)
// @route   DELETE /api/test/clear-all
// @access  Public (but should be protected in production)
router.delete('/clear-all', async (req, res) => {
  try {
    await User.deleteMany({});
    await ExchangeRequest.deleteMany({});

    res.status(200).json({
      success: true,
      message: 'All data cleared from database'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;