# Cash Exchange Backend - Improved Version 2.0

A production-ready geo-based peer-to-peer cash-online exchange platform with comprehensive security, transaction management, and real-time features.

## 🎯 What's New in V2.0

### Core Improvements
✅ **Complete Wallet System** - Full transaction processing with balance management
✅ **Transaction History** - Complete audit trail for all exchanges
✅ **Rating System** - Users can rate each other after exchanges
✅ **Input Validation** - Comprehensive validation middleware
✅ **Rate Limiting** - Protection against spam and abuse
✅ **Security Enhancements** - Helmet, XSS protection, NoSQL injection prevention
✅ **Real-Time Updates** - Socket.IO for instant notifications
✅ **Refresh Tokens** - More secure authentication flow
✅ **Error Handling** - Professional error responses and logging
✅ **Completion Codes** - OTP verification for exchange completion
✅ **Account Locking** - Protection against brute force attacks
✅ **Pagination** - Efficient data fetching for all list endpoints
✅ **Distance Calculation** - Accurate geospatial queries with distance sorting

### New Features
- Transaction statistics and analytics
- User profile management
- Password change functionality
- Location updates
- Linked exchange requests
- Platform fee calculation
- Request expiry with automated cleanup
- Comprehensive logging system
- Health check endpoint

## 📋 Prerequisites

- Node.js v18+ 
- MongoDB v6+
- npm or yarn

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# OR
yarn install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Required Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret_key
```

### 4. Start the Server

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "1234567890",
  "location": {
    "coordinates": [77.5946, 12.9716]
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

#### Get Profile
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Update Location
```http
PUT /api/auth/location
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Exchange Request Endpoints

#### Create Exchange Request
```http
POST /api/exchange
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "amount": 500,
  "exchangeType": "CASH_TO_ONLINE",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "expiresInMinutes": 30,
  "notes": "Near Starbucks"
}
```

#### Get Nearby Requests
```http
GET /api/exchange/nearby?lat=12.9716&lng=77.5946&maxDistance=5000&page=1&limit=20
Authorization: Bearer <access_token>
```

#### Discover Compatible Helpers
```http
GET /api/exchange/helpers?maxDistance=5000&page=1&limit=20
Authorization: Bearer <access_token>
```

#### Accept Exchange Request
```http
POST /api/exchange/:id/accept
Authorization: Bearer <access_token>
```

#### Complete Exchange Request
```http
POST /api/exchange/:id/complete
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "code": "123456"
}
```

#### Cancel Exchange Request
```http
POST /api/exchange/:id/cancel
Authorization: Bearer <access_token>
```

#### Get My Requests
```http
GET /api/exchange/my-requests?status=CREATED&page=1&limit=20
Authorization: Bearer <access_token>
```

### Transaction Endpoints

#### Get Transaction History
```http
GET /api/transactions?page=1&limit=20&status=COMPLETED
Authorization: Bearer <access_token>
```

#### Get Transaction Statistics
```http
GET /api/transactions/stats
Authorization: Bearer <access_token>
```

### Rating Endpoints

#### Create Rating
```http
POST /api/ratings/:transactionId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "rating": 5,
  "review": "Great experience!",
  "categories": {
    "punctuality": 5,
    "communication": 5,
    "trustworthiness": 5
  },
  "isAnonymous": false
}
```

#### Get User Ratings
```http
GET /api/ratings/user/:userId?page=1&limit=20
Authorization: Bearer <access_token>
```

## 🔄 Exchange Flow

### Complete Exchange Workflow

1. **User A** creates a request (e.g., CASH_TO_ONLINE for ₹500)
2. **User B** discovers User A's request nearby
3. **User B** must have a compatible request (ONLINE_TO_CASH for ≥₹500)
4. **User B** accepts User A's request
   - Both requests are marked as "ACCEPTED"
   - A 6-digit completion code is generated
5. Users meet in person and exchange
6. **Helper (User B)** completes the exchange with the code
   - Wallet balances are updated
   - Transaction record is created
   - Both requests are marked as "COMPLETED"
7. Both users can rate each other

## 💾 Database Models

