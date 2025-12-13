# XDrive Logistics - Full-Integration MVP

A modern courier exchange platform with Node.js/Express backend, PostgreSQL database, and interactive frontend. Enables shippers to post delivery requests, drivers to make offers, and provides comprehensive reporting and analytics.

## Features

- 🔐 **Authentication**: Register, login, email verification with JWT
- 📦 **Bookings Management**: Full CRUD operations for delivery bookings
- 💰 **Invoicing**: Track invoices linked to bookings
- 📊 **Reports & Analytics**: Gross margin calculations, subcontract spend tracking
- 💬 **Feedback System**: Customer ratings and comments
- 🎯 **Watchlist**: Track favorite bookings and suppliers
- 🎨 **Modern Dashboard**: Interactive charts with Chart.js
- 🐳 **Docker Ready**: Full Docker Compose setup for development

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Authentication**: bcrypt, JWT, email verification
- **Email**: Nodemailer with SendGrid support
- **Frontend**: HTML5, CSS3, JavaScript, Chart.js
- **Database**: PostgreSQL 15
- **DevOps**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 18+ and PostgreSQL 15+ (manual setup)

## Quick Start with Docker (Recommended)

### 1. Clone and Start Services

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk

# Start PostgreSQL and Backend API
docker compose up --build
```

The services will start:
- **PostgreSQL**: `localhost:5432`
- **Backend API**: `http://localhost:3001`

### 2. Seed the Database

In a new terminal, run:

```bash
# Wait for postgres to be ready (about 10 seconds)
sleep 10

# Seed the database with sample data
docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/seeds.sql
```

Or use the convenience script:

```bash
chmod +x docker/dev/seed.sh
./docker/dev/seed.sh
```

### 3. Open the Frontend

Serve the `public/` directory with any static file server:

```bash
# Using Python
cd public
python3 -m http.server 8000

# Using Node.js http-server
npx http-server public -p 8000

# Using PHP
cd public
php -S localhost:8000
```

Then open:
- **Login**: http://localhost:8000/desktop-signin-final.html
- **Register**: http://localhost:8000/register-inline.html
- **Dashboard**: http://localhost:8000/dashboard.html

### 4. Test with Demo Credentials

```
Email: shipper@example.com
Password: password123
```

---

## Manual Setup (Without Docker)

### 1. Install PostgreSQL 15+

Install and start PostgreSQL on your system.

### 2. Create Database

```bash
createdb xdrive_db
psql xdrive_db < db/schema.sql
psql xdrive_db < db/seeds.sql
```

### 3. Configure Backend Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your database credentials:

```env
DATABASE_URL=postgresql://localhost:5432/xdrive_db
PORT=3001
JWT_SECRET=your-secret-key-here
# ... see server/.env.example for all options
```

### 4. Install Backend Dependencies and Start

```bash
cd server
npm install
npm start
```

### 5. Serve Frontend

```bash
cd public
python3 -m http.server 8000
```

---

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Create a new user account.

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "shipper",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "account_type": "shipper",
    "status": "pending"
  }
}
```

#### POST /api/auth/login
Authenticate and receive JWT token.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shipper@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "shipper@example.com",
    "account_type": "shipper"
  }
}
```

#### GET /api/auth/verify-email?token=xxx
Verify email address.

```bash
curl "http://localhost:3001/api/auth/verify-email?token=your-verification-token"
```

### Bookings Endpoints

#### GET /api/bookings
List all bookings with optional filters.

```bash
# Get all bookings
curl http://localhost:3001/api/bookings

# Filter by status
curl "http://localhost:3001/api/bookings?status=Delivered&limit=10"

# Filter by date range
curl "http://localhost:3001/api/bookings?from_date=2025-01-01&to_date=2025-01-31"
```

#### GET /api/bookings/:id
Get a single booking.

```bash
curl http://localhost:3001/api/bookings/1
```

#### POST /api/bookings
Create a new booking.

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "load_id": "LD-2025-999",
    "from_address": "London, UK",
    "to_address": "Manchester, UK",
    "vehicle_type": "Large Van",
    "pickup_window_start": "2025-02-01T09:00:00",
    "pickup_window_end": "2025-02-01T11:00:00",
    "delivery_instruction": "Call before delivery",
    "price": 450.00,
    "subcontract_cost": 320.00,
    "status": "Pending"
  }'
```

#### PUT /api/bookings/:id
Update a booking.

```bash
curl -X PUT http://localhost:3001/api/bookings/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Transit",
    "completed_by": "John Doe"
  }'
```

### Reports Endpoints

#### GET /api/reports/gross-margin
Calculate gross margin and subcontract spend.

```bash
# All time
curl http://localhost:3001/api/reports/gross-margin

# Specific date range
curl "http://localhost:3001/api/reports/gross-margin?from=2025-01-01&to=2025-01-31"
```

**Response:**
```json
{
  "period": {
    "from": "2025-01-01",
    "to": "2025-01-31"
  },
  "summary": {
    "total_bookings": 15,
    "total_revenue": 5945.00,
    "total_subcontract_cost": 3420.00,
    "gross_margin_total": 2525.00,
    "avg_gross_margin": 168.33,
    "gross_margin_percentage": 42.46
  }
}
```

#### GET /api/reports/bookings-by-status
Get booking counts by status.

```bash
curl http://localhost:3001/api/reports/bookings-by-status
```

### Invoices Endpoints

#### GET /api/invoices
List all invoices.

```bash
curl http://localhost:3001/api/invoices

