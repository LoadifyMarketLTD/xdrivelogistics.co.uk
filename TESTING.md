# Testing Guide - XDrive Logistics MVP

This document provides step-by-step instructions for testing the XDrive Logistics full integration MVP.

## Prerequisites

- PostgreSQL 14+ running locally
- Node.js 18+ installed
- Terminal access
- Web browser

## Setup Steps

### 1. Database Setup

```bash
# Create database
createdb xdrive

# Run schema
psql -d xdrive -f db/schema.sql

# Load seed data
psql -d xdrive -f db/seeds.sql
```

**Expected Output:**
```
Seed data inserted successfully!
 users_count | bookings_count | invoices_count | feedback_count | watchlist_count 
-------------+----------------+----------------+----------------+-----------------
           3 |             18 |              6 |              5 |               3
```

### 2. Backend Setup

```bash
cd server
npm install

# Create .env file
cp .env.example .env

# Edit .env and update DATABASE_URL with your credentials
# DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/xdrive
```

### 3. Start Backend

```bash
# From server directory
npm start
```

**Expected Output:**
```
⚠️  SMTP not configured - emails will be logged to console
🚀 XDrive Logistics API server running on port 3001
📍 Environment: development
🔗 Health check: http://localhost:3001/health
```

## API Testing

### Test 1: Health Check

```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{"status":"ok","timestamp":"2025-12-13T01:32:40.074Z"}
```

### Test 2: List Bookings

```bash
curl http://localhost:3001/api/bookings | jq .
```

**Expected Response:**
```json
{
  "bookings": [...],
  "count": 18
}
```

### Test 3: Gross Margin Report

```bash
curl "http://localhost:3001/api/reports/gross-margin?from=2024-12-01&to=2024-12-31" | jq .summary
```

**Expected Response:**
```json
{
  "total_bookings": 12,
  "total_revenue": 5370,
  "subcontract_spend": 3930,
  "gross_margin_total": 1440,
  "avg_margin_per_booking": 120,
  "margin_percentage": 26.82
}
```

### Test 4: User Registration

```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "test@example.com",
    "password": "testpass123",
    "full_name": "Test Driver"
  }' | jq .
```

**Expected Response:**
```json
{
  "message": "Account created successfully. Please check your email to verify.",
  "user": {
    "id": 4,
    "email": "test@example.com",
    "account_type": "driver",
    "status": "pending"
  }
}
```

**Check Server Logs:** You should see the verification email logged:
```
📧 Email would be sent:
   To: test@example.com
   Subject: Verify your XDrive account
   Body: Please verify your account: http://localhost:3000/verify-email.html?token=...
```

### Test 5: Email Verification

Copy the token from the server logs and verify:

```bash
curl "http://localhost:3001/api/verify-email?token=YOUR_TOKEN_HERE" | jq .
```

**Expected Response:**
```json
{
  "message": "Email verified successfully. You can now login.",
  "email": "test@example.com"
}
```

### Test 6: Login

```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }' | jq .
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 4,
    "email": "test@example.com",
    "account_type": "driver",
    "full_name": "Test Driver"
  }
}
```

### Test 7: Create Booking

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "load_id": "LOAD-TEST-001",
    "from_address": "London, UK",
    "to_address": "Manchester, UK",
    "vehicle_type": "Van",
    "pickup_date": "2024-12-20",
    "price": 500.00,
    "subcontract_cost": 350.00,
    "status": "pending"
  }' | jq .
```

**Expected Response:**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "id": 19,
    "load_id": "LOAD-TEST-001",
    "from_address": "London, UK",
    "to_address": "Manchester, UK",
    ...
  }
}
```

### Test 8: Submit Feedback

```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Excellent platform!",
    "feedback_type": "general"
  }' | jq .
```

**Expected Response:**
```json
{
  "message": "Feedback submitted successfully",
  "feedback": {
    "id": 6,
    "rating": 5,
    "comment": "Excellent platform!",
    ...
  }
}
```

## Frontend Testing

### Test 1: Registration Page

1. Open `public/register-inline.html` in your browser
2. Fill in the registration form:
   - Select account type (Driver or Shipper)
   - Enter email address
   - Enter password (min 8 characters)
   - Confirm password
3. Click "Create account"
4. Check browser console and server logs for verification link

