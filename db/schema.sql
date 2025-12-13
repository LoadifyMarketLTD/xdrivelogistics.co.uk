-- XDrive Logistics Database Schema
-- PostgreSQL 12+

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('driver', 'shipper')),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  verify_token VARCHAR(128),
  verify_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_load_id_idx ON bookings (load_id);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
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
