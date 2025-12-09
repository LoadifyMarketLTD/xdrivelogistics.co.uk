# XDrive Logistics - Prisma Schema and Missing Database Columns

## Problem Summary

The live application was experiencing errors due to missing database columns:
- `Invalid prisma.job.findMany(): The column jobs.pickupCountry does not exist`
- `Invalid prisma.driverProfile.findMany(): The column driver_profiles.isVerified does not exist`
- And other similar missing-column errors

## Solution Provided

This repository now includes a complete Prisma schema and migration documentation to resolve all missing column errors.

### Files Added/Updated:

1. **`prisma/schema.prisma`** - Complete Prisma schema with all models and fields
2. **`MISSING_DATABASE_COLUMNS.md`** - Detailed documentation of all required columns
3. **`MIGRATION.sql`** - SQL migration script to add missing columns and tables
4. **`README_SOLUTION.md`** - This file

---

## Complete List of Models and Tables

The Prisma schema now includes the following models:

### Core Models:
1. **User** (`users`) - User authentication and profile
2. **DriverProfile** (`driver_profiles`) - Driver-specific information and verification
3. **DriverDocument** (`driver_documents`) - Driver documentation and licenses
4. **Vehicle** (`vehicles`) - Vehicle information and tracking
5. **Job** (`jobs`) - Delivery job information and tracking
6. **TrackingUpdate** (`tracking_updates`) - Real-time job tracking updates

### Supporting Models:
7. **Address** (`addresses`) - User saved addresses
8. **Payment** (`payments`) - Payment transactions
9. **Review** (`reviews`) - Job reviews and ratings
10. **Notification** (`notifications`) - User notifications

---

## Critical Missing Fields (From Error Messages)

### `jobs` table:
✅ **`pickupCountry`** - VARCHAR, NOT NULL, DEFAULT 'UK'
- Also added: `deliveryCountry`, all location fields, package details, pricing, status tracking

### `driver_profiles` table:
✅ **`isVerified`** - BOOLEAN, NOT NULL, DEFAULT false
- Also added: verification timestamps, ratings, availability, location tracking, documents

---

## All Model Fields by Table

### 1. Users Table (`users`)
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String (CUID) | Yes | cuid() | Primary key |
| email | String | Yes | - | Unique email |
| name | String | No | null | Full name |
| password | String | Yes | - | Hashed password |
| role | Enum (UserRole) | Yes | SHIPPER | User role |
| phone | String | No | null | Phone number |
| emailVerified | Boolean | Yes | false | Email verified |
| createdAt | DateTime | Yes | now() | Created timestamp |
| updatedAt | DateTime | Yes | now() | Updated timestamp |

**Relations:**
- shippedJobs → Job[]
- driverProfile → DriverProfile (optional)
- vehicles → Vehicle[]
- addresses → Address[]
- payments → Payment[]
- notifications → Notification[]

---

### 2. Driver Profiles Table (`driver_profiles`)
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String (CUID) | Yes | cuid() | Primary key |
| userId | String | Yes | - | Foreign key to users |
| licenseNumber | String | Yes | - | Unique license number |
| licenseExpiry | DateTime | Yes | - | License expiration |
| licenseType | String | Yes | - | Type of license |
| **isVerified** | **Boolean** | **Yes** | **false** | **Verification status** |
| verifiedAt | DateTime | No | null | Verified timestamp |
| rating | Float | Yes | 0 | Driver rating (0-5) |
| totalJobs | Int | Yes | 0 | Total jobs completed |
| yearsExperience | Int | No | null | Years of experience |
| dateOfBirth | DateTime | No | null | Date of birth |
| insuranceNumber | String | No | null | Insurance number |
| insuranceExpiry | DateTime | No | null | Insurance expiration |
| insuranceProvider | String | No | null | Insurance provider |
| isAvailable | Boolean | Yes | true | Availability status |
| availabilityStatus | Enum | Yes | OFFLINE | Current status |
| currentLatitude | Float | No | null | Current GPS latitude |
| currentLongitude | Float | No | null | Current GPS longitude |
| lastLocationUpdate | DateTime | No | null | Last location update |
| preferredRadius | Int | No | null | Preferred job radius (km) |
| preferredVehicle | String | No | null | Preferred vehicle type |
| createdAt | DateTime | Yes | now() | Created timestamp |
| updatedAt | DateTime | Yes | now() | Updated timestamp |

**Relations:**
- user → User
- assignedJobs → Job[]
- vehicles → Vehicle[]
- driverDocuments → DriverDocument[]

---