**Expected Behavior:**
- Form validates inputs
- Success message displayed
- Server logs show verification email
- Page redirects to login after 3 seconds

### Test 2: Login Page

1. Open `public/desktop-signin-final.html` in your browser
2. Enter verified user credentials
3. Click "Sign in to XDrive"

**Expected Behavior:**
- Login successful message
- Token stored in localStorage
- Redirect to dashboard

### Test 3: Dashboard

1. After logging in, dashboard should load
2. Date range selector should default to current month
3. Metrics should display:
   - Total Bookings
   - Total Revenue
   - Gross Margin
   - Margin %

**Expected Behavior:**
- Charts render using Chart.js
- Bookings list populates
- KPIs update when date range changes
- Data matches backend API responses

### Test 4: Email Verification Page

1. Open `public/verify-email.html?token=YOUR_TOKEN` in your browser
2. Page should verify the token automatically

**Expected Behavior:**
- "Verifying..." message shows briefly
- Success message appears on valid token
- "Go to Login" link appears
- Error message on invalid/expired token

## Database Verification

### Check Seeded Data

```bash
# Count records
psql -d xdrive -c "
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM feedback) as feedback,
  (SELECT COUNT(*) FROM watchlist) as watchlist;
"
```

**Expected Output:**
```
 users | bookings | invoices | feedback | watchlist 
-------+----------+----------+----------+-----------
     3 |       18 |        6 |        5 |         3
```

### Verify Gross Margin Calculation

```bash
psql -d xdrive -c "
SELECT 
  COUNT(*) as delivered_bookings,
  SUM(price) as total_revenue,
  SUM(subcontract_cost) as total_cost,
  SUM(price - subcontract_cost) as gross_margin
FROM bookings 
WHERE status IN ('delivered', 'completed')
  AND pickup_date >= '2024-12-01' 
  AND pickup_date <= '2024-12-31';
"
```

**Expected Output:**
```
 delivered_bookings | total_revenue | total_cost | gross_margin 
--------------------+---------------+------------+--------------
                 12 |       5370.00 |    3930.00 |      1440.00
```

## Security Testing

### Test Rate Limiting

Try registering multiple times rapidly:

```bash
for i in {1..15}; do
  curl -X POST http://localhost:3001/api/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@test.com\",\"password\":\"pass123\",\"account_type\":\"driver\"}"
  echo
done
```

**Expected Behavior:**
After 10 requests, you should get:
```json
{"error":"Too many authentication attempts, please try again later"}
```

### Test Password Hashing

```bash
psql -d xdrive -c "SELECT email, LEFT(password_hash, 20) FROM users WHERE email = 'test@example.com';"
```

**Expected Output:**
Password hash should start with `$2b$10$` (bcrypt format)

## Troubleshooting

### Backend won't start

**Error:** Cannot find module 'dotenv'
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

**Error:** Database connection failed
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env
- Check credentials and database exists

### Frontend can't connect to backend

**Error:** Network error
- Ensure backend is running on http://localhost:3001
- Check browser console for CORS errors
- Verify firewall isn't blocking port 3001

### Dashboard shows no data

1. Check browser console for errors
2. Verify backend is responding: `curl http://localhost:3001/api/bookings`
3. Check date range - data is for December 2024 - January 2025
4. Clear browser cache and reload

## Success Criteria

✅ **All API endpoints return expected responses**
✅ **Database seeding completes successfully**  
✅ **Registration creates users with pending status**
✅ **Email verification activates users**
✅ **Login returns JWT token**
✅ **Gross margin calculation matches database query**
✅ **Dashboard loads and displays charts**
✅ **Rate limiting prevents abuse**
✅ **Passwords are bcrypt hashed**
✅ **CORS allows frontend access**

## Performance Benchmarks

### Expected Response Times (local)

- Health check: < 10ms
- List bookings: < 50ms
- Gross margin report: < 100ms
- Registration: < 200ms (includes bcrypt hashing)
- Login: < 200ms (includes bcrypt verification)

### Database Query Performance

All queries should complete in < 100ms with seeded data size.

## Next Steps

After successful testing:

1. Review code quality and security
2. Test with larger datasets
3. Add integration tests
4. Set up CI/CD pipeline
5. Configure production environment variables
6. Enable real SMTP for email
7. Add monitoring and logging
8. Implement backup strategy
