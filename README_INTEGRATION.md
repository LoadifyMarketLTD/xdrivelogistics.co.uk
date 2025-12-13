# XDrive Logistics - Full Integration MVP

A complete courier exchange platform with backend API, PostgreSQL database, and frontend dashboard.

## Features

- 🔐 **Authentication** - User registration with email verification (bcrypt password hashing)
- 📦 **Bookings Management** - Full CRUD operations for delivery bookings
- 💰 **Reports & Analytics** - Gross margin calculation and subcontract spend tracking
- 🧾 **Invoicing** - Invoice management linked to bookings
- 📊 **Dashboard** - Interactive dashboard with Chart.js visualizations
- 🔒 **Security** - Rate limiting, CORS, helmet middleware
- 🐳 **Docker** - Containerized PostgreSQL and backend services

## Architecture

```
├── server/                 # Backend API (Express + Node.js)
│   ├── src/
│   │   ├── index.js       # Main server entry point
│   │   ├── db.js          # PostgreSQL connection pool
│   │   ├── mailer.js      # Email service (with log fallback)
│   │   └── routes/        # API route handlers
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── db/                     # Database files
│   ├── schema.sql         # Table definitions
│   └── seeds.sql          # Demo data
├── public/                 # Frontend static files
│   ├── desktop-signin-final.html
│   ├── register-inline.html
│   └── dashboard.html
└── docker-compose.yml      # Docker orchestration
```

## Prerequisites

- **Docker** 20.10+ and Docker Compose 2.0+
- **Node.js** 20+ (if running without Docker)
- **PostgreSQL** 15+ (if running without Docker)

## Quick Start with Docker

### 1. Clone the repository

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk
```

### 2. Start the services

```bash
docker compose up --build
```

This will:
- Start PostgreSQL on port 5432
- Create database schema and seed demo data
- Start backend API on port 3001

### 3. Verify the services

**Health check:**
```bash
curl http://localhost:3001/health
```

**API root:**
```bash
curl http://localhost:3001/
```

### 4. Test the API endpoints

**Get all bookings:**
```bash
curl http://localhost:3001/api/bookings
```

**Get gross margin report:**
```bash
curl http://localhost:3001/api/reports/gross-margin
```

**Get gross margin for date range:**
```bash
curl "http://localhost:3001/api/reports/gross-margin?from=2025-01-01&to=2025-01-31"
```

**Register a new user:**
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shipper@xdrive.test",
    "password": "password123"
  }'
```

### 5. Access the frontend

Open your browser and navigate to:

- **Login:** `http://localhost:3000/public/desktop-signin-final.html`
- **Register:** `http://localhost:3000/public/register-inline.html`
- **Dashboard:** `http://localhost:3000/public/dashboard.html`

> **Note:** For frontend to work, you'll need to serve the public directory or integrate with your Next.js app.

## Manual Setup (Without Docker)

### 1. Install PostgreSQL

Install PostgreSQL 15+ and create a database:

```bash
createdb xdrive_db
```

### 2. Setup database

```bash
psql xdrive_db -f db/schema.sql
psql xdrive_db -f db/seeds.sql
```

### 3. Install backend dependencies

```bash
cd server
npm install
```

### 4. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and update the DATABASE_URL:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/xdrive_db
```

### 5. Start the backend server

```bash
cd server
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login with email/password |
| GET | `/api/verify-email?token=xxx` | Verify email address |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List all bookings |
| GET | `/api/bookings/:id` | Get single booking |
| POST | `/api/bookings` | Create new booking |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Delete booking |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/gross-margin` | Calculate gross margin |
| GET | `/api/reports/bookings-by-status` | Bookings grouped by status |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices |
| GET | `/api/invoices/:id` | Get single invoice |
| POST | `/api/invoices` | Create new invoice |
| PUT | `/api/invoices/:id` | Update invoice |

### Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feedback` | List all feedback |
| GET | `/api/feedback/:id` | Get single feedback |
| POST | `/api/feedback` | Create new feedback |

## Database Schema

### Users
- Stores user accounts (drivers and shippers)
- Email verification tokens
- Password hashing with bcrypt

### Bookings
- Delivery bookings with pricing
- Status tracking (pending, confirmed, in_transit, delivered, cancelled)
- Price and subcontract cost for margin calculation

### Invoices
- Linked to bookings
- Track payment status

### Feedback
- User ratings and comments
- Linked to users and bookings

### Watchlist
- Users can track favorite routes and partners

## Demo Data

