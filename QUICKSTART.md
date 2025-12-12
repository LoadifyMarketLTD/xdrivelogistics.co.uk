# XDrive Logistics - Quick Start Guide

This guide will help you get the application running locally in 5 minutes.

## Prerequisites

- Node.js 20+ ([Download](https://nodejs.org/))
- A Supabase account ([Sign up](https://supabase.com))

## Step 1: Clone and Install

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk
npm install
```

## Step 2: Set Up Supabase

1. **Create a new project** at [https://app.supabase.com](https://app.supabase.com)
   - Choose a project name (e.g., "xdrive-logistics")
   - Set a secure database password
   - Select a region close to you

2. **Run the database schema**
   - Go to SQL Editor in your Supabase project
   - Copy the contents of `supabase-schema.sql`
   - Paste and click "Run"

3. **Get your API keys**
   - Go to Settings > API
   - Find your:
     - Project URL (e.g., `https://xxxxx.supabase.co`)
     - `anon` / `public` key
     - `service_role` key (⚠️ keep this secret!)

## Step 3: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 4: Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 5: Test the Features

1. **Register** at `/register`
   - Create an account as a Driver or Shipper
   - Check your email for confirmation (if email auth is enabled)

2. **Login** at `/login`
   - Use your credentials to sign in

3. **View Dashboard** at `/dashboard`
   - See your shipments (if shipper) or available loads (if driver)

4. **Browse Shipments** at `/shipments`
   - View all available shipments

5. **Create Offers** (as Driver)
   - Click on a shipment
   - Submit your price and notes

## Common Issues

### Build fails with "supabaseUrl is required"
- Make sure `.env.local` exists and has valid values
- The build uses placeholder values if env vars are missing (this is normal)

### Can't see tables in Supabase
- Make sure you ran the `supabase-schema.sql` in SQL Editor
- Check Table Editor in Supabase dashboard

### Authentication not working
- Verify your Supabase URL and keys in `.env.local`
- Check if email confirmation is required in Supabase Auth settings
- For development, disable email confirmation in Supabase

### Pages not loading
- Clear your browser cache
- Check browser console for errors
- Verify the dev server is running

## What's Next?

- Customize the UI in the `app/` and `components/` directories
- Add more features to the API routes in `app/api/`
- Deploy to Vercel or Netlify (see README.md)
- Add Mapbox integration for route visualization
- Implement Stripe payments for completed deliveries

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the [Supabase Documentation](https://supabase.com/docs)
- Review the [Next.js Documentation](https://nextjs.org/docs)
