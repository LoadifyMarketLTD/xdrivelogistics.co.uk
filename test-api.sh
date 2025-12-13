#!/bin/bash
# Simple API testing script for XDrive Logistics
# Usage: ./test-api.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3001}"

echo "╔═══════════════════════════════════════╗"
echo "║  XDrive Logistics API Test Suite     ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "Testing API at: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_endpoint() {
  local method="$1"
  local endpoint="$2"
  local description="$3"
  local data="$4"
  
  echo -n "Testing: $description ... "
  
  if [ -z "$data" ]; then
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" -w "\n%{http_code}")
  else
    response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\n%{http_code}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ OK (HTTP $http_code)${NC}"
    [ -n "$VERBOSE" ] && echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}✗ FAIL (HTTP $http_code)${NC}"
    echo "$body"
  fi
  echo ""
}

# Health check
test_endpoint "GET" "/health" "Health check"

# Root endpoint
test_endpoint "GET" "/" "API root"

# Bookings
test_endpoint "GET" "/api/bookings" "Get all bookings"

# Reports
test_endpoint "GET" "/api/reports/gross-margin" "Gross margin report (all time)"
test_endpoint "GET" "/api/reports/gross-margin?from=2025-01-01&to=2025-01-31" "Gross margin report (January 2025)"
test_endpoint "GET" "/api/reports/bookings-by-status" "Bookings by status"

# Invoices
test_endpoint "GET" "/api/invoices" "Get all invoices"

# Feedback
test_endpoint "GET" "/api/feedback" "Get all feedback"

# Authentication (these will fail if user already exists, which is OK for testing)
echo "═══ Authentication Tests ═══"
test_endpoint "POST" "/api/register" "Register new user" \
  '{"account_type":"driver","email":"test-'$(date +%s)'@example.com","password":"password123"}'

test_endpoint "POST" "/api/login" "Login with demo user" \
  '{"email":"shipper@xdrive.test","password":"password123"}'

echo "╔═══════════════════════════════════════╗"
echo "║  Test Suite Complete                  ║"
echo "╚═══════════════════════════════════════╝"