### 3. Vehicles Table (`vehicles`)
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String (CUID) | Yes | cuid() | Primary key |
| userId | String | Yes | - | Foreign key to users |
| driverProfileId | String | No | null | Foreign key to driver_profiles |
| make | String | Yes | - | Vehicle manufacturer |
| model | String | Yes | - | Vehicle model |
| year | Int | Yes | - | Manufacturing year |
| color | String | No | null | Vehicle color |
| licensePlate | String | Yes | - | Unique license plate |
| vin | String | No | null | Vehicle identification number |
| vehicleType | Enum | Yes | - | Type of vehicle |
| capacity | Float | No | null | Cargo capacity (m³) |
| maxWeight | Float | No | null | Max weight (kg) |
| fuelType | Enum | No | null | Fuel type |
| isActive | Boolean | Yes | true | Active status |
| isAvailable | Boolean | Yes | true | Availability status |
| currentLocation | String | No | null | Current location |
| registrationDate | DateTime | No | null | Registration date |
| insuranceExpiry | DateTime | No | null | Insurance expiration |
| motExpiry | DateTime | No | null | MOT expiration |
| currentLatitude | Float | No | null | Current GPS latitude |
| currentLongitude | Float | No | null | Current GPS longitude |
| createdAt | DateTime | Yes | now() | Created timestamp |
| updatedAt | DateTime | Yes | now() | Updated timestamp |

**Relations:**
- user → User
- driverProfile → DriverProfile (optional)
- jobs → Job[]

---

### 4. Jobs Table (`jobs`) - MAIN TABLE
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | String (CUID) | Yes | cuid() | Primary key |
| shipperId | String | Yes | - | Foreign key to users |
| driverId | String | No | null | Foreign key to driver_profiles |
| vehicleId | String | No | null | Foreign key to vehicles |
| jobNumber | String | Yes | cuid() | Unique job number |
| title | String | Yes | - | Job title |
| description | String | No | null | Job description |
| **pickupAddress** | **String** | **Yes** | **-** | **Pickup street address** |
| **pickupCity** | **String** | **Yes** | **-** | **Pickup city** |
| **pickupPostcode** | **String** | **Yes** | **-** | **Pickup postcode** |
| **pickupCountry** | **String** | **Yes** | **'UK'** | **Pickup country** |
| pickupLatitude | Float | No | null | Pickup GPS latitude |
| pickupLongitude | Float | No | null | Pickup GPS longitude |
| pickupContactName | String | No | null | Pickup contact person |
| pickupContactPhone | String | No | null | Pickup contact phone |
| pickupDate | DateTime | Yes | - | Scheduled pickup date |
| pickupTimeSlot | String | No | null | Pickup time window |
| deliveryAddress | String | Yes | - | Delivery street address |
| deliveryCity | String | Yes | - | Delivery city |
| deliveryPostcode | String | Yes | - | Delivery postcode |
| deliveryCountry | String | Yes | 'UK' | Delivery country |
| deliveryLatitude | Float | No | null | Delivery GPS latitude |
| deliveryLongitude | Float | No | null | Delivery GPS longitude |
| deliveryContactName | String | No | null | Delivery contact person |
| deliveryContactPhone | String | No | null | Delivery contact phone |
| deliveryDate | DateTime | No | null | Delivery date |
| deliveryTimeSlot | String | No | null | Delivery time window |
| packageType | Enum | Yes | PARCEL | Package type |
| weight | Float | No | null | Weight (kg) |
| dimensions | String | No | null | Dimensions (LxWxH cm) |
| quantity | Int | Yes | 1 | Number of items |
| value | Float | No | null | Package value |
| requiresSignature | Boolean | Yes | false | Signature required |
| fragile | Boolean | Yes | false | Fragile package |
| specialInstructions | String | No | null | Special instructions |
| estimatedPrice | Float | No | null | Estimated price |
| finalPrice | Float | No | null | Final price |
| currency | String | Yes | 'GBP' | Currency code |
| status | Enum | Yes | PENDING | Job status |
| priority | Enum | Yes | NORMAL | Job priority |
| estimatedDistance | Float | No | null | Estimated distance (km) |
| estimatedDuration | Int | No | null | Estimated duration (min) |
| actualDistance | Float | No | null | Actual distance (km) |
| actualDuration | Int | No | null | Actual duration (min) |
| assignedAt | DateTime | No | null | Assignment timestamp |
| startedAt | DateTime | No | null | Start timestamp |
| pickedUpAt | DateTime | No | null | Pickup timestamp |
| completedAt | DateTime | No | null | Completion timestamp |
| cancelledAt | DateTime | No | null | Cancellation timestamp |
| cancellationReason | String | No | null | Cancellation reason |
| createdAt | DateTime | Yes | now() | Created timestamp |
| updatedAt | DateTime | Yes | now() | Updated timestamp |

