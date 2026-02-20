import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxRequests, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes'
  },
  skipSuccessfulRequests: true // Don't count successful requests
});

// Rate limiter for exchange creation
export const exchangeCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exchange requests per hour
  message: {
    success: false,
    message: 'Too many exchange requests created. Please wait before creating more'
  },
  skipSuccessfulRequests: false
});

// Rate limiter for accept actions
export const acceptLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 accept attempts per minute
  message: {
    success: false,
    message: 'Too many accept attempts, please wait a moment'
  },
  skipSuccessfulRequests: true
});

export default {
  apiLimiter,
  authLimiter,
  exchangeCreationLimiter,
  acceptLimiter
};
