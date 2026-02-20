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

  const existingRequest = await ExchangeRequest.findOne({
    requester: req.user._id,
    status: { $in: ['CREATED', 'ACCEPTED'] }
  });

  if (existingRequest) {
    throw new AppError(
      'You already have an active exchange request',
      400
    );
  }

  if (exchangeType === 'ONLINE_TO_CASH' && req.user.wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(
    expiresAt.getMinutes() + (expiresInMinutes || config.exchange.defaultExpiryMinutes)
  );

  const exchangeRequest = await ExchangeRequest.create({
    requester: req.user._id,
    amount,
    exchangeType,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    timeline: { expiresAt },
    notes: { requesterNotes: notes || '' },
    metadata: {
      platformFee: (amount * config.exchange.platformFeePercent) / 100
    }
  });

  logger.info('Exchange request created', {
    userId: req.user._id,
    requestId: exchangeRequest._id
  });

  res.status(201).json({
    success: true,
    message: 'Exchange request created successfully',
    data: { exchangeRequest }
  });
});

export const getNearbyRequests = asyncHandler(async (req, res) => {
  const { lat, lng, maxDistance, minAmount, maxAmount, exchangeType, page, limit } = req.query;

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

  res.status(200).json({
    success: true,
    data: {
      requests: result.requests,
      pagination: result.pagination
    }
  });
});

export const discoverHelpers = asyncHandler(async (req, res) => {
  const myRequest = await ExchangeRequest.findOne({
    requester: req.user._id,
    status: 'CREATED',
    'timeline.expiresAt': { $gt: new Date() }
  });

  if (!myRequest) {
    throw new AppError('You must have an active exchange request', 400);
  }

  const options = {
    maxDistance: parseInt(req.query.maxDistance) || config.exchange.defaultMaxDistance,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || config.exchange.defaultSearchLimit
  };

  const result = await ExchangeRequest.findCompatibleHelpers(myRequest._id, options);

  res.status(200).json({
    success: true,
    data: {
      myRequest: {
        _id: myRequest._id,
        amount: myRequest.amount,
        exchangeType: myRequest.exchangeType
      },
      helpers: result.requests,
      pagination: result.pagination
    }
  });
});

export const acceptExchangeRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;

  const busyCheck = await ExchangeRequest.findOne({
    status: 'ACCEPTED',
    $or: [
      { requester: req.user._id },
      { helper: req.user._id }
    ]
  });

  if (busyCheck) {
    throw new AppError('You already have an active exchange in progress', 400);
  }

  const targetRequest = await ExchangeRequest.findById(requestId);

  if (!targetRequest) {
    throw new AppError('Exchange request not found', 404);
  }

  if (targetRequest.requester.toString() === req.user._id.toString()) {
    throw new AppError('Cannot accept your own request', 400);
  }

  if (targetRequest.status !== 'CREATED') {
    throw new AppError('Request is no longer available', 400);
  }

  if (targetRequest.isExpired) {
    throw new AppError('Request has expired', 400);
  }

  const helperRequest = await ExchangeRequest.findOne({
    requester: req.user._id,
    status: 'CREATED'
  });

  if (!helperRequest) {
    throw new AppError('You must have an active request to accept others', 400);
  }

  const compatible =
    (targetRequest.exchangeType === 'ONLINE_TO_CASH' &&
      helperRequest.exchangeType === 'CASH_TO_ONLINE') ||
    (targetRequest.exchangeType === 'CASH_TO_ONLINE' &&
      helperRequest.exchangeType === 'ONLINE_TO_CASH');

  if (!compatible) {
    throw new AppError('Exchange types are not compatible', 400);
  }

  if (helperRequest.amount < targetRequest.amount) {
    throw new AppError('Your request amount is insufficient', 400);
  }

  const updatedRequest = await ExchangeRequest.findOneAndUpdate(
    { _id: requestId, status: 'CREATED', helper: null },
    {
      $set: {
        status: 'ACCEPTED',
        helper: req.user._id,
        'timeline.acceptedAt': new Date()
      }
    },
    { new: true }
  );

  if (!updatedRequest) {
    throw new AppError('Request already accepted by another user', 400);
  }

  const completionCode = updatedRequest.generateCompletionCode();
  await updatedRequest.save();

  await ExchangeRequest.findByIdAndUpdate(helperRequest._id, {
    status: 'ACCEPTED',
    linkedRequest: updatedRequest._id,
    'timeline.acceptedAt': new Date()
  });

  logger.info('Exchange request accepted', {
    requestId: updatedRequest._id,
    helperId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Request accepted successfully',
    data: {
      exchangeRequest: updatedRequest,
      completionCode
    }
  });
});

