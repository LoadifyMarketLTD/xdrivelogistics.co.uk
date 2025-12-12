# XDrive Logistics - Courier Exchange MVP

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