### User Schema
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  location: GeoJSON Point,
  wallet: {
    balance: Number,
    currency: String
  },
  profile: {
    rating: Number,
    totalRatings: Number,
    completedExchanges: Number
  }
}
```

### Exchange Request Schema
```javascript
{
  requester: ObjectId → User,
  helper: ObjectId → User,
  amount: Number,
  exchangeType: 'CASH_TO_ONLINE' | 'ONLINE_TO_CASH',
  location: GeoJSON Point,
  status: 'CREATED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED',
  linkedRequest: ObjectId → ExchangeRequest,
  timeline: {
    expiresAt: Date,
    acceptedAt: Date,
    completedAt: Date
  },
  metadata: {
    completionCode: String,
    platformFee: Number,
    distance: Number
  }
}
```

### Transaction Schema
```javascript
{
  exchangeRequest: ObjectId,
  payer: ObjectId → User,
  payee: ObjectId → User,
  amount: Number,
  type: 'CASH_TO_ONLINE' | 'ONLINE_TO_CASH',
  status: 'COMPLETED' | 'FAILED' | 'REVERSED',
  platformFee: Number,
  netAmount: Number,
  balanceBefore/After: Number
}
```

## 🔒 Security Features

- **Password Hashing** - bcrypt with 10 salt rounds
- **JWT Authentication** - Access + Refresh token system
- **Rate Limiting** - 5 auth attempts per 15 minutes, 100 API requests per window
- **Input Validation** - express-validator on all endpoints
- **NoSQL Injection Prevention** - express-mongo-sanitize
- **XSS Protection** - xss-clean middleware
- **Security Headers** - Helmet.js
- **Account Locking** - After 5 failed login attempts
- **CORS Protection** - Configurable allowed origins

## 📊 Logging & Monitoring

- **Winston Logger** - File-based logging with rotation
- **Error Logs** - logs/error.log
- **Combined Logs** - logs/combined.log
- **Console Logging** - Development mode only

## ⚙️ Cron Jobs

- **Hourly** - Expire old exchange requests
- **Daily (2 AM)** - Cleanup old completed/cancelled requests (30+ days)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 📁 Project Structure

```
improved-backend/
├── config/
│   ├── config.js          # Environment-based configuration
│   └── db.js              # Database connection
├── controllers/
│   ├── authController.js      # Authentication logic
│   └── exchangeController.js  # Exchange request logic
├── middleware/
│   ├── authMiddleware.js      # JWT verification
│   ├── errorHandler.js        # Error handling
│   ├── rateLimiter.js         # Rate limiting configs
│   └── validateRequest.js     # Input validation
├── models/
│   ├── User.js                # User model
│   ├── ExchangeRequest.js     # Exchange request model
│   ├── Transaction.js         # Transaction model
│   └── Rating.js              # Rating model
├── routes/
│   ├── authRoutes.js          # Auth endpoints
│   ├── exchangeRoutes.js      # Exchange endpoints
│   ├── transactionRoutes.js   # Transaction endpoints
│   └── ratingRoutes.js        # Rating endpoints
├── utils/
│   ├── generateToken.js       # JWT token utilities
│   └── logger.js              # Winston logger
├── logs/                      # Log files (auto-generated)
├── .env.example               # Environment template
├── package.json
├── index.js                   # Main application file
└── README.md
```

## 🚦 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

## 🐛 Common Issues & Solutions

### Issue: MongoDB Connection Failed
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

### Issue: Port Already in Use
```bash
# Find process using port
lsof -i :5000

# Kill the process
kill -9 <PID>
```

### Issue: JWT Secret Not Set
```
Error: JWT_SECRET environment variable not set

Solution: Add JWT_SECRET to your .env file
```

## 📈 Performance Tips

1. **Enable MongoDB Indexes** - Already configured in models
2. **Use Pagination** - Limit queries to 20-50 items
3. **Cache Frequent Queries** - Consider Redis for production
4. **Use Lean Queries** - For read-only operations
5. **Optimize Geospatial Queries** - Keep maxDistance reasonable

## 🌟 Future Enhancements

- [ ] Email verification
- [ ] SMS OTP verification
- [ ] Push notifications
- [ ] Chat between users
- [ ] Dispute resolution system
- [ ] Admin dashboard
- [ ] Analytics & reporting
- [ ] Multi-currency support
- [ ] KYC verification
- [ ] Scheduled exchanges

## 📞 Support

For issues or questions:
1. Check this README
2. Review the code comments
3. Check logs in `logs/` directory

## 📄 License

ISC

## 👨‍💻 Contributors

Built with improvements to the original cash-exchange backend.

---

**Version:** 2.0.0
**Last Updated:** February 2026
