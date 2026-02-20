import mongoose from 'mongoose';
import ExchangeRequest from '../models/ExchangeRequest.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

// @desc    Create new exchange request
// @route   POST /api/exchange
// @access  Private
export const createExchangeRequest = asyncHandler(async (req, res) => {
  const { 
    amount, 
    exchangeType, 
    latitude, 
    longitude, 
    expiresInMinutes,
    notes,
    meetingPoint
  } = req.body;

  // Check if user already has an active request
  const existingRequest = await ExchangeRequest.findOne({
    requester: req.user._id,
    status: { $in: ['CREATED', 'ACCEPTED'] }
  });

  if (existingRequest) {
    throw new AppError(
      'You already have an active exchange request. Please complete or cancel it first',
      400
    );
  }

  // For ONLINE_TO_CASH, check if user has sufficient wallet balance
  if (exchangeType === 'ONLINE_TO_CASH' && req.user.wallet.balance < amount) {
    throw new AppError(
      `Insufficient wallet balance. You need ${amount} ${req.user.wallet.currency} but have ${req.user.wallet.balance} ${req.user.wallet.currency}`,
      400
    );
  }

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setMinutes(
    expiresAt.getMinutes() + (expiresInMinutes || config.exchange.defaultExpiryMinutes)
  );

  // Create exchange request
  const exchangeRequest = await ExchangeRequest.create({
    requester: req.user._id,
    amount,
    exchangeType,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    timeline: {
      expiresAt
    },
    notes: {
      requesterNotes: notes || ''
    },
    meetingPoint: meetingPoint || {},
    metadata: {
      platformFee: (amount * config.exchange.platformFeePercent) / 100
    }
  });

  logger.info('Exchange request created', {
    userId: req.user._id,
    requestId: exchangeRequest._id,
    amount,
    type: exchangeType
  });

  res.status(201).json({
    success: true,
    message: 'Exchange request created successfully',
    data: {
      exchangeRequest
    }
  });
});

// @desc    Get nearby exchange requests
// @route   GET /api/exchange/nearby
// @access  Private
export const getNearbyRequests = asyncHandler(async (req, res) => {
  const { 
    lat, 
    lng, 
    maxDistance,
    minAmount,
    maxAmount,
    exchangeType,
    page,
    limit 
  } = req.query;

  const options = {
    coordinates: [parseFloat(lng), parseFloat(lat)],
    maxDistance: parseInt(maxDistance) || config.exchange.defaultMaxDistance,
    excludeUserId: req.user._id,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    exchangeType,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || config.exchange.defaultSearchLimit
  };

  const result = await ExchangeRequest.findNearby(options);

  // Increment view count for returned requests
  const requestIds = result.requests.map(r => r._id);
  if (requestIds.length > 0) {
    await ExchangeRequest.updateMany(
      { _id: { $in: requestIds } },
      { $inc: { 'metadata.viewCount': 1 } }
    );
  }

  res.status(200).json({
    success: true,
    data: {
      requests: result.requests,
      pagination: result.pagination
    }
  });
});

// @desc    Get compatible helpers for user's request
// @route   GET /api/exchange/helpers
// @access  Private
export const discoverHelpers = asyncHandler(async (req, res) => {
  const { maxDistance, page, limit } = req.query;

  // Get user's active request
  const myRequest = await ExchangeRequest.findOne({
    requester: req.user._id,
    status: 'CREATED',
    'timeline.expiresAt': { $gt: new Date() }
  });

  if (!myRequest) {
    throw new AppError(
      'You must have an active exchange request to discover helpers',
      400
    );
  }

  const options = {
    maxDistance: parseInt(maxDistance) || config.exchange.defaultMaxDistance,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || config.exchange.defaultSearchLimit
  };

  const result = await ExchangeRequest.findCompatibleHelpers(
    myRequest._id,
    options
  );

  res.status(200).json({
    success: true,
    data: {
      myRequest: {
        _id: myRequest._id,
        amount: myRequest.amount,
        exchangeType: myRequest.exchangeType,
        expiresAt: myRequest.timeline.expiresAt,
        timeRemaining: myRequest.timeRemaining
      },
      helpers: result.requests,
      pagination: result.pagination
    }
  });
});

// CONTINUED IN PART 2...
