import User from '../models/User.js';
import { verifyAccessToken } from '../utils/generateToken.js';
import logger from '../utils/logger.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. No token provided'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database (exclude sensitive fields)
    const user = await User.findById(decoded.id)
      .select('-password -refreshTokens -verification');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    // Attach user to request object
    req.user = user;

    next();
  } catch (error) {
    logger.error('Auth middleware error:', { error: error.message });
    
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid token'
    });
  }
};

// Optional auth - doesn't block if no token
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id)
        .select('-password -refreshTokens -verification');

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without user
    next();
  }
};

// Check if user owns the resource
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Insufficient permissions'
      });
    }

    next();
  };
};

export default protect;
