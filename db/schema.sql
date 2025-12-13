-- XDrive Logistics Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
-- PostgreSQL 12+

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('driver', 'shipper')),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  verify_token VARCHAR(128),
  verify_token_expires TIMESTAMP,
  verify_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  load_id VARCHAR(50),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  pickup_window_start TIMESTAMP,
  pickup_window_end TIMESTAMP,
  delivery_instruction TEXT,
  subcontractor VARCHAR(255),
  price NUMERIC(10, 2),
  subcontract_cost NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'Pending',
  completed_by VARCHAR(255),
-- Index for fast email lookup
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

-- Bookings/Loads table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  load_id VARCHAR(50) UNIQUE,
  customer_name VARCHAR(255),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  vehicle_type VARCHAR(100),
  pickup_time TIMESTAMP WITH TIME ZONE,
  delivery_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'completed', 'cancelled', 'subcontracted', 'allocated')),
  price DECIMAL(10, 2),
  subcontract_cost DECIMAL(10, 2),
  completed_by VARCHAR(255),
  your_ref VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_load_id_idx ON bookings (load_id);
CREATE INDEX IF NOT EXISTS bookings_pickup_start_idx ON bookings (pickup_window_start);
-- Indexes for bookings
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_load_id_idx ON bookings (load_id);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'overdue')),
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS invoices_booking_id_idx ON invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_booking_id_idx ON feedback (booking_id);
CREATE INDEX IF NOT EXISTS feedback_rating_idx ON feedback (rating);

-- Watchlist table (for tracking favorite bookings/drivers)
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS watchlist_booking_id_idx ON watchlist (booking_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts (drivers and shippers)';
COMMENT ON TABLE bookings IS 'Delivery bookings with pricing and subcontractor information';
COMMENT ON TABLE invoices IS 'Invoices linked to bookings';
COMMENT ON TABLE feedback IS 'Customer feedback and ratings';
COMMENT ON TABLE watchlist IS 'User watchlist for tracking specific bookings';
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  payment_rating VARCHAR(20) CHECK (payment_rating IN ('definitely', 'maybe', 'not_use')),
  delivery_rating VARCHAR(20) CHECK (delivery_rating IN ('definitely', 'maybe', 'not_use')),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS feedback_from_user_idx ON feedback (from_user_id);
CREATE INDEX IF NOT EXISTS feedback_to_user_idx ON feedback (to_user_id);

-- Watchlist table (compliance tracking)
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  watched_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, watched_user_id)
);

-- Indexes for watchlist
CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS watchlist_watched_user_id_idx ON watchlist (watched_user_id);

-- Comments
COMMENT ON TABLE users IS 'User accounts (drivers and shippers)';
COMMENT ON TABLE bookings IS 'Booking/load records';
COMMENT ON TABLE invoices IS 'Invoice records linked to bookings';
COMMENT ON TABLE feedback IS 'User feedback and ratings';
COMMENT ON TABLE watchlist IS 'Compliance watchlist for monitoring suppliers';
