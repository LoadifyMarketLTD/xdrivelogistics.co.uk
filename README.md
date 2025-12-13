# XDrive Logistics - Full Integration MVP

A comprehensive courier exchange platform with backend API, PostgreSQL database, and modern frontend. This MVP includes user authentication, booking management, invoicing, reporting, and feedback systems.

## Features

- 🔐 **Authentication**: Email/password registration with email verification
- 📦 **Booking Management**: Full CRUD operations for delivery bookings
- 💰 **Financial Reporting**: Gross margin and subcontract spend analytics
- 📊 **Dashboard**: Real-time metrics with Chart.js visualizations
- 📧 **Email Notifications**: Verification emails (configurable SMTP or console logging)
- 🔒 **Security**: Bcrypt password hashing, JWT tokens, rate limiting, CORS
- 🗄️ **Database**: PostgreSQL with proper schema and seed data
- 🐳 **Docker**: Complete containerized setup with docker-compose

## Prerequisites

- Node.js 18 or higher
- Docker and Docker Compose
- npm 8 or higher
- PostgreSQL 14+ (if running without Docker)

## Quick Start with Docker (Recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk
```

### 2. Start Services with Docker Compose

```bash
docker-compose up --build
```

This will:
- Start PostgreSQL database on port 5432
- Create database schema automatically
- Start backend API on port 3001
- Install all dependencies

### 3. Seed the Database

In a new terminal:

```bash
# Wait for postgres to be ready (check logs for "database system is ready")
# Then seed the database
docker exec -i xdrive-postgres psql -U postgres -d xdrive < db/seeds.sql
```

Or using npm script:

```bash
cd server
npm run seed
```

### 4. Access the Application

- **Frontend**: Open `public/desktop-signin-final.html` in your browser
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Database**: localhost:5432 (postgres/postgres)

### Demo Credentials

```
Email: demo@demo.com
Password: password123
```

Note: Email verification is disabled for demo users. For new registrations, check console logs for verification links.

## API Documentation

### Authentication Endpoints

#### Register New User

```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "driver@example.com",
    "password": "password123",
    "full_name": "John Doe",
    "company_name": "Fast Delivery Co"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@demo.com",
    "password": "password123"
  }'
```

Response includes JWT token:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "driver@demo.com",
    "account_type": "driver"
  }
}
```

#### Verify Email

```bash
curl "http://localhost:3001/api/verify-email?token=YOUR_TOKEN_HERE"
```

### Bookings Endpoints

#### List All Bookings

```bash
curl "http://localhost:3001/api/bookings?status=delivered&limit=10"
```

#### Get Single Booking

```bash
curl "http://localhost:3001/api/bookings/1"
```

#### Create Booking

```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "load_id": "LOAD-123",
    "from_address": "London, UK",
    "to_address": "Manchester, UK",
    "vehicle_type": "Van",
    "pickup_date": "2024-12-15",
    "delivery_date": "2024-12-15",
    "status": "pending",
    "price": 450.00,
    "subcontract_cost": 320.00
  }'
```

#### Update Booking

```bash
curl -X PUT http://localhost:3001/api/bookings/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "completed_by": "John Driver"
  }'
```

### Reports Endpoints

#### Gross Margin Report

```bash
curl "http://localhost:3001/api/reports/gross-margin?from=2024-12-01&to=2024-12-31"
```

Response:
```json
{
  "period": {
    "from": "2024-12-01",
    "to": "2024-12-31"
  },
  "summary": {
    "total_bookings": 18,
    "total_revenue": 7890.00,
    "subcontract_spend": 5760.00,
    "gross_margin_total": 2130.00,
    "avg_margin_per_booking": 118.33,
    "margin_percentage": 26.99
  }
}
```

### Invoices Endpoints

```bash
# List invoices
curl "http://localhost:3001/api/invoices?status=pending"

# Create invoice
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "invoice_number": "INV-2024-100",
    "amount": 450.00,
    "due_date": "2024-12-31"
  }'
```

### Feedback Endpoints

```bash
# Submit feedback
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "rating": 5,
    "comment": "Excellent service!",
    "feedback_type": "booking"
  }'
```

## Manual Setup (Without Docker)

### 4. Create Database Tables