**Relations:**
- shipper → User
- driver → DriverProfile (optional)
- vehicle → Vehicle (optional)
- trackingUpdates → TrackingUpdate[]
- payments → Payment[]
- reviews → Review[]

**Indexes:**
- jobs_shipperId_idx
- jobs_driverId_idx
- jobs_status_idx
- jobs_createdAt_idx

---

### 5. Other Supporting Tables

See `MISSING_DATABASE_COLUMNS.md` for complete details on:
- `driver_documents`
- `tracking_updates`
- `addresses`
- `payments`
- `reviews`
- `notifications`

---

## Enums Defined

1. **UserRole**: ADMIN, DRIVER, SHIPPER, OPERATOR
2. **DriverStatus**: ONLINE, OFFLINE, BUSY, ON_BREAK
3. **DocumentType**: LICENSE, INSURANCE, ID_CARD, VEHICLE_REGISTRATION, MOT_CERTIFICATE, BACKGROUND_CHECK, OTHER
4. **VehicleType**: VAN, TRUCK, LORRY, CARGO_VAN, BOX_TRUCK, FLATBED, REFRIGERATED, MOTORCYCLE, BICYCLE
5. **FuelType**: PETROL, DIESEL, ELECTRIC, HYBRID, LPG
6. **JobStatus**: PENDING, ASSIGNED, ACCEPTED, IN_PROGRESS, PICKED_UP, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, FAILED
7. **JobPriority**: LOW, NORMAL, HIGH, URGENT
8. **PackageType**: PARCEL, DOCUMENT, FURNITURE, ELECTRONICS, FOOD, FRAGILE, BULK, PALLETIZED, OTHER
9. **PaymentMethod**: CARD, BANK_TRANSFER, CASH, PAYPAL, STRIPE, WALLET
10. **PaymentStatus**: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, CANCELLED
11. **ReviewType**: DRIVER_TO_SHIPPER, SHIPPER_TO_DRIVER
12. **NotificationType**: JOB_ASSIGNED, JOB_ACCEPTED, JOB_COMPLETED, JOB_CANCELLED, PAYMENT_RECEIVED, PAYMENT_FAILED, DOCUMENT_EXPIRING, SYSTEM

---

## How to Apply This Schema to Your Neon Database

### Option 1: Using Prisma Migrate (Recommended)

1. Install Prisma (if not already installed):
   ```bash
   npm install prisma @prisma/client
   ```

2. Update your `.env` file with Neon database connection:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
   ```

3. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name complete_schema
   ```

4. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```

### Option 2: Manual SQL Execution

1. Open your Neon database console
2. Execute the SQL script from `MIGRATION.sql`
3. Run `npx prisma generate` to generate the client

### Option 3: Database Push (Development Only)

```bash
npx prisma db push
```

**⚠️ Warning**: This syncs without creating migrations. Use only for development.

---

## Verification After Migration

### 1. Check All Tables Exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 2. Verify Critical Missing Fields:
```sql
-- Check jobs.pickupCountry exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'pickupCountry';

-- Check driver_profiles.isVerified exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_profiles' AND column_name = 'isVerified';
```

### 3. Test Prisma Queries:
```javascript
// Test jobs query
const jobs = await prisma.job.findMany({
  where: { pickupCountry: 'UK' }
});

// Test driver profiles query
const drivers = await prisma.driverProfile.findMany({
  where: { isVerified: true }
});
```

---

## Next Steps

1. ✅ Review the complete Prisma schema (`prisma/schema.prisma`)
2. ✅ Check the missing columns documentation (`MISSING_DATABASE_COLUMNS.md`)
3. ✅ Choose your migration method (Prisma Migrate, SQL script, or DB Push)
4. ⬜ Backup your current Neon database before applying changes
5. ⬜ Apply the migration to your Neon database
6. ⬜ Test the application to ensure no more missing column errors
7. ⬜ Update your application code to use the new fields

---

## Important Notes

- **Backup First**: Always backup your database before running migrations
- **Review ENUMs**: Make sure the enum values match your application logic
- **Foreign Keys**: The schema includes cascading deletes where appropriate
- **Indexes**: Performance indexes are included for frequently queried fields
- **Defaults**: Sensible defaults are set for most fields
- **CUID**: Uses collision-resistant unique IDs instead of auto-incrementing integers

---

## Support

If you encounter any issues:
1. Check the error message for specific column names
2. Verify the column exists in `MISSING_DATABASE_COLUMNS.md`
3. Run the verification queries above
4. Check Prisma schema syntax with `npx prisma format`

---

## Files Reference

- **`prisma/schema.prisma`** - Complete Prisma schema
- **`MISSING_DATABASE_COLUMNS.md`** - Detailed column documentation
- **`MIGRATION.sql`** - SQL migration script
- **`README_SOLUTION.md`** - This documentation (you are here)
