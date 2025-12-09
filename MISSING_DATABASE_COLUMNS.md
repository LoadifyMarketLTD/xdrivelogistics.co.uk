# Missing Database Columns - XDrive Logistics

This document lists all the Prisma schema fields that the application expects but may not exist in the current PostgreSQL database.

## Overview

Based on the errors reported:
- `jobs.pickupCountry does not exist`
- `driver_profiles.isVerified does not exist`

This comprehensive list ensures all required columns are added to the Neon PostgreSQL database.

---

## Table: `users`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `email` | VARCHAR | NO | - | Unique email address |
| `name` | VARCHAR | YES | NULL | User's full name |
| `password` | VARCHAR | NO | - | Hashed password |
| `role` | ENUM | NO | 'SHIPPER' | User role (ADMIN, DRIVER, SHIPPER, OPERATOR) |
| `phone` | VARCHAR | YES | NULL | Phone number |
| `emailVerified` | BOOLEAN | NO | false | Email verification status |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `UserRole`
- ADMIN
- DRIVER
- SHIPPER
- OPERATOR

---

## Table: `driver_profiles`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `userId` | VARCHAR | NO | - | Foreign key to users.id (UNIQUE) |
| `licenseNumber` | VARCHAR | NO | - | Unique driver license number |
| `licenseExpiry` | TIMESTAMP | NO | - | License expiration date |
| `licenseType` | VARCHAR | NO | - | Type of license |
| `isVerified` | BOOLEAN | NO | false | **MISSING - Driver verification status** |
| `verifiedAt` | TIMESTAMP | YES | NULL | Verification timestamp |
| `rating` | DECIMAL/FLOAT | NO | 0 | Driver rating (0-5) |
| `totalJobs` | INTEGER | NO | 0 | Total completed jobs |
| `yearsExperience` | INTEGER | YES | NULL | Years of driving experience |
| `dateOfBirth` | TIMESTAMP | YES | NULL | Driver's date of birth |
| `insuranceNumber` | VARCHAR | YES | NULL | Insurance policy number |
| `insuranceExpiry` | TIMESTAMP | YES | NULL | Insurance expiration date |
| `insuranceProvider` | VARCHAR | YES | NULL | Insurance company name |
| `isAvailable` | BOOLEAN | NO | true | Driver availability |
| `availabilityStatus` | ENUM | NO | 'OFFLINE' | Current status (ONLINE, OFFLINE, BUSY, ON_BREAK) |
| `currentLatitude` | DECIMAL/FLOAT | YES | NULL | Current GPS latitude |
| `currentLongitude` | DECIMAL/FLOAT | YES | NULL | Current GPS longitude |
| `lastLocationUpdate` | TIMESTAMP | YES | NULL | Last location update time |
| `preferredRadius` | INTEGER | YES | NULL | Preferred job radius in km |
| `preferredVehicle` | VARCHAR | YES | NULL | Preferred vehicle type |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `DriverStatus`
- ONLINE
- OFFLINE
- BUSY
- ON_BREAK

---

## Table: `driver_documents`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `driverProfileId` | VARCHAR | NO | - | Foreign key to driver_profiles.id |
| `documentType` | ENUM | NO | - | Type of document |
| `documentUrl` | VARCHAR | NO | - | URL to stored document |
| `documentNumber` | VARCHAR | YES | NULL | Document reference number |
| `expiryDate` | TIMESTAMP | YES | NULL | Document expiration date |
| `isVerified` | BOOLEAN | NO | false | Document verification status |
| `verifiedAt` | TIMESTAMP | YES | NULL | Verification timestamp |
| `verifiedBy` | VARCHAR | YES | NULL | Admin who verified |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `DocumentType`
- LICENSE
- INSURANCE
- ID_CARD
- VEHICLE_REGISTRATION
- MOT_CERTIFICATE
- BACKGROUND_CHECK
- OTHER

---

