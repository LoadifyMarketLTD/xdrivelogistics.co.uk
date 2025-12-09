# XDrive Logistics Database Schema Diagram

## Table Relationships Overview

```
┌─────────────────┐
│     users       │
│  (9 fields)     │
└────────┬────────┘
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
┌──────────────────┐              ┌──────────────────┐
│ driver_profiles  │              │    addresses     │
│   (23 fields)    │              │   (11 fields)    │
│                  │              └──────────────────┘
│ ⚠️ isVerified   │
└────────┬─────────┘
         │
         ├────────────────┬──────────────────┐
         │                │                  │
         ▼                ▼                  ▼
┌────────────────┐ ┌──────────────┐  ┌─────────────────┐
│driver_documents│ │   vehicles   │  │      jobs       │
│  (10 fields)   │ │ (22 fields)  │  │   (52 fields)   │
└────────────────┘ └──────┬───────┘  │                 │
                          │          │ ⚠️ pickupCountry│
                          │          └────────┬────────┘
                          │                   │
                          └───────────────────┤
                                              │
                                ┌─────────────┼─────────────┐
                                │             │             │
                                ▼             ▼             ▼
                        ┌──────────────┐ ┌─────────┐ ┌──────────┐
                        │tracking_     │ │payments │ │ reviews  │
                        │  updates     │ │(14 flds)│ │(6 fields)│
                        │  (7 fields)  │ └─────────┘ └──────────┘
                        └──────────────┘

                        ┌──────────────────┐
                        │  notifications   │
                        │   (6 fields)     │
                        │                  │
                        │ (linked to users)│
                        └──────────────────┘
```

## Model Details

### 🔵 Core User Models

#### users (9 fields)
- Primary authentication table
- **Key fields**: email, password, role
- **Relations**: 1-to-many with jobs, addresses, payments, notifications
- **1-to-1**: with driver_profiles

#### driver_profiles (23 fields) ⚠️
- **CRITICAL FIELD**: `isVerified` (boolean)
- Extended driver information
- **Key fields**: licenseNumber, rating, availabilityStatus
- **Relations**: 1-to-many with jobs (as driver), vehicles, driver_documents

### 🟢 Logistics Models

#### jobs (52 fields) ⚠️
- **CRITICAL FIELD**: `pickupCountry` (varchar)
- Main delivery job table
- **Pickup fields**: address, city, postcode, country, lat/lng, contact
- **Delivery fields**: address, city, postcode, country, lat/lng, contact
- **Package fields**: type, weight, dimensions, value, fragile
- **Status tracking**: status, priority, timestamps
- **Relations**: belongs to shipper (user), driver (driver_profile), vehicle

#### vehicles (22 fields)
- Vehicle registration and tracking
- **Key fields**: licensePlate, vehicleType, capacity
- **Relations**: belongs to user, optional driver_profile

#### tracking_updates (7 fields)
- Real-time job status updates
- **Key fields**: status, location, lat/lng, notes
- **Relations**: belongs to job

### 🟡 Supporting Models

#### driver_documents (10 fields)
- Document management for drivers
- **Key fields**: documentType, documentUrl, isVerified
- **Relations**: belongs to driver_profile

#### addresses (11 fields)
- Saved addresses for users
- **Key fields**: addressLine1, city, postcode, country
- **Relations**: belongs to user

#### payments (14 fields)
- Payment transaction tracking
- **Key fields**: amount, paymentMethod, paymentStatus
- **Relations**: belongs to user, optional job

#### reviews (6 fields)
- Job reviews and ratings
- **Key fields**: rating, comment, reviewType
- **Relations**: belongs to job

#### notifications (6 fields)
- User notification system
- **Key fields**: title, message, type, isRead
- **Relations**: belongs to user

---

## Field Count by Category

### Location/Geography Fields (18 total)
- jobs: pickupCountry, deliveryCountry, pickupCity, deliveryCity, pickupLatitude, etc.
- driver_profiles: currentLatitude, currentLongitude
- vehicles: currentLatitude, currentLongitude
- addresses: latitude, longitude, country, city
- tracking_updates: latitude, longitude, location

