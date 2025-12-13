# XDrive Logistics - Full-Integration MVP

A modern courier exchange platform with Node.js/Express backend, PostgreSQL database, and interactive frontend. Enables shippers to post delivery requests, drivers to make offers, and provides comprehensive reporting and analytics.
# XDrive Logistics - Full Integration MVP

A modern courier exchange platform with:
- Next.js 16 frontend (optional)
- Node.js/Express backend API
- PostgreSQL database
- Static HTML demo pages for testing
- Docker Compose for local development

A complete courier exchange platform with Express.js backend, PostgreSQL database, and modern frontend.

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
- 🔐 Authentication (Register, Login with email verification)
- 📦 Bookings Management (CRUD operations for loads/deliveries)
- 💰 Financial Reports (Gross margin, subcontract spend)
- 📊 Dashboard with real-time statistics
- 🚚 Multi-role support (Driver, Shipper)
- 🎨 Modern premium UI with dark theme
- 🐳 Docker Compose for easy local setup

## Quick Start with Docker Compose (Recommended)

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

> **Note**: First-time build may take 2-5 minutes as npm installs all dependencies. Subsequent starts will be faster.

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
The easiest way to run the full stack locally:

```bash
# 1. Clone the repository
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk

# 2. Start all services (PostgreSQL + Backend API)
docker compose up --build

# 3. Wait for services to start (database will auto-initialize with schema and seed data)
# Backend API will be available at http://localhost:3001
# PostgreSQL will be available at localhost:5432

# 4. Serve the frontend static files
# Option A: Using Python
cd public && python3 -m http.server 8000

# Option B: Using Node.js
cd public && npx http-server -p 8000

# 5. Open your browser
# Navigate to http://localhost:8000/dashboard.html
# Or register: http://localhost:8000/register-inline.html
# Or login: http://localhost:8000/desktop-signin-final.html
```

### Demo Credentials

The seed data includes these demo accounts (password: `password123`):

- **Shipper**: `shipper@xdrivelogistics.co.uk`
- **Driver**: `driver@xdrivelogistics.co.uk` or `ion@xdrivelogistics.co.uk`

**For the complete integration MVP with Docker Compose, see [README-INTEGRATION.md](./README-INTEGRATION.md)**

- Docker and Docker Compose (for the easiest setup)
- OR Node.js 20+ and PostgreSQL 12+ (for manual setup)
- npm 10 or higher

## Manual Setup (Without Docker)

### 1. Set Up PostgreSQL Database

```bash
# Create database
createdb xdrive

# Run schema
psql -d xdrive -f db/schema.sql

# Load seed data
psql -d xdrive -f db/seeds.sql
```

### 2. Configure Backend

```bash
cd server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# Minimum required:
# DATABASE_URL=postgresql://username:password@localhost:5432/xdrive
# PORT=3001

# Start the backend
npm start
```

### 3. Serve Frontend Files

```bash
# In a new terminal, from the project root
cd public
python3 -m http.server 8000

# Or use Node.js http-server
npx http-server -p 8000
```

### 4. Test the Application

Visit http://localhost:8000/dashboard.html

## Environment Variables

### Backend Configuration (`server/.env`)

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://xdrive:xdrive@localhost:5432/xdrive

# SMTP (Optional - leave empty to log emails to console)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="XDrive Logistics <no-reply@xdrivelogistics.co.uk>"

# Security
BCRYPT_ROUNDS=10
VERIFY_TOKEN_EXPIRES_MIN=60

# CORS
CORS_ORIGIN=http://localhost:8000
```

**Note**: If SMTP credentials are not configured, verification emails will be logged to the console instead of being sent.

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/verify-email?token=xxx` - Verify email address

### Bookings

- `GET /api/bookings` - Get all bookings (supports ?status=, ?limit=, ?offset=)
- `GET /api/bookings/:id` - Get single booking
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking

### Reports

- `GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD` - Get gross margin report
- `GET /api/reports/dashboard-stats` - Get dashboard statistics
- `GET /api/reports/monthly-totals?year=YYYY&month=MM` - Get monthly totals

### Invoices

- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get single invoice
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice

### Health Check

- `GET /health` - API health status

## Testing with curl

```bash
# Register a new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shipper@xdrivelogistics.co.uk",
    "password": "password123"
  }'

# Get bookings
curl http://localhost:3001/api/bookings

# Get gross margin report
curl "http://localhost:3001/api/reports/gross-margin?from=2025-12-01&to=2025-12-31"

# Get dashboard stats
curl http://localhost:3001/api/reports/dashboard-stats
```

## Database Schema

The application uses the following tables:

- **users** - User accounts (drivers and shippers)
- **bookings** - Load/delivery records with pricing
- **invoices** - Invoice records linked to bookings
- **feedback** - User ratings and feedback
- **watchlist** - Compliance tracking for suppliers

See `db/schema.sql` for complete schema definition.

## Supabase Integration (Optional - Legacy)

