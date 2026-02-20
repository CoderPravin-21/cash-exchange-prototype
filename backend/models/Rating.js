import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
    unique: true // One rating per transaction
  },
  exchangeRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExchangeRequest',
    required: true
  },
  rater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: 500,
    trim: true
  },
  categories: {
    punctuality: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    trustworthiness: { type: Number, min: 1, max: 5 }
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  response: {
    text: { type: String, maxlength: 500 },
    createdAt: Date
  },
  flags: {
    isReported: { type: Boolean, default: false },
    reportReason: String,
    reportedAt: Date
  }
}, { 
  timestamps: true 
});

// Indexes
ratingSchema.index({ rated: 1, createdAt: -1 });
ratingSchema.index({ rater: 1, createdAt: -1 });
ratingSchema.index({ rating: -1 });

// Prevent duplicate ratings
ratingSchema.index({ rater: 1, transaction: 1 }, { unique: true });

// Static method to create rating and update user
ratingSchema.statics.createRating = async function(data) {
  const { transaction, exchangeRequest, rater, rated, rating, review, categories, isAnonymous } = data;
  
  // Check if rating already exists
  const existingRating = await this.findOne({ transaction });
  if (existingRating) {
    throw new Error('Rating already exists for this transaction');
  }
  
  // Create rating
  const newRating = await this.create({
    transaction,
    exchangeRequest,
    rater,
    rated,
    rating,
    review,
    categories,
    isAnonymous
  });
  
  // Update user's rating
  const User = mongoose.model('User');
  const user = await User.findById(rated);
  await user.updateRating(rating);
  
  return newRating;
};

// Static method to get user ratings
ratingSchema.statics.getUserRatings = async function(userId, options = {}) {
  const { page = 1, limit = 20, minRating, maxRating } = options;
  const skip = (page - 1) * limit;
  
  const query = { rated: userId };
  
  if (minRating) query.rating = { ...query.rating, $gte: minRating };
  if (maxRating) query.rating = { ...query.rating, $lte: maxRating };
  
  const ratings = await this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('rater', 'name profile.avatar')
    .populate('exchangeRequest', 'amount exchangeType');
  
  const total = await this.countDocuments(query);
  
  // Get rating breakdown
  const breakdown = await this.aggregate([
    { $match: { rated: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);
  
  return {
    ratings,
    breakdown: breakdown.reduce((acc, curr) => {
      acc[`${curr._id}star`] = curr.count;
      return acc;
    }, {}),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Method to add response to rating
ratingSchema.methods.addResponse = async function(responseText) {
  this.response = {
    text: responseText,
    createdAt: new Date()
  };
  await this.save();
  return this;
};

// Method to report rating
ratingSchema.methods.report = async function(reason) {
  this.flags.isReported = true;
  this.flags.reportReason = reason;
  this.flags.reportedAt = new Date();
  await this.save();
  return this;
};

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
