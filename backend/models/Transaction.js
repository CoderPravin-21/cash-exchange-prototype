import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  exchangeRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExchangeRequest',
    required: true,
    index: true
  },
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['CASH_TO_ONLINE', 'ONLINE_TO_CASH'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'],
    default: 'PENDING',
    index: true
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  payerBalanceBefore: Number,
  payerBalanceAfter: Number,
  payeeBalanceBefore: Number,
  payeeBalanceAfter: Number,
  metadata: {
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number]
    },
    distance: Number,
    completionCode: String,
    completedAt: Date,
    failureReason: String,
    reversalReason: String,
    reversedAt: Date
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, { 
  timestamps: true 
});

// Indexes
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ payer: 1, createdAt: -1 });
transactionSchema.index({ payee: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

// Static method to create transaction with wallet update
transactionSchema.statics.createTransaction = async function(data, session) {
  const { exchangeRequest, payer, payee, amount, type, platformFee = 0 } = data;
  
  const netAmount = amount - platformFee;
  
  // Get user models
  const User = mongoose.model('User');
  const payerUser = await User.findById(payer).session(session);
  const payeeUser = await User.findById(payee).session(session);
  
  if (!payerUser || !payeeUser) {
    throw new Error('Payer or payee not found');
  }
  
  // Record balances before transaction
  const payerBalanceBefore = payerUser.wallet.balance;
  const payeeBalanceBefore = payeeUser.wallet.balance;
  
  // Perform wallet operations
  await payerUser.debitWallet(amount, session);
  await payeeUser.creditWallet(netAmount, session);
  
  // Create transaction record
  const transaction = await this.create([{
    exchangeRequest,
    payer,
    payee,
    amount,
    type,
    platformFee,
    netAmount,
    payerBalanceBefore,
    payerBalanceAfter: payerUser.wallet.balance,
    payeeBalanceBefore,
    payeeBalanceAfter: payeeUser.wallet.balance,
    status: 'COMPLETED',
    metadata: {
      completedAt: new Date()
    }
  }], { session });
  
  return transaction[0];
};

// Method to reverse transaction
transactionSchema.methods.reverse = async function(reason) {
  if (this.status !== 'COMPLETED') {
    throw new Error('Only completed transactions can be reversed');
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const User = mongoose.model('User');
    const payer = await User.findById(this.payer).session(session);
    const payee = await User.findById(this.payee).session(session);
    
    // Reverse the amounts
    await payee.debitWallet(this.netAmount, session);
    await payer.creditWallet(this.amount, session);
    
    // Update transaction status
    this.status = 'REVERSED';
    this.metadata.reversalReason = reason;
    this.metadata.reversedAt = new Date();
    await this.save({ session });
    
    await session.commitTransaction();
    return this;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = async function(userId, options = {}) {
  const { page = 1, limit = 20, status, type } = options;
  const skip = (page - 1) * limit;
  
  const query = {
    $or: [{ payer: userId }, { payee: userId }]
  };
  
  if (status) query.status = status;
  if (type) query.type = type;
  
  const transactions = await this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('payer', 'name email profile.avatar')
    .populate('payee', 'name email profile.avatar')
    .populate('exchangeRequest', 'amount exchangeType status');
  
  const total = await this.countDocuments(query);
  
  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Static method to get transaction statistics
transactionSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { payer: mongoose.Types.ObjectId(userId) },
          { payee: mongoose.Types.ObjectId(userId) }
        ],
        status: 'COMPLETED'
      }
    },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmountPaid: {
          $sum: {
            $cond: [
              { $eq: ['$payer', mongoose.Types.ObjectId(userId)] },
              '$amount',
              0
            ]
          }
        },
        totalAmountReceived: {
          $sum: {
            $cond: [
              { $eq: ['$payee', mongoose.Types.ObjectId(userId)] },
              '$netAmount',
              0
            ]
          }
        },
        totalFeesPaid: {
          $sum: {
            $cond: [
              { $eq: ['$payer', mongoose.Types.ObjectId(userId)] },
              '$platformFee',
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalTransactions: 0,
    totalAmountPaid: 0,
    totalAmountReceived: 0,
    totalFeesPaid: 0
  };
};

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