The seed file includes:
- 3 demo users (shipper@xdrive.test, driver@xdrive.test, john.driver@xdrive.test)
- 18 bookings (15 delivered, 3 pending/in-transit)
- 10 invoices
- 5 feedback entries
- All demo accounts use password: `password123`

### Gross Margin Calculation

The demo data shows:
- **Total Bookings:** 15 delivered
- **Total Revenue:** £3,450.00
- **Subcontract Spend:** £2,425.00
- **Gross Margin:** £1,025.00

## Email Verification

The backend includes nodemailer integration with **log fallback mode** for development:

- When SMTP is **not configured**, verification links are logged to console instead of sent via email
- In production, configure SMTP settings in `.env`
- Verification tokens expire in 60 minutes (configurable)

### Development Mode Example

When a user registers, you'll see output like:

```
═══════════════════════════════════════
📧 EMAIL VERIFICATION (DEV MODE)
═══════════════════════════════════════
To: test@example.com
Verification Link: http://localhost:3000/verify-email?token=abc123...
═══════════════════════════════════════
```

## Security Features

- ✅ Password hashing with bcrypt (10 rounds default)
- ✅ Rate limiting on auth endpoints (10 requests/minute)
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ SQL injection protection (parameterized queries)
- ✅ Email verification for new accounts

## Development

### Watch mode (auto-reload)

```bash
cd server
npm run dev
```

### Database management

**Reset database:**
```bash
psql xdrive_db -f db/schema.sql
psql xdrive_db -f db/seeds.sql
```

**Connect to database:**
```bash
psql xdrive_db
```

### Logs

Docker logs:
```bash
docker compose logs -f backend
docker compose logs -f postgres
```

## Production Deployment

### Environment Variables

See `server/.env.example` and `env.prod.example` for all required variables.

**Critical production settings:**

1. **Database:** Use managed PostgreSQL (Neon, Supabase, AWS RDS, etc.)
2. **SMTP:** Configure real email service (SendGrid, Mailgun, AWS SES, etc.)
3. **Secrets:** Use secret manager (never commit `.env` files)
4. **CORS:** Set `CORS_ORIGIN` to your frontend domain
5. **JWT_SECRET:** Generate a strong random secret
6. **BCRYPT_ROUNDS:** Use 12+ for production

### Docker Production Build

Update `docker-compose.yml` for production:
- Use environment-specific `.env` files
- Add restart policies
- Configure SSL/TLS
- Setup reverse proxy (nginx)

## Troubleshooting

### Database connection errors

```bash
# Check PostgreSQL is running
docker compose ps

# Check database logs
docker compose logs postgres

# Verify connection string
echo $DATABASE_URL
```

### Port conflicts

If ports 3001 or 5432 are in use, update `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Use different host port
  postgres:
    ports:
      - "5433:5432"  # Use different host port
```

### Email not sending

The backend uses **log mode** by default when SMTP is not configured. This is intentional for development. Check console logs for verification links.

## Testing

### Manual Testing Steps

1. ✅ Start services: `docker compose up --build`
2. ✅ Check health: `curl http://localhost:3001/health`
3. ✅ Get bookings: `curl http://localhost:3001/api/bookings`
4. ✅ Calculate margins: `curl http://localhost:3001/api/reports/gross-margin`
5. ✅ Register user: Use curl command above
6. ✅ Login user: Use curl command above
7. ✅ Open frontend pages in browser

## What's Included

✅ Backend API with Express  
✅ PostgreSQL database with schema  
✅ Demo seed data (15 delivered bookings)  
✅ Docker Compose configuration  
✅ Authentication with email verification  
✅ CRUD operations for bookings  
✅ Gross margin calculation endpoint  
✅ Invoice management  
✅ Feedback system  
✅ Frontend HTML pages (login, register, dashboard)  
✅ Chart.js integration in dashboard  
✅ Rate limiting and security middleware  
✅ Email service with log fallback  

## What Remains for Production

⚠️ **Authentication:** Implement JWT tokens and session management  
⚠️ **Authorization:** Add user ownership checks and role-based access control  
⚠️ **Validation:** Add comprehensive input validation (e.g., express-validator)  
⚠️ **Testing:** Add unit and integration tests  
⚠️ **Monitoring:** Add logging (Winston), error tracking (Sentry)  
⚠️ **API Documentation:** Add OpenAPI/Swagger docs  
⚠️ **File Uploads:** Handle document/image uploads  
⚠️ **Real-time:** Add WebSocket for live updates  
⚠️ **Caching:** Implement Redis for performance  
⚠️ **CI/CD:** Setup automated testing and deployment  

## License

© 2024 XDrive Logistics - Danny Courier LTD

## Support

For issues or questions, please open an issue on GitHub.
