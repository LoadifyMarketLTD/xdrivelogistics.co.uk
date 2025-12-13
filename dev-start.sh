#!/bin/bash
# Development startup script for XDrive Logistics
# This script helps start the development environment

set -e

echo "╔═══════════════════════════════════════╗"
echo "║  XDrive Logistics - Dev Environment   ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "🐳 Starting Docker services..."
echo ""

# Start services
docker compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if backend is healthy
echo ""
echo "🔍 Checking backend health..."
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✅ Backend is healthy!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend failed to start. Check logs with: docker compose logs backend"
        exit 1
    fi
    echo "   Waiting... ($i/10)"
    sleep 2
done

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║  Services Running                     ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "📊 Backend API:  http://localhost:3001"
echo "🗄️  PostgreSQL:   localhost:5432"
echo "📖 API Docs:     http://localhost:3001/"
echo ""
echo "Demo Users:"
echo "  • shipper@xdrive.test / password123"
echo "  • driver@xdrive.test / password123"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f backend    # View backend logs"
echo "  docker compose logs -f postgres   # View database logs"
echo "  docker compose down               # Stop all services"
echo "  ./test-api.sh                     # Run API tests"
echo ""
echo "Frontend pages (if serving public/):"
echo "  • Login:      /public/desktop-signin-final.html"
echo "  • Register:   /public/register-inline.html"
echo "  • Dashboard:  /public/dashboard.html"
echo ""
