-- PostgreSQL schema for users table (basic)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL, -- 'driver' or 'shipper'
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, active, disabled
  verify_token VARCHAR(128),
  verify_token_expires TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- index on email for fast lookup
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