Run the schema SQL:

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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Register** - Create an account as either a Driver or Shipper
2. **Login** - Sign in with your credentials
3. **Shippers**: Create shipments with pickup/delivery details and wait for driver offers
4. **Drivers**: Browse available shipments and make offers with your price

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add your environment variables in Project Settings
4. Deploy!

### Netlify

Update `netlify.toml` if needed:

```toml
[build]
  command = "npm run build"
  
[build.environment]
  NODE_VERSION = "20.12.2"
```

Then deploy via Netlify UI or CLI.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS
- **Deployment**: Vercel or Netlify

## Project Structure

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

## Known Limitations

- Email verification links are logged to console if SMTP not configured
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

## Features

- 🔐 Supabase authentication (email/password)
- 📦 Shipment management (create, list, view)
- 💰 Driver offers system
- 👤 Role-based access (Shipper/Driver)
- 🎨 Modern UI with Tailwind CSS

## Local Development Setup

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- Supabase account ([sign up here](https://supabase.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
   cd xdrivelogistics.co.uk
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. **Get your Supabase credentials**
   
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Create a new project (or use existing)
   - Go to Settings > API
   - Copy the following values to your `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - anon/public key
     - `SUPABASE_SERVICE_ROLE_KEY` - service_role key (keep this secret!)

5. **Create database tables**

   Go to your Supabase project > SQL Editor and run the following SQL:

   ```sql
   -- Users table (extended with Supabase Auth)
   -- Supabase Auth handles the main users table, we just add metadata
   
   -- Shipments table
   CREATE TABLE shipments (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES auth.users(id),
     pickup_location TEXT NOT NULL,
     delivery_location TEXT NOT NULL,
     pickup_date TIMESTAMP NOT NULL,
     cargo_type TEXT DEFAULT 'general',
     weight DECIMAL DEFAULT 0,
     status TEXT DEFAULT 'pending',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Offers table
   CREATE TABLE offers (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
     driver_id UUID NOT NULL REFERENCES auth.users(id),
     price DECIMAL NOT NULL,
     notes TEXT,
     status TEXT DEFAULT 'pending',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

   -- Policies for shipments (everyone can read, authenticated users can create)
   CREATE POLICY "Anyone can view shipments" ON shipments FOR SELECT USING (true);
   CREATE POLICY "Authenticated users can create shipments" ON shipments FOR INSERT WITH CHECK (auth.uid() = user_id);

   -- Policies for offers (everyone can read, authenticated users can create)
   CREATE POLICY "Anyone can view offers" ON offers FOR SELECT USING (true);
   CREATE POLICY "Authenticated users can create offers" ON offers FOR INSERT WITH CHECK (auth.uid() = driver_id);

   -- Indexes for performance
   CREATE INDEX idx_shipments_user_id ON shipments(user_id);
   CREATE INDEX idx_shipments_status ON shipments(status);
   CREATE INDEX idx_offers_shipment_id ON offers(shipment_id);
   CREATE INDEX idx_offers_driver_id ON offers(driver_id);
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── shipments/         # Shipment API endpoints
│   │   └── offers/            # Offer API endpoints
│   ├── login/                 # Login page
│   ├── register/              # Registration page
│   ├── dashboard/             # User dashboard
│   ├── shipments/             # Shipments list & detail pages
│   ├── layout.jsx             # Root layout
│   └── page.jsx               # Home page
├── components/
│   ├── ShipmentCard.jsx       # Shipment card component
│   ├── OfferForm.jsx          # Offer submission form
│   └── header.jsx             # Navigation header
├── lib/
│   └── supabaseClient.js      # Supabase client setup
└── .env.example               # Example environment variables
```

## Deployment

### Recommended: Vercel

1. Push your code to GitHub
2. Import your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Alternative: Netlify

1. Update `netlify.toml` if needed
2. Connect your repository to Netlify
3. Add environment variables in Netlify dashboard
4. Deploy!

**Note:** This project requires Node.js 20 or higher.

## Build Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Security Notes

- Never commit `.env.local` to git
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret (server-side only)
- Use environment variables for all sensitive data
- Enable Row Level Security (RLS) in Supabase for production

## Contributing

Please create a new branch for each feature and submit a pull request for review.

## License

Proprietary - © Danny Courier LTD