# Filter by status
curl "http://localhost:3001/api/invoices?status=pending"
```

#### POST /api/invoices
Create a new invoice.

```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "invoice_number": "INV-2025-100",
    "amount": 450.00,
    "due_date": "2025-02-28",
    "status": "pending"
  }'
```

### Feedback Endpoints

#### GET /api/feedback
List all feedback.

```bash
curl http://localhost:3001/api/feedback
```

#### POST /api/feedback
Submit feedback.

```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "booking_id": 1,
    "rating": 5,
    "comment": "Excellent service!"
  }'
```

---

## Database Management

### Reset Database

```bash
./docker/dev/reset-db.sh
```

Or manually:

```bash
docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
EOF

docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/schema.sql
docker exec -i xdrive-postgres psql -U xdrive -d xdrive_db < db/seeds.sql
```

### Access Database Console

```bash
docker exec -it xdrive-postgres psql -U xdrive -d xdrive_db
```

### Backup Database

```bash
docker exec xdrive-postgres pg_dump -U xdrive xdrive_db > backup.sql
```

---

## Usage

1. **Register** - Create an account as either a Driver or Shipper via the registration page
2. **Login** - Sign in with your credentials
3. **Dashboard** - View bookings, gross margin reports, and analytics
4. **Manage Bookings** - Create, update, and track delivery bookings
5. **Reports** - Analyze gross margin, subcontract spend, and revenue

## Project Structure

```
xdrivelogistics.co.uk/
├── server/                 # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   │   ├── auth.js    # Authentication endpoints
│   │   │   ├── bookings.js
│   │   │   ├── invoices.js
│   │   │   ├── reports.js
│   │   │   └── feedback.js
│   │   ├── index.js       # Express app entry point
│   │   ├── db.js          # PostgreSQL pool helper
│   │   └── mailer.js      # Email service (SendGrid)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example       # Backend environment template
│
├── db/                    # Database files
│   ├── schema.sql         # Database schema
│   └── seeds.sql          # Sample data
│
├── public/                # Frontend static files
│   ├── desktop-signin-final.html
│   ├── register-inline.html
│   ├── dashboard.html     # Interactive dashboard with Chart.js
│   └── assets/
│
├── docker/                # Docker utilities
│   └── dev/
│       ├── seed.sh        # Seed database script
│       └── reset-db.sh    # Reset database script
│
├── docker-compose.yml     # Docker services configuration
├── .env.example           # Root environment template
├── .env.prod.example      # Production environment template
└── README.md
```

## Deployment

### Production Deployment

1. **Backend**: Deploy to any Node.js hosting (Render, Railway, Heroku, DigitalOcean)
   - Set environment variables from `.env.prod.example`
   - Configure PostgreSQL database (Neon, Supabase, AWS RDS)
   - Run migrations: `psql $DATABASE_URL < db/schema.sql`
   - Seed data: `psql $DATABASE_URL < db/seeds.sql`

2. **Frontend**: Deploy static files to CDN (Netlify, Vercel, Cloudflare Pages)
   - Update API_BASE URL in frontend HTML files
   - Configure CORS_ORIGIN in backend to match frontend domain

### Environment Variables for Production

See `.env.prod.example` for all required production environment variables.

**Important:**
- Generate strong JWT_SECRET: `openssl rand -base64 32`
- Use SSL-enabled PostgreSQL (set `?sslmode=require`)
- Configure SendGrid API key for email delivery
- Never commit `.env` or `.env.prod` files

## Security Notes

- **Never commit** `.env`, `.env.local`, or `.env.prod` files
- Use **strong random secrets** for JWT_SECRET (generate with `openssl rand -base64 32`)
- Enable **SSL/TLS** for PostgreSQL in production (`?sslmode=require`)
- Configure **rate limiting** on auth endpoints (already implemented)
- Use **SendGrid** or similar for production email delivery
- Store secrets in **environment variables** or secret managers (AWS Secrets Manager, etc.)
- Enable **CORS** only for trusted domains in production

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker ps`
- Verify DATABASE_URL in server/.env
- Check logs: `docker logs xdrive-backend`

### Frontend can't connect to backend
- Ensure backend is running on port 3001
- Check browser console for CORS errors
- Verify API_BASE URL in frontend JavaScript

### Database connection errors
- Wait 10-15 seconds after `docker compose up` for PostgreSQL to initialize
- Check connection string format: `postgresql://user:pass@host:port/db`
- Verify credentials match docker-compose.yml

### Email verification not working
- Check server logs for email sending attempts
- If SMTP not configured, emails are logged to console (dev mode)
- For production, configure SendGrid API key in SMTP_PASS

## Contributing

Please create a new branch for each feature and submit a pull request for review.

## Build Commands

### Backend
- `npm start` - Start production server
- `npm run dev` - Start with auto-reload
- `npm run seed` - Seed database (requires DATABASE_URL)

### Frontend
- Serve `public/` directory with any static server
- No build step required (vanilla HTML/CSS/JS)

## Contributing

Please create a new branch for each feature and submit a pull request for review.

## License

Proprietary - © Danny Courier LTD
