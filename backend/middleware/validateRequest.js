import { body, query, param, validationResult } from 'express-validator';
import config from '../config/config.js';

// Error formatter
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Registration validation
export const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })  // Changed from 8 to 6
    .withMessage('Password must be at least 6 characters long'),
    // Removed strict password requirements for easier testing
  
  body('phone')
    .optional()  // Made phone optional
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of [longitude, latitude]'),
  
  body('location.coordinates[0]')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('location.coordinates[1]')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  validate
];

// Login validation
export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  validate
];

// Exchange request validation
export const validateExchangeRequest = [
  body('amount')
    .isFloat({ min: config.exchange.minAmount, max: config.exchange.maxAmount })
    .withMessage(`Amount must be between ${config.exchange.minAmount} and ${config.exchange.maxAmount}`),
  
  body('exchangeType')
    .isIn(['CASH_TO_ONLINE', 'ONLINE_TO_CASH'])
    .withMessage('Exchange type must be either CASH_TO_ONLINE or ONLINE_TO_CASH'),
  
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('expiresInMinutes')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Expiry time must be between 5 minutes and 24 hours'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  validate
];

// Location update validation
export const validateLocationUpdate = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  validate
];

// Nearby requests query validation
export const validateNearbyQuery = [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  query('maxDistance')
    .optional()
    .isInt({ min: 100, max: 50000 })
    .withMessage('Max distance must be between 100m and 50km'),
  
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min amount must be a positive number'),
  
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max amount must be a positive number'),
  
  query('exchangeType')
    .optional()
    .isIn(['CASH_TO_ONLINE', 'ONLINE_TO_CASH'])
    .withMessage('Invalid exchange type'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  validate
];

// MongoDB ObjectId validation
export const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  validate
];

// Rating validation
export const validateRating = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('review')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Review cannot exceed 500 characters')
    .trim(),
  
  body('categories.punctuality')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Punctuality rating must be between 1 and 5'),
  
  body('categories.communication')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Communication rating must be between 1 and 5'),
  
  body('categories.trustworthiness')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Trustworthiness rating must be between 1 and 5'),
  
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be a boolean'),
  
  validate
];

// Completion code validation
export const validateCompletionCode = [
  body('code')
    .matches(/^[0-9]{6}$/)
    .withMessage('Completion code must be a 6-digit number'),
  
  validate
];

// Wallet operations validation
export const validateWalletOperation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  validate
];

export default {
  validate,
  validateRegistration,
  validateLogin,
  validateExchangeRequest,
  validateLocationUpdate,
  validateNearbyQuery,
  validateObjectId,
  validateRating,
  validateCompletionCode,
  validateWalletOperation
};