### Status/State Fields (10 total)
- jobs: status, priority
- driver_profiles: isVerified, isAvailable, availabilityStatus
- vehicles: isActive, isAvailable
- payments: paymentStatus
- notifications: isRead

### Timestamp Fields (30+ total)
- All tables: createdAt, updatedAt
- jobs: assignedAt, startedAt, pickedUpAt, completedAt, cancelledAt
- driver_profiles: verifiedAt, lastLocationUpdate
- payments: paidAt, refundedAt
- driver_documents: expiryDate, verifiedAt

---

## Critical Missing Fields (Errors Fixed)

### ❌ ERROR: jobs.pickupCountry does not exist
**✅ FIXED**: Added to jobs table
- Type: VARCHAR
- Required: YES
- Default: 'UK'
- Location in schema: Line ~148

### ❌ ERROR: driver_profiles.isVerified does not exist
**✅ FIXED**: Added to driver_profiles table
- Type: BOOLEAN
- Required: YES
- Default: false
- Location in schema: Line ~69

---

## Database Indexes

### Performance Indexes Created:
1. `jobs_shipperId_idx` - Fast job lookup by shipper
2. `jobs_driverId_idx` - Fast job lookup by driver
3. `jobs_status_idx` - Fast filtering by job status
4. `jobs_createdAt_idx` - Fast sorting by creation date
5. `tracking_updates_jobId_idx` - Fast tracking history lookup
6. `payments_userId_idx` - Fast payment history by user
7. `payments_jobId_idx` - Fast payment lookup by job
8. `reviews_jobId_idx` - Fast review lookup
9. `notifications_userId_idx` - Fast notification lookup
10. `notifications_isRead_idx` - Fast unread notification filtering

---

## Enum Types (12 total)

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

## Data Flow Example

### Creating a New Job:
1. **User (Shipper)** creates a job
   - Required: pickupCountry ✅, pickupAddress, deliveryCountry, deliveryAddress
   - Job status: PENDING

2. **Driver** gets assigned
   - Must have: isVerified = true ✅
   - Job status: ASSIGNED

3. **Vehicle** is linked
   - Must be: isAvailable = true

4. **Tracking Updates** are created
   - Each status change creates a tracking_update record

5. **Payment** is processed
   - Linked to job and user

6. **Review** is created
   - After job completion

7. **Notifications** sent
   - Job assigned, completed, payment received

---

## Total Schema Size

- **Tables**: 10
- **Total Fields**: 160+
- **Relationships**: 15+
- **Indexes**: 10
- **Enums**: 12
- **Foreign Keys**: 14+

---

## SQL Table Sizes (Estimated)

| Table | Fields | Indexes | Est. Row Size |
|-------|--------|---------|---------------|
| users | 9 | 1 (PK) | ~300 bytes |
| driver_profiles | 23 | 1 (PK) | ~600 bytes |
| driver_documents | 10 | 1 (PK) | ~400 bytes |
| vehicles | 22 | 1 (PK) | ~550 bytes |
| jobs | 52 | 5 | ~1.5 KB |
| tracking_updates | 7 | 2 | ~300 bytes |
| addresses | 11 | 1 (PK) | ~400 bytes |
| payments | 14 | 3 | ~450 bytes |
| reviews | 6 | 2 | ~300 bytes |
| notifications | 6 | 3 | ~300 bytes |

---

## Migration Impact

### New Tables Created: 10
All tables will be created from scratch if they don't exist.

### Columns Added to Existing Tables:
If tables already exist, the migration script will add missing columns using safe ALTER TABLE statements.

### Data Integrity:
- Foreign keys with CASCADE deletes where appropriate
- SET NULL for optional relationships
- Default values for all non-nullable fields

---

## ⚡ Quick Stats

- **10** database tables
- **160+** total fields
- **12** enum types (60+ enum values)
- **10** performance indexes
- **2** critical missing fields identified and fixed
- **15+** foreign key relationships
- **100%** coverage of logistics operations

---

This schema provides complete coverage for a logistics/delivery platform! 🚀