The project originally used Supabase. To use Supabase instead of the local PostgreSQL setup:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (stores user roles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'shipper')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipments table
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_location TEXT NOT NULL,
  delivery_location TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  delivery_date DATE,
  weight NUMERIC,
  dimensions TEXT,
  description TEXT,
  price NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_transit', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offers table
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  notes TEXT,
  estimated_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_offers_shipment_id ON offers(shipment_id);
CREATE INDEX idx_offers_driver_id ON offers(driver_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Shipments policies
CREATE POLICY "Shipments are viewable by everyone" ON shipments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create shipments" ON shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments" ON shipments
  FOR UPDATE USING (auth.uid() = user_id);

-- Offers policies
CREATE POLICY "Offers are viewable by everyone" ON offers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create offers" ON offers
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own offers" ON offers
  FOR UPDATE USING (auth.uid() = driver_id);
```

### 5. Run the Development Server

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
├── server/                    # Backend API
│   ├── src/
│   │   ├── routes/           # API route handlers
│   │   │   ├── auth.js       # Authentication endpoints
│   │   │   ├── bookings.js   # Booking CRUD
│   │   │   ├── invoices.js   # Invoice management
│   │   │   ├── reports.js    # Analytics & reports
│   │   │   └── feedback.js   # User feedback
│   │   ├── index.js          # Express app entry point
│   │   ├── db.js             # PostgreSQL connection pool
│   │   └── mailer.js         # Email service
│   ├── package.json          # Backend dependencies
│   ├── Dockerfile            # Backend container config
│   └── .env.example          # Environment variables template
├── db/
│   ├── schema.sql            # Database schema
│   └── seeds.sql             # Sample data
├── public/                   # Frontend files
│   ├── desktop-signin-final.html    # Login page
│   ├── register-inline.html         # Registration page
│   └── dashboard.html               # Dashboard with charts
├── docker-compose.yml        # Docker orchestration
└── README.md                 # This file
```

## Testing the Application

### 1. Test Registration

1. Open `public/register-inline.html` in your browser
2. Register a new account (choose driver or shipper)
3. Check server logs for verification email link
4. Copy the token from the URL and verify via API or click the link

### 2. Test Login

1. Open `public/desktop-signin-final.html`
2. Login with demo credentials or your verified account
3. You'll be redirected to the dashboard

### 3. Test Dashboard

1. The dashboard loads bookings and reports from the API
2. Use the date range selector to filter data
3. View Chart.js visualizations of gross margin

### 4. Test API Endpoints

Use the curl commands provided in the API Documentation section above.

## Environment Variables

### Backend (.env)

See `server/.env.example` for full template:

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: API server port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens
- `CORS_ORIGIN`: Allowed CORS origin
- `SMTP_*`: Email configuration (optional)

## Production Readiness Checklist

⚠️ **Important**: This is an MVP. Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Configure real SMTP credentials for email
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure proper CORS origins (not '*')
- [ ] Increase bcrypt rounds for production
- [ ] Set up database backups
- [ ] Add request logging and monitoring
- [ ] Implement proper error tracking (e.g., Sentry)
- [ ] Add API authentication middleware
- [ ] Set up rate limiting per user (not just IP)
- [ ] Review and tighten database permissions
- [ ] Add input sanitization for XSS prevention
- [ ] Set up CI/CD pipeline
- [ ] Configure proper environment variables
- [ ] Add comprehensive API tests
- [ ] Set up database migrations
- [ ] Configure proper session management
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Set up log rotation and retention
- [ ] Configure database connection pooling limits

## Docker Support

A `docker-compose.yml` file is provided for containerized deployment. However, there's a known issue with npm package installation in Alpine/Slim containers in the current build environment where npm crashes during installation. 

For production deployment, consider:
- Using a CI/CD pipeline with proper build caching
- Pre-building the node_modules and copying into the container
- Using managed container services that handle dependency installation
- Running PostgreSQL in Docker and the Node.js app natively

The Docker configuration is provided as a reference and works in most environments but may need adjustment based on your infrastructure.

## Known Limitations

- Docker npm installation has issues in current environment (use local development instead)
- Email verification links are logged to console if SMTP not configured
- Demo seed data uses placeholder password hashes (create users via /api/register for testing login)
- No frontend authentication state management (uses localStorage)
- No refresh token implementation
- Limited error handling on frontend
- No pagination on frontend lists
- Chart.js data is not cached
- No WebSocket support for real-time updates

## Troubleshooting

### Backend won't start

```bash
# Check if postgres is running
docker ps

# Check logs
docker logs xdrive-postgres
docker logs xdrive-backend
```

### Database connection error

```bash
# Ensure postgres is healthy
docker-compose ps

# Restart services
docker-compose restart
```

### Seed data fails

```bash
# Ensure schema is loaded first
docker exec -i xdrive-postgres psql -U postgres -d xdrive < db/schema.sql
docker exec -i xdrive-postgres psql -U postgres -d xdrive < db/seeds.sql
```

## Support

For issues or questions, please open an issue on GitHub.

## License

© 2024 XDrive Logistics - Danny Courier LTD

Proprietary software. All rights reserved.

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
