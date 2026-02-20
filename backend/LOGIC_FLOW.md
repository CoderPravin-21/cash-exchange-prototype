# Improved Backend Logic Flow

## 🔄 Complete System Architecture

This document explains the improved logic flow and how all components work together.

---

## 1. Authentication Flow

### Registration Flow
```
User submits registration
    ↓
Validation middleware checks all inputs
    ↓
Check if email/phone already exists
    ↓
Hash password with bcrypt (10 salt rounds)
    ↓
Create user in database
    ↓
Generate access token (15min) + refresh token (7 days)
    ↓
Store refresh token in user document
    ↓
Return user data + both tokens
```

**Key Improvements:**
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Phone number validation (exactly 10 digits)
- Coordinate validation
- Duplicate email/phone check
- Refresh token for extended sessions

### Login Flow
```
User submits credentials
    ↓
Find user by email (include password field)
    ↓
Check if account is locked
    ↓
Check if account is active
    ↓
Compare password with bcrypt
    ↓
If incorrect:
    - Increment login attempts
    - Lock account after 5 failed attempts (2 hour lock)
    - Return error
    ↓
If correct:
    - Reset login attempts
    - Update last login timestamp
    - Generate new token pair
    - Store refresh token (max 5 tokens)
    - Return user data + tokens
```

**Key Improvements:**
- Account locking mechanism
- Login attempt tracking
- Active/inactive account checking
- Refresh token rotation
- Security logging

### Token Refresh Flow
```
Client sends refresh token
    ↓
Verify refresh token signature
    ↓
Check if token exists in user's stored tokens
    ↓
Generate new token pair
    ↓
Remove old refresh token
    ↓
Store new refresh token
    ↓
Return new tokens
```

---

## 2. Exchange Request Lifecycle

### Creation Flow
```
User wants to exchange money
    ↓
Check: User has no active request (CREATED or ACCEPTED)
    ↓
If exchangeType = ONLINE_TO_CASH:
    Check wallet balance >= amount
    ↓
Calculate expiry time (default 30 minutes)
    ↓
Calculate platform fee (0% by default)
    ↓
Create exchange request with:
    - GeoJSON coordinates
    - Status: CREATED
    - Expiry timestamp
    ↓
Log creation event
    ↓
Return created request
```

**Key Improvements:**
- One active request per user (prevents spam)
- Wallet balance validation for ONLINE_TO_CASH
- Configurable expiry time (5 mins to 24 hours)
- Platform fee calculation
- Meeting point notes support

### Discovery Flow (Finding Nearby Requests)
```
User searches with lat/lng
    ↓
Build query:
    - Status = CREATED
    - Not expired
    - Exclude own requests
    - Optional filters: amount range, exchange type
    ↓
MongoDB $geoNear aggregation:
    - Calculate distance for each request
    - Sort by proximity
    - Apply maxDistance filter (default 5km)
    ↓
Populate requester details (exclude sensitive data)
    ↓
Apply pagination (page, limit)
    ↓
Increment view count for returned requests
    ↓
Return requests + pagination info + distances
```

**Key Improvements:**
- Accurate distance calculation
- Flexible filtering (amount, type)
- Pagination for large result sets
- View tracking
- Privacy protection (no wallet/password in results)

### Compatible Helper Discovery
```
User wants to find helpers for their request
    ↓
Find user's active CREATED request
    ↓
If none: Return error (must create request first)
    ↓
Determine opposite exchange type:
    CASH_TO_ONLINE ← → ONLINE_TO_CASH
    ↓
Search for nearby requests matching:
    - Opposite type
    - Amount >= user's amount
    - Not expired
    - Within maxDistance
    ↓
Return compatible helpers sorted by distance
```

**Key Improvements:**
- Automatic compatibility checking
- Amount sufficiency validation
- Bidirectional matching support

### Accept Flow (The Complex Part)
```
Helper wants to accept a request
    ↓
1. VALIDATION CHECKS:
    ✓ Helper has no other ACCEPTED exchange
    ✓ Target request exists
    ✓ Target request status = CREATED
    ✓ Target request not expired
    ✓ Not accepting own request
    ↓
2. COMPATIBILITY CHECKS:
    ✓ Helper has active CREATED request
    ✓ Exchange types are opposite
    ✓ Helper's amount >= Target amount
    ↓
3. ATOMIC UPDATE (prevent race conditions):
    Update target request WHERE:
        - ID matches
        - Status = CREATED
        - Helper = null
    Set:
        - Status = ACCEPTED
        - Helper = current user
        - AcceptedAt = now
    ↓
4. If update succeeds:
    Generate 6-digit completion code
    ↓
5. Link helper's request:
    Update helper's request:
        - Status = ACCEPTED
        - LinkedRequest = target request ID
    ↓
Return success + completion code
```

**Key Improvements:**
- Race condition prevention (atomic update)
- Comprehensive validation
- Completion code generation (OTP)
- Request linking (both requests updated together)
- Detailed error messages