export const completeExchangeRequest = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const requestId = req.params.id;

  const exchangeRequest = await ExchangeRequest.findById(requestId)
    .populate('requester')
    .populate('helper');

  if (!exchangeRequest) {
    throw new AppError('Exchange request not found', 404);
  }

  if (!exchangeRequest.helper || 
      exchangeRequest.helper._id.toString() !== req.user._id.toString()) {
    throw new AppError('Only the helper can complete this request', 403);
  }

  if (exchangeRequest.status !== 'ACCEPTED') {
    throw new AppError('This request cannot be completed', 400);
  }

  if (!exchangeRequest.verifyCompletionCode(code)) {
    throw new AppError('Invalid completion code', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payer = exchangeRequest.exchangeType === 'CASH_TO_ONLINE'
      ? exchangeRequest.requester
      : exchangeRequest.helper;

    const payee = exchangeRequest.exchangeType === 'CASH_TO_ONLINE'
      ? exchangeRequest.helper
      : exchangeRequest.requester;

    const transaction = await Transaction.createTransaction({
      exchangeRequest: exchangeRequest._id,
      payer: payer._id,
      payee: payee._id,
      amount: exchangeRequest.amount,
      type: exchangeRequest.exchangeType,
      platformFee: exchangeRequest.metadata.platformFee
    }, session);

    exchangeRequest.status = 'COMPLETED';
    exchangeRequest.timeline.completedAt = new Date();
    await exchangeRequest.save({ session });

    const linkedRequest = await ExchangeRequest.findById(exchangeRequest.linkedRequest);
    if (linkedRequest) {
      linkedRequest.status = 'COMPLETED';
      linkedRequest.timeline.completedAt = new Date();
      await linkedRequest.save({ session });
    }

    payer.profile.completedExchanges += 1;
    payee.profile.completedExchanges += 1;
    await payer.save({ session });
    await payee.save({ session });

    await session.commitTransaction();

    logger.info('Exchange completed successfully', {
      requestId: exchangeRequest._id,
      transactionId: transaction._id
    });

    res.status(200).json({
      success: true,
      message: 'Exchange completed successfully',
      data: {
        exchangeRequest,
        transaction
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const cancelExchangeRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.id;

  const exchangeRequest = await ExchangeRequest.findById(requestId);

  if (!exchangeRequest) {
    throw new AppError('Exchange request not found', 404);
  }

  if (exchangeRequest.requester.toString() !== req.user._id.toString()) {
    throw new AppError('Only the requester can cancel this request', 403);
  }

  if (exchangeRequest.status !== 'CREATED') {
    throw new AppError('Only pending requests can be cancelled', 400);
  }

  exchangeRequest.status = 'CANCELLED';
  exchangeRequest.timeline.cancelledAt = new Date();
  await exchangeRequest.save();

  logger.info('Exchange request cancelled', {
    requestId: exchangeRequest._id,
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Request cancelled successfully',
    data: { exchangeRequest }
  });
});

export const getMyRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { requester: req.user._id },
      { helper: req.user._id }
    ]
  };

  if (status) {
    query.status = status;
  }

  const requests = await ExchangeRequest.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('requester', 'name email profile')
    .populate('helper', 'name email profile');

  const total = await ExchangeRequest.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export default {
  createExchangeRequest,
  getNearbyRequests,
  discoverHelpers,
  acceptExchangeRequest,
  completeExchangeRequest,
  cancelExchangeRequest,
  getMyRequests
};
