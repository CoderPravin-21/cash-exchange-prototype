import mongoose from 'mongoose';

const exchangeRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  helper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1'],
    max: [100000, 'Amount cannot exceed 100000']
  },
  exchangeType: {
    type: String,
    enum: {
      values: ['CASH_TO_ONLINE', 'ONLINE_TO_CASH'],
      message: 'Exchange type must be either CASH_TO_ONLINE or ONLINE_TO_CASH'
    },
    required: true,
    index: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      pincode: String
    }
  },
  status: {
    type: String,
    enum: {
      values: ['CREATED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'],
      message: 'Invalid status'
    },
    default: 'CREATED',
    index: true
  },
  linkedRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExchangeRequest',
    default: null
  },
  meetingPoint: {
    name: String,
    coordinates: [Number],
    notes: String
  },
  timeline: {
    createdAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    expiresAt: { type: Date, required: true, index: true }
  },
  notes: {
    requesterNotes: { type: String, maxlength: 500 },
    helperNotes: { type: String, maxlength: 500 },
    adminNotes: { type: String, maxlength: 1000 }
  },
  metadata: {
    distance: Number, // Distance between users in meters
    platformFee: { type: Number, default: 0 },
    completionCode: String, // OTP for verification
    attempts: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
exchangeRequestSchema.index({ location: '2dsphere' });
exchangeRequestSchema.index({ status: 1, 'timeline.expiresAt': 1 });
exchangeRequestSchema.index({ status: 1, exchangeType: 1, 'timeline.expiresAt': 1 });
exchangeRequestSchema.index({ requester: 1, status: 1 });
exchangeRequestSchema.index({ helper: 1, status: 1 });
exchangeRequestSchema.index({ linkedRequest: 1 });
exchangeRequestSchema.index({ createdAt: -1 });

// Virtual for checking if expired
exchangeRequestSchema.virtual('isExpired').get(function() {
  return this.timeline.expiresAt < new Date();
});

// Virtual for time remaining
exchangeRequestSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const expiry = this.timeline.expiresAt;
  return Math.max(0, Math.floor((expiry - now) / 1000)); // seconds
});

// Virtual for opposite exchange type
exchangeRequestSchema.virtual('oppositeType').get(function() {
  return this.exchangeType === 'CASH_TO_ONLINE' ? 'ONLINE_TO_CASH' : 'CASH_TO_ONLINE';
});

// Pre-save middleware to validate business rules
exchangeRequestSchema.pre('save', function(next) {
  // Ensure timeline consistency
  if (this.status === 'ACCEPTED' && !this.timeline.acceptedAt) {
    this.timeline.acceptedAt = new Date();
  }
  
  if (this.status === 'COMPLETED' && !this.timeline.completedAt) {
    this.timeline.completedAt = new Date();
  }
  
  if (this.status === 'CANCELLED' && !this.timeline.cancelledAt) {
    this.timeline.cancelledAt = new Date();
  }
  
  next();
});

// Static method to find nearby requests
exchangeRequestSchema.statics.findNearby = async function(options) {
  const {
    coordinates,
    maxDistance = 5000,
    excludeUserId,
    exchangeType,
    minAmount,
    maxAmount,
    limit = 50,
    page = 1
  } = options;

  const skip = (page - 1) * limit;

  const query = {
    status: 'CREATED',
    'timeline.expiresAt': { $gt: new Date() },
    requester: { $ne: excludeUserId }
  };

  if (exchangeType) query.exchangeType = exchangeType;
  if (minAmount) query.amount = { ...query.amount, $gte: minAmount };
  if (maxAmount) query.amount = { ...query.amount, $lte: maxAmount };

  const requests = await this.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: coordinates
        },
        distanceField: 'metadata.distance',
        maxDistance: maxDistance,
        spherical: true,
        query: query
      }
    },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'requester',
        foreignField: '_id',
        as: 'requesterDetails'
      }
    },
    {
      $unwind: '$requesterDetails'
    },
    {
      $project: {
        'requesterDetails.password': 0,
        'requesterDetails.refreshTokens': 0,
        'requesterDetails.wallet': 0,
        'requesterDetails.verification': 0
      }
    }
  ]);

  const total = await this.countDocuments(query);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Static method to find compatible helpers
exchangeRequestSchema.statics.findCompatibleHelpers = async function(requestId, options = {}) {
  const request = await this.findById(requestId);
  
  if (!request) {
    throw new Error('Request not found');
  }

  const {
    maxDistance = 5000,
    limit = 50,
    page = 1
  } = options;

  const oppositeType = request.exchangeType === 'CASH_TO_ONLINE' 
    ? 'ONLINE_TO_CASH' 
    : 'CASH_TO_ONLINE';

  return await this.findNearby({
    coordinates: request.location.coordinates,
    maxDistance,
    excludeUserId: request.requester,
    exchangeType: oppositeType,
    minAmount: request.amount,
    limit,
    page
  });
};

// Method to generate completion code
exchangeRequestSchema.methods.generateCompletionCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.metadata.completionCode = code;
  return code;
};

// Method to verify completion code
exchangeRequestSchema.methods.verifyCompletionCode = function(code) {
  return this.metadata.completionCode === code;
};

const ExchangeRequest = mongoose.model('ExchangeRequest', exchangeRequestSchema);

export default ExchangeRequest;
