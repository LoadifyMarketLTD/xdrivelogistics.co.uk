-- XDrive Logistics - Supabase Database Schema
-- Run this SQL in Supabase SQL Editor to set up the database

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
CREATE POLICY "Users can update their own shipments" ON shipments FOR UPDATE USING (auth.uid() = user_id);

-- Policies for offers (everyone can read, authenticated users can create)
CREATE POLICY "Anyone can view offers" ON offers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create offers" ON offers FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Users can update their own offers" ON offers FOR UPDATE USING (auth.uid() = driver_id);

-- Indexes for performance
CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);
CREATE INDEX idx_offers_shipment_id ON offers(shipment_id);
CREATE INDEX idx_offers_driver_id ON offers(driver_id);
CREATE INDEX idx_offers_created_at ON offers(created_at);

-- Optional: Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
