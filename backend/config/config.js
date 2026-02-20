import dotenv from 'dotenv';
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/cash-exchange',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpire: process.env.JWT_EXPIRE || '15m',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
  },

  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  exchange: {
    defaultMaxDistance: parseInt(process.env.DEFAULT_MAX_DISTANCE) || 5000,
    defaultSearchLimit: parseInt(process.env.DEFAULT_SEARCH_LIMIT) || 50,
    defaultExpiryMinutes: parseInt(process.env.DEFAULT_EXPIRY_MINUTES) || 30,
    minAmount: parseFloat(process.env.MIN_EXCHANGE_AMOUNT) || 1,
    maxAmount: parseFloat(process.env.MAX_EXCHANGE_AMOUNT) || 100000,
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 0
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    errorFile: process.env.LOG_FILE_ERROR || 'logs/error.log',
    combinedFile: process.env.LOG_FILE_COMBINED || 'logs/combined.log'
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};

export default config;
