-- XDrive Logistics Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('driver', 'shipper')),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
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
  pickup_window_start TIMESTAMP WITH TIME ZONE,
  pickup_window_end TIMESTAMP WITH TIME ZONE,
  delivery_time TIMESTAMP WITH TIME ZONE,
  delivery_instruction TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'Pending', 'confirmed', 'in_transit', 'In Transit', 'delivered', 'Delivered', 'completed', 'cancelled', 'subcontracted', 'allocated')),
  price DECIMAL(10, 2),
  subcontract_cost DECIMAL(10, 2),
  subcontractor VARCHAR(255),
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
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_booking_id_idx ON invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_booking_id_idx ON feedback (booking_id);

-- Watchlist table (for compliance tracking)
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS watchlist_booking_id_idx ON watchlist (booking_id);