### Completion Flow (Money Transfer)
```
Helper submits completion with code
    ↓
1. VALIDATION:
    ✓ Request exists
    ✓ Status = ACCEPTED
    ✓ Current user = helper
    ✓ Completion code matches
    ↓
2. START DATABASE TRANSACTION:
    ↓
3. WALLET OPERATIONS:
    Determine payer/payee based on exchange type:
        CASH_TO_ONLINE: requester pays, helper receives
        ONLINE_TO_CASH: helper pays, requester receives
    ↓
    Record balances before transaction
    ↓
    Debit payer wallet (with validation)
    ↓
    Credit payee wallet (after fee deduction)
    ↓
4. CREATE TRANSACTION RECORD:
    - Store all transaction details
    - Include before/after balances
    - Store completion time
    ↓
5. UPDATE EXCHANGE REQUESTS:
    - Mark target request as COMPLETED
    - Mark linked request as COMPLETED
    ↓
6. UPDATE USER STATS:
    - Increment completedExchanges for both users
    ↓
7. COMMIT TRANSACTION
    ↓
If any step fails:
    - ROLLBACK transaction
    - Return error
    - No changes applied
```

**Key Improvements:**
- Database transactions (ACID compliance)
- Completion code verification (OTP)
- Automatic wallet balance update
- Transaction audit trail
- Atomic operations (all or nothing)
- User statistics tracking

### Cancellation Flow
```
Requester wants to cancel
    ↓
Validate:
    ✓ Request exists
    ✓ Current user = requester
    ✓ Status = CREATED (only unaccepted requests)
    ↓
Update request:
    - Status = CANCELLED
    - CancelledAt = now
    ↓
Return success
```

**Key Improvements:**
- Only requester can cancel
- Only CREATED requests can be cancelled
- Timestamp tracking

---

## 3. Rating System Flow

```
User completes an exchange
    ↓
User submits rating for other party
    ↓
Validate:
    ✓ Transaction exists
    ✓ Transaction is COMPLETED
    ✓ User was involved in transaction
    ✓ No existing rating for this transaction
    ↓
Determine who to rate:
    If user = payer: rate payee
    If user = payee: rate payer
    ↓
Create rating with:
    - Overall rating (1-5)
    - Optional review text
    - Category ratings (punctuality, communication, trust)
    - Anonymous option
    ↓
Update rated user's profile:
    - Recalculate average rating
    - Increment total ratings count
    ↓
Return success
```

**Key Improvements:**
- One rating per transaction (prevents spam)
- Automatic rating calculation
- Category-based ratings
- Anonymous rating option
- Prevents self-rating

---

## 4. Transaction History & Analytics

### Transaction History
```
User requests transaction history
    ↓
Build query:
    - User is payer OR payee
    - Optional filters: status, type
    - Sort by date (newest first)
    ↓
Apply pagination
    ↓
Populate related data:
    - Other party details
    - Exchange request details
    ↓
Return transactions + pagination
```

### Transaction Statistics
```
User requests stats
    ↓
Aggregate all user transactions:
    - Total transactions count
    - Total amount paid
    - Total amount received
    - Total fees paid
    ↓
Return statistics
```

**Key Improvements:**
- Comprehensive transaction history
- Filtering and pagination
- Statistical summaries
- Privacy-aware (exclude sensitive data)

---

## 5. Security & Performance Optimizations

### Rate Limiting Strategy
```
Request received
    ↓
Check request type:
    - Auth endpoints: 5 requests per 15 min
    - Exchange creation: 10 per hour
    - Accept action: 3 per minute
    - General API: 100 per 15 min
    ↓
If limit exceeded: Return 429 error
Otherwise: Continue to route handler
```

### Input Validation Pipeline
```
Request received
    ↓
Express-validator rules check:
    - Data types correct
    - Required fields present
    - Value ranges valid
    - Format validation (email, phone, etc.)
    ↓
If validation fails:
    - Collect all errors
    - Return 400 with detailed error list
    ↓
If validation passes:
    - Sanitize inputs (remove HTML, special chars)
    - Normalize data (lowercase email, trim strings)
    - Continue to controller
```

### Database Query Optimization
```
Query request
    ↓
Use appropriate indexes:
    - User: email, location (2dsphere)
    - ExchangeRequest: status, location, expiresAt
    - Transaction: payer, payee, createdAt
    ↓
Apply query techniques:
    - Use .lean() for read-only queries (50% faster)
    - Project only needed fields
    - Limit results with pagination
    - Use aggregation for complex queries
    ↓
Return optimized results
```

---

## 6. Background Jobs (Cron)

### Hourly Job: Expire Old Requests
```
Every hour (0 * * * *)
    ↓
Find all requests:
    - Status = CREATED
    - expiresAt <= current time
    ↓
Update matching requests:
    - Set status = EXPIRED
    ↓
Log count of expired requests
```