## Table: `vehicles`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `userId` | VARCHAR | NO | - | Foreign key to users.id |
| `driverProfileId` | VARCHAR | YES | NULL | Foreign key to driver_profiles.id |
| `make` | VARCHAR | NO | - | Vehicle manufacturer |
| `model` | VARCHAR | NO | - | Vehicle model |
| `year` | INTEGER | NO | - | Manufacturing year |
| `color` | VARCHAR | YES | NULL | Vehicle color |
| `licensePlate` | VARCHAR | NO | - | Unique license plate number |
| `vin` | VARCHAR | YES | NULL | Vehicle identification number (UNIQUE) |
| `vehicleType` | ENUM | NO | - | Type of vehicle |
| `capacity` | DECIMAL/FLOAT | YES | NULL | Cargo capacity in cubic meters |
| `maxWeight` | DECIMAL/FLOAT | YES | NULL | Max weight in kg |
| `fuelType` | ENUM | YES | NULL | Fuel type |
| `isActive` | BOOLEAN | NO | true | Vehicle active status |
| `isAvailable` | BOOLEAN | NO | true | Vehicle availability |
| `currentLocation` | VARCHAR | YES | NULL | Current location description |
| `registrationDate` | TIMESTAMP | YES | NULL | Vehicle registration date |
| `insuranceExpiry` | TIMESTAMP | YES | NULL | Insurance expiration |
| `motExpiry` | TIMESTAMP | YES | NULL | MOT certificate expiration |
| `currentLatitude` | DECIMAL/FLOAT | YES | NULL | Current GPS latitude |
| `currentLongitude` | DECIMAL/FLOAT | YES | NULL | Current GPS longitude |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `VehicleType`
- VAN
- TRUCK
- LORRY
- CARGO_VAN
- BOX_TRUCK
- FLATBED
- REFRIGERATED
- MOTORCYCLE
- BICYCLE

### Enum: `FuelType`
- PETROL
- DIESEL
- ELECTRIC
- HYBRID
- LPG

---

## Table: `jobs`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `shipperId` | VARCHAR | NO | - | Foreign key to users.id |
| `driverId` | VARCHAR | YES | NULL | Foreign key to driver_profiles.id |
| `vehicleId` | VARCHAR | YES | NULL | Foreign key to vehicles.id |
| `jobNumber` | VARCHAR | NO | cuid() | Unique job reference number |
| `title` | VARCHAR | NO | - | Job title |
| `description` | TEXT | YES | NULL | Job description |
| `pickupAddress` | VARCHAR | NO | - | Pickup street address |
| `pickupCity` | VARCHAR | NO | - | Pickup city |
| `pickupPostcode` | VARCHAR | NO | - | Pickup postal code |
| `pickupCountry` | VARCHAR | NO | 'UK' | **MISSING - Pickup country** |
| `pickupLatitude` | DECIMAL/FLOAT | YES | NULL | Pickup GPS latitude |
| `pickupLongitude` | DECIMAL/FLOAT | YES | NULL | Pickup GPS longitude |
| `pickupContactName` | VARCHAR | YES | NULL | Pickup contact person |
| `pickupContactPhone` | VARCHAR | YES | NULL | Pickup contact phone |
| `pickupDate` | TIMESTAMP | NO | - | Scheduled pickup date/time |
| `pickupTimeSlot` | VARCHAR | YES | NULL | Pickup time window |
| `deliveryAddress` | VARCHAR | NO | - | Delivery street address |
| `deliveryCity` | VARCHAR | NO | - | Delivery city |
| `deliveryPostcode` | VARCHAR | NO | - | Delivery postal code |
| `deliveryCountry` | VARCHAR | NO | 'UK' | Delivery country |
| `deliveryLatitude` | DECIMAL/FLOAT | YES | NULL | Delivery GPS latitude |
| `deliveryLongitude` | DECIMAL/FLOAT | YES | NULL | Delivery GPS longitude |
| `deliveryContactName` | VARCHAR | YES | NULL | Delivery contact person |
| `deliveryContactPhone` | VARCHAR | YES | NULL | Delivery contact phone |
| `deliveryDate` | TIMESTAMP | YES | NULL | Scheduled/actual delivery date/time |
| `deliveryTimeSlot` | VARCHAR | YES | NULL | Delivery time window |
| `packageType` | ENUM | NO | 'PARCEL' | Type of package |
| `weight` | DECIMAL/FLOAT | YES | NULL | Package weight in kg |
| `dimensions` | VARCHAR | YES | NULL | Package dimensions (LxWxH cm) |
| `quantity` | INTEGER | NO | 1 | Number of items |
| `value` | DECIMAL/FLOAT | YES | NULL | Package value |
| `requiresSignature` | BOOLEAN | NO | false | Signature required flag |
| `fragile` | BOOLEAN | NO | false | Fragile package flag |
| `specialInstructions` | TEXT | YES | NULL | Special handling instructions |
| `estimatedPrice` | DECIMAL/FLOAT | YES | NULL | Estimated job price |
| `finalPrice` | DECIMAL/FLOAT | YES | NULL | Final job price |
| `currency` | VARCHAR | NO | 'GBP' | Currency code |
| `status` | ENUM | NO | 'PENDING' | Current job status |
| `priority` | ENUM | NO | 'NORMAL' | Job priority level |
| `estimatedDistance` | DECIMAL/FLOAT | YES | NULL | Estimated distance in km |
| `estimatedDuration` | INTEGER | YES | NULL | Estimated duration in minutes |
| `actualDistance` | DECIMAL/FLOAT | YES | NULL | Actual distance traveled |
| `actualDuration` | INTEGER | YES | NULL | Actual duration in minutes |
| `assignedAt` | TIMESTAMP | YES | NULL | Driver assignment timestamp |
| `startedAt` | TIMESTAMP | YES | NULL | Job start timestamp |
| `pickedUpAt` | TIMESTAMP | YES | NULL | Package pickup timestamp |
| `completedAt` | TIMESTAMP | YES | NULL | Job completion timestamp |
| `cancelledAt` | TIMESTAMP | YES | NULL | Cancellation timestamp |
| `cancellationReason` | TEXT | YES | NULL | Reason for cancellation |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `JobStatus`
- PENDING
- ASSIGNED
- ACCEPTED
- IN_PROGRESS
- PICKED_UP
- IN_TRANSIT
- DELIVERED
- COMPLETED
- CANCELLED
- FAILED

