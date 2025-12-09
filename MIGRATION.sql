-- XDrive Logistics Database Migration Script
-- This script creates all tables and columns required by the Prisma schema
-- Run this script in your Neon PostgreSQL database

-- WARNING: Review this script before running it in production
-- It creates new tables and may modify existing ones

-- ============================================================================
-- STEP 1: Create ENUM Types
-- ============================================================================

-- Drop existing enums if they exist (use with caution)
-- DROP TYPE IF EXISTS "UserRole" CASCADE;
-- DROP TYPE IF EXISTS "DriverStatus" CASCADE;
-- DROP TYPE IF EXISTS "DocumentType" CASCADE;
-- DROP TYPE IF EXISTS "VehicleType" CASCADE;
-- DROP TYPE IF EXISTS "FuelType" CASCADE;
-- DROP TYPE IF EXISTS "JobStatus" CASCADE;
-- DROP TYPE IF EXISTS "JobPriority" CASCADE;
-- DROP TYPE IF EXISTS "PackageType" CASCADE;
-- DROP TYPE IF EXISTS "PaymentMethod" CASCADE;
-- DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
-- DROP TYPE IF EXISTS "ReviewType" CASCADE;
-- DROP TYPE IF EXISTS "NotificationType" CASCADE;

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DRIVER', 'SHIPPER', 'OPERATOR');
CREATE TYPE "DriverStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY', 'ON_BREAK');
CREATE TYPE "DocumentType" AS ENUM ('LICENSE', 'INSURANCE', 'ID_CARD', 'VEHICLE_REGISTRATION', 'MOT_CERTIFICATE', 'BACKGROUND_CHECK', 'OTHER');
CREATE TYPE "VehicleType" AS ENUM ('VAN', 'TRUCK', 'LORRY', 'CARGO_VAN', 'BOX_TRUCK', 'FLATBED', 'REFRIGERATED', 'MOTORCYCLE', 'BICYCLE');
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "PackageType" AS ENUM ('PARCEL', 'DOCUMENT', 'FURNITURE', 'ELECTRONICS', 'FOOD', 'FRAGILE', 'BULK', 'PALLETIZED', 'OTHER');
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'CASH', 'PAYPAL', 'STRIPE', 'WALLET');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "ReviewType" AS ENUM ('DRIVER_TO_SHIPPER', 'SHIPPER_TO_DRIVER');
CREATE TYPE "NotificationType" AS ENUM ('JOB_ASSIGNED', 'JOB_ACCEPTED', 'JOB_COMPLETED', 'JOB_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'DOCUMENT_EXPIRING', 'SYSTEM');

-- ============================================================================
-- STEP 2: Create Tables
-- ============================================================================

-- Table: users
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SHIPPER',
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Table: driver_profiles
CREATE TABLE IF NOT EXISTS "driver_profiles" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT UNIQUE NOT NULL,
    "licenseNumber" TEXT UNIQUE NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "licenseType" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "yearsExperience" INTEGER,
    "dateOfBirth" TIMESTAMP(3),
    "insuranceNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "insuranceProvider" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availabilityStatus" "DriverStatus" NOT NULL DEFAULT 'OFFLINE',
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "lastLocationUpdate" TIMESTAMP(3),
    "preferredRadius" INTEGER,
    "preferredVehicle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: driver_documents
CREATE TABLE IF NOT EXISTS "driver_documents" (
    "id" TEXT PRIMARY KEY,
    "driverProfileId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "driver_documents_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: vehicles
CREATE TABLE IF NOT EXISTS "vehicles" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "driverProfileId" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "licensePlate" TEXT UNIQUE NOT NULL,
    "vin" TEXT UNIQUE,
    "vehicleType" "VehicleType" NOT NULL,
    "capacity" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "fuelType" "FuelType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "currentLocation" TEXT,
    "registrationDate" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "motExpiry" TIMESTAMP(3),
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicles_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Table: jobs
CREATE TABLE IF NOT EXISTS "jobs" (
    "id" TEXT PRIMARY KEY,
    "shipperId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "jobNumber" TEXT UNIQUE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pickupAddress" TEXT NOT NULL,
    "pickupCity" TEXT NOT NULL,
    "pickupPostcode" TEXT NOT NULL,
    "pickupCountry" TEXT NOT NULL DEFAULT 'UK',
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "pickupContactName" TEXT,
    "pickupContactPhone" TEXT,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "pickupTimeSlot" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryPostcode" TEXT NOT NULL,
    "deliveryCountry" TEXT NOT NULL DEFAULT 'UK',
    "deliveryLatitude" DOUBLE PRECISION,
    "deliveryLongitude" DOUBLE PRECISION,
    "deliveryContactName" TEXT,
    "deliveryContactPhone" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryTimeSlot" TEXT,
    "packageType" "PackageType" NOT NULL DEFAULT 'PARCEL',
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "value" DOUBLE PRECISION,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "fragile" BOOLEAN NOT NULL DEFAULT false,
    "specialInstructions" TEXT,
    "estimatedPrice" DOUBLE PRECISION,
    "finalPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "estimatedDistance" DOUBLE PRECISION,
    "estimatedDuration" INTEGER,
    "actualDistance" DOUBLE PRECISION,
    "actualDuration" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "jobs_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Table: tracking_updates
CREATE TABLE IF NOT EXISTS "tracking_updates" (
    "id" TEXT PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tracking_updates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: addresses
CREATE TABLE IF NOT EXISTS "addresses" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'UK',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: payments
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentId" TEXT UNIQUE,
    "stripeInvoiceId" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Table: reviews
CREATE TABLE IF NOT EXISTS "reviews" (
    "id" TEXT PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewType" "ReviewType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================================
-- STEP 3: Add Missing Columns to Existing Tables
-- ============================================================================

-- If tables already exist, use ALTER TABLE to add missing columns
-- Uncomment and modify as needed based on your existing schema

-- For jobs table - add pickupCountry if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'pickupCountry'
    ) THEN
        ALTER TABLE "jobs" ADD COLUMN "pickupCountry" TEXT NOT NULL DEFAULT 'UK';
    END IF;
END $$;

-- For driver_profiles table - add isVerified if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'driver_profiles' AND column_name = 'isVerified'
    ) THEN
        ALTER TABLE "driver_profiles" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add other potentially missing columns for jobs table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'deliveryCountry') THEN
        ALTER TABLE "jobs" ADD COLUMN "deliveryCountry" TEXT NOT NULL DEFAULT 'UK';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'packageType') THEN
        ALTER TABLE "jobs" ADD COLUMN "packageType" "PackageType" NOT NULL DEFAULT 'PARCEL';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'status') THEN
        ALTER TABLE "jobs" ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'PENDING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'priority') THEN
        ALTER TABLE "jobs" ADD COLUMN "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create Indexes for Performance
-- ============================================================================

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS "jobs_shipperId_idx" ON "jobs"("shipperId");
CREATE INDEX IF NOT EXISTS "jobs_driverId_idx" ON "jobs"("driverId");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs"("status");
CREATE INDEX IF NOT EXISTS "jobs_createdAt_idx" ON "jobs"("createdAt");

-- Tracking updates indexes
CREATE INDEX IF NOT EXISTS "tracking_updates_jobId_idx" ON "tracking_updates"("jobId");

-- Payments indexes
CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments"("userId");
CREATE INDEX IF NOT EXISTS "payments_jobId_idx" ON "payments"("jobId");

-- Reviews indexes
CREATE INDEX IF NOT EXISTS "reviews_jobId_idx" ON "reviews"("jobId");

-- Notifications indexes
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX IF NOT EXISTS "notifications_isRead_idx" ON "notifications"("isRead");

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 'driver_profiles', 'driver_documents', 'vehicles', 
    'jobs', 'tracking_updates', 'addresses', 'payments', 
    'reviews', 'notifications'
  )
ORDER BY table_name;

-- Check columns in jobs table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position;

-- Check columns in driver_profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'driver_profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- After running this script, run:
-- npx prisma generate
-- to regenerate the Prisma Client
