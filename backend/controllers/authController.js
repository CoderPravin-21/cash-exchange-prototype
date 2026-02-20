import User from '../models/User.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/generateToken.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, location } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError('User with this email already exists', 400);
  }

  // Check phone number uniqueness (only if phone provided)
  if (phone) {
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      throw new AppError('User with this phone number already exists', 400);
    }
  }

  // Create user
  const userData = {
    name,
    email,
    password,
    location: {
      type: 'Point',
      coordinates: location.coordinates
    }
  };

  // Add phone only if provided
  if (phone) {
    userData.phone = phone;
  }

  const user = await User.create(userData);

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user._id);

  // Store refresh token
  user.refreshTokens.push({ token: refreshToken });
  await user.save();

  logger.info('User registered successfully', { 
    userId: user._id, 
    email: user.email 
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        wallet: user.wallet,
        profile: user.profile
      },
      accessToken,
      refreshToken
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is locked
  if (user.isLocked) {
    throw new AppError(
      'Account is locked due to multiple failed login attempts. Please try again later',
      403
    );
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account has been deactivated', 403);
  }

  // Verify password
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    // Increment login attempts
    await user.incLoginAttempts();

    logger.warn('Failed login attempt', { 
      email, 
      attempts: user.loginAttempts 
    });

    throw new AppError('Invalid email or password', 401);
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user._id);

  // Store refresh token
  user.refreshTokens.push({ token: refreshToken });
  
  // Limit stored refresh tokens to last 5
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  
  await user.save();

  logger.info('User logged in successfully', { 
    userId: user._id, 
    email: user.email 
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        location: user.location,
        wallet: user.wallet,
        profile: user.profile
      },
      accessToken,
      refreshToken
    }
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Find user and check if refresh token exists
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);

  if (!tokenExists) {
    throw new AppError('Invalid refresh token', 401);
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user._id);

  // Remove old refresh token and add new one
  user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
  user.refreshTokens.push({ token: newRefreshToken });
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken,
      refreshToken: newRefreshToken
    }
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Remove specific refresh token
    req.user.refreshTokens = req.user.refreshTokens.filter(
      t => t.token !== refreshToken
    );
  } else {
    // Remove all refresh tokens (logout from all devices)
    req.user.refreshTokens = [];
  }

  await req.user.save();

  logger.info('User logged out', { userId: req.user._id });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password -refreshTokens -verification');

  res.status(200).json({
    success: true,
    data: { user }
  });
});

// @desc    Update user location
// @route   PUT /api/auth/location
// @access  Private
export const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  req.user.location = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };

  await req.user.save();

  logger.info('User location updated', { 
    userId: req.user._id,
    coordinates: [longitude, latitude]
  });

  res.status(200).json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: req.user.location
    }
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, bio } = req.body;

  const allowedUpdates = {};
  if (name) allowedUpdates.name = name;
  if (phone) allowedUpdates.phone = phone;
  if (bio) allowedUpdates['profile.bio'] = bio;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    allowedUpdates,
    { new: true, runValidators: true }
  ).select('-password -refreshTokens -verification');

  logger.info('User profile updated', { userId: user._id });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);

  if (!isPasswordCorrect) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  user.password = newPassword;
  
  // Clear all refresh tokens (force re-login on all devices)
  user.refreshTokens = [];
  
  await user.save();

  logger.info('User password changed', { userId: user._id });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Please login again'
  });
});

// @desc    Get wallet balance
// @route   GET /api/auth/wallet
// @access  Private
export const getWalletBalance = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      wallet: req.user.wallet
    }
  });
});

export default {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  updateLocation,
  updateProfile,
  changePassword,
  getWalletBalance
};