### Enum: `JobPriority`
- LOW
- NORMAL
- HIGH
- URGENT

### Enum: `PackageType`
- PARCEL
- DOCUMENT
- FURNITURE
- ELECTRONICS
- FOOD
- FRAGILE
- BULK
- PALLETIZED
- OTHER

### Indexes:
- `jobs_shipperId_idx` on `shipperId`
- `jobs_driverId_idx` on `driverId`
- `jobs_status_idx` on `status`
- `jobs_createdAt_idx` on `createdAt`

---

## Table: `tracking_updates`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `jobId` | VARCHAR | NO | - | Foreign key to jobs.id |
| `status` | ENUM | NO | - | Job status at this update |
| `location` | VARCHAR | YES | NULL | Location description |
| `latitude` | DECIMAL/FLOAT | YES | NULL | GPS latitude |
| `longitude` | DECIMAL/FLOAT | YES | NULL | GPS longitude |
| `notes` | TEXT | YES | NULL | Update notes |
| `createdAt` | TIMESTAMP | NO | now() | Update timestamp |

### Indexes:
- `tracking_updates_jobId_idx` on `jobId`

---

## Table: `addresses`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `userId` | VARCHAR | NO | - | Foreign key to users.id |
| `label` | VARCHAR | YES | NULL | Address label (e.g., "Home", "Office") |
| `addressLine1` | VARCHAR | NO | - | Street address line 1 |
| `addressLine2` | VARCHAR | YES | NULL | Street address line 2 |
| `city` | VARCHAR | NO | - | City |
| `postcode` | VARCHAR | NO | - | Postal code |
| `country` | VARCHAR | NO | 'UK' | Country |
| `latitude` | DECIMAL/FLOAT | YES | NULL | GPS latitude |
| `longitude` | DECIMAL/FLOAT | YES | NULL | GPS longitude |
| `isDefault` | BOOLEAN | NO | false | Default address flag |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

---

