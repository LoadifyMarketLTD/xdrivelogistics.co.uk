# XDrive Logistics - Full Integration MVP Demo

This document provides instructions for running and testing the complete XDrive Logistics Full Integration MVP with demo pages.

## Quick Start

### 1. Start PostgreSQL Database

```bash
docker compose up postgres -d
```

Wait ~10 seconds for PostgreSQL to initialize and load the schema and seed data.

### 2. Start Backend API Server

```bash
cd server
npm install  # if not already done
npm start
```

The backend API will be available at **http://localhost:3001**

### 3. Start Next.js Frontend

In a new terminal:

```bash
npm install  # if not already done
npm run dev
```

The frontend will be available at **http://localhost:3000**

## Demo Pages

The Full Integration MVP includes the following demo pages:

### → Register New Account
**URL**: http://localhost:3000/register

Create a new account as either a Driver or Shipper. The registration will:
- Validate your email and password
- Create an account in the database
- Send a verification email (logged to console in development mode)
- Redirect you to the login page

### → Sign In
**URL**: http://localhost:3000/login

Login with your credentials. On successful login, you'll be redirected to the dashboard.

### → Dashboard (requires login)
**URL**: http://localhost:3000/dashboard

The dashboard displays:
- Total bookings, active bookings, and completed bookings
- Recent bookings with details (pickup/delivery addresses, vehicle type, price, status)
- User account information

## Demo Credentials

Use these credentials to test the login functionality:

| Email | Password | Account Type |
|-------|----------|--------------|
| `shipper@xdrivelogistics.co.uk` | `password123` | Shipper |
| `driver@xdrivelogistics.co.uk` | `password123` | Driver |
| `ion@xdrivelogistics.co.uk` | `password123` | Driver |

## API Endpoints

The backend API is running at **http://localhost:3001**

### Health Check
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-13T14:00:00.000Z"
}
```

### Authentication

#### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shipper@xdrivelogistics.co.uk",
    "password": "password123"
  }'
```

Expected response:
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": 4,
    "email": "shipper@xdrivelogistics.co.uk",
    "account_type": "shipper",
    "status": "active"
  }
}
```

## Architecture

### Frontend (Next.js)
- **Port**: 3000
- **Tech Stack**: Next.js 16, React 19, Tailwind CSS
- **Pages**:
  - `/` - Home page
  - `/register` - User registration
  - `/login` - User login
  - `/dashboard` - User dashboard (requires authentication)

### Backend (Express)
- **Port**: 3001
- **Tech Stack**: Node.js, Express, PostgreSQL
- **Authentication**: JWT tokens, bcrypt password hashing
- **Email**: Nodemailer (logs to console in dev mode)
- **Rate Limiting**: 10 requests/15min for auth, 100 requests/15min for API

### Database (PostgreSQL)
- **Port**: 5432
- **Database**: xdrive
- **Tables**: users, bookings, invoices, feedback, watchlist
- **Demo Data**: 6 users, 25+ bookings

## Testing the Integration

### Test 1: Register New Account
1. Visit http://localhost:3000/register
2. Select account type (Driver or Shipper)
3. Enter email and password
4. Click "Create account"
5. You should see a success message and be redirected to login
6. Check backend console for verification email link

### Test 2: Login with Demo Credentials
1. Visit http://localhost:3000/login
2. Enter email: `shipper@xdrivelogistics.co.uk`
3. Enter password: `password123`
4. Click "Log in"
5. You should be redirected to the dashboard

### Test 3: View Dashboard
1. After logging in, you should see:
   - Your email in the header
   - Stats cards showing booking counts
   - Recent bookings list with details
2. Verify that the data is loaded from the backend API

### Test 4: Logout
1. Click the "Logout" button on the dashboard
2. You should be redirected to the login page
3. Try accessing `/dashboard` directly - you should be redirected to login

## Troubleshooting

### Backend won't start
- Check that PostgreSQL is running: `docker ps | grep postgres`
- Verify database connection: `docker exec xdrive-postgres psql -U xdrive -d xdrive -c "SELECT 1"`
- Check logs: `docker logs xdrive-postgres`

### Frontend can't connect to backend
- Verify backend is running on port 3001
- Check browser console for CORS errors
- Verify API_BASE_URL in `lib/api.js` is set to `http://localhost:3001`

### Login fails
- Verify demo users exist: `docker exec xdrive-postgres psql -U xdrive -d xdrive -c "SELECT email, status FROM users"`
- Check backend logs for errors
- Verify password is `password123`

### Database tables don't exist
- Manually load schema: `docker exec -i xdrive-postgres psql -U xdrive -d xdrive < db/schema.sql`
- Load seed data: `docker exec -i xdrive-postgres psql -U xdrive -d xdrive < db/seeds.sql`

## Stopping the Services

```bash
# Stop Next.js dev server: Ctrl+C in the terminal
# Stop backend server: Ctrl+C in the terminal
# Stop PostgreSQL:
docker compose down
```

## Features Demonstrated

✅ User registration with email verification  
✅ User login with JWT authentication  
✅ Protected dashboard requiring authentication  
✅ Real-time data from PostgreSQL database  
✅ Rate limiting on authentication endpoints  
✅ Secure password hashing with bcrypt  
✅ CORS-enabled API for cross-origin requests  
✅ Docker Compose for easy database setup  
✅ Modern UI with dark theme and responsive design  

## Next Steps

This is a fully functional MVP demonstrating the complete integration between Next.js frontend, Express backend, and PostgreSQL database. All demo credentials are working and the authentication flow is complete.

For production deployment, remember to:
- Set strong JWT_SECRET
- Configure real SMTP for email delivery
- Enable SSL/TLS for database connections
- Set up proper CORS origins (not '*')
- Use environment-specific configuration
- Add comprehensive error logging
- Implement refresh tokens
- Add API authentication middleware for protected routes
