# XDrive Logistics - Courier Exchange MVP

This repository contains the source code for the XDrive Logistics courier exchange application, built with Next.js 16 and Supabase.

## Features

- **Authentication**: User registration and login with Supabase Auth
- **Role-based Access**: Separate flows for shippers and drivers
- **Shipments Management**: Create, view, and manage shipment requests
- **Offers System**: Drivers can submit offers on open shipments
- **RESTful API**: Server-side API routes for data operations

## Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Supabase** account and project

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon/Public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`) - **Keep this secret!**

### 4. Create Database Tables

In your Supabase project, go to the SQL Editor and run the following:

```sql
-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  origin text NOT NULL,
  destination text NOT NULL,
  price_estimate numeric,
  status text DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id),
  price numeric NOT NULL,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipments
CREATE POLICY "Shipments are viewable by everyone" ON shipments
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own shipments" ON shipments
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own shipments" ON shipments
  FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for offers
CREATE POLICY "Offers are viewable by everyone" ON offers
  FOR SELECT USING (true);

CREATE POLICY "Drivers can create offers" ON offers
  FOR INSERT WITH CHECK (auth.uid() = driver_id);
```

### 5. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```env
# Supabase Configuration (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Mapbox (for maps)
NEXT_PUBLIC_MAPBOX_TOKEN=

# Optional: Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
```

**Important**: Never commit `.env.local` to version control. The `.gitignore` file is already configured to exclude it.

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Netlify

1. Push your code to GitHub
2. Connect repository in Netlify
3. Set build command: `npm run build`
4. Add environment variables in Netlify dashboard
5. Deploy

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── shipments/    # Shipment endpoints
│   │   └── offers/       # Offer endpoints
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── dashboard/        # User dashboard
│   └── shipments/        # Shipment pages
├── components/            # React components
│   ├── ShipmentCard.jsx
│   ├── OfferForm.jsx
│   └── header.jsx
├── lib/                   # Utilities
│   └── supabaseClient.js # Supabase client setup
└── styles/               # Global styles
```

## Security Notes

- **SERVICE_ROLE_KEY**: This key bypasses Row Level Security. Never expose it client-side or commit it to version control.
- **RLS Policies**: Ensure proper Row Level Security policies are in place in Supabase to protect your data.
- **Authentication**: All API routes that modify data require authentication via Bearer token.

## User Roles

- **Shipper**: Can create shipments and view offers on their shipments
- **Driver**: Can browse shipments and submit offers

Roles are stored in `user_metadata.role` during registration.

## API Routes

- `GET /api/shipments` - List shipments
- `POST /api/shipments` - Create shipment (auth required)
- `GET /api/shipments/[id]` - Get shipment details with offers
- `GET /api/offers` - List offers
- `POST /api/offers` - Create offer (auth required, driver role only)

## License

Private - LoadifyMarketLTD