## Table: `payments`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `userId` | VARCHAR | NO | - | Foreign key to users.id |
| `jobId` | VARCHAR | YES | NULL | Foreign key to jobs.id |
| `amount` | DECIMAL/FLOAT | NO | - | Payment amount |
| `currency` | VARCHAR | NO | 'GBP' | Currency code |
| `paymentMethod` | ENUM | NO | - | Payment method used |
| `paymentStatus` | ENUM | NO | 'PENDING' | Payment status |
| `stripePaymentId` | VARCHAR | YES | NULL | Stripe payment ID (UNIQUE) |
| `stripeInvoiceId` | VARCHAR | YES | NULL | Stripe invoice ID |
| `paidAt` | TIMESTAMP | YES | NULL | Payment completion timestamp |
| `refundedAt` | TIMESTAMP | YES | NULL | Refund timestamp |
| `refundAmount` | DECIMAL/FLOAT | YES | NULL | Refunded amount |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `PaymentMethod`
- CARD
- BANK_TRANSFER
- CASH
- PAYPAL
- STRIPE
- WALLET

### Enum: `PaymentStatus`
- PENDING
- PROCESSING
- COMPLETED
- FAILED
- REFUNDED
- CANCELLED

### Indexes:
- `payments_userId_idx` on `userId`
- `payments_jobId_idx` on `jobId`

---

## Table: `reviews`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `jobId` | VARCHAR | NO | - | Foreign key to jobs.id |
| `rating` | INTEGER | NO | - | Rating (1-5) |
| `comment` | TEXT | YES | NULL | Review comment |
| `reviewType` | ENUM | NO | - | Type of review |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NO | now() | Last update timestamp |

### Enum: `ReviewType`
- DRIVER_TO_SHIPPER
- SHIPPER_TO_DRIVER

### Indexes:
- `reviews_jobId_idx` on `jobId`

---

## Table: `notifications`

### Required Columns:
| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | VARCHAR (CUID) | NO | cuid() | Primary key |
| `userId` | VARCHAR | NO | - | Foreign key to users.id |
| `title` | VARCHAR | NO | - | Notification title |
| `message` | VARCHAR | NO | - | Notification message |
| `type` | ENUM | NO | - | Notification type |
| `isRead` | BOOLEAN | NO | false | Read status |
| `createdAt` | TIMESTAMP | NO | now() | Creation timestamp |

### Enum: `NotificationType`
- JOB_ASSIGNED
- JOB_ACCEPTED
- JOB_COMPLETED
- JOB_CANCELLED
- PAYMENT_RECEIVED
- PAYMENT_FAILED
- DOCUMENT_EXPIRING
- SYSTEM

### Indexes:
- `notifications_userId_idx` on `userId`
- `notifications_isRead_idx` on `isRead`

---

## Summary of Key Missing Fields

Based on the errors reported, these are the critical missing columns:

### `jobs` table:
- ✅ **`pickupCountry`** - VARCHAR, NOT NULL, DEFAULT 'UK'

### `driver_profiles` table:
- ✅ **`isVerified`** - BOOLEAN, NOT NULL, DEFAULT false

### Additional Important Fields Likely Missing:
- All fields in newly created tables: `driver_documents`, `tracking_updates`, `addresses`, `payments`, `reviews`, `notifications`
- Many fields in existing tables that weren't originally created

---

## Migration Instructions

### Option 1: Using Prisma Migrate (Recommended)

1. Update your `.env` file with the correct `DATABASE_URL` for Neon
2. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_all_missing_fields
   ```

### Option 2: Manual SQL Migration

If you prefer to add columns manually to Neon, use the SQL migration script provided in `MIGRATION.sql`.

### Option 3: Using Prisma DB Push (For Development)

```bash
npx prisma db push
```

**⚠️ Warning**: This will sync your database schema without creating migrations. Use only for development.

---

## Verification Steps

After applying the migration:

1. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```

2. Verify the schema matches the database:
   ```bash
   npx prisma db pull
   ```

3. Test queries in your application to ensure no more "column does not exist" errors

---

## Notes

- All `id` fields use CUID (Collision-resistant Unique Identifier) for better distribution
- Timestamps use PostgreSQL `TIMESTAMP` type with timezone support
- Enums are implemented as PostgreSQL ENUM types
- Foreign key constraints include `onDelete: Cascade` where appropriate
- Indexes are added for frequently queried fields

---

## Contact

For questions or issues with the migration, please contact the development team.
