# XDrive Logistics - Courier Exchange MVP

A modern courier exchange platform with:
- Next.js 16 frontend (optional)
- Node.js/Express backend API
- PostgreSQL database
- Static HTML demo pages for testing
- Docker Compose for local development

## Features

- 🔐 Authentication (Register, Login with email verification)
- 📦 Bookings Management (CRUD operations for loads/deliveries)
- 💰 Financial Reports (Gross margin, subcontract spend)
- 📊 Dashboard with real-time statistics
- 🚚 Multi-role support (Driver, Shipper)
- 🎨 Modern premium UI with dark theme
- 🐳 Docker Compose for easy local setup

## Quick Start with Docker Compose (Recommended)

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

## Prerequisites

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
├── app/
│   ├── api/              # API routes (shipments, offers)
│   ├── dashboard/        # User dashboard
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── shipments/        # Shipments listing and details
│   ├── layout.jsx        # Root layout
│   └── page.jsx          # Home page
├── components/
│   ├── header.jsx        # Auth-aware header
│   ├── footer.jsx        # Footer
│   ├── ShipmentCard.jsx  # Shipment card component
│   └── OfferForm.jsx     # Offer creation form
├── lib/
│   └── supabaseClient.js # Supabase client configuration
└── styles/
    └── globals.css       # Global styles
```

## License

© 2024 XDrive Logistics - Danny Courier LTD
This repository contains the source code for the XDrive Logistics courier exchange platform.

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
