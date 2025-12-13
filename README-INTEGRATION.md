# XDrive Logistics - Full Integration MVP

A complete courier exchange platform with Express.js backend, PostgreSQL database, and modern frontend.

## 🚀 Features

- **Authentication System**: Register, login, email verification with JWT
- **Bookings Management**: Full CRUD operations for delivery bookings
- **Invoicing**: Invoice creation and tracking
- **Reports & Analytics**: Gross margin calculation, revenue tracking
- **Feedback System**: User ratings and comments
- **Docker Support**: Complete Docker Compose setup for easy deployment

## 📋 Prerequisites

- Docker and Docker Compose (for containerized setup)
- Node.js 20+ and npm 10+ (for local development)
- PostgreSQL 15+ (if running without Docker)

## 🐳 Quick Start with Docker Compose

The easiest way to run the entire application:

### 1. Clone the Repository

```bash
git clone https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git
cd xdrivelogistics.co.uk
```

### 2. Start the Services

```bash
docker compose up --build
```

This will:
- Start PostgreSQL database on port 5432
- Create the database schema automatically
- Start the backend API server on port 3001
- Set up networking between services

### 3. Seed the Database

In a new terminal, run:

```bash
docker compose exec postgres psql -U xdrive -d xdrive_db -f /docker-entrypoint-initdb.d/01-schema.sql
```

Then seed demo data:

```bash
docker exec -i xdrive_postgres psql -U xdrive -d xdrive_db < db/seeds.sql
```

Or using npm (from server directory):

```bash
cd server
npm run seed
```

### 4. Access the Application

- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/health
- **Frontend Pages**: Open `public/dashboard.html` in your browser

## 📁 Project Structure

```
xdrivelogistics.co.uk/
├── server/                      # Backend API server
│   ├── src/
│   │   ├── index.js            # Main Express app
│   │   ├── db.js               # PostgreSQL connection pool
│   │   ├── mailer.js           # Email service (with console fallback)
│   │   └── routes/
│   │       ├── auth.js         # Authentication endpoints
│   │       ├── bookings.js     # Bookings CRUD
│   │       ├── invoices.js     # Invoice management
│   │       ├── reports.js      # Analytics & reporting
│   │       └── feedback.js     # Feedback system
│   ├── package.json            # Server dependencies
│   ├── Dockerfile              # Server container image
│   └── .env.example            # Environment variables template
├── db/
│   ├── schema.sql              # Database schema
│   └── seeds.sql               # Demo seed data
├── public/                     # Frontend HTML pages
│   ├── desktop-signin-final.html    # Login page
│   ├── register-inline.html         # Registration page
│   └── dashboard.html               # Dashboard with reports
├── docker-compose.yml          # Docker services configuration
└── README.md                   # This file
```

## 🔌 API Endpoints

### Authentication

**Register a new user**
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "driver",
    "email": "driver@example.com",
    "password": "password123"
  }'
```

**Login**
```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "password123"
  }'
```

**Verify Email**
```bash
curl http://localhost:3001/api/verify-email?token=YOUR_TOKEN
```

### Bookings

**List all bookings**
```bash
curl http://localhost:3001/api/bookings
```

**Get a specific booking**
```bash
curl http://localhost:3001/api/bookings/1
```

**Create a booking**
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "load_id": "XD-2024-999",
    "from_address": "London, UK",
    "to_address": "Manchester, UK",
    "vehicle_type": "Luton Van",
    "pickup_date": "2024-12-20",
    "price": 250.00,
    "subcontract_cost": 180.00,
    "status": "pending"
  }'
```

**Update a booking**
```bash
curl -X PUT http://localhost:3001/api/bookings/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "delivered",
    "delivery_date": "2024-12-20"
  }'
```

**Delete a booking**
```bash
curl -X DELETE http://localhost:3001/api/bookings/1
```

### Reports

**Get gross margin report**
```bash
# All time
curl http://localhost:3001/api/reports/gross-margin

# Date range
curl "http://localhost:3001/api/reports/gross-margin?from=2024-12-01&to=2024-12-31"
```

**Get bookings by status**
```bash
curl http://localhost:3001/api/reports/bookings-by-status
```

**Get revenue by month**
```bash
curl http://localhost:3001/api/reports/revenue-by-month
```

### Invoices

**List invoices**
```bash
curl http://localhost:3001/api/invoices
```

**Create an invoice**
```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "invoice_number": "INV-2024-999",
    "amount": 250.00,
    "due_date": "2024-12-31",
    "status": "pending"
  }'
```

### Feedback

**Submit feedback**
```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "rating": 5,
    "comment": "Excellent service!"
  }'
```

**List feedback**
```bash
curl http://localhost:3001/api/feedback
```

## 🗄️ Database Schema

The database includes the following tables:

- **users**: User accounts (drivers and shippers) with authentication
- **bookings**: Delivery bookings with pricing and status
- **invoices**: Invoices linked to bookings
- **feedback**: User ratings and comments
- **watchlist**: Saved routes and partners

## 🔧 Local Development (Without Docker)

### 1. Install PostgreSQL

Install PostgreSQL 15+ locally and create a database:

```bash
createdb xdrive_db
```

### 2. Set Up Database

```bash
psql xdrive_db < db/schema.sql
psql xdrive_db < db/seeds.sql
```

### 3. Install Server Dependencies

```bash
cd server
npm install
```

### 4. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 5. Start the Server

```bash
npm start
# Or for development with auto-reload:
npm run dev
```

### 6. Open Frontend

Open `public/desktop-signin-final.html` or `public/dashboard.html` in your browser.

## 📊 Demo Data

The seed data includes:
- 15 sample bookings with realistic UK addresses
- Multiple delivery statuses (pending, confirmed, in_transit, delivered)
- Price and subcontract cost data for margin calculation
- Sample invoices and feedback entries
- Demo users (passwords are all 'password123' - change in production!)

**Demo Users:**
- `shipper@demo.com` - Shipper account
- `driver@demo.com` - Driver account

## 🔐 Security Notes

- **NEVER commit `.env` files with real secrets**
- Change all default passwords in production
- Use strong JWT secrets
- Enable HTTPS in production
- Configure CORS properly for your domain
- Rate limiting is enabled on auth endpoints
- Email verification tokens expire after 60 minutes

## 📧 Email Configuration

The server supports email verification via SMTP. If SMTP is not configured, verification links will be logged to the console instead of being sent via email.

To configure SMTP, add these to your `.env`:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@xdrivelogistics.co.uk
```

## 🐛 Troubleshooting

**Database connection errors:**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify database credentials

**API not responding:**
- Check if server is running on port 3001
- Look for port conflicts
- Check server logs for errors

**Frontend not connecting to API:**
- Verify API_BASE URL in HTML files
- Check CORS settings in server
- Ensure server is running before opening frontend

**Docker issues:**
```bash
# Stop all services
docker compose down

# Remove volumes and rebuild
docker compose down -v
docker compose up --build
```

## 🧪 Manual Testing

1. **Register a new account**: Open `public/register-inline.html`
2. **Check verification email**: Look in server logs for verification link
3. **Login**: Open `public/desktop-signin-final.html`
4. **View dashboard**: Open `public/dashboard.html`
5. **Test APIs**: Use the curl commands above

## 📝 License

© 2024 XDrive Logistics - Danny Courier LTD

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For issues or questions, please open an issue on GitHub.
