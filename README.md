# XDrive Logistics - Courier Exchange MVP

A modern courier exchange platform built with Next.js 16 and Supabase, enabling shippers to post delivery requests and drivers to make offers.

## Features

- 🔐 Authentication (Login/Register with email/password)
- 📦 Shipment Management (Create, list, and view shipments)
- 💰 Offer System (Drivers can make offers on shipments)
- 👥 Role-based Access (Shipper vs Driver views)
- 🎨 Modern UI with Tailwind CSS

## Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- A Supabase account (free tier works fine)

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [https://app.supabase.com](https://app.supabase.com)
2. Get your project URL and anon key from Project Settings > API
3. Get your service role key from Project Settings > API (keep this secret!)

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. Create Database Tables

Run the following SQL in your Supabase SQL Editor:

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
