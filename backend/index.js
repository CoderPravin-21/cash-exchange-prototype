import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import cron from 'node-cron';
import http from 'http';
import { Server } from 'socket.io';

// Config and utilities
import config from './config/config.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

// Middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import exchangeRoutes from './routes/exchangeRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import testRoutes from './routes/testRoutes.js';
// Models
import ExchangeRequest from './models/ExchangeRequest.js';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials
  }
});

// Connect to database
await connectDB();

// ====================
// MIDDLEWARE
// ====================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS
app.use(cors(config.cors));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks

// Rate limiting (apply to all API routes)
app.use('/api/', apiLimiter);

// Request logging (development only)
if (config.env === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      body: req.body,
      query: req.query,
      ip: req.ip
    });
    next();
  });
}

// ====================
// SOCKET.IO SETUP
// ====================

io.on('connection', (socket) => {
  logger.info('Socket connected', { socketId: socket.id });

  // Join user to their personal room
  socket.on('join', (userId) => {
    socket.join(userId);
    logger.info('User joined room', { userId, socketId: socket.id });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id });
  });
});

// Make io accessible in routes
app.set('io', io);

// ====================
// ROUTES
// ====================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.env
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/test', testRoutes); // Added test routes for development

// API documentation route
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cash Exchange API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      exchange: '/api/exchange',
      transactions: '/api/transactions',
      ratings: '/api/ratings'
    },
    documentation: 'See README.md for full API documentation'
  });
});

// ====================
// ERROR HANDLING
// ====================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ====================
// CRON JOBS
// ====================

// Expire old exchange requests (runs every hour)
cron.schedule('0 * * * *', async () => {
  try {
    const result = await ExchangeRequest.updateMany(
      {
        status: 'CREATED',
        'timeline.expiresAt': { $lte: new Date() }
      },
      {
        $set: { status: 'EXPIRED' }
      }
    );

    logger.info('Expired requests updated', {
      count: result.modifiedCount
    });
  } catch (error) {
    logger.error('Error in expiry cron job:', error);
  }
});

// Cleanup very old completed/cancelled requests (runs daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ExchangeRequest.deleteMany({
      status: { $in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
      updatedAt: { $lte: thirtyDaysAgo }
    });

    logger.info('Old requests cleaned up', {
      count: result.deletedCount
    });
  } catch (error) {
    logger.error('Error in cleanup cron job:', error);
  }
});

// ====================
// START SERVER
// ====================

const PORT = config.port;

server.listen(PORT, () => {
  logger.info(`🚀 Server running in ${config.env} mode on port ${PORT}`);
  logger.info(`📡 Health check: http://localhost:${PORT}/health`);
  logger.info(`📚 API documentation: http://localhost:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default app;
