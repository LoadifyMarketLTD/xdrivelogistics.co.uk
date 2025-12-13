# XDrive Logistics - Full Integration MVP Demo

This guide shows you how to run the complete XDrive Logistics MVP locally.

## Quick Start (3 Steps)

### 1. Start the Database

```bash
docker compose up -d postgres
```

Wait ~10 seconds for PostgreSQL to initialize and load seed data.

### 2. Start the Backend API

```bash
cd server
npm install
npm start
```

The API will be available at `http://localhost:3001`

### 3. Start the Frontend

In a new terminal:

```bash
cd public
python3 -m http.server 8000
```

Visit: **http://localhost:8000/**

## Demo Credentials

- **Email**: `shipper@xdrivelogistics.co.uk` / **Password**: `password123`
- **Email**: `driver@xdrivelogistics.co.uk` / **Password**: `password123`  
- **Email**: `ion@xdrivelogistics.co.uk` / **Password**: `password123`

## What You Can Test

### 1. User Registration
- Visit: http://localhost:8000/register-inline.html
- Create a new account (email verification will be logged to backend console)

### 2. User Login
- Visit: http://localhost:8000/desktop-signin-final.html
- Login with demo credentials above
- Successfully logged in users are redirected to the dashboard

### 3. Dashboard with Real Data
- Visit: http://localhost:8000/dashboard.html (or login first)
- See real-time data from the API:
  - **Gross Margin**: Calculated from bookings (revenue minus subcontract costs)
  - **Subcontract Spend**: Total costs paid to subcontractors
  - **Latest Bookings**: Shows recent loads with details
  - **Dashboard Stats**: Total jobs, customers, users from database

## API Endpoints to Test

```bash
# Health check
curl http://localhost:3001/health

# Get all bookings
curl http://localhost:3001/api/bookings

# Get gross margin report
curl "http://localhost:3001/api/reports/gross-margin?from=2025-12-01&to=2025-12-31"

# Get dashboard stats
curl http://localhost:3001/api/reports/dashboard-stats

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"shipper@xdrivelogistics.co.uk","password":"password123"}'

# Register new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"account_type":"driver","email":"test@example.com","password":"password123"}'
```

## Demo Data

The seed data includes:
- **10 bookings** (loads) with realistic addresses, vehicle types, and pricing
- **3 user accounts** (shipper and drivers)
- **5 invoices** linked to bookings
- **Gross margin calculation**: £2,590 from £8,690 revenue (29.8% margin)

## Features Demonstrated

✅ User registration with email verification (logged to console)  
✅ User login with bcrypt password hashing  
✅ Dashboard with live API data  
✅ Bookings CRUD operations  
✅ Financial reports (gross margin, subcontract spend)  
✅ PostgreSQL database with proper schema  
✅ Docker Compose for easy database setup  
✅ CORS-enabled API for frontend integration  
✅ Rate limiting on auth endpoints  

## Stopping the Services

```bash
# Stop backend: Ctrl+C in the backend terminal
# Stop frontend: Ctrl+C in the frontend terminal
# Stop database:
docker compose down
```

## Notes

- Email verification tokens are logged to the backend console (SMTP not configured)
- All passwords are hashed with bcrypt (rounds: 10)
- Database automatically initializes with schema and seed data on first run
- Frontend uses vanilla JavaScript (no build step required)