### Daily Job: Cleanup Old Data
```
Every day at 2 AM (0 2 * * *)
    ↓
Calculate date 30 days ago
    ↓
Delete requests:
    - Status in [COMPLETED, CANCELLED, EXPIRED]
    - Updated more than 30 days ago
    ↓
Log count of deleted requests
```

---

## 7. Real-Time Features (Socket.IO)

### Connection Flow
```
Client connects to server
    ↓
Server assigns socket ID
    ↓
Client emits 'join' with user ID
    ↓
Server joins user to personal room
    ↓
Ready to receive notifications
```

### Notification Flow
```
Event occurs (e.g., request accepted)
    ↓
Server gets Socket.IO instance
    ↓
Emit event to specific user's room:
    io.to(userId).emit('requestAccepted', { data })
    ↓
Client receives notification
```

---

## 8. Error Handling Flow

### Global Error Handler
```
Error occurs in any route
    ↓
Error is caught by error handler middleware
    ↓
Classify error type:
    - Validation error → 400
    - Authentication error → 401
    - Authorization error → 403
    - Not found → 404
    - Mongoose errors → 400/500
    - Operational errors → Specific code
    - Unknown errors → 500
    ↓
Log error details:
    - Error message
    - Stack trace
    - Request path
    - User ID (if authenticated)
    ↓
Send formatted response:
    {
      success: false,
      message: "User-friendly error message",
      errors: [...] // If validation error
    }
    ↓
In development:
    Include stack trace in response
```

---

## 9. Key Architectural Decisions

### Why Refresh Tokens?
- **Security**: Access tokens expire quickly (15 min)
- **UX**: Users stay logged in without re-authenticating
- **Control**: Can revoke specific devices/sessions

### Why Transaction Sessions?
- **Atomicity**: All wallet updates succeed or fail together
- **Consistency**: Prevents partial transactions
- **Accuracy**: Balance records always match transaction history

### Why Completion Codes?
- **Verification**: Proves both parties met in person
- **Security**: Prevents remote fraud
- **Dispute Prevention**: Both parties confirm completion

### Why Linked Requests?
- **Bidirectional**: Both parties' requests are tracked
- **Status Sync**: Both requests complete together
- **Data Integrity**: Complete audit trail

### Why GeoJSON?
- **MongoDB Native**: 2dsphere indexes for fast queries
- **Industry Standard**: Compatible with mapping libraries
- **Distance Calculation**: Built-in distance queries

---

## 10. Testing the Flow

### Manual Testing Sequence

1. **Setup**
```bash
# Start MongoDB
mongod

# Start server
npm run dev
```

2. **Create Two Users**
```bash
# User A (Cash → Online)
POST /api/auth/register
{
  "name": "Alice",
  "email": "alice@test.com",
  "password": "Test1234",
  "phone": "1111111111",
  "location": { "coordinates": [77.5946, 12.9716] }
}

# User B (Online → Cash)
POST /api/auth/register
{
  "name": "Bob",
  "email": "bob@test.com",
  "password": "Test1234",
  "phone": "2222222222",
  "location": { "coordinates": [77.5950, 12.9720] }
}
```

3. **Create Exchange Requests**
```bash
# Alice creates CASH_TO_ONLINE request
POST /api/exchange
Authorization: Bearer <alice_token>
{
  "amount": 500,
  "exchangeType": "CASH_TO_ONLINE",
  "latitude": 12.9716,
  "longitude": 77.5946
}

# Bob creates ONLINE_TO_CASH request
POST /api/exchange
Authorization: Bearer <bob_token>
{
  "amount": 500,
  "exchangeType": "ONLINE_TO_CASH",
  "latitude": 12.9720,
  "longitude": 77.5950
}
```

4. **Discover & Accept**
```bash
# Bob discovers Alice's request
GET /api/exchange/nearby?lat=12.9720&lng=77.5950
Authorization: Bearer <bob_token>

# Bob accepts Alice's request
POST /api/exchange/<alice_request_id>/accept
Authorization: Bearer <bob_token>
```

5. **Complete Exchange**
```bash
# Bob completes with code (received in accept response)
POST /api/exchange/<alice_request_id>/complete
Authorization: Bearer <bob_token>
{
  "code": "123456"
}
```

6. **Rate & Review**
```bash
# Alice rates Bob
POST /api/ratings/<transaction_id>
Authorization: Bearer <alice_token>
{
  "rating": 5,
  "review": "Great exchange!"
}
```

---

## Conclusion

This improved backend provides:
- ✅ Production-ready code quality
- ✅ Comprehensive security
- ✅ Complete transaction management
- ✅ Excellent error handling
- ✅ Scalable architecture
- ✅ Clear audit trails
- ✅ Real-time capabilities

All major flaws from the original version have been addressed with proper validation, security, and transaction management.
