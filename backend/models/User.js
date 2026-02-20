import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'], // Changed from 8 to 6
      select: false // Don't return password by default
    },
    phone: {
      type: String,
      required: false, // Made optional
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates are required'],
        validate: {
          validator: function(coords) {
            return coords.length === 2 && 
                   coords[0] >= -180 && coords[0] <= 180 &&
                   coords[1] >= -90 && coords[1] <= 90;
          },
          message: 'Invalid coordinates. Format: [longitude, latitude]'
        }
      }
    },
    wallet: {
      balance: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'INR' },
      lastUpdated: { type: Date, default: Date.now }
    },
    profile: {
      avatar: { type: String, default: '' },
      bio: { type: String, maxlength: 200, default: '' },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      totalRatings: { type: Number, default: 0 },
      completedExchanges: { type: Number, default: 0 }
    },
    verification: {
      isEmailVerified: { type: Boolean, default: false },
      isPhoneVerified: { type: Boolean, default: false },
      emailVerificationToken: String,
      emailVerificationExpires: Date
    },
    refreshTokens: [{
      token: { type: String, required: true },
      createdAt: { type: Date, default: Date.now, expires: '7d' }
    }],
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });
userSchema.index({ 'profile.rating': -1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Wallet operations with transaction support
userSchema.methods.creditWallet = async function(amount, session = null) {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }
  
  this.wallet.balance += amount;
  this.wallet.lastUpdated = new Date();
  
  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }
  
  return this.wallet.balance;
};

userSchema.methods.debitWallet = async function(amount, session = null) {
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }
  
  if (this.wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.wallet.balance -= amount;
  this.wallet.lastUpdated = new Date();
  
  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }
  
  return this.wallet.balance;
};

// Update rating
userSchema.methods.updateRating = async function(newRating) {
  const totalRatings = this.profile.totalRatings;
  const currentRating = this.profile.rating;
  
  this.profile.rating = ((currentRating * totalRatings) + newRating) / (totalRatings + 1);
  this.profile.totalRatings += 1;
  
  await this.save();
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;
    
    // Lock account for 2 hours after 5 failed attempts
    if (this.loginAttempts >= 5 && !this.isLocked) {
      this.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    }
  }
  
  await this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = new Date();
  await this.save();
};

const User = mongoose.model('User', userSchema);

export default User;