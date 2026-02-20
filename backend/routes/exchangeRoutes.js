import express from 'express';
import {
  createExchangeRequest,
  getNearbyRequests,
  discoverHelpers,
  acceptExchangeRequest,
  completeExchangeRequest,
  cancelExchangeRequest,
  getMyRequests
} from '../controllers/exchangeController.js';
import protect from '../middleware/authMiddleware.js';
import {
  validateExchangeRequest,
  validateNearbyQuery,
  validateObjectId,
  validateCompletionCode
} from '../middleware/validateRequest.js';
import {
  exchangeCreationLimiter,
  acceptLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Exchange request routes
router.post('/', exchangeCreationLimiter, validateExchangeRequest, createExchangeRequest);
router.get('/nearby', validateNearbyQuery, getNearbyRequests);
router.get('/helpers', discoverHelpers);
router.get('/my-requests', getMyRequests);

// Single exchange request operations
router.post('/:id/accept', validateObjectId('id'), acceptLimiter, acceptExchangeRequest);
router.post('/:id/complete', validateObjectId('id'), validateCompletionCode, completeExchangeRequest);
router.post('/:id/cancel', validateObjectId('id'), cancelExchangeRequest);

export default router